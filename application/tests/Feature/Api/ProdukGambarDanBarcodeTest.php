<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Product;
use App\Models\User;
use App\Services\BarcodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Foto produk (unggah, ganti, hapus) dan barcode internal (buat satu,
 * isi massal untuk produk tanpa barcode).
 */
class ProdukGambarDanBarcodeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        Storage::fake('public');
    }

    private function unggah(Product $p, UploadedFile $berkas): TestResponse
    {
        return $this->actingAs($this->admin)->post(
            "/api/products/{$p->id}/gambar",
            ['gambar' => $berkas],
            ['Accept' => 'application/json'],
        );
    }

    /* ------------------------------------------------------------- foto */

    public function test_foto_diunggah_lalu_diganti_tanpa_menyisakan_berkas_lama(): void
    {
        $p = Product::factory()->create(['gambar' => null]);

        $url1 = $this->unggah($p, UploadedFile::fake()->image('a.jpg', 400, 400))
            ->assertOk()
            ->assertJsonPath('message', 'Foto produk diperbarui.')
            ->json('data.gambar_url');

        $this->assertStringStartsWith('/storage/produk/', $url1);
        $path1 = substr($url1, strlen('/storage/'));
        Storage::disk('public')->assertExists($path1);

        $url2 = $this->unggah($p, UploadedFile::fake()->image('b.webp', 300, 300))->assertOk()->json('data.gambar_url');

        $this->assertNotSame($url1, $url2);
        Storage::disk('public')->assertMissing($path1);
        Storage::disk('public')->assertExists(substr($url2, strlen('/storage/')));
    }

    public function test_foto_contoh_seeder_tidak_pernah_dihapus_saat_diganti(): void
    {
        // Seandainya pun berkas bernama sama ada di disk, jalur contoh seeder
        // (di luar folder produk/) tidak boleh disentuh aplikasi.
        Storage::disk('public')->put('products/aqua-botol-600ml.webp', 'contoh');
        $p = Product::factory()->create(['gambar' => 'products/aqua-botol-600ml.webp']);

        $this->actingAs($this->admin)->getJson("/api/products/{$p->id}")
            ->assertJsonPath('data.gambar_url', '/img-produk/products/aqua-botol-600ml.webp');

        $this->unggah($p, UploadedFile::fake()->image('baru.png', 200, 200))->assertOk();
        Storage::disk('public')->assertExists('products/aqua-botol-600ml.webp');

        $this->actingAs($this->admin)->deleteJson("/api/products/{$p->id}/gambar")->assertOk();
        Storage::disk('public')->assertExists('products/aqua-botol-600ml.webp');
    }

    public function test_foto_dihapus(): void
    {
        $p = Product::factory()->create();
        $url = $this->unggah($p, UploadedFile::fake()->image('a.png', 200, 200))->json('data.gambar_url');

        $this->actingAs($this->admin)->deleteJson("/api/products/{$p->id}/gambar")
            ->assertOk()
            ->assertJsonPath('data.gambar_url', null);

        Storage::disk('public')->assertMissing(substr($url, strlen('/storage/')));
        $this->assertNull($p->fresh()?->gambar);
    }

    public function test_path_foto_tidak_dapat_ditulis_lewat_formulir_produk(): void
    {
        $p = Product::factory()->create(['gambar' => null]);

        $this->actingAs($this->admin)->putJson("/api/products/{$p->id}", [
            'nama_produk' => $p->nama_produk,
            'category_id' => $p->category_id,
            'unit_id' => $p->unit_id,
            'harga_beli' => $p->harga_beli,
            'harga_jual' => $p->harga_jual,
            'gambar' => '../../.env',
        ])->assertOk();

        $this->assertNull($p->fresh()?->gambar);
    }

    /**
     * @return array<string, array{\Closure(): UploadedFile}>
     */
    public static function fotoTidakSah(): array
    {
        return [
            'svg' => [fn () => UploadedFile::fake()->create('a.svg', 4, 'image/svg+xml')],
            'lebih dari 2 MB' => [fn () => UploadedFile::fake()->image('a.jpg', 900, 900)->size(2_500)],
            'bukan gambar' => [fn () => UploadedFile::fake()->create('a.pdf', 10, 'application/pdf')],
            'terlalu kecil' => [fn () => UploadedFile::fake()->image('a.png', 40, 40)],
        ];
    }

    /**
     * @param  \Closure(): UploadedFile  $berkas
     */
    #[DataProvider('fotoTidakSah')]
    public function test_foto_tidak_sah_ditolak(\Closure $berkas): void
    {
        $p = Product::factory()->create(['gambar' => null]);

        $this->unggah($p, $berkas())->assertUnprocessable()->assertJsonValidationErrors('gambar');

        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertNull($p->fresh()?->gambar);
    }

    public function test_kasir_tidak_boleh_mengubah_foto(): void
    {
        $kasir = User::factory()->kasir()->create();
        $p = Product::factory()->create();

        $this->actingAs($kasir)->post("/api/products/{$p->id}/gambar", [
            'gambar' => UploadedFile::fake()->image('a.png', 200, 200),
        ], ['Accept' => 'application/json'])->assertForbidden();
        $this->actingAs($kasir)->deleteJson("/api/products/{$p->id}/gambar")->assertForbidden();
    }

    /* ---------------------------------------------------------- barcode */

    /**
     * Contoh yang SAMA dipakai `composables/barcode.test.ts`.
     *
     * @return array<string, array{string, int}>
     */
    public static function digitCek(): array
    {
        return [
            'contoh GS1' => ['400638133393', 1],
            'Indomie (seeder)' => ['899886620019', 6],
            'awalan internal' => ['200014000010', 4],
            'nol semua' => ['000000000000', 0],
        ];
    }

    #[DataProvider('digitCek')]
    public function test_digit_cek_ean13_sama_dengan_klien(string $duaBelas, int $cek): void
    {
        $this->assertSame($cek, BarcodeService::digitCek($duaBelas));
    }

    public function test_barcode_baru_ean13_internal_yang_sah_dan_belum_terpakai(): void
    {
        $kode = $this->actingAs($this->admin)->getJson('/api/products/barcode-baru')
            ->assertOk()
            ->json('data.barcode');

        $this->assertMatchesRegularExpression('/^20\d{11}$/', $kode);
        $this->assertTrue(BarcodeService::ean13Sah($kode));
        $this->assertFalse(Product::withTrashed()->where('barcode', $kode)->exists());
    }

    public function test_barcode_baru_tidak_tertangkap_rute_produk_dan_tertutup_untuk_kasir(): void
    {
        $kasir = User::factory()->kasir()->create();

        // Bila rute berada di bawah products/{product}, jawabannya 404 model.
        $this->actingAs($kasir)->getJson('/api/products/barcode-baru')->assertForbidden();
        $this->actingAs($kasir)->postJson('/api/products/barcode-otomatis')->assertForbidden();
    }

    public function test_isi_otomatis_hanya_menyentuh_produk_tanpa_barcode(): void
    {
        $punya = Product::factory()->create(['barcode' => '8998866200196']);
        $kosong1 = Product::factory()->create(['barcode' => null]);
        $kosong2 = Product::factory()->create(['barcode' => '']);

        $this->actingAs($this->admin)->postJson('/api/products/barcode-otomatis')
            ->assertOk()
            ->assertJsonPath('data.jumlah', 2)
            ->assertJsonPath('message', '2 produk diberi barcode baru.');

        $this->assertSame('8998866200196', $punya->fresh()?->barcode);
        $kode1 = (string) $kosong1->fresh()?->barcode;
        $kode2 = (string) $kosong2->fresh()?->barcode;
        $this->assertTrue(BarcodeService::ean13Sah($kode1));
        $this->assertTrue(BarcodeService::ean13Sah($kode2));
        $this->assertNotSame($kode1, $kode2);

        // Dijalankan lagi: tidak ada yang tersisa.
        $this->actingAs($this->admin)->postJson('/api/products/barcode-otomatis')
            ->assertJsonPath('data.jumlah', 0)
            ->assertJsonPath('message', 'Semua produk sudah punya barcode.');
    }

    public function test_isi_otomatis_dapat_dibatasi_ke_produk_tertentu(): void
    {
        $a = Product::factory()->create(['barcode' => null]);
        $b = Product::factory()->create(['barcode' => null]);

        $this->actingAs($this->admin)->postJson('/api/products/barcode-otomatis', ['ids' => [$a->id]])
            ->assertJsonPath('data.jumlah', 1);

        $this->assertNotNull($a->fresh()?->barcode);
        $this->assertNull($b->fresh()?->barcode);
    }

    public function test_saring_produk_tanpa_barcode(): void
    {
        Product::factory()->count(2)->create(['barcode' => null]);
        Product::factory()->create(['barcode' => '8998866200196']);

        $this->actingAs($this->admin)->getJson('/api/products?tanpa_barcode=1')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);
    }

    public function test_barcode_berspasi_ditolak(): void
    {
        $p = Product::factory()->create();

        $this->actingAs($this->admin)->putJson("/api/products/{$p->id}", [
            'barcode' => '899 886',
            'nama_produk' => $p->nama_produk,
            'category_id' => $p->category_id,
            'unit_id' => $p->unit_id,
            'harga_beli' => $p->harga_beli,
            'harga_jual' => $p->harga_jual,
        ])->assertUnprocessable()->assertJsonValidationErrors('barcode');
    }
}
