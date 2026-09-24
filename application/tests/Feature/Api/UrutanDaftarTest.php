<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Urutan per kolom dan ukuran halaman pada endpoint daftar (App\Support\Daftar).
 */
class UrutanDaftarTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
        foreach ([['Beras', 78_000], ['Aqua', 4_000], ['Cabai', 12_000]] as [$nama, $harga]) {
            Product::factory()->create(['nama_produk' => $nama, 'harga_beli' => 1_000, 'harga_jual' => $harga]);
        }
    }

    /**
     * @return list<string>
     */
    private function urutanNama(string $query): array
    {
        return array_column(
            $this->actingAs($this->admin)->getJson("/api/products?{$query}")->assertOk()->json('data'),
            'nama_produk',
        );
    }

    public function test_urutan_bawaan_adalah_nama_naik(): void
    {
        $this->assertSame(['Aqua', 'Beras', 'Cabai'], $this->urutanNama(''));
    }

    public function test_dapat_diurutkan_per_kolom_dan_arah(): void
    {
        $this->assertSame(['Beras', 'Cabai', 'Aqua'], $this->urutanNama('urut=harga_jual&arah=desc'));
        $this->assertSame(['Aqua', 'Cabai', 'Beras'], $this->urutanNama('urut=harga_jual&arah=asc'));
    }

    public function test_kolom_di_luar_daftar_izin_diabaikan(): void
    {
        // Nama kolom tidak pernah diteruskan mentah ke SQL.
        $this->assertSame(['Aqua', 'Beras', 'Cabai'], $this->urutanNama('urut=harga_jual;DROP TABLE users&arah=desc'));
        $this->assertSame(['Aqua', 'Beras', 'Cabai'], $this->urutanNama('urut=deleted_at'));
        $this->assertDatabaseCount('users', 1);
    }

    public function test_ukuran_halaman_dibatasi(): void
    {
        $this->actingAs($this->admin)->getJson('/api/products?per_page=5000')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 200);

        $this->actingAs($this->admin)->getJson('/api/products?per_page=2')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.last_page', 2);
    }
}
