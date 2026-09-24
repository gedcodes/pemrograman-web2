<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Penjaga data hasil seeder.
 *
 * Tes lain memakai `UserFactory`, sedangkan yang dipakai sehari-hari adalah
 * `UserSeeder`, sehingga cacat pada seeder tidak tertangkap di tempat lain.
 * Hash kata sandi yang rusak pernah lolos sampai dicoba manual.
 */
class SeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(UserSeeder::class);
    }

    public function test_kata_sandi_seeder_ter_hash_bcrypt_dan_dapat_dipakai_masuk(): void
    {
        foreach (User::all() as $user) {
            $info = password_get_info($user->password);

            $this->assertSame('bcrypt', $info['algoName'], "Hash {$user->email} bukan bcrypt.");
            $this->assertSame(60, strlen($user->password), "Panjang hash {$user->email} tidak 60.");
            $this->assertTrue(
                Hash::check(UserSeeder::DEFAULT_PASSWORD, $user->password),
                "Kata sandi bawaan tidak cocok untuk {$user->email}.",
            );
        }
    }

    public function test_komposisi_peran_sesuai_prototipe(): void
    {
        $this->assertSame(5, User::count());
        $this->assertSame(2, User::where('peran', 'admin')->count());
        $this->assertSame(3, User::where('peran', 'kasir')->count());
        // Satu kasir sengaja nonaktif, sebagai contoh penolakan masuk.
        $this->assertSame(1, User::where('aktif', false)->count());
    }
}
