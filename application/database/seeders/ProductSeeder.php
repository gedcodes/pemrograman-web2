<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use Illuminate\Database\Seeder;

/**
 * 24 produk Toko Sari Amerta, disalin dari `docs/assets/js/data/products.js`.
 *
 * Kolom `stok` di sini adalah stok SAAT INI, sama seperti pada prototipe.
 * TransactionSeeder kemudian membangun stok pembukaan dan mutasi keluarnya
 * secara mundur dari angka ini, sehingga `stock_moves` selalu berjodoh dengan
 * `products.stok` dan jumlah "stok menipis" tetap sama dengan rancangan.
 *
 * Sembilan produk pertama memiliki berkas gambar di `docs/assets/img/products/`.
 */
class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $kategori = Category::pluck('id', 'nama_kategori');
        $satuan = Unit::pluck('id', 'nama_satuan');

        foreach ($this->rows() as $row) {
            [$barcode, $nama, $kat, $sat, $beli, $jual, $stok, $min, $gambar] = $row;

            Product::create([
                'barcode' => $barcode,
                'nama_produk' => $nama,
                'category_id' => $kategori[$kat],
                'unit_id' => $satuan[$sat],
                'harga_beli' => $beli,
                'harga_jual' => $jual,
                'stok' => $stok,
                'stok_minimum' => $min,
                'gambar' => $gambar,
                'aktif' => true,
            ]);
        }
    }

    /**
     * @return list<array{0: string, 1: string, 2: string, 3: string, 4: int, 5: int, 6: int, 7: int, 8: string|null}>
     */
    private function rows(): array
    {
        return [
            ['8998866200196', 'Indomie Goreng Rendang 85g', 'Makanan', 'Pieces', 2850, 3500, 184, 40, 'products/indomie-goreng-rendang-85g.webp'],
            ['8992753211102', 'Aqua Botol 600ml', 'Minuman', 'Botol', 3100, 4000, 96, 24, 'products/aqua-botol-600ml.webp'],
            ['8997009511032', 'Teh Pucuk Harum 350ml', 'Minuman', 'Botol', 4600, 5500, 142, 30, 'products/teh-pucuk-harum-350ml.webp'],
            ['8993175102043', 'Beras Pandan Wangi 5kg', 'Sembako', 'Sak / Karung', 68400, 78000, 3, 10, 'products/beras-pandan-wangi-5kg.webp'],
            ['8992314552019', 'Minyak Bimoli 1L', 'Sembako', 'Pouch', 16900, 19500, 5, 15, 'products/minyak-bimoli-1l.webp'],
            ['8991002341094', 'Gula Pasir Gulaku 1kg', 'Sembako', 'Pieces', 15200, 17800, 0, 20, 'products/gula-pasir-gulaku-1kg.webp'],
            ['8991001120034', 'Kopi Kapal Api 165g', 'Minuman', 'Pieces', 10100, 12300, 67, 15, 'products/kopi-kapal-api-165g.webp'],
            ['8999999014522', 'Sabun Lifebuoy 250ml', 'Kebersihan', 'Botol', 18300, 21400, 41, 12, 'products/sabun-lifebuoy-250ml.webp'],
            ['2000140000259', 'Kopi Bubuk Robusta Sari Amerta 250g', 'Minuman', 'Pieces', 29500, 38500, 22, 8, 'products/kopi-robusta-sari-amerta-250g.webp'],
            ['8998866200318', 'Indomie Kuah Ayam Bawang 69g', 'Makanan', 'Pieces', 2700, 3300, 150, 40, null],
            ['8998866601610', 'Pop Mie Ayam Pedas 75g', 'Makanan', 'Cup', 4200, 5200, 48, 12, null],
            ['8998866602877', 'Chiki Balls Keju 55g', 'Makanan', 'Bungkus', 4500, 5500, 60, 15, null],
            ['8996001301142', 'Roma Kelapa 300g', 'Makanan', 'Bungkus', 9800, 11500, 34, 10, null],
            ['2000140000105', 'Telur Ayam Negeri', 'Sembako', 'Kilogram', 26500, 29800, 18, 10, null],
            ['8998866601276', 'Tepung Terigu Segitiga Biru 1kg', 'Sembako', 'Pieces', 11800, 13900, 26, 10, null],
            ['8996001600146', 'Le Minerale 600ml', 'Minuman', 'Botol', 2900, 3800, 88, 24, null],
            ['8998009010231', 'Ultra Milk Cokelat 250ml', 'Minuman', 'Pieces', 5300, 6500, 7, 12, null],
            ['8999999036227', 'Rinso Anti Noda 770g', 'Kebersihan', 'Bungkus', 21900, 25500, 15, 6, null],
            ['8999999049326', 'Sunlight Jeruk Nipis 755ml', 'Kebersihan', 'Pouch', 14200, 16800, 6, 8, null],
            ['8999999707974', 'Pepsodent Pencegah Gigi Berlubang 190g', 'Kebersihan', 'Pieces', 11400, 13500, 28, 8, null],
            ['8992727002035', 'So Klin Pewangi 900ml', 'Kebersihan', 'Pouch', 12600, 14900, 0, 6, null],
            ['8998989110129', 'Gudang Garam Surya 12', 'Rokok', 'Bungkus', 26800, 29000, 45, 20, null],
            ['8999909096004', 'Sampoerna Mild 16', 'Rokok', 'Bungkus', 30200, 32500, 38, 20, null],
            ['8993188110015', 'Djarum Super 12', 'Rokok', 'Bungkus', 22400, 24500, 4, 10, null],
        ];
    }
}
