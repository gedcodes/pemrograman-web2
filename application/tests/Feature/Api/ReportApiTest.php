<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\OperationalExpense;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Product $produk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
        $this->produk = Product::factory()->create([
            'harga_beli' => 10_000,
            'harga_jual' => 15_000,
            'stok' => 5,
            'stok_minimum' => 10,
        ]);
    }

    private function transaksiLunas(int $qty, string $status = 'settlement'): Transaction
    {
        $shift = Shift::create([
            'user_id' => $this->admin->id, 'waktu_buka' => now(), 'modal_awal' => 0,
        ]);

        $subtotal = $qty * $this->produk->harga_jual;
        $pajak = (int) round($subtotal * 0.11);

        $trx = Transaction::factory()->create([
            'shift_id' => $shift->id,
            'tanggal' => now(),
            'subtotal' => $subtotal,
            'diskon' => 0,
            'pajak' => $pajak,
            'total' => $subtotal + $pajak,
            'status' => $status,
        ]);

        TransactionItem::factory()->create([
            'transaction_id' => $trx->id,
            'product_id' => $this->produk->id,
            'nama_produk' => $this->produk->nama_produk,
            'qty' => $qty,
            'harga_satuan' => $this->produk->harga_jual,
            'harga_beli' => $this->produk->harga_beli,
            'subtotal' => $subtotal,
        ]);

        return $trx;
    }

    public function test_laporan_penjualan_merekap_periode(): void
    {
        $this->transaksiLunas(2);
        $this->transaksiLunas(3);

        $this->actingAs($this->admin)->getJson('/api/reports/sales')
            ->assertOk()
            ->assertJsonPath('data.ringkasan.jumlah_transaksi', 2)
            // (2 + 3) x 15.000 = 75.000
            ->assertJsonPath('data.ringkasan.subtotal', 75_000);
    }

    public function test_laporan_penjualan_mengabaikan_transaksi_belum_lunas(): void
    {
        $this->transaksiLunas(2);
        $this->transaksiLunas(10, 'pending');
        $this->transaksiLunas(10, 'cancel');

        $this->actingAs($this->admin)->getJson('/api/reports/sales')
            ->assertOk()
            ->assertJsonPath('data.ringkasan.jumlah_transaksi', 1)
            ->assertJsonPath('data.ringkasan.subtotal', 30_000);
    }

    public function test_laba_kotor_dihitung_dari_selisih_harga(): void
    {
        $this->transaksiLunas(4);

        // pendapatan 4 x 15.000 = 60.000 ; HPP 4 x 10.000 = 40.000 ; laba 20.000
        $this->actingAs($this->admin)->getJson('/api/reports/profit-loss')
            ->assertOk()
            ->assertJsonPath('data.pendapatan_kotor', 60_000)
            ->assertJsonPath('data.harga_pokok_penjualan', 40_000)
            ->assertJsonPath('data.laba_kotor', 20_000)
            ->assertJsonPath('data.unit_terjual', 4)
            // margin = 20.000 / 60.000 = 33,33%
            ->assertJsonPath('data.margin_kotor', 33.33);
    }

    public function test_laporan_stok_menghitung_nilai_persediaan(): void
    {
        $this->actingAs($this->admin)->getJson('/api/reports/stock')
            ->assertOk()
            ->assertJsonPath('data.jumlah_produk', 1)
            ->assertJsonPath('data.total_unit', 5)
            // Persediaan dinilai pada harga beli: 5 x 10.000
            ->assertJsonPath('data.nilai_persediaan', 50_000)
            ->assertJsonPath('data.produk_stok_menipis', 1);
    }

    public function test_dashboard_mengembalikan_kartu_dan_grafik_tujuh_hari(): void
    {
        $this->transaksiLunas(2);

        $this->actingAs($this->admin)->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'kartu' => ['omzet_hari_ini', 'jumlah_transaksi', 'produk_terjual', 'stok_menipis'],
                    'grafik_7_hari',
                    'transaksi_terakhir',
                ],
            ])
            ->assertJsonCount(7, 'data.grafik_7_hari')
            ->assertJsonPath('data.kartu.jumlah_transaksi', 1)
            ->assertJsonPath('data.kartu.produk_terjual', 2)
            ->assertJsonPath('data.kartu.stok_menipis', 1);
    }

    /**
     * Regresi: grafik pernah menampilkan nol untuk seluruh hari.
     *
     * Penyebabnya alias `DATE(tanggal) as tanggal` yang tertimpa cast datetime
     * pada model, sehingga kuncinya menjadi "2026-09-17 00:00:00" dan tidak
     * pernah cocok dengan pencarian per tanggal. Bug ini lolos dari pengujian
     * lama karena yang diperiksa hanya JUMLAH titik grafik, bukan nilainya.
     */
    public function test_grafik_dashboard_memuat_omzet_hari_ini(): void
    {
        $this->transaksiLunas(4);

        $response = $this->actingAs($this->admin)->getJson('/api/dashboard')->assertOk();

        $deret = $response->json('data.grafik_7_hari');
        $hariIni = end($deret);

        $this->assertSame(now()->toDateString(), $hariIni['tanggal']);
        $this->assertSame(1, $hariIni['jumlah_transaksi']);
        $this->assertGreaterThan(0, $hariIni['omzet']);
    }

    /**
     * Regresi: tanggal pada rekap harian harus berupa string tanggal biasa,
     * bukan objek Carbon hasil hidrasi cast.
     */
    public function test_rekap_harian_memakai_string_tanggal(): void
    {
        $this->transaksiLunas(2);

        $response = $this->actingAs($this->admin)->getJson('/api/reports/sales')->assertOk();

        $baris = $response->json('data.harian.0');

        $this->assertSame(now()->toDateString(), $baris['tanggal_str']);
    }

    /**
     * Inti dari potret harga beli: laba periode lampau TIDAK BOLEH bergeser
     * ketika harga modal produk dinaikkan hari ini.
     */
    public function test_menaikkan_harga_beli_tidak_menggeser_laba_lampau(): void
    {
        $this->transaksiLunas(4);

        $sebelum = $this->actingAs($this->admin)
            ->getJson('/api/reports/profit-loss')
            ->json('data.laba_kotor');

        // Harga modal naik drastis SETELAH penjualan terjadi.
        $this->produk->update(['harga_beli' => 14_000]);

        $sesudah = $this->actingAs($this->admin)
            ->getJson('/api/reports/profit-loss')
            ->json('data.laba_kotor');

        $this->assertSame($sebelum, $sesudah, 'Laba periode lampau ikut bergeser.');
        // 4 x (15.000 - 10.000) = 20.000, memakai harga modal saat penjualan.
        $this->assertSame(20_000, $sesudah);
    }

    public function test_beban_operasional_diprorata_dan_mengurangi_laba(): void
    {
        $this->transaksiLunas(100); // pendapatan 1.500.000, HPP 1.000.000, laba kotor 500.000

        // 30.000/bulan -> tepat 1.000/hari, sehingga periode 7 hari = 7.000.
        OperationalExpense::factory()->create(['nama' => 'Sewa', 'jumlah_bulanan' => 30_000]);

        $d = $this->actingAs($this->admin)->getJson('/api/reports/profit-loss')->json('data');

        $this->assertSame(7, $d['periode']['jumlah_hari']);
        $this->assertSame(500_000, $d['laba_kotor']);
        $this->assertSame(7_000, $d['beban']['operasional']);
        $this->assertSame(493_000, $d['laba_bersih']);
    }

    public function test_beban_nonaktif_tidak_dihitung(): void
    {
        $this->transaksiLunas(10);
        OperationalExpense::factory()->create(['jumlah_bulanan' => 30_000, 'aktif' => false]);

        $d = $this->actingAs($this->admin)->getJson('/api/reports/profit-loss')->json('data');

        $this->assertSame(0, $d['beban']['operasional']);
        $this->assertSame($d['laba_kotor'], $d['laba_bersih']);
    }

    public function test_biaya_mdr_hanya_dari_transaksi_non_tunai(): void
    {
        $tunai = $this->transaksiLunas(10);
        Payment::factory()->create(['transaction_id' => $tunai->id, 'metode' => 'tunai']);

        $nonTunai = $this->transaksiLunas(10);
        Payment::factory()->create(['transaction_id' => $nonTunai->id, 'metode' => 'non_tunai']);

        $d = $this->actingAs($this->admin)->getJson('/api/reports/profit-loss')->json('data');

        // Hanya nilai transaksi non-tunai yang kena MDR 0,7%.
        $this->assertSame($nonTunai->total, $d['beban']['nilai_non_tunai']);
        $this->assertSame((int) round($nonTunai->total * 0.007), $d['beban']['mdr']);
    }

    public function test_kasir_tidak_boleh_mengelola_beban_operasional(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->getJson('/api/expenses')->assertForbidden();
        $this->actingAs($kasir)->postJson('/api/expenses')->assertForbidden();
    }

    public function test_beban_operasional_dapat_dikelola_admin(): void
    {
        $r = $this->actingAs($this->admin)->postJson('/api/expenses', [
            'nama' => 'Sewa tempat',
            'jumlah_bulanan' => 1_500_000,
        ])->assertCreated();

        $id = $r->json('data.id');

        $this->actingAs($this->admin)
            ->putJson("/api/expenses/{$id}", ['nama' => 'Sewa kios', 'jumlah_bulanan' => 1_750_000])
            ->assertOk()
            ->assertJsonPath('data.jumlah_bulanan', 1_750_000);

        $this->actingAs($this->admin)->deleteJson("/api/expenses/{$id}")->assertOk();
        $this->assertSoftDeleted('operational_expenses', ['id' => $id]);
    }

    public function test_kasir_boleh_melihat_dashboard(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->getJson('/api/dashboard')->assertOk();
    }
}
