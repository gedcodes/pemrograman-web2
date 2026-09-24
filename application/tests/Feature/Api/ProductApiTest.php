<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Category $category;

    private Unit $unit;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        $this->category = Category::factory()->create();
        $this->unit = Unit::factory()->create();
    }

    /**
     * @param  array<string, mixed>  $ubah
     * @return array<string, mixed>
     */
    private function payload(array $ubah = []): array
    {
        return array_merge([
            'barcode' => '8991234567890',
            'nama_produk' => 'Kopi Robusta 250g',
            'category_id' => $this->category->id,
            'unit_id' => $this->unit->id,
            'harga_beli' => 20_000,
            'harga_jual' => 25_000,
            'stok' => 40,
            'stok_minimum' => 10,
        ], $ubah);
    }

    public function test_produk_dapat_dibuat(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/products', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.nama_produk', 'Kopi Robusta 250g')
            // Default basis data harus ikut terbawa ke response, bukan null.
            ->assertJsonPath('data.aktif', true)
            // margin = (25000 - 20000) / 25000 = 20%
            // json_encode memangkas pecahan nol, sehingga nilainya tiba sebagai 20.
            ->assertJsonPath('data.margin', 20);
    }

    public function test_harga_jual_di_bawah_harga_beli_ditolak(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/products', $this->payload(['harga_beli' => 30_000, 'harga_jual' => 25_000]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('harga_jual')
            ->assertJsonPath(
                'errors.harga_jual.0',
                'Harga jual tidak boleh lebih kecil daripada harga beli.',
            );
    }

    public function test_mengubah_produk_tidak_boleh_mengubah_stok(): void
    {
        $product = Product::factory()->create(['stok' => 40]);

        $this->actingAs($this->admin)
            ->putJson("/api/products/{$product->id}", $this->payload(['stok' => 999]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('stok');

        $this->assertSame(40, $product->fresh()?->stok);
    }

    public function test_mengubah_produk_tanpa_stok_tidak_menyentuh_stok(): void
    {
        $product = Product::factory()->create(['stok' => 40]);
        $muatan = $this->payload(['harga_jual' => 27_000]);
        unset($muatan['stok']);

        $this->actingAs($this->admin)
            ->putJson("/api/products/{$product->id}", $muatan)
            ->assertOk()
            ->assertJsonPath('data.harga_jual', 27_000)
            ->assertJsonPath('data.stok', 40);
    }

    public function test_harga_jual_sama_dengan_harga_beli_diizinkan(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/products', $this->payload(['harga_beli' => 25_000, 'harga_jual' => 25_000]))
            ->assertCreated();
    }

    public function test_barcode_tidak_boleh_kembar(): void
    {
        Product::factory()->create(['barcode' => '8991234567890']);

        $this->actingAs($this->admin)
            ->postJson('/api/products', $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('barcode');
    }

    public function test_pencarian_barcode_menemukan_produk(): void
    {
        $product = Product::factory()->create(['barcode' => '8990001112223', 'aktif' => true]);

        $this->actingAs($this->admin)
            ->getJson('/api/products/barcode/8990001112223')
            ->assertOk()
            ->assertJsonPath('data.id', $product->id);
    }

    public function test_pencarian_barcode_tidak_dikenal_menghasilkan_404(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/products/barcode/0000000000000')
            ->assertNotFound();
    }

    public function test_produk_nonaktif_tidak_muncul_pada_pencarian_barcode(): void
    {
        Product::factory()->create(['barcode' => '8887776665554', 'aktif' => false]);

        $this->actingAs($this->admin)
            ->getJson('/api/products/barcode/8887776665554')
            ->assertNotFound();
    }

    public function test_penyaringan_stok_menipis(): void
    {
        Product::factory()->create(['nama_produk' => 'Menipis', 'stok' => 2, 'stok_minimum' => 10]);
        Product::factory()->create(['nama_produk' => 'Aman', 'stok' => 80, 'stok_minimum' => 10]);

        $this->actingAs($this->admin)
            ->getJson('/api/products?stok_menipis=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama_produk', 'Menipis')
            ->assertJsonPath('data.0.stok_menipis', true);
    }

    public function test_penyaringan_kategori(): void
    {
        $lain = Category::factory()->create();
        Product::factory()->create(['category_id' => $this->category->id]);
        Product::factory()->create(['category_id' => $lain->id]);

        $this->actingAs($this->admin)
            ->getJson('/api/products?category_id='.$this->category->id)
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_produk_yang_pernah_terjual_tidak_dapat_dihapus(): void
    {
        $product = Product::factory()->create();
        $product->stockMoves()->create([
            'tipe' => 'masuk', 'qty' => 10, 'stok_sebelum' => 0, 'stok_sesudah' => 10,
        ]);

        $this->actingAs($this->admin)
            ->deleteJson('/api/products/'.$product->id)
            ->assertStatus(409);
    }
}
