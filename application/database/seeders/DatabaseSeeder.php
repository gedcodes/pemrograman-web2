<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Urutannya mengikuti arah foreign key: master data lebih dulu, lalu pengguna,
 * lalu produk yang merujuk kategori dan satuan, dan terakhir transaksi yang
 * merujuk hampir semuanya.
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            CategorySeeder::class,
            UnitSeeder::class,
            SupplierSeeder::class,
            CustomerSeeder::class,
            OperationalExpenseSeeder::class,
            UserSeeder::class,         // 2 admin + 3 kasir
            ProductSeeder::class,      // 24 produk
            TransactionSeeder::class,  // riwayat 7 hari + shift + pembayaran + mutasi stok
        ]);
    }
}
