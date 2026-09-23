<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Aturan inti kasir: perhitungan total, pengurangan stok, dan penolakan
 * transaksi yang tidak sah.
 */
class TransactionApiTest extends TestCase
{
    use RefreshDatabase;

    private User $kasir;

    private Product $produk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->kasir = User::factory()->kasir()->create();
        $this->produk = Product::factory()->create([
            'nama_produk' => 'Teh Pucuk 350ml',
            'harga_beli' => 4_600,
            'harga_jual' => 5_500,
            'stok' => 100,
            'stok_minimum' => 10,
        ]);
    }

    private function bukaShift(): Shift
    {
        return Shift::create([
            'user_id' => $this->kasir->id,
            'waktu_buka' => now(),
            'modal_awal' => 300_000,
        ]);
    }

    public function test_transaksi_tunai_menghitung_total_dari_item(): void
    {
        $this->bukaShift();

        // 2 x 5.500 = 11.000 ; tanpa member tidak ada diskon ; PPN 11% = 1.210
        $response = $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'tunai',
            'jumlah_bayar' => 20_000,
            'items' => [['product_id' => $this->produk->id, 'qty' => 2]],
        ])->assertCreated();

        $response
            ->assertJsonPath('data.subtotal', 11_000)
            ->assertJsonPath('data.diskon', 0)
            ->assertJsonPath('data.pajak', 1_210)
            ->assertJsonPath('data.total', 12_210)
            ->assertJsonPath('data.status', 'settlement')
            ->assertJsonPath('data.payment.kembalian', 7_790);
    }

    public function test_diskon_member_dipotong_sebelum_ppn(): void
    {
        $this->bukaShift();
        $customer = Customer::factory()->create();

        // subtotal 55.000 ; diskon 5% = 2.750 ; DPP 52.250 ; PPN 11% = 5.748 (bulat)
        $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'tunai',
            'jumlah_bayar' => 100_000,
            'customer_id' => $customer->id,
            'items' => [['product_id' => $this->produk->id, 'qty' => 10]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.subtotal', 55_000)
            ->assertJsonPath('data.diskon', 2_750)
            ->assertJsonPath('data.pajak', 5_748)
            ->assertJsonPath('data.total', 57_998);
    }

    public function test_harga_kiriman_klien_diabaikan(): void
    {
        $this->bukaShift();

        // Klien mencoba menyuntikkan harga satuan sendiri; server harus mengabaikannya.
        $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'tunai',
            'jumlah_bayar' => 20_000,
            'items' => [[
                'product_id' => $this->produk->id,
                'qty' => 1,
                'harga_satuan' => 1,
                'subtotal' => 1,
            ]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.subtotal', 5_500);
    }

    public function test_stok_berkurang_dan_mutasi_tercatat(): void
    {
        $this->bukaShift();

        $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'tunai',
            'jumlah_bayar' => 50_000,
            'items' => [['product_id' => $this->produk->id, 'qty' => 3]],
        ])->assertCreated();

        $this->assertSame(97, $this->produk->fresh()->stok);

        $this->assertDatabaseHas('stock_moves', [
            'product_id' => $this->produk->id,
            'tipe' => 'keluar',
            'qty' => -3,
            'stok_sebelum' => 100,
            'stok_sesudah' => 97,
            'referensi_tipe' => 'transaction',
        ]);
    }

    public function test_stok_tidak_cukup_ditolak_dan_tidak_menyisakan_data(): void
    {
        $this->bukaShift();

        $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'tunai',
            'jumlah_bayar' => 10_000_000,
            'items' => [['product_id' => $this->produk->id, 'qty' => 500]],
        ])->assertStatus(422);

        // Database transaction harus membatalkan seluruhnya.
        $this->assertSame(100, $this->produk->fresh()->stok);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('transaction_items', 0);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_uang_tunai_kurang_ditolak(): void
    {
        $this->bukaShift();

        $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'tunai',
            'jumlah_bayar' => 1_000,
            'items' => [['product_id' => $this->produk->id, 'qty' => 2]],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('jumlah_bayar');

        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_non_tunai_berstatus_pending_dan_belum_mengurangi_stok(): void
    {
        $this->bukaShift();

        $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'non_tunai',
            'items' => [['product_id' => $this->produk->id, 'qty' => 4]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        // Aturan Bagian 4.3: stok baru berkurang saat webhook settlement tiba.
        $this->assertSame(100, $this->produk->fresh()->stok);
        $this->assertDatabaseCount('stock_moves', 0);
    }

    public function test_tanpa_shift_terbuka_transaksi_ditolak(): void
    {
        $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'tunai',
            'jumlah_bayar' => 20_000,
            'items' => [['product_id' => $this->produk->id, 'qty' => 1]],
        ])->assertStatus(409);
    }

    public function test_baris_produk_kembar_digabung(): void
    {
        $this->bukaShift();

        $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'tunai',
            'jumlah_bayar' => 50_000,
            'items' => [
                ['product_id' => $this->produk->id, 'qty' => 2],
                ['product_id' => $this->produk->id, 'qty' => 3],
            ],
        ])
            ->assertCreated()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.qty', 5);
    }

    public function test_item_kosong_ditolak(): void
    {
        $this->bukaShift();

        $this->actingAs($this->kasir)->postJson('/api/transactions', [
            'metode' => 'tunai',
            'jumlah_bayar' => 10_000,
            'items' => [],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');
    }

    public function test_kasir_hanya_melihat_transaksi_shift_sendiri(): void
    {
        $shiftSaya = $this->bukaShift();
        Transaction::factory()->create(['shift_id' => $shiftSaya->id, 'no_struk' => 'TRX-MILIK-SAYA']);

        $kasirLain = User::factory()->kasir()->create();
        $shiftLain = Shift::create([
            'user_id' => $kasirLain->id, 'waktu_buka' => now(), 'modal_awal' => 0,
        ]);
        Transaction::factory()->create(['shift_id' => $shiftLain->id, 'no_struk' => 'TRX-ORANG-LAIN']);

        $this->actingAs($this->kasir)->getJson('/api/transactions')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.no_struk', 'TRX-MILIK-SAYA');
    }

    public function test_admin_melihat_seluruh_transaksi(): void
    {
        $shift = $this->bukaShift();
        Transaction::factory()->count(3)->create(['shift_id' => $shift->id]);

        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->getJson('/api/transactions')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }
}
