<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\StokTidakCukupException;
use App\Models\Product;
use App\Models\StockMove;
use Illuminate\Support\Facades\DB;

/**
 * Satu-satunya pintu perubahan stok.
 *
 * Tidak ada tempat lain yang boleh menyentuh `products.stok` secara langsung.
 * Setiap perubahan selalu menulis satu baris `stock_moves`, sehingga buku besar
 * stok tidak pernah berbeda dengan angka stok itu sendiri.
 */
class StockService
{
    /**
     * Kurangi stok karena penjualan.
     *
     * @throws StokTidakCukupException
     */
    public function keluar(int $productId, int $qty, string $refTipe, int $refId, ?int $userId = null, ?string $keterangan = null): StockMove
    {
        return $this->catat($productId, 'keluar', -abs($qty), $refTipe, $refId, $userId, $keterangan);
    }

    /**
     * Tambah stok karena penerimaan barang.
     */
    public function masuk(int $productId, int $qty, string $refTipe, int $refId, ?int $userId = null, ?string $keterangan = null): StockMove
    {
        return $this->catat($productId, 'masuk', abs($qty), $refTipe, $refId, $userId, $keterangan);
    }

    /**
     * Kembalikan stok karena retur penjualan.
     */
    public function retur(int $productId, int $qty, string $refTipe, int $refId, ?int $userId = null, ?string $keterangan = null): StockMove
    {
        return $this->catat($productId, 'retur', abs($qty), $refTipe, $refId, $userId, $keterangan);
    }

    /**
     * Terapkan SELISIH hasil stok opname ke stok terkini.
     *
     * Bukan menimpa stok dengan angka hitung fisik: penjualan dan penerimaan
     * yang terjadi selama petugas menghitung tetap tercatat. Contoh: buku 20,
     * dihitung 17 (selisih -3), sementara itu terjual 2 → stok akhir 15,
     * bukan 17 yang akan menghapus dua penjualan tadi.
     *
     * @param  int  $selisih  bertanda: positif menambah, negatif mengurangi
     *
     * @throws StokTidakCukupException bila selisih membuat stok negatif
     */
    public function sesuaikan(int $productId, int $selisih, string $refTipe, int $refId, ?int $userId = null, ?string $keterangan = null): ?StockMove
    {
        if ($selisih === 0) {
            return null;
        }

        return $this->catat($productId, 'opname', $selisih, $refTipe, $refId, $userId, $keterangan);
    }

    /**
     * Tulis satu mutasi sekaligus ubah stok produknya.
     *
     * Baris produk dikunci lebih dulu (`lockForUpdate`) supaya dua kasir yang
     * menjual barang sama pada saat bersamaan tidak saling menimpa perhitungan.
     *
     * @param  int  $qty  bertanda: positif menambah, negatif mengurangi
     *
     * @throws StokTidakCukupException
     */
    private function catat(int $productId, string $tipe, int $qty, ?string $refTipe, ?int $refId, ?int $userId, ?string $keterangan): StockMove
    {
        return DB::transaction(function () use ($productId, $tipe, $qty, $refTipe, $refId, $userId, $keterangan): StockMove {
            $product = Product::query()->lockForUpdate()->findOrFail($productId);

            $sebelum = $product->stok;
            $sesudah = $sebelum + $qty;

            if ($sesudah < 0) {
                throw new StokTidakCukupException($product->nama_produk, abs($qty), $sebelum);
            }

            $product->forceFill(['stok' => $sesudah])->save();

            return StockMove::create([
                'product_id' => $productId,
                'tipe' => $tipe,
                'qty' => $qty,
                'stok_sebelum' => $sebelum,
                'stok_sesudah' => $sesudah,
                'referensi_tipe' => $refTipe,
                'referensi_id' => $refId,
                'user_id' => $userId,
                'keterangan' => $keterangan,
            ]);
        });
    }
}
