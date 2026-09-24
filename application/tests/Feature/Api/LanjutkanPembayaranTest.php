<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Payment;
use App\Models\PaymentLog;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Services\MidtransService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

/**
 * Melanjutkan pembayaran non-tunai yang popup-nya sempat ditutup.
 *
 * Midtrans tidak pernah dihubungi: pemanggilan SDK (`buatSnapToken`,
 * `cekStatus`) diganti tiruan, sedangkan aturan milik kita (token aktif,
 * signature, idempotensi, stok) tetap berjalan sungguhan.
 */
class LanjutkanPembayaranTest extends TestCase
{
    use RefreshDatabase;

    private const SERVER_KEY = 'SB-Mid-server-KUNCI-PALSU-UNTUK-UJI';

    private const ORDER_ID = 'SA-TRX-20260924-0001';

    private User $kasir;

    private Product $produk;

    private Transaction $transaksi;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'midtrans.server_key' => self::SERVER_KEY,
            'midtrans.client_key' => 'SB-Mid-client-PALSU',
        ]);

        $this->kasir = User::factory()->kasir()->create();
        $shift = Shift::create([
            'user_id' => $this->kasir->id, 'waktu_buka' => now(), 'modal_awal' => 0,
        ]);

        $this->produk = Product::factory()->create([
            'harga_beli' => 10_000, 'harga_jual' => 15_000, 'stok' => 50,
        ]);

        $this->transaksi = Transaction::factory()->create([
            'shift_id' => $shift->id,
            'no_struk' => 'TRX-20260924-0001',
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
            'order_id' => self::ORDER_ID,
            'snap_token' => 'TOKEN-LAMA',
            'snap_kedaluwarsa' => now()->addMinutes(20),
            'transaction_status' => 'pending',
            'jumlah_bayar' => 0,
        ]);
    }

    /**
     * Jawaban Get Status API Midtrans, lengkap dengan signature yang sah.
     *
     * @return array<string, mixed>
     */
    private function statusMidtrans(string $status, string $kode): array
    {
        $p = [
            'order_id' => self::ORDER_ID,
            'status_code' => $kode,
            'gross_amount' => '33300.00',
            'transaction_status' => $status,
            'payment_type' => 'qris',
            'fraud_status' => 'accept',
        ];
        $p['signature_key'] = hash('sha512', $p['order_id'].$p['status_code'].$p['gross_amount'].self::SERVER_KEY);

        return $p;
    }

    private function tokenLamaKedaluwarsa(): void
    {
        $this->transaksi->payment()->update(['snap_kedaluwarsa' => now()->subMinutes(5)]);
    }

    public function test_token_yang_masih_berlaku_dibuka_ulang_tanpa_tagihan_baru(): void
    {
        $this->partialMock(MidtransService::class, function (MockInterface $m): void {
            $m->shouldNotReceive('buatSnapToken');
            $m->shouldNotReceive('cekStatus');
        });

        $this->actingAs($this->kasir)
            ->postJson("/api/transactions/{$this->transaksi->id}/snap-token")
            ->assertOk()
            ->assertJsonPath('data.snap_token', 'TOKEN-LAMA')
            ->assertJsonPath('data.dipakai_ulang', true)
            ->assertJsonPath('data.order_id', self::ORDER_ID);
    }

    public function test_tagihan_lama_yang_ternyata_lunas_tidak_ditagih_ulang(): void
    {
        $this->tokenLamaKedaluwarsa();

        $this->partialMock(MidtransService::class, function (MockInterface $m): void {
            $m->shouldReceive('cekStatus')->once()->andReturn($this->statusMidtrans('settlement', '200'));
            $m->shouldNotReceive('buatSnapToken');
        });

        $this->actingAs($this->kasir)
            ->postJson("/api/transactions/{$this->transaksi->id}/snap-token")
            ->assertStatus(409)
            ->assertJsonPath('data.status', 'settlement');

        $this->assertSame('settlement', $this->transaksi->fresh()?->status);
        $this->assertSame(48, $this->produk->fresh()?->stok, 'Stok berkurang tepat satu kali.');
        $this->assertDatabaseHas('payment_logs', ['dikonfirmasi_oleh' => 'midtrans-status-api']);
    }

    public function test_tagihan_lama_yang_belum_dipilih_metodenya_diganti_tagihan_baru(): void
    {
        $this->tokenLamaKedaluwarsa();

        $this->partialMock(MidtransService::class, function (MockInterface $m): void {
            // 404 dari Midtrans: popup lama tidak pernah dipakai membayar.
            $m->shouldReceive('cekStatus')->once()->andReturnNull();
            $m->shouldReceive('buatSnapToken')->once()->andReturn('TOKEN-BARU');
        });

        $this->actingAs($this->kasir)
            ->postJson("/api/transactions/{$this->transaksi->id}/snap-token")
            ->assertOk()
            ->assertJsonPath('data.snap_token', 'TOKEN-BARU')
            ->assertJsonPath('data.dipakai_ulang', false);
    }

    public function test_tagihan_lama_yang_masih_menunggu_di_midtrans_dibuka_ulang(): void
    {
        $this->tokenLamaKedaluwarsa();

        $this->partialMock(MidtransService::class, function (MockInterface $m): void {
            $m->shouldReceive('cekStatus')->once()->andReturn($this->statusMidtrans('pending', '201'));
            $m->shouldNotReceive('buatSnapToken');
        });

        $this->actingAs($this->kasir)
            ->postJson("/api/transactions/{$this->transaksi->id}/snap-token")
            ->assertOk()
            ->assertJsonPath('data.snap_token', 'TOKEN-LAMA')
            ->assertJsonPath('data.dipakai_ulang', true);

        $this->assertSame(50, $this->produk->fresh()?->stok, 'Pending tidak mengurangi stok.');
    }

    public function test_tagihan_yang_sudah_kedaluwarsa_tidak_dapat_ditagih_lagi(): void
    {
        $this->transaksi->update(['status' => 'expire']);

        $this->actingAs($this->kasir)
            ->postJson("/api/transactions/{$this->transaksi->id}/snap-token")
            ->assertStatus(409)
            ->assertJsonPath('data.status', 'expire');
    }

    public function test_status_midtrans_tidak_terjangkau_tidak_membuat_tagihan_baru(): void
    {
        $this->tokenLamaKedaluwarsa();

        $this->partialMock(MidtransService::class, function (MockInterface $m): void {
            $m->shouldReceive('cekStatus')->once()->andThrow(new RuntimeException('putus'));
            $m->shouldNotReceive('buatSnapToken');
        });

        $this->actingAs($this->kasir)
            ->postJson("/api/transactions/{$this->transaksi->id}/snap-token")
            ->assertStatus(502);
    }

    public function test_jawaban_status_bersignature_palsu_ditolak(): void
    {
        $palsu = $this->statusMidtrans('settlement', '200');
        $palsu['signature_key'] = str_repeat('0', 128);

        $this->partialMock(MidtransService::class, function (MockInterface $m) use ($palsu): void {
            $m->shouldReceive('cekStatus')->once()->andReturn($palsu);
        });

        $this->actingAs($this->kasir)
            ->getJson("/api/transactions/{$this->transaksi->id}/status")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.dicek_ke_midtrans', false);

        $this->assertSame(50, $this->produk->fresh()?->stok);
    }

    public function test_periksa_status_menyinkronkan_dari_midtrans(): void
    {
        $this->partialMock(MidtransService::class, function (MockInterface $m): void {
            $m->shouldReceive('cekStatus')->once()->andReturn($this->statusMidtrans('settlement', '200'));
        });

        $this->actingAs($this->kasir)
            ->getJson("/api/transactions/{$this->transaksi->id}/status")
            ->assertOk()
            ->assertJsonPath('data.status', 'settlement')
            ->assertJsonPath('data.dicek_ke_midtrans', true);

        // Webhook yang tiba belakangan dengan isi sama tidak mengurangi stok lagi.
        $this->postJson('/api/midtrans/notification', $this->statusMidtrans('settlement', '200'))->assertOk();

        $this->assertSame(48, $this->produk->fresh()?->stok);
        $this->assertSame(1, PaymentLog::query()->count());
    }

    public function test_periksa_status_tetap_menjawab_bila_midtrans_tidak_terjangkau(): void
    {
        $this->partialMock(MidtransService::class, function (MockInterface $m): void {
            $m->shouldReceive('cekStatus')->once()->andThrow(new RuntimeException('putus'));
        });

        $this->actingAs($this->kasir)
            ->getJson("/api/transactions/{$this->transaksi->id}/status")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.dicek_ke_midtrans', false);
    }

    public function test_order_id_tagihan_ulang_bertambah_berurutan(): void
    {
        $service = app(MidtransService::class);
        $payment = $this->transaksi->payment;
        $this->assertNotNull($payment);

        $payment->order_id = null;
        $this->assertSame('SA-TRX-20260924-0001', $service->orderIdBerikutnya($this->transaksi));

        $payment->order_id = 'SA-TRX-20260924-0001';
        $this->assertSame('SA-TRX-20260924-0001-R2', $service->orderIdBerikutnya($this->transaksi));

        $payment->order_id = 'SA-TRX-20260924-0001-R2';
        $this->assertSame('SA-TRX-20260924-0001-R3', $service->orderIdBerikutnya($this->transaksi));

        $payment->order_id = 'SA-TRX-20260924-0001-R9';
        $this->assertSame('SA-TRX-20260924-0001-R10', $service->orderIdBerikutnya($this->transaksi));
    }
}
