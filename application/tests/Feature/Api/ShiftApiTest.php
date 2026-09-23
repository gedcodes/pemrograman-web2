<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShiftApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_shift_dapat_dibuka_dan_ditutup(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->getJson('/api/shifts/aktif')
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->actingAs($kasir)->postJson('/api/shifts/open', ['modal_awal' => 300_000])
            ->assertCreated()
            ->assertJsonPath('data.terbuka', true)
            ->assertJsonPath('data.modal_awal', 300_000);

        $this->actingAs($kasir)->getJson('/api/shifts/aktif')
            ->assertOk()
            ->assertJsonPath('data.terbuka', true);

        $this->actingAs($kasir)->postJson('/api/shifts/close', ['kas_akhir' => 1_250_000])
            ->assertOk()
            ->assertJsonPath('data.terbuka', false)
            ->assertJsonPath('data.kas_akhir', 1_250_000);
    }

    public function test_tidak_boleh_membuka_dua_shift_sekaligus(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->postJson('/api/shifts/open', ['modal_awal' => 100_000])->assertCreated();
        $this->actingAs($kasir)->postJson('/api/shifts/open', ['modal_awal' => 100_000])->assertStatus(409);
    }

    public function test_menutup_tanpa_shift_terbuka_ditolak(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->postJson('/api/shifts/close', ['kas_akhir' => 0])->assertStatus(409);
    }

    public function test_modal_awal_wajib_diisi(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->postJson('/api/shifts/open', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('modal_awal');
    }

    public function test_shift_kasir_lain_tidak_terlihat(): void
    {
        $a = User::factory()->kasir()->create();
        $b = User::factory()->kasir()->create();

        $this->actingAs($a)->postJson('/api/shifts/open', ['modal_awal' => 50_000])->assertCreated();

        $this->actingAs($b)->getJson('/api/shifts/aktif')
            ->assertOk()
            ->assertJsonPath('data', null);
    }
}
