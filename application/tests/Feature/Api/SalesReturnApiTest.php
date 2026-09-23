<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\SalesReturn;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PERANCANGAN Bagian 2.2: admin menyetujui seketika, pengajuan kasir menunggu.
 */
class SalesReturnApiTest extends TestCase
{
    use RefreshDatabase;

    private Transaction $transaksi;

    protected function setUp(): void
    {
        parent::setUp();
        $this->transaksi = Transaction::factory()->create();
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'transaction_id' => $this->transaksi->id,
            'alasan' => 'Kemasan rusak saat diterima pelanggan.',
            'jumlah_refund' => 15_000,
        ];
    }

    public function test_retur_dari_kasir_menunggu_persetujuan(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->postJson('/api/returns', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.status_approval', 'pending')
            ->assertJsonPath('data.penyetuju', null);
    }

    public function test_retur_dari_admin_langsung_disetujui(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->postJson('/api/returns', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.status_approval', 'approved')
            ->assertJsonPath('data.penyetuju.id', $admin->id);
    }

    public function test_admin_dapat_menyetujui_retur_kasir(): void
    {
        $kasir = User::factory()->kasir()->create();
        $admin = User::factory()->admin()->create();

        $id = $this->actingAs($kasir)->postJson('/api/returns', $this->payload())->json('data.id');

        $this->actingAs($admin)->postJson("/api/returns/{$id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status_approval', 'approved')
            ->assertJsonPath('data.penyetuju.id', $admin->id);
    }

    public function test_admin_dapat_menolak_retur(): void
    {
        $kasir = User::factory()->kasir()->create();
        $admin = User::factory()->admin()->create();

        $id = $this->actingAs($kasir)->postJson('/api/returns', $this->payload())->json('data.id');

        $this->actingAs($admin)->postJson("/api/returns/{$id}/reject")
            ->assertOk()
            ->assertJsonPath('data.status_approval', 'rejected');
    }

    public function test_kasir_tidak_dapat_menyetujui_retur(): void
    {
        $kasir = User::factory()->kasir()->create();
        $retur = SalesReturn::factory()->create(['transaction_id' => $this->transaksi->id]);

        $this->actingAs($kasir)->postJson("/api/returns/{$retur->id}/approve")->assertForbidden();
    }

    public function test_retur_yang_sudah_diproses_tidak_dapat_diproses_ulang(): void
    {
        $admin = User::factory()->admin()->create();
        $retur = SalesReturn::factory()->create([
            'transaction_id' => $this->transaksi->id,
            'status_approval' => 'approved',
        ]);

        $this->actingAs($admin)->postJson("/api/returns/{$retur->id}/approve")->assertStatus(409);
    }

    public function test_alasan_wajib_diisi(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->postJson('/api/returns', [
            'transaction_id' => $this->transaksi->id,
            'jumlah_refund' => 1_000,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('alasan');
    }
}
