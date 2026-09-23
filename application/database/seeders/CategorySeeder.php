<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Lima kategori produk Toko Sari Amerta.
 *
 * Angkanya disalin apa adanya dari prototipe `docs/assets/js/data/master.js`
 * supaya aplikasi baru menampilkan figur yang sama persis dengan rancangannya.
 */
class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            'Makanan',
            'Minuman',
            'Sembako',
            'Kebersihan',
            'Rokok',
        ];

        foreach ($rows as $nama) {
            Category::create([
                'nama_kategori' => $nama,
                'slug' => Str::slug($nama),
            ]);
        }
    }
}
