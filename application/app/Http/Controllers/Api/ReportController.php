<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\OperationalExpense;
use App\Models\Product;
use App\Models\Transaction;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Laporan penjualan, laba rugi, dan stok.
 *
 * Seluruh laporan hanya menghitung transaksi berstatus `settlement`. Transaksi
 * `pending` berarti pelanggan belum membayar, sehingga memasukkannya akan
 * melaporkan pendapatan yang belum tentu diterima.
 */
class ReportController extends Controller
{
    /**
     * Rekap penjualan per hari dalam satu periode.
     */
    public function sales(Request $request): JsonResponse
    {
        [$dari, $sampai] = $this->periode($request);

        $harian = Transaction::query()
            ->lunas()
            ->whereBetween('tanggal', [$dari, $sampai])
            // Sama seperti pada Dashboard: alias tidak boleh bernama `tanggal`
            // karena akan tertimpa cast datetime milik model.
            ->selectRaw('DATE(tanggal) as tanggal_str')
            ->selectRaw('COUNT(*) as jumlah_transaksi')
            ->selectRaw('SUM(subtotal) as subtotal')
            ->selectRaw('SUM(diskon) as diskon')
            ->selectRaw('SUM(pajak) as pajak')
            ->selectRaw('SUM(total) as total')
            ->groupBy('tanggal_str')
            ->orderBy('tanggal_str')
            ->get();

        return ApiResponse::ok([
            'periode' => ['dari' => $dari->toDateString(), 'sampai' => $sampai->toDateString()],
            'ringkasan' => [
                'jumlah_transaksi' => (int) $harian->sum('jumlah_transaksi'),
                'subtotal' => (int) $harian->sum('subtotal'),
                'diskon' => (int) $harian->sum('diskon'),
                'pajak' => (int) $harian->sum('pajak'),
                'total' => (int) $harian->sum('total'),
            ],
            'harian' => $harian,
        ]);
    }

    /**
     * Laba rugi lengkap sampai laba bersih.
     *
     * Harga pokok dibaca dari POTRET `transaction_items.harga_beli`, yaitu harga
     * modal pada saat penjualan terjadi -- bukan harga modal saat ini. Tanpa itu,
     * menaikkan harga beli sebuah produk akan menggeser laba periode yang sudah
     * lewat.
     *
     * Beban operasional disimpan per BULAN lalu diprorata sesuai panjang periode
     * laporan, mengikuti perilaku prototipe. Biaya MDR dihitung dari nilai
     * transaksi non-tunai yang lunas.
     */
    public function profitLoss(Request $request): JsonResponse
    {
        [$dari, $sampai] = $this->periode($request);

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
        $hari = $dari->copy()->startOfDay()->diffInDays($sampai->copy()->startOfDay()) + 1;
        $prorata = $hari / 30;

        $bebanBulanan = OperationalExpense::query()->aktif()->orderByDesc('jumlah_bulanan')->get();

        $rincianBeban = $bebanBulanan->map(static fn (OperationalExpense $b): array => [
            'nama' => $b->nama,
            'jumlah_bulanan' => $b->jumlah_bulanan,
            'jumlah_periode' => (int) round($b->jumlah_bulanan * $prorata),
        ])->all();

        $bebanOperasional = (int) array_sum(array_column($rincianBeban, 'jumlah_periode'));

        // ---- biaya MDR dari transaksi non-tunai yang lunas
        $nilaiNonTunai = (int) DB::table('transactions as t')
            ->join('payments as p', 'p.transaction_id', '=', 't.id')
            ->where('t.status', 'settlement')
            ->where('p.metode', 'non_tunai')
            ->whereBetween('t.tanggal', [$dari, $sampai])
            ->sum('t.total');

        $tarifMdr = (float) config('pos.tarif_mdr');
        $biayaMdr = (int) round($nilaiNonTunai * $tarifMdr);

        $totalBeban = $bebanOperasional + $biayaMdr;
        $labaBersih = $labaKotor - $totalBeban;

        return ApiResponse::ok([
            'periode' => [
                'dari' => $dari->toDateString(),
                'sampai' => $sampai->toDateString(),
                'jumlah_hari' => $hari,
            ],
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
        ]);
    }

    private function persen(int $bagian, int $dasar): float
    {
        return $dasar > 0 ? round($bagian / $dasar * 100, 2) : 0.0;
    }

    /**
     * Laporan stok beserta daftar produk yang menipis.
     */
    public function stock(Request $request): JsonResponse
    {
        $menipis = Product::query()->with(['category', 'unit'])->stokMenipis()
            ->orderBy('stok')->get();

        $ringkas = Product::query()
            ->selectRaw('COUNT(*) as jumlah_produk')
            ->selectRaw('SUM(stok) as total_unit')
            ->selectRaw('SUM(stok * harga_beli) as nilai_persediaan')
            ->selectRaw('SUM(CASE WHEN stok = 0 THEN 1 ELSE 0 END) as produk_habis')
            ->first();

        return ApiResponse::ok([
            'jumlah_produk' => (int) ($ringkas->jumlah_produk ?? 0),
            'total_unit' => (int) ($ringkas->total_unit ?? 0),
            // Persediaan dinilai pada harga beli, bukan harga jual.
            'nilai_persediaan' => (int) ($ringkas->nilai_persediaan ?? 0),
            'produk_habis' => (int) ($ringkas->produk_habis ?? 0),
            'produk_stok_menipis' => $menipis->count(),
            'daftar_stok_menipis' => ProductResource::collection($menipis)->resolve(),
        ]);
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function periode(Request $request): array
    {
        $dari = $request->filled('dari')
            ? Carbon::parse($request->string('dari')->value())->startOfDay()
            : Carbon::today()->subDays(6)->startOfDay();

        $sampai = $request->filled('sampai')
            ? Carbon::parse($request->string('sampai')->value())->endOfDay()
            : Carbon::today()->endOfDay();

        return [$dari, $sampai];
    }
}
