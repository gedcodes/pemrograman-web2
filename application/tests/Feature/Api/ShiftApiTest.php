<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Payment;
use App\Models\Shift;
use App\Models\Transaction;
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

    public function test_ringkasan_kas_dan_selisih_saat_tutup_shift(): void
    {
        $kasir = User::factory()->kasir()->create();
        $shift = Shift::create(['user_id' => $kasir->id, 'waktu_buka' => now(), 'modal_awal' => 300_000]);

        // Dua penjualan tunai lunas, satu non-tunai lunas, satu non-tunai menunggu.
        foreach ([['tunai', 'settlement', 50_000], ['tunai', 'settlement', 25_000],
            ['non_tunai', 'settlement', 40_000], ['non_tunai', 'pending', 10_000]] as $i => [$metode, $status, $total]) {
            $trx = Transaction::factory()->create([
                'shift_id' => $shift->id, 'no_struk' => "TRX-UJI-{$i}", 'status' => $status, 'total' => $total,
            ]);
            Payment::factory()->create(['transaction_id' => $trx->id, 'metode' => $metode]);
        }

        $this->actingAs($kasir)->getJson('/api/shifts/aktif')
            ->assertOk()
            ->assertJsonPath('data.ringkasan.jumlah_transaksi', 3)
            ->assertJsonPath('data.ringkasan.penjualan_tunai', 75_000)
            ->assertJsonPath('data.ringkasan.penjualan_non_tunai', 40_000)
            ->assertJsonPath('data.ringkasan.tagihan_menunggu', 1)
            // Kas seharusnya = modal 300.000 + tunai 75.000. Non-tunai tidak masuk laci.
            ->assertJsonPath('data.ringkasan.kas_seharusnya', 375_000)
            ->assertJsonPath('data.ringkasan.selisih', null);

        $this->actingAs($kasir)->postJson('/api/shifts/close', ['kas_akhir' => 370_000])
            ->assertOk()
            ->assertJsonPath('data.terbuka', false)
            ->assertJsonPath('data.ringkasan.selisih', -5_000)
            ->assertJsonPath('message', 'Shift ditutup. Kas kurang dari seharusnya.');
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
