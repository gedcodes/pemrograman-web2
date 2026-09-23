<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MasterDataTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    public function test_kategori_dapat_dibuat_dan_slug_dibentuk_otomatis(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/categories', ['nama_kategori' => 'Sembako Pilihan'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'sembako-pilihan')
            ->assertJsonPath('message', 'Kategori berhasil ditambahkan.');
    }

    public function test_nama_kategori_tidak_boleh_kembar(): void
    {
        Category::factory()->create(['nama_kategori' => 'Minuman', 'slug' => 'minuman']);

        $this->actingAs($this->admin)
            ->postJson('/api/categories', ['nama_kategori' => 'Minuman'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('nama_kategori');
    }

    public function test_kategori_yang_masih_dipakai_produk_tidak_dapat_dihapus(): void
    {
        $product = Product::factory()->create();

        $this->actingAs($this->admin)
            ->deleteJson('/api/categories/'.$product->category_id)
            ->assertStatus(409);

        $this->assertDatabaseHas('categories', [
            'id' => $product->category_id,
            'deleted_at' => null,
        ]);
    }

    public function test_kategori_tanpa_produk_dapat_dihapus(): void
    {
        $category = Category::factory()->create();

        $this->actingAs($this->admin)
            ->deleteJson('/api/categories/'.$category->id)
            ->assertOk();

        $this->assertSoftDeleted('categories', ['id' => $category->id]);
    }

    public function test_satuan_yang_masih_dipakai_tidak_dapat_dihapus(): void
    {
        $product = Product::factory()->create();

        $this->actingAs($this->admin)
            ->deleteJson('/api/units/'.$product->unit_id)
            ->assertStatus(409);
    }

    public function test_pelanggan_dapat_dibuat_dan_diperbarui(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/customers', ['nama' => 'Bu Ratna', 'no_hp' => '0811000111'])
            ->assertCreated();

        $id = $response->json('data.id');

        $this->actingAs($this->admin)
            ->putJson('/api/customers/'.$id, ['nama' => 'Bu Ratna Dewi', 'no_hp' => '0811000111'])
            ->assertOk()
            ->assertJsonPath('data.nama', 'Bu Ratna Dewi');
    }

    public function test_no_hp_kembar_ditolak_tetapi_memperbarui_diri_sendiri_diizinkan(): void
    {
        $a = Customer::factory()->create(['no_hp' => '0811111111']);
        Customer::factory()->create(['no_hp' => '0822222222']);

        // Memperbarui diri sendiri dengan nomor yang sama harus lolos.
        $this->actingAs($this->admin)
            ->putJson('/api/customers/'.$a->id, ['nama' => 'Ganti Nama', 'no_hp' => '0811111111'])
            ->assertOk();

        // Memakai nomor milik pelanggan lain harus ditolak.
        $this->actingAs($this->admin)
            ->putJson('/api/customers/'.$a->id, ['nama' => 'Ganti Nama', 'no_hp' => '0822222222'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('no_hp');
    }

    public function test_supplier_dapat_dikelola_admin(): void
    {
        $supplier = Supplier::factory()->create();

        $this->actingAs($this->admin)->getJson('/api/suppliers/'.$supplier->id)->assertOk();
        $this->actingAs($this->admin)->deleteJson('/api/suppliers/'.$supplier->id)->assertOk();
    }

    public function test_pencarian_menyaring_hasil(): void
    {
        Unit::factory()->create(['nama_satuan' => 'Kilogram', 'simbol' => 'Kg']);
        Unit::factory()->create(['nama_satuan' => 'Botol', 'simbol' => 'Btl']);

        $this->actingAs($this->admin)
            ->getJson('/api/units?q=Kilo')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama_satuan', 'Kilogram');
    }
}
