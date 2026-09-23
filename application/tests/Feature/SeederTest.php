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
 * Dua hal di bawah pernah lolos dari seluruh pengujian lain: tes memakai
 * `UserFactory`, sedangkan yang dipakai sehari-hari adalah `UserSeeder`.
 * Akibatnya cacat pada seeder tidak pernah tertangkap sampai dicoba manual.
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

    /**
     * Regresi: pengguna hasil seeder pernah tidak punya tim sama sekali.
     *
     * Rute bawaan starter kit ter-scope tim (`{current_team}/dashboard`),
     * sehingga tanpa tim, login lewat halaman Inertia berhasil tetapi
     * pengalihannya langsung gagal dengan "Missing required parameter".
     */
    public function test_setiap_pengguna_seeder_punya_tim_pribadi(): void
    {
        $this->assertSame(5, User::count());

        foreach (User::all() as $user) {
            $this->assertNotNull($user->current_team_id, "{$user->email} tidak punya tim aktif.");
            $this->assertSame(1, $user->teams()->count(), "{$user->email} bukan anggota tim mana pun.");
            $this->assertNotNull($user->currentTeam?->slug, "Tim {$user->email} tidak punya slug.");
        }
    }

    public function test_komposisi_peran_sesuai_prototipe(): void
    {
        $this->assertSame(2, User::where('peran', 'admin')->count());
        $this->assertSame(3, User::where('peran', 'kasir')->count());
        // Satu kasir sengaja nonaktif, sebagai contoh penolakan masuk.
        $this->assertSame(1, User::where('aktif', false)->count());
    }
}
