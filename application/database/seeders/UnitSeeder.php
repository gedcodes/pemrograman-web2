<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Unit;
use Illuminate\Database\Seeder;

/**
 * Tujuh satuan jual.
 *
 * Angkanya disalin apa adanya dari prototipe `docs/assets/js/data/master.js`
 * supaya aplikasi baru menampilkan figur yang sama persis dengan rancangannya.
 */
class UnitSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['Pieces', 'Pcs'],
            ['Botol', 'Btl'],
            ['Bungkus', 'Bks'],
            ['Pouch', 'Pouch'],
            ['Sak / Karung', 'Sak'],
            ['Kilogram', 'Kg'],
            ['Cup', 'Cup'],
        ];

        foreach ($rows as [$nama, $simbol]) {
            Unit::create([
                'nama_satuan' => $nama,
                'simbol' => $simbol,
            ]);
        }
    }
}
