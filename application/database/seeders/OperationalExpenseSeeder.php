<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\OperationalExpense;
use Illuminate\Database\Seeder;

/**
 * Beban operasional bulanan, disalin dari `MONTHLY_EXPENSES`
 * pada `docs/assets/js/data/master.js`.
 */
class OperationalExpenseSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['Gaji dua kasir paruh waktu', 3_465_000],
            ['Listrik, air & internet kasir', 912_400],
            ['Kertas struk, kantong belanja & ATK', 386_700],
            ['Retribusi kebersihan & keamanan banjar', 150_000],
            ['Penyusutan peralatan kasir & rak', 287_500],
        ];

        foreach ($rows as [$nama, $jumlah]) {
            OperationalExpense::create([
                'nama' => $nama,
                'jumlah_bulanan' => $jumlah,
                'aktif' => true,
            ]);
        }
    }
}
