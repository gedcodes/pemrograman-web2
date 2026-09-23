<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Supplier;
use Illuminate\Database\Seeder;

/**
 * Delapan supplier beserta kontak dan alamatnya.
 *
 * Angkanya disalin apa adanya dari prototipe `docs/assets/js/data/master.js`
 * supaya aplikasi baru menampilkan figur yang sama persis dengan rancangannya.
 */
class SupplierSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['PT Indofood CBP Sukses Makmur Tbk', '0812-3456-7890', 'Jl. Bypass Ngurah Rai No. 88, Denpasar'],
            ['PT Tirta Investama (Danone Aqua)', '0819-8765-4321', 'Jl. Gatot Subroto Barat No. 212, Denpasar'],
            ['CV Amerta Jaya Distribusi', '0878-1122-3344', 'Jl. Raya Sesetan No. 17, Denpasar'],
            ['PT Unilever Indonesia Distributor Bali', '0813-9988-7766', 'Jl. Cokroaminoto No. 45, Denpasar'],
            ['PT Mayora Indah Tbk', '0857-4433-2211', 'Jl. Imam Bonjol No. 380, Denpasar'],
            ['CV Surya Pangan Mandiri', '0812-6655-4433', 'Jl. Pulau Bungin No. 9, Denpasar'],
            ['PT Wings Surya Distribusi', '0821-3344-5566', 'Jl. Mahendradatta No. 120, Denpasar'],
            ['PT Djarum Distribusi Retail', '0818-7766-5544', 'Jl. Teuku Umar Barat No. 66, Denpasar'],
        ];

        foreach ($rows as [$nama, $kontak, $alamat]) {
            Supplier::create([
                'nama_supplier' => $nama,
                'kontak' => $kontak,
                'alamat' => $alamat,
            ]);
        }
    }
}
