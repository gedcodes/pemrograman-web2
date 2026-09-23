<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Payment;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Pembuatan transaksi kasir.
 *
 * Seluruh tulisan -- transaksi, itemnya, pembayaran, dan mutasi stok -- terjadi
 * di dalam SATU database transaction, sehingga kegagalan di tengah jalan tidak
 * pernah meninggalkan data separuh jadi.
 *
 * Harga TIDAK diambil dari kiriman klien. Server membacanya sendiri dari basis
 * data lalu menghitung ulang seluruh total (aturan keamanan Bagian 5.4).
 */
class TransactionService
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly StockService $stock,
        private readonly DocumentNumberService $nomor,
    ) {}

    /**
     * @param  list<array{product_id: int, qty: int}>  $items
     */
    public function buat(
        User $kasir,
        Shift $shift,
        array $items,
        string $metode,
        ?int $customerId = null,
        ?int $jumlahBayar = null,
        ?string $catatan = null,
    ): Transaction {
        return DB::transaction(function () use ($kasir, $shift, $items, $metode, $customerId, $jumlahBayar, $catatan): Transaction {
            $baris = $this->susunBaris($items);

            $totals = $this->pricing->hitung(
                array_map(static fn (array $b): array => [
                    'qty' => $b['qty'],
                    'harga_satuan' => $b['harga_satuan'],
                ], $baris),
                member: $customerId !== null,
            );

            $tunai = $metode === 'tunai';

            if ($tunai && ($jumlahBayar === null || $jumlahBayar < $totals['total'])) {
                throw ValidationException::withMessages([
                    'jumlah_bayar' => sprintf(
                        'Nominal yang diterima kurang dari total belanja (%d).',
                        $totals['total'],
                    ),
                ]);
            }

            // Pembayaran tunai langsung lunas. Non-tunai menunggu webhook Midtrans,
            // jadi dimulai sebagai pending dan BELUM mengurangi stok.
            $status = $tunai ? 'settlement' : 'pending';

            $transaction = Transaction::create([
                'no_struk' => $this->nomor->struk(),
                'tanggal' => now(),
                'shift_id' => $shift->id,
                'customer_id' => $customerId,
                'subtotal' => $totals['subtotal'],
                'diskon' => $totals['diskon'],
                'pajak' => $totals['pajak'],
                'total' => $totals['total'],
                'status' => $status,
                'catatan' => $catatan,
            ]);

            foreach ($baris as $b) {
                TransactionItem::create([
                    'transaction_id' => $transaction->id,
                    'product_id' => $b['product_id'],
                    // Potret nama saat penjualan, supaya struk lama tidak berubah
                    // ketika produknya kelak diganti nama.
                    'nama_produk' => $b['nama_produk'],
                    'qty' => $b['qty'],
                    'harga_satuan' => $b['harga_satuan'],
                    // Harga modal ikut dipotret, supaya menaikkan harga beli
                    // produk kelak tidak menggeser laba periode yang sudah lewat.
                    'harga_beli' => $b['harga_beli'],
                    'subtotal' => $b['qty'] * $b['harga_satuan'],
                ]);
            }

            Payment::create([
                'transaction_id' => $transaction->id,
                'metode' => $tunai ? 'tunai' : 'non_tunai',
                'jumlah_bayar' => $tunai ? (int) $jumlahBayar : 0,
                'kembalian' => $tunai ? (int) $jumlahBayar - $totals['total'] : 0,
                'waktu_settlement' => $tunai ? now() : null,
            ]);

            if ($status === 'settlement') {
                $this->kurangiStok($transaction, $kasir->id);
            }

            return $transaction->load(['items', 'payment', 'customer', 'shift']);
        });
    }

    /**
     * Kurangi stok untuk seluruh baris sebuah transaksi.
     *
     * Dipanggil saat pembayaran tunai, dan kelak oleh webhook Midtrans ketika
     * status berubah menjadi settlement (PERANCANGAN Bagian 4.3).
     */
    public function kurangiStok(Transaction $transaction, ?int $userId = null): void
    {
        foreach ($transaction->items as $item) {
            $this->stock->keluar(
                $item->product_id,
                $item->qty,
                'transaction',
                $transaction->id,
                $userId,
                'Penjualan '.$transaction->no_struk,
            );
        }
    }

    /**
     * Ambil harga dan nama dari basis data, serta gabungkan baris produk kembar.
     *
     * @param  list<array{product_id: int, qty: int}>  $items
     * @return list<array{product_id: int, nama_produk: string, qty: int, harga_satuan: int, harga_beli: int}>
     */
    private function susunBaris(array $items): array
    {
        $gabung = [];
        foreach ($items as $item) {
            $id = $item['product_id'];
            $gabung[$id] = ($gabung[$id] ?? 0) + $item['qty'];
        }

        /** @var array<int, Product> $products */
        $products = Product::query()->findMany(array_keys($gabung))->keyBy('id')->all();

        $baris = [];
        foreach ($gabung as $id => $qty) {
            $product = $products[$id] ?? null;

            if ($product === null || ! $product->aktif) {
                throw ValidationException::withMessages([
                    'items' => 'Produk tidak ditemukan atau sedang dinonaktifkan.',
                ]);
            }

            $baris[] = [
                'product_id' => $product->id,
                'nama_produk' => $product->nama_produk,
                'qty' => $qty,
                'harga_satuan' => $product->harga_jual,
                'harga_beli' => $product->harga_beli,
            ];
        }

        return $baris;
    }
}
