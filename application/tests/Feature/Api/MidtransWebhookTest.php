<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Payment;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Services\MidtransService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Webhook Midtrans.
 *
 * Seluruh pengujian di sini memakai Server Key palsu dan payload yang disusun
 * sendiri, sehingga tidak memerlukan akun Midtrans sungguhan. Yang diuji adalah
 * aturan yang kita tulis: verifikasi signature, pemetaan status, idempotensi,
 * dan syarat pengurangan stok.
 */
class MidtransWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const SERVER_KEY = 'SB-Mid-server-KUNCI-PALSU-UNTUK-UJI';

    private Product $produk;

    private Transaction $transaksi;

    protected function setUp(): void
    {
        parent::setUp();

        config(['midtrans.server_key' => self::SERVER_KEY]);

        $kasir = User::factory()->kasir()->create();
        $shift = Shift::create([
            'user_id' => $kasir->id, 'waktu_buka' => now(), 'modal_awal' => 0,
        ]);

        $this->produk = Product::factory()->create([
            'harga_beli' => 10_000, 'harga_jual' => 15_000, 'stok' => 50,
        ]);

        $this->transaksi = Transaction::factory()->create([
            'shift_id' => $shift->id,
            'no_struk' => 'TRX-20260923-0001',
            'subtotal' => 30_000,
            'diskon' => 0,
            'pajak' => 3_300,
            'total' => 33_300,
            'status' => 'pending',
        ]);

        TransactionItem::factory()->create([
            'transaction_id' => $this->transaksi->id,
            'product_id' => $this->produk->id,
            'nama_produk' => $this->produk->nama_produk,
            'qty' => 2,
            'harga_satuan' => 15_000,
            'subtotal' => 30_000,
        ]);

        Payment::factory()->create([
            'transaction_id' => $this->transaksi->id,
            'metode' => 'non_tunai',
            'order_id' => 'SA-TRX-20260923-0001',
            'transaction_status' => 'pending',
            'jumlah_bayar' => 0,
        ]);
    }

    /**
     * Susun payload lengkap dengan signature yang sah.
     *
     * @param  array<string, mixed>  $ubah
     * @return array<string, mixed>
     */
    private function payload(array $ubah = []): array
    {
        $p = array_merge([
            'order_id' => 'SA-TRX-20260923-0001',
            'status_code' => '200',
            'gross_amount' => '33300.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'qris',
            'fraud_status' => 'accept',
        ], $ubah);

        $p['signature_key'] = hash('sha512',
            $p['order_id'].$p['status_code'].$p['gross_amount'].self::SERVER_KEY);

        return $p;
    }

    public function test_signature_tidak_sah_ditolak(): void
    {
        $p = $this->payload();
        $p['signature_key'] = str_repeat('a', 128);

        $this->postJson('/api/midtrans/notification', $p)->assertForbidden();

        // Tidak boleh ada perubahan apa pun.
        $this->assertSame('pending', $this->transaksi->fresh()->status);
        $this->assertSame(50, $this->produk->fresh()->stok);
    }

    public function test_signature_kosong_ditolak(): void
    {
        $p = $this->payload();
        unset($p['signature_key']);

        $this->postJson('/api/midtrans/notification', $p)->assertForbidden();
    }

    public function test_nominal_yang_diubah_membuat_signature_gagal(): void
    {
        // Penyerang mengubah gross_amount setelah signature dihitung.
        $p = $this->payload();
        $p['gross_amount'] = '1.00';

        $this->postJson('/api/midtrans/notification', $p)->assertForbidden();
        $this->assertSame('pending', $this->transaksi->fresh()->status);
    }

    public function test_webhook_tidak_memerlukan_autentikasi(): void
    {
        // Midtrans memanggil tanpa sesi; yang menjaga adalah signature.
        $this->postJson('/api/midtrans/notification', $this->payload())->assertOk();
    }

    public function test_settlement_melunasi_transaksi_dan_mengurangi_stok(): void
    {
        $this->postJson('/api/midtrans/notification', $this->payload())
            ->assertOk()
            ->assertJsonPath('status', 'settlement');

        $this->assertSame('settlement', $this->transaksi->fresh()->status);
        $this->assertSame(48, $this->produk->fresh()->stok);

        $this->assertDatabaseHas('stock_moves', [
            'product_id' => $this->produk->id,
            'tipe' => 'keluar',
            'qty' => -2,
            'referensi_tipe' => 'transaction',
        ]);

        $this->assertDatabaseHas('payment_logs', [
            'status_lama' => 'pending',
            'status_baru' => 'settlement',
            'dikonfirmasi_oleh' => 'midtrans-webhook',
        ]);
    }

    public function test_notifikasi_duplikat_tidak_mengurangi_stok_dua_kali(): void
    {
        $p = $this->payload();

        $this->postJson('/api/midtrans/notification', $p)->assertOk();
        $this->postJson('/api/midtrans/notification', $p)
            ->assertOk()
            ->assertJsonPath('message', 'notifikasi duplikat');
        $this->postJson('/api/midtrans/notification', $p)->assertOk();

        // Stok hanya boleh berkurang sekali walau notifikasi datang tiga kali.
        $this->assertSame(48, $this->produk->fresh()->stok);
        $this->assertDatabaseCount('stock_moves', 1);
        $this->assertDatabaseCount('payment_logs', 1);
    }

    public function test_status_pending_tidak_mengurangi_stok(): void
    {
        $this->postJson('/api/midtrans/notification', $this->payload([
            'transaction_status' => 'pending',
            'status_code' => '201',
        ]))->assertOk();

        $this->assertSame('pending', $this->transaksi->fresh()->status);
        $this->assertSame(50, $this->produk->fresh()->stok);
        $this->assertDatabaseCount('stock_moves', 0);
    }

    public function test_expire_tidak_mengurangi_stok(): void
    {
        $this->postJson('/api/midtrans/notification', $this->payload([
            'transaction_status' => 'expire',
            'status_code' => '407',
        ]))->assertOk();

        $this->assertSame('expire', $this->transaksi->fresh()->status);
        $this->assertSame(50, $this->produk->fresh()->stok);
    }

    public function test_capture_dengan_fraud_challenge_tetap_pending(): void
    {
        $this->postJson('/api/midtrans/notification', $this->payload([
            'transaction_status' => 'capture',
            'fraud_status' => 'challenge',
            'payment_type' => 'credit_card',
        ]))->assertOk();

        // Kartu yang ditandai perlu ditinjau belum boleh dianggap lunas.
        $this->assertSame('pending', $this->transaksi->fresh()->status);
        $this->assertSame(50, $this->produk->fresh()->stok);
    }

    public function test_capture_dengan_fraud_accept_dianggap_lunas(): void
    {
        $this->postJson('/api/midtrans/notification', $this->payload([
            'transaction_status' => 'capture',
            'fraud_status' => 'accept',
            'payment_type' => 'credit_card',
        ]))->assertOk();

        $this->assertSame('settlement', $this->transaksi->fresh()->status);
        $this->assertSame(48, $this->produk->fresh()->stok);
    }

    public function test_status_final_tidak_dapat_dimundurkan(): void
    {
        $this->postJson('/api/midtrans/notification', $this->payload())->assertOk();
        $this->assertSame('settlement', $this->transaksi->fresh()->status);

        // Notifikasi susulan yang mencoba membatalkan transaksi lunas.
        $this->postJson('/api/midtrans/notification', $this->payload([
            'transaction_status' => 'cancel',
            'status_code' => '202',
        ]))
            ->assertOk()
            ->assertJsonPath('message', 'status sudah final');

        $this->assertSame('settlement', $this->transaksi->fresh()->status);
        $this->assertSame(48, $this->produk->fresh()->stok);
    }

    public function test_order_id_tidak_dikenal_dibalas_tanpa_perubahan(): void
    {
        $this->postJson('/api/midtrans/notification', $this->payload([
            'order_id' => 'SA-TIDAK-ADA',
        ]))
            ->assertOk()
            ->assertJsonPath('message', 'order_id tidak dikenal');

        $this->assertSame('pending', $this->transaksi->fresh()->status);
    }

    /**
     * @return list<array{0: string, 1: string|null, 2: string}>
     */
    public static function pemetaanStatus(): array
    {
        return [
            ['settlement', 'accept', 'settlement'],
            ['capture', 'accept', 'settlement'],
            ['capture', 'challenge', 'pending'],
            ['pending', null, 'pending'],
            ['deny', null, 'deny'],
            ['cancel', null, 'cancel'],
            ['expire', null, 'expire'],
            ['failure', null, 'deny'],
        ];
    }

    #[DataProvider('pemetaanStatus')]
    public function test_pemetaan_status_midtrans(string $midtrans, ?string $fraud, string $harapan): void
    {
        $service = app(MidtransService::class);

        $this->assertSame($harapan, $service->petakanStatus($midtrans, $fraud));
    }

    public function test_snap_token_ditolak_bila_kredensial_belum_diisi(): void
    {
        config(['midtrans.server_key' => '', 'midtrans.client_key' => '']);

        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/transactions/'.$this->transaksi->id.'/snap-token')
            ->assertStatus(503);
    }

    public function test_snap_token_ditolak_untuk_transaksi_yang_sudah_lunas(): void
    {
        config(['midtrans.client_key' => 'SB-Mid-client-PALSU']);
        $this->transaksi->update(['status' => 'settlement']);

        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/transactions/'.$this->transaksi->id.'/snap-token')
            ->assertStatus(409);
    }

    public function test_konfigurasi_hanya_membocorkan_client_key(): void
    {
        config(['midtrans.client_key' => 'SB-Mid-client-PALSU']);

        $kasir = User::factory()->kasir()->create();

        $response = $this->actingAs($kasir)->getJson('/api/midtrans/config')->assertOk();

        $response->assertJsonPath('data.client_key', 'SB-Mid-client-PALSU');
        // Server Key tidak boleh muncul di mana pun pada response.
        $this->assertStringNotContainsString(self::SERVER_KEY, $response->getContent() ?: '');
    }

    public function test_endpoint_status_dapat_dipakai_sebagai_cadangan(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)
            ->getJson('/api/transactions/'.$this->transaksi->id.'/status')
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.payment.metode', 'non_tunai');
    }
}
