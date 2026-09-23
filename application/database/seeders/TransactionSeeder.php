<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Payment;
use App\Models\PaymentLog;
use App\Models\Product;
use App\Models\Shift;
use App\Models\StockMove;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Riwayat transaksi tujuh hari terakhir.
 *
 * Aturan harga disalin persis dari `docs/assets/js/core/pricing.js`:
 *
 *     subtotal = jumlah(harga_satuan x qty)
 *     diskon   = bulat(subtotal x tarif diskon member)
 *     DPP      = subtotal - diskon
 *     pajak    = bulat(DPP x 11%)
 *     total    = DPP + pajak
 *
 * Tidak ada satu pun angka total yang ditulis tetap; semuanya dihitung dari item.
 *
 * Stok direkonsiliasi mundur: stok pembukaan dihitung dari stok akhir pada
 * ProductSeeder ditambah seluruh qty yang terjual, sehingga setelah seluruh
 * mutasi keluar dicatat, `products.stok` kembali persis ke angka rancangan.
 * Hanya transaksi berstatus `settlement` yang mengurangi stok -- sesuai aturan
 * PERANCANGAN Bagian 4.3.
 */
class TransactionSeeder extends Seeder
{
    private const HARI = 7;

    private const TARIF_PAJAK = 0.11;

    private const TARIF_DISKON_MEMBER = 0.05;

    private const MENIT_BUKA = 420;          // 07:00

    private const MENIT_TUTUP = 1290;        // 21:30

    private const MENIT_GANTI_SHIFT = 900;   // 15:00

    /** Bobot kemunculan produk di keranjang, urut sesuai ProductSeeder. */
    private const POPULARITAS = [
        12, 11, 8, 2, 4, 4, 5, 2, 1, 9, 5, 6,
        4, 3, 2, 8, 5, 2, 2, 2, 2, 6, 5, 3,
    ];

    private const BOBOT_JUMLAH_BARIS = [[1, 30], [2, 30], [3, 20], [4, 12], [5, 5], [6, 3]];

    private const BOBOT_METODE = [['tunai', 46], ['qris', 34], ['gopay', 9], ['bank_transfer', 11]];

    public function run(): void
    {
        /** @var list<Product> $products */
        $products = Product::orderBy('id')->get()->all();
        // Dipetakan eksplisit ke int lalu diratakan jadi list, supaya tipenya
        // benar-benar terbukti dan bukan sekadar dianggap benar.
        $customerIds = array_values(
            Customer::query()->get(['id'])->map(fn (Customer $c): int => $c->id)->all()
        );

        $kasirPagi = User::where('email', 'kadek.ayu@sariamerta.test')->firstOrFail();
        $kasirSiang = User::where('email', 'made.dwi@sariamerta.test')->firstOrFail();

        $hariIni = Carbon::today();
        $rencana = [];
        $terjual = [];

        // ---- Tahap 1: susun seluruh transaksi di memori, kumpulkan qty terjual.
        for ($offset = self::HARI - 1; $offset >= 0; $offset--) {
            $hari = $hariIni->copy()->subDays($offset);
            mt_srand((int) $hari->format('Ymd'));

            $akhirPekan = in_array($hari->dayOfWeek, [Carbon::SATURDAY, Carbon::SUNDAY], true);
            $jumlah = (int) round(mt_rand(36, 52) * ($akhirPekan ? 1.25 : 1));

            $menitList = [];
            for ($i = 0; $i < $jumlah; $i++) {
                $menitList[] = mt_rand(self::MENIT_BUKA, self::MENIT_TUTUP);
            }
            sort($menitList);

            foreach ($menitList as $urutan => $menit) {
                $trx = $this->susunTransaksi($products, $customerIds, $hari, $menit, $urutan + 1, $offset === 0);
                $rencana[] = $trx;

                if ($trx['status'] === 'settlement') {
                    foreach ($trx['items'] as $item) {
                        $pid = $item['product_id'];
                        $terjual[$pid] = ($terjual[$pid] ?? 0) + $item['qty'];
                    }
                }
            }
        }

        // ---- Tahap 2: stok pembukaan = stok akhir rancangan + seluruh yang terjual.
        $stokBerjalan = [];
        $waktuPembukaan = $hariIni->copy()->subDays(self::HARI)->setTime(6, 0);

        DB::transaction(function () use ($products, $terjual, &$stokBerjalan, $waktuPembukaan, $rencana, $kasirPagi, $kasirSiang, $hariIni): void {
            foreach ($products as $product) {
                $dibuka = $product->stok + ($terjual[$product->id] ?? 0);
                $stokBerjalan[$product->id] = $dibuka;

                // Stok dinaikkan ke angka pembukaan, lalu dikembalikan oleh mutasi keluar.
                $product->forceFill(['stok' => $dibuka])->save();

                StockMove::create([
                    'product_id' => $product->id,
                    'tipe' => 'masuk',
                    'qty' => $dibuka,
                    'stok_sebelum' => 0,
                    'stok_sesudah' => $dibuka,
                    'referensi_tipe' => 'seeder',
                    'referensi_id' => null,
                    'keterangan' => 'Stok pembukaan awal periode',
                    'created_at' => $waktuPembukaan,
                    'updated_at' => $waktuPembukaan,
                ]);
            }

            // ---- Tahap 3: shift harian.
            $shiftPerHari = [];
            for ($offset = self::HARI - 1; $offset >= 0; $offset--) {
                $hari = $hariIni->copy()->subDays($offset);
                $kunci = $hari->toDateString();

                $shiftPerHari[$kunci] = [
                    'pagi' => Shift::create([
                        'user_id' => $kasirPagi->id,
                        'waktu_buka' => $hari->copy()->setTime(7, 0),
                        'waktu_tutup' => $offset === 0 ? null : $hari->copy()->setTime(15, 0),
                        'modal_awal' => 300_000,
                    ])->id,
                    'siang' => Shift::create([
                        'user_id' => $kasirSiang->id,
                        'waktu_buka' => $hari->copy()->setTime(15, 0),
                        'waktu_tutup' => $offset === 0 ? null : $hari->copy()->setTime(21, 30),
                        'modal_awal' => 300_000,
                    ])->id,
                ];
            }

            // ---- Tahap 4: tulis transaksi, item, pembayaran, dan mutasi keluar.
            foreach ($rencana as $t) {
                $shiftId = $shiftPerHari[$t['tanggal']->toDateString()][$t['shift']];

                $trx = Transaction::create([
                    'no_struk' => $t['no_struk'],
                    'tanggal' => $t['tanggal'],
                    'shift_id' => $shiftId,
                    'customer_id' => $t['customer_id'],
                    'subtotal' => $t['subtotal'],
                    'diskon' => $t['diskon'],
                    'pajak' => $t['pajak'],
                    'total' => $t['total'],
                    'status' => $t['status'],
                ]);

                foreach ($t['items'] as $item) {
                    TransactionItem::create([
                        'transaction_id' => $trx->id,
                        'product_id' => $item['product_id'],
                        'nama_produk' => $item['nama_produk'],
                        'qty' => $item['qty'],
                        'harga_satuan' => $item['harga_satuan'],
                        'harga_beli' => $item['harga_beli'],
                        'subtotal' => $item['subtotal'],
                    ]);

                    if ($t['status'] !== 'settlement') {
                        continue;
                    }

                    $sebelum = $stokBerjalan[$item['product_id']];
                    $sesudah = $sebelum - $item['qty'];
                    $stokBerjalan[$item['product_id']] = $sesudah;

                    StockMove::create([
                        'product_id' => $item['product_id'],
                        'tipe' => 'keluar',
                        'qty' => -$item['qty'],
                        'stok_sebelum' => $sebelum,
                        'stok_sesudah' => $sesudah,
                        'referensi_tipe' => 'transaction',
                        'referensi_id' => $trx->id,
                        'keterangan' => 'Penjualan '.$t['no_struk'],
                        'created_at' => $t['tanggal'],
                        'updated_at' => $t['tanggal'],
                    ]);
                }

                $lunas = $t['status'] === 'settlement';
                $nonTunai = $t['metode'] !== 'tunai';

                $payment = Payment::create([
                    'transaction_id' => $trx->id,
                    'metode' => $nonTunai ? 'non_tunai' : 'tunai',
                    'order_id' => $nonTunai ? 'SA-'.$t['no_struk'] : null,
                    'payment_type' => $nonTunai ? $t['metode'] : null,
                    'transaction_status' => $nonTunai ? $t['status'] : null,
                    'jumlah_bayar' => $t['bayar'],
                    'kembalian' => $lunas && ! $nonTunai ? $t['bayar'] - $t['total'] : 0,
                    'waktu_settlement' => $lunas ? $t['tanggal'] : null,
                ]);

                if ($nonTunai) {
                    PaymentLog::create([
                        'payment_id' => $payment->id,
                        'status_lama' => 'pending',
                        'status_baru' => $t['status'],
                        'waktu_perubahan' => $t['tanggal'],
                        'dikonfirmasi_oleh' => 'midtrans-webhook',
                        'raw_payload' => [
                            'order_id' => 'SA-'.$t['no_struk'],
                            'transaction_status' => $t['status'],
                            'payment_type' => $t['metode'],
                            'gross_amount' => (string) $t['total'],
                        ],
                        'idempotency_key' => hash('sha256', 'SA-'.$t['no_struk'].'|'.$t['status']),
                    ]);
                }
            }

            // ---- Tahap 5: kembalikan stok ke angka akhir hasil mutasi.
            foreach ($stokBerjalan as $productId => $stok) {
                DB::table('products')->where('id', $productId)->update(['stok' => $stok]);
            }
        });
    }

    /**
     * @param  list<Product>  $products
     * @param  list<int>  $customerIds
     * @return array<string, mixed>
     */
    private function susunTransaksi(array $products, array $customerIds, Carbon $hari, int $menit, int $urutan, bool $hariIni): array
    {
        $jumlahBaris = $this->berbobot(self::BOBOT_JUMLAH_BARIS);

        $terpilih = [];
        while (count($terpilih) < $jumlahBaris) {
            $idx = $this->indeksProdukBerbobot();
            $terpilih[$idx] = $products[$idx];
        }

        $items = [];
        $subtotal = 0;
        foreach ($terpilih as $product) {
            $qty = $this->qtyUntuk($product->harga_jual);
            $barisSubtotal = $qty * $product->harga_jual;
            $subtotal += $barisSubtotal;

            $items[] = [
                'product_id' => $product->id,
                'nama_produk' => $product->nama_produk,
                'qty' => $qty,
                'harga_satuan' => $product->harga_jual,
                'harga_beli' => $product->harga_beli,
                'subtotal' => $barisSubtotal,
            ];
        }

        $customerId = (mt_rand(0, 999) / 1000) < 0.28 ? $customerIds[array_rand($customerIds)] : null;

        $diskon = $customerId !== null ? (int) round($subtotal * self::TARIF_DISKON_MEMBER) : 0;
        $dpp = $subtotal - $diskon;
        $pajak = (int) round($dpp * self::TARIF_PAJAK);
        $total = $dpp + $pajak;

        $metode = $this->berbobot(self::BOBOT_METODE);
        $nonTunai = $metode !== 'tunai';

        $undian = mt_rand(0, 999) / 1000;
        $status = 'settlement';
        if ($undian < 0.02) {
            $status = 'cancel';
        } elseif ($nonTunai && $hariIni && $undian < 0.07) {
            $status = 'pending';
        } elseif ($nonTunai && ! $hariIni && $undian < 0.035) {
            $status = 'expire';
        }

        $tanggal = $hari->copy()->setTime(0, 0)->addMinutes($menit)->addSeconds(mt_rand(0, 59));

        $bayar = 0;
        if ($status === 'settlement') {
            $bayar = $nonTunai ? $total : $this->uangDiserahkan($total);
        }

        return [
            'no_struk' => sprintf('TRX-%s-%04d', $hari->format('Ymd'), $urutan),
            'tanggal' => $tanggal,
            'shift' => $menit < self::MENIT_GANTI_SHIFT ? 'pagi' : 'siang',
            'customer_id' => $customerId,
            'items' => $items,
            'subtotal' => $subtotal,
            'diskon' => $diskon,
            'pajak' => $pajak,
            'total' => $total,
            'status' => $status,
            'metode' => $metode,
            'bayar' => $bayar,
        ];
    }

    private function qtyUntuk(int $hargaJual): int
    {
        if ($hargaJual < 6_000) {
            return $this->berbobot([[1, 40], [2, 25], [3, 12], [4, 8], [6, 6], [10, 5], [12, 4]]);
        }

        if ($hargaJual < 30_000) {
            return $this->berbobot([[1, 70], [2, 22], [3, 8]]);
        }

        return 1;
    }

    /** Uang yang diserahkan pelanggan: pas, atau dibulatkan ke pecahan umum. */
    private function uangDiserahkan(int $total): int
    {
        $pecahan = $this->berbobot([[1_000, 2], [5_000, 3], [10_000, 3], [50_000, 3], [100_000, 2]]);

        return (int) (ceil($total / $pecahan) * $pecahan);
    }

    private function indeksProdukBerbobot(): int
    {
        $pasangan = [];
        foreach (self::POPULARITAS as $i => $bobot) {
            $pasangan[] = [$i, $bobot];
        }

        return $this->berbobot($pasangan);
    }

    /**
     * @template TValue
     *
     * @param  list<array{0: TValue, 1: int}>  $pasangan
     * @return TValue
     */
    private function berbobot(array $pasangan): mixed
    {
        $jumlah = array_sum(array_column($pasangan, 1));
        $undian = mt_rand(1, $jumlah);

        foreach ($pasangan as [$nilai, $bobot]) {
            $undian -= $bobot;
            if ($undian <= 0) {
                return $nilai;
            }
        }

        return $pasangan[0][0];
    }
}
