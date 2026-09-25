<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Product;
use App\Models\StockMove;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Barang masuk dan stok opname: keduanya harus mengubah stok HANYA lewat
 * StockService, sehingga buku besar mutasi tidak pernah tertinggal.
 */
class InventoryApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Product $produk;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        $this->produk = Product::factory()->create(['stok' => 20, 'harga_beli' => 10_000]);
    }

    public function test_barang_masuk_menambah_stok_dan_menghitung_total(): void
    {
        $supplier = Supplier::factory()->create();

        $this->actingAs($this->admin)->postJson('/api/purchases', [
            'supplier_id' => $supplier->id,
            'items' => [
                ['product_id' => $this->produk->id, 'qty' => 30, 'harga_beli' => 9_500],
            ],
        ])
            ->assertCreated()
            // Total dihitung dari baris: 30 x 9.500 = 285.000
            ->assertJsonPath('data.total_biaya', 285_000);

        $this->assertSame(50, $this->produk->fresh()->stok);

        $this->assertDatabaseHas('stock_moves', [
            'product_id' => $this->produk->id,
            'tipe' => 'masuk',
            'qty' => 30,
            'stok_sebelum' => 20,
            'stok_sesudah' => 50,
        ]);
    }

    public function test_nomor_dokumen_barang_masuk_dibentuk_otomatis(): void
    {
        $supplier = Supplier::factory()->create();
        $payload = [
            'supplier_id' => $supplier->id,
            'items' => [['product_id' => $this->produk->id, 'qty' => 1, 'harga_beli' => 1_000]],
        ];

        $a = $this->actingAs($this->admin)->postJson('/api/purchases', $payload)->json('data.no_dokumen');
        $b = $this->actingAs($this->admin)->postJson('/api/purchases', $payload)->json('data.no_dokumen');

        $this->assertMatchesRegularExpression('/^BM-\d{8}-\d{3}$/', (string) $a);
        $this->assertNotSame($a, $b);
    }

    public function test_barang_masuk_tanpa_item_ditolak(): void
    {
        $supplier = Supplier::factory()->create();

        $this->actingAs($this->admin)->postJson('/api/purchases', [
            'supplier_id' => $supplier->id,
            'items' => [],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');
    }

    public function test_opname_menyesuaikan_stok_ke_hitung_fisik(): void
    {
        // Stok sistem 20, hitung fisik 17 -> selisih -3
        $this->actingAs($this->admin)->postJson('/api/opnames', [
            'items' => [['product_id' => $this->produk->id, 'stok_fisik' => 17]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.stok_sistem', 20)
            ->assertJsonPath('data.items.0.stok_fisik', 17)
            ->assertJsonPath('data.items.0.selisih', -3);

        $this->assertSame(17, $this->produk->fresh()->stok);

        $this->assertDatabaseHas('stock_moves', [
            'product_id' => $this->produk->id,
            'tipe' => 'opname',
            'qty' => -3,
            'stok_sebelum' => 20,
            'stok_sesudah' => 17,
        ]);
    }

    public function test_opname_tanpa_selisih_tidak_menulis_mutasi(): void
    {
        $this->actingAs($this->admin)->postJson('/api/opnames', [
            'items' => [['product_id' => $this->produk->id, 'stok_fisik' => 20]],
        ])->assertCreated();

        $this->assertSame(20, $this->produk->fresh()->stok);
        $this->assertDatabaseCount('stock_moves', 0);
    }

    public function test_opname_dapat_menambah_stok_bila_fisik_lebih_banyak(): void
    {
        $this->actingAs($this->admin)->postJson('/api/opnames', [
            'items' => [['product_id' => $this->produk->id, 'stok_fisik' => 26]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.selisih', 6);

        $this->assertSame(26, $this->produk->fresh()->stok);
    }

    public function test_opname_menerapkan_selisih_sehingga_penjualan_selama_hitung_tidak_hilang(): void
    {
        // Lembar hitung dibuka saat stok buku 20. Selama petugas menghitung,
        // terjual 2 (stok kini 18). Fisik yang dihitung 17 → selisih -3.
        $this->produk->forceFill(['stok' => 18])->save();

        $this->actingAs($this->admin)->postJson('/api/opnames', [
            'items' => [[
                'product_id' => $this->produk->id,
                'stok_sistem' => 20,
                'stok_fisik' => 17,
            ]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.stok_sistem', 20)
            ->assertJsonPath('data.items.0.selisih', -3);

        // 18 - 3 = 15: penjualan 2 unit tadi tetap tercatat.
        $this->assertSame(15, $this->produk->fresh()->stok);
    }

    public function test_opname_yang_membuat_stok_negatif_ditolak_utuh(): void
    {
        $this->produk->forceFill(['stok' => 2])->save();

        $this->actingAs($this->admin)->postJson('/api/opnames', [
            'items' => [[
                'product_id' => $this->produk->id,
                'stok_sistem' => 20,
                'stok_fisik' => 10,
            ]],
        ])->assertStatus(422);

        $this->assertSame(2, $this->produk->fresh()->stok);
        $this->assertDatabaseCount('stock_opnames', 0);
    }

    public function test_barang_yang_cocok_ikut_tercatat_tanpa_mengubah_stok(): void
    {
        $cocok = Product::factory()->create(['stok' => 7]);

        $id = $this->actingAs($this->admin)->postJson('/api/opnames', [
            'items' => [
                ['product_id' => $this->produk->id, 'stok_fisik' => $this->produk->stok - 2, 'stok_sistem' => $this->produk->stok],
                ['product_id' => $cocok->id, 'stok_fisik' => 7, 'stok_sistem' => 7],
            ],
        ])->assertCreated()->json('data.id');

        // Yang cocok tercatat sebagai barang yang diperiksa, tanpa mutasi stok.
        $this->assertDatabaseHas('opname_items', ['product_id' => $cocok->id, 'selisih' => 0]);
        $this->assertSame(0, StockMove::where('product_id', $cocok->id)->count());
        $this->assertSame(7, $cocok->fresh()?->stok);

        $this->actingAs($this->admin)->getJson('/api/opnames')
            ->assertJsonPath('data.0.jumlah_produk', 2)
            ->assertJsonPath('data.0.jumlah_berselisih', 1);

        // Rincian: barang berselisih lebih dulu, lengkap dengan data produknya.
        $this->actingAs($this->admin)->getJson("/api/opnames/{$id}")
            ->assertOk()
            ->assertJsonPath('data.items.0.product_id', $this->produk->id)
            ->assertJsonPath('data.items.0.selisih', -2)
            ->assertJsonPath('data.items.0.nilai_selisih', -2 * $this->produk->harga_beli)
            ->assertJsonPath('data.items.0.product.nama_produk', $this->produk->nama_produk)
            ->assertJsonPath('data.items.1.product_id', $cocok->id)
            ->assertJsonPath('data.items.1.selisih', 0);
    }

    public function test_rincian_opname_tetap_menampilkan_produk_yang_sudah_dihapus(): void
    {
        $p = Product::factory()->create(['stok' => 3]);
        $id = $this->actingAs($this->admin)->postJson('/api/opnames', [
            'items' => [['product_id' => $p->id, 'stok_fisik' => 3, 'stok_sistem' => 3]],
        ])->json('data.id');

        $p->delete();

        $this->actingAs($this->admin)->getJson("/api/opnames/{$id}")
            ->assertJsonPath('data.items.0.product.nama_produk', $p->nama_produk)
            ->assertJsonPath('data.items.0.product.dihapus', true);
    }

    public function test_produk_ganda_dalam_satu_opname_ditolak(): void
    {
        $this->actingAs($this->admin)->postJson('/api/opnames', [
            'items' => [
                ['product_id' => $this->produk->id, 'stok_fisik' => 17],
                ['product_id' => $this->produk->id, 'stok_fisik' => 19],
            ],
        ])->assertStatus(422);
    }

    public function test_kasir_boleh_melihat_inventori_tetapi_tidak_mengubahnya(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->getJson('/api/purchases')->assertOk();
        $this->actingAs($kasir)->getJson('/api/opnames')->assertOk();

        $this->actingAs($kasir)->postJson('/api/purchases', [])->assertForbidden();
        $this->actingAs($kasir)->postJson('/api/opnames', [])->assertForbidden();
    }
}
