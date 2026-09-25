<?php

declare(strict_types=1);

namespace App\Services;

use App\Http\Resources\ProductResource;
use App\Models\OperationalExpense;
use App\Models\Product;
use App\Models\Transaction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Isi ketiga laporan (penjualan, laba rugi, stok).
 *
 * Dipakai bersama oleh tampilan JSON dan unduhan PDF/Excel, sehingga angka di
 * layar dan di berkas unduhan dihitung oleh kode yang sama -- tidak mungkin
 * berbeda.
 *
 * Seluruh laporan hanya menghitung transaksi berstatus `settlement`. Transaksi
 * `pending` berarti pelanggan belum membayar, sehingga memasukkannya akan
 * melaporkan pendapatan yang belum tentu diterima.
 */
final class LaporanService
{
    /**
     * Sampai sepanjang ini tren dirinci per hari; lebih panjang dari itu per
     * bulan. 62 hari ≈ dua bulan: batang harian masih terbaca, sedangkan satu
     * tahun per hari (365 titik) hanya menjadi derau.
     */
    public const BATAS_TREN_HARIAN = 62;

    public function __construct(private readonly PengaturanToko $pengaturan) {}

    /* ------------------------------------------------------------ penjualan */

    /**
     * @return array<string, mixed>
     */
    public function penjualan(Carbon $dari, Carbon $sampai): array
    {
        $harian = $this->rekapHarian($dari, $sampai);

        $ringkasan = [
            'jumlah_transaksi' => (int) $harian->sum('jumlah_transaksi'),
            'subtotal' => (int) $harian->sum('subtotal'),
            'diskon' => (int) $harian->sum('diskon'),
            'pajak' => (int) $harian->sum('pajak'),
            'total' => (int) $harian->sum('total'),
        ];

        // Periode pembanding: panjangnya sama, tepat sebelum periode ini.
        $hari = $this->jumlahHari($dari, $sampai);
        $dariLalu = $dari->copy()->subDays($hari)->startOfDay();
        $sampaiLalu = $dari->copy()->subDay()->endOfDay();
        $lalu = Transaction::query()->lunas()
            ->whereBetween('tanggal', [$dariLalu, $sampaiLalu])
            ->selectRaw('COUNT(*) as jumlah_transaksi')
            ->selectRaw('COALESCE(SUM(total), 0) as total')
            ->first();

        $totalLalu = (int) ($lalu->total ?? 0);

        return [
            'periode' => ['dari' => $dari->toDateString(), 'sampai' => $sampai->toDateString(), 'jumlah_hari' => $hari],
            'ringkasan' => $ringkasan + [
                'rata_rata_transaksi' => $ringkasan['jumlah_transaksi'] > 0
                    ? (int) round($ringkasan['total'] / $ringkasan['jumlah_transaksi'])
                    : 0,
            ],
            'pembanding' => [
                'dari' => $dariLalu->toDateString(),
                'sampai' => $sampaiLalu->toDateString(),
                'jumlah_transaksi' => (int) ($lalu->jumlah_transaksi ?? 0),
                'total' => $totalLalu,
                // null bila periode lalu kosong: "naik ∞%" tidak bermakna.
                'perubahan_persen' => $totalLalu > 0
                    ? round(($ringkasan['total'] - $totalLalu) / $totalLalu * 100, 1)
                    : null,
            ],
            'tren' => $this->tren($dari, $sampai, $harian),
            'harian' => $harian->values()->all(),
        ];
    }

    /**
     * Rekap per hari, HANYA hari yang ada penjualannya.
     *
     * @return Collection<int, array{tanggal_str: string, jumlah_transaksi: int, subtotal: int, diskon: int, pajak: int, total: int}>
     */
    private function rekapHarian(Carbon $dari, Carbon $sampai): Collection
    {
        return Transaction::query()
            ->lunas()
            ->whereBetween('tanggal', [$dari, $sampai])
            // Alias tidak boleh bernama `tanggal`: akan tertimpa cast datetime
            // milik model (lihat catatan Fase 6 di IMPLEMENTASI.md).
            ->selectRaw('DATE(tanggal) as tanggal_str')
            ->selectRaw('COUNT(*) as jumlah_transaksi')
            ->selectRaw('SUM(subtotal) as subtotal')
            ->selectRaw('SUM(diskon) as diskon')
            ->selectRaw('SUM(pajak) as pajak')
            ->selectRaw('SUM(total) as total')
            ->groupBy('tanggal_str')
            ->orderBy('tanggal_str')
            ->toBase()
            ->get()
            ->map(static fn (object $r): array => [
                'tanggal_str' => (string) $r->tanggal_str,
                'jumlah_transaksi' => (int) $r->jumlah_transaksi,
                'subtotal' => (int) $r->subtotal,
                'diskon' => (int) $r->diskon,
                'pajak' => (int) $r->pajak,
                'total' => (int) $r->total,
            ]);
    }

    /**
     * Deret tren yang RAPAT: hari (atau bulan) tanpa penjualan tetap ada
     * dengan nilai nol. Tanpa itu, garis tren melompati hari sepi dan
     * menggambarkan penjualan yang tidak pernah terjadi.
     *
     * @param  Collection<int, array{tanggal_str: string, jumlah_transaksi: int, subtotal: int, diskon: int, pajak: int, total: int}>  $harian
     * @return array{satuan: 'hari'|'bulan', titik: list<array{kunci: string, mulai: string, jumlah_transaksi: int, total: int}>}
     */
    private function tren(Carbon $dari, Carbon $sampai, Collection $harian): array
    {
        $perHari = $harian->keyBy('tanggal_str');
        $bulanan = $this->jumlahHari($dari, $sampai) > self::BATAS_TREN_HARIAN;

        $titik = [];
        $kursor = $dari->copy()->startOfDay();
        $akhir = $sampai->copy()->startOfDay();

        while ($kursor->lte($akhir)) {
            $kunci = $bulanan ? $kursor->format('Y-m') : $kursor->toDateString();
            $h = $perHari->get($kursor->toDateString());

            $titik[$kunci] ??= ['kunci' => $kunci, 'mulai' => $kursor->toDateString(), 'jumlah_transaksi' => 0, 'total' => 0];
            if ($h !== null) {
                $titik[$kunci]['jumlah_transaksi'] += $h['jumlah_transaksi'];
                $titik[$kunci]['total'] += $h['total'];
            }

            $kursor->addDay();
        }

        return ['satuan' => $bulanan ? 'bulan' : 'hari', 'titik' => array_values($titik)];
    }

    /* ------------------------------------------------------------ laba rugi */

    /**
     * Laba rugi lengkap sampai laba bersih.
     *
     * Harga pokok dibaca dari POTRET `transaction_items.harga_beli`, yaitu harga
     * modal pada saat penjualan terjadi -- bukan harga modal saat ini. Beban
     * operasional disimpan per BULAN lalu diprorata sesuai panjang periode.
     * Biaya MDR dihitung dari nilai transaksi non-tunai yang lunas.
     *
     * @return array{periode: array{dari: string, sampai: string, jumlah_hari: int}, unit_terjual: int, pendapatan_kotor: int, diskon: int, penjualan_bersih: int, harga_pokok_penjualan: int, laba_kotor: int, margin_kotor: float, beban: array{operasional: int, mdr: int, total: int, rincian: list<array{nama: string, jumlah_bulanan: int, jumlah_periode: int}>, nilai_non_tunai: int, tarif_mdr: float}, laba_bersih: int, margin_bersih: float, pajak_dipungut: int}
     */
    public function labaRugi(Carbon $dari, Carbon $sampai): array
    {
        $baris = DB::table('transaction_items as ti')
            ->join('transactions as t', 't.id', '=', 'ti.transaction_id')
            ->where('t.status', 'settlement')
            ->whereBetween('t.tanggal', [$dari, $sampai])
            ->selectRaw('SUM(ti.subtotal) as pendapatan_kotor')
            ->selectRaw('SUM(ti.qty * ti.harga_beli) as harga_pokok')
            ->selectRaw('SUM(ti.qty) as unit_terjual')
            ->first();

        $pendapatanKotor = (int) ($baris->pendapatan_kotor ?? 0);
        $hargaPokok = (int) ($baris->harga_pokok ?? 0);

        $agregat = Transaction::query()->lunas()
            ->whereBetween('tanggal', [$dari, $sampai])
            ->selectRaw('SUM(diskon) as diskon')
            ->selectRaw('SUM(pajak) as pajak')
            ->first();

        $diskon = (int) ($agregat->diskon ?? 0);
        $penjualanBersih = $pendapatanKotor - $diskon;
        $labaKotor = $penjualanBersih - $hargaPokok;

        // ---- beban operasional, diprorata terhadap 30 hari
        $hari = $this->jumlahHari($dari, $sampai);
        $prorata = $hari / 30;

        $rincianBeban = array_values(OperationalExpense::query()->aktif()->orderByDesc('jumlah_bulanan')->get()
            ->map(static fn (OperationalExpense $b): array => [
                'nama' => $b->nama,
                'jumlah_bulanan' => $b->jumlah_bulanan,
                'jumlah_periode' => (int) round($b->jumlah_bulanan * $prorata),
            ])->all());

        $bebanOperasional = (int) array_sum(array_column($rincianBeban, 'jumlah_periode'));

        // ---- biaya MDR dari transaksi non-tunai yang lunas
        $nilaiNonTunai = (int) DB::table('transactions as t')
            ->join('payments as p', 'p.transaction_id', '=', 't.id')
            ->where('t.status', 'settlement')
            ->where('p.metode', 'non_tunai')
            ->whereBetween('t.tanggal', [$dari, $sampai])
            ->sum('t.total');

        $tarifMdr = $this->pengaturan->tarifMdr();
        $biayaMdr = (int) round($nilaiNonTunai * $tarifMdr);

        $totalBeban = $bebanOperasional + $biayaMdr;
        $labaBersih = $labaKotor - $totalBeban;

        return [
            'periode' => ['dari' => $dari->toDateString(), 'sampai' => $sampai->toDateString(), 'jumlah_hari' => $hari],
            'unit_terjual' => (int) ($baris->unit_terjual ?? 0),
            'pendapatan_kotor' => $pendapatanKotor,
            'diskon' => $diskon,
            'penjualan_bersih' => $penjualanBersih,
            'harga_pokok_penjualan' => $hargaPokok,
            'laba_kotor' => $labaKotor,
            'margin_kotor' => $this->persen($labaKotor, $penjualanBersih),
            'beban' => [
                'operasional' => $bebanOperasional,
                'mdr' => $biayaMdr,
                'total' => $totalBeban,
                'rincian' => $rincianBeban,
                'nilai_non_tunai' => $nilaiNonTunai,
                'tarif_mdr' => $tarifMdr,
            ],
            'laba_bersih' => $labaBersih,
            'margin_bersih' => $this->persen($labaBersih, $penjualanBersih),
            'pajak_dipungut' => (int) ($agregat->pajak ?? 0),
        ];
    }

    /* ----------------------------------------------------------------- stok */

    /**
     * @param  bool  $semuaProduk  sertakan daftar seluruh produk (untuk unduhan)
     * @return array<string, mixed>
     */
    public function stok(bool $semuaProduk = false): array
    {
        $menipis = Product::query()->with(['category', 'unit'])->stokMenipis()
            ->orderBy('stok')->get();

        $ringkas = Product::query()
            ->selectRaw('COUNT(*) as jumlah_produk')
            ->selectRaw('SUM(stok) as total_unit')
            ->selectRaw('SUM(stok * harga_beli) as nilai_persediaan')
            ->selectRaw('SUM(CASE WHEN stok = 0 THEN 1 ELSE 0 END) as produk_habis')
            ->first();

        $hasil = [
            'jumlah_produk' => (int) ($ringkas->jumlah_produk ?? 0),
            'total_unit' => (int) ($ringkas->total_unit ?? 0),
            // Persediaan dinilai pada harga beli, bukan harga jual.
            'nilai_persediaan' => (int) ($ringkas->nilai_persediaan ?? 0),
            'produk_habis' => (int) ($ringkas->produk_habis ?? 0),
            'produk_stok_menipis' => $menipis->count(),
            'daftar_stok_menipis' => ProductResource::collection($menipis)->resolve(),
        ];

        if ($semuaProduk) {
            $hasil['daftar_produk'] = ProductResource::collection(
                Product::query()->with(['category', 'unit'])->orderBy('nama_produk')->get(),
            )->resolve();
        }

        return $hasil;
    }

    /* -------------------------------------------------------------- bantuan */

    public function jumlahHari(Carbon $dari, Carbon $sampai): int
    {
        return (int) $dari->copy()->startOfDay()->diffInDays($sampai->copy()->startOfDay()) + 1;
    }

    private function persen(int $bagian, int $dasar): float
    {
        return $dasar > 0 ? round($bagian / $dasar * 100, 2) : 0.0;
    }
}
