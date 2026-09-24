<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Pengguna Toko Sari Amerta, disalin dari `docs/assets/js/data/users.js`.
 *
 * Prototipe memakai PIN enam digit karena tidak punya back-end. Di sini PIN itu
 * TIDAK dipakai: Fortify mengautentikasi dengan email dan kata sandi yang di-hash.
 * Prototipe juga memakai `username`, sedangkan Fortify memakai email, sehingga
 * alamat email dibentuk dari username tersebut pada domain .test yang memang
 * dicadangkan untuk pengujian.
 */
class UserSeeder extends Seeder
{
    /**
     * Kata sandi seluruh akun contoh. Hanya untuk pengembangan lokal.
     */
    public const DEFAULT_PASSWORD = 'password';

    public function run(): void
    {
        $rows = [
            // [nama, username, peran, aktif]
            ['I Wayan Surya Adnyana', 'surya.owner', 'admin', true],
            ['Ni Luh Putu Ratna', 'luh.ratna', 'admin', true],
            ['Ni Kadek Ayu Pramesti', 'kadek.ayu', 'kasir', true],
            ['I Made Dwi Antara', 'made.dwi', 'kasir', true],
            ['Ni Wayan Sari Dewi', 'sari.kasir', 'kasir', false],
        ];

        foreach ($rows as [$nama, $username, $peran, $aktif]) {
            User::create([
                'name' => $nama,
                'email' => $username.'@sariamerta.test',
                'peran' => $peran,
                'aktif' => $aktif,
                'password' => self::DEFAULT_PASSWORD,
                'email_verified_at' => now(),
            ]);
        }
    }
}
