<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Masuk dan keluar lewat Fortify tanpa tampilan, persis seperti yang
 * dilakukan `spa/stores/auth.ts`: permintaan JSON ke POST /login dan /logout.
 */
class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_pengguna_dapat_masuk_lewat_json(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertOk()->assertExactJson(['two_factor' => false]);
        $this->assertAuthenticatedAs($user);
    }

    public function test_kata_sandi_salah_ditolak_dengan_pesan_validasi(): void
    {
        $user = User::factory()->create();

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->assertGuest();
    }

    public function test_pengguna_dapat_keluar(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/logout')->assertNoContent();

        $this->assertGuest();
    }

    public function test_percobaan_masuk_dibatasi(): void
    {
        $user = User::factory()->create();

        RateLimiter::increment(md5('login'.implode('|', [$user->email, '127.0.0.1'])), amount: 5);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertTooManyRequests();
    }

    /**
     * Fitur starter kit yang sudah dilepas tidak boleh diam-diam hidup lagi.
     * GET ke alamat-alamat ini jatuh ke SPA, jadi yang diperiksa POST-nya.
     */
    public function test_endpoint_fitur_starter_kit_tidak_lagi_tersedia(): void
    {
        foreach (['/register', '/forgot-password', '/reset-password', '/two-factor-challenge', '/email/verification-notification'] as $alamat) {
            $this->postJson($alamat)->assertStatus(405);
        }
    }
}
