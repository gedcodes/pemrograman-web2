<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;

/**
 * Sepuluh pelanggan terdaftar beserta poin loyalitasnya.
 *
 * Angkanya disalin apa adanya dari prototipe `docs/assets/js/data/master.js`
 * supaya aplikasi baru menampilkan figur yang sama persis dengan rancangannya.
 */
class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['Ni Made Dwi Lestari', '0819-4455-8890', 3510],
            ['Rizky Maulana Hakim', '0857-1234-9988', 2140],
            ['Ibu Ketut Suartini', '0878-6011-2345', 6200],
            ['Putu Gede Arimbawa', '0813-2289-4411', 1650],
            ['Komang Ayu Sintia', '0821-4477-8099', 920],
            ['Pak Made Sukadana', '0818-0567-3321', 650],
            ['Amanda Christine', '0852-3901-7788', 430],
            ['Dewa Ayu Komang', '0812-7730-5164', 1180],
            ['Ketut Budiarta', '0877-6021-4439', 2890],
            ['Putu Hendra Pratama', '0896-3355-1270', 360],
        ];

        foreach ($rows as [$nama, $hp, $poin]) {
            Customer::create([
                'nama' => $nama,
                'no_hp' => $hp,
                'poin_loyalti' => $poin,
            ]);
        }
    }
}
