<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Setting;
use App\Models\User;
use App\Services\PengaturanToko;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Pengaturan Toko: dibaca semua peran, diubah hanya admin, dan nilai bawaan
 * dari config/pos.php berlaku selama belum pernah disimpan.
 */
class PengaturanApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    /**
     * @return array<string, mixed>
     */
    private function muatan(array $timpa = []): array
    {
        return array_merge([
            'nama_toko' => 'Warung Bu Tini',
            'slogan' => 'Serba Ada',
            'alamat' => 'Jl. Gatot Subroto 10, Denpasar',
            'telepon' => '0812-3456-7890',
            'email' => 'tini@example.com',
            'npwp' => '01.234.567.8-901.000',
            'nib' => '1234567890123',
            'jam_buka' => '06:30',
            'jam_tutup' => '22:00',
            'struk_footer_1' => 'Matur suksma',
            'struk_footer_2' => null,
            'struk_tampilkan_logo' => false,
            'pkp' => true,
            'tarif_pajak' => 0.12,
            'tarif_diskon_member' => 0.1,
            'tarif_mdr' => 0.015,
            'batas_bayar_menit' => 15,
        ], $timpa);
    }

    public function test_tabel_kosong_memakai_nilai_bawaan_config(): void
    {
        $this->assertSame(0, Setting::count());

        $this->actingAs($this->admin)->getJson('/api/pengaturan')
            ->assertOk()
            ->assertJsonPath('data.nama_toko', 'Toko Sari Amerta')
            ->assertJsonPath('data.inisial', 'SA')
            ->assertJsonPath('data.logo_url', null)
            ->assertJsonPath('data.pkp', true)
            ->assertJsonPath('data.tarif_pajak', 0.11)
            ->assertJsonPath('data.tarif_diskon_member', 0.05)
            ->assertJsonPath('data.batas_bayar_menit', 30)
            ->assertJsonMissingPath('data.logo');
    }

    public function test_kasir_boleh_membaca_karena_butuh_tarif_dan_identitas_struk(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->getJson('/api/pengaturan')
            ->assertOk()
            ->assertJsonPath('data.tarif_pajak', 0.11);
    }

    public function test_tamu_tidak_boleh_membaca(): void
    {
        $this->getJson('/api/pengaturan')->assertUnauthorized();
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function endpointAdmin(): array
    {
        return [
            'simpan pengaturan' => ['put', '/api/pengaturan'],
            'unggah logo' => ['post', '/api/pengaturan/logo'],
            'hapus logo' => ['delete', '/api/pengaturan/logo'],
        ];
    }

    #[DataProvider('endpointAdmin')]
    public function test_kasir_ditolak_mengubah_pengaturan(string $metode, string $url): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->json($metode, $url, $this->muatan())->assertForbidden();
        $this->assertSame(0, Setting::count());
    }

    public function test_admin_menyimpan_dan_nilainya_bertipe_benar(): void
    {
        $this->actingAs($this->admin)->putJson('/api/pengaturan', $this->muatan())
            ->assertOk()
            ->assertJsonPath('message', 'Pengaturan toko disimpan.')
            ->assertJsonPath('data.nama_toko', 'Warung Bu Tini')
            ->assertJsonPath('data.inisial', 'BT');

        $data = $this->actingAs($this->admin)->getJson('/api/pengaturan')->json('data');

        $this->assertSame(0.12, $data['tarif_pajak']);
        $this->assertSame(0.015, $data['tarif_mdr']);
        $this->assertSame(15, $data['batas_bayar_menit']);
        $this->assertFalse($data['struk_tampilkan_logo']);
        $this->assertNull($data['struk_footer_2']);
        $this->assertSame('Matur suksma', $data['struk_footer_1']);
    }

    /**
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function muatanTidakSah(): array
    {
        return [
            'nama kosong' => [['nama_toko' => ''], 'nama_toko'],
            'nama melebihi lebar struk' => [['nama_toko' => str_repeat('A', 33)], 'nama_toko'],
            'PPN di atas 20%' => [['tarif_pajak' => 0.25], 'tarif_pajak'],
            'diskon negatif' => [['tarif_diskon_member' => -0.01], 'tarif_diskon_member'],
            'MDR di atas 5%' => [['tarif_mdr' => 0.06], 'tarif_mdr'],
            'batas bayar terlalu pendek' => [['batas_bayar_menit' => 2], 'batas_bayar_menit'],
            'NPWP 14 digit' => [['npwp' => '01.234.567.8-901.00'], 'npwp'],
            'NPWP berhuruf' => [['npwp' => '01.234.567.8-901.00A'], 'npwp'],
            'NIB 12 digit' => [['nib' => '123456789012'], 'nib'],
            'telepon berhuruf' => [['telepon' => '0361-TOKO'], 'telepon'],
            'jam tutup sama dengan buka' => [['jam_tutup' => '06:30'], 'jam_tutup'],
            'format jam salah' => [['jam_buka' => '7 pagi'], 'jam_buka'],
        ];
    }

    /**
     * @param  array<string, mixed>  $timpa
     */
    #[DataProvider('muatanTidakSah')]
    public function test_muatan_tidak_sah_ditolak(array $timpa, string $field): void
    {
        $this->actingAs($this->admin)->putJson('/api/pengaturan', $this->muatan($timpa))
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);

        $this->assertSame(0, Setting::count());
    }

    public function test_npwp_16_digit_format_baru_diterima(): void
    {
        $this->actingAs($this->admin)
            ->putJson('/api/pengaturan', $this->muatan(['npwp' => '3171012345678901']))
            ->assertOk()
            ->assertJsonPath('data.npwp', '3171012345678901');
    }

    public function test_logo_diunggah_diganti_lalu_dihapus_tanpa_menyisakan_berkas(): void
    {
        Storage::fake('public');

        $pertama = $this->actingAs($this->admin)->post('/api/pengaturan/logo', [
            'logo' => UploadedFile::fake()->image('logo.png', 256, 256),
        ], ['Accept' => 'application/json'])->assertOk()->json('data.logo_url');

        $this->assertStringStartsWith('/storage/toko/', $pertama);
        $pathPertama = substr($pertama, strlen('/storage/'));
        Storage::disk('public')->assertExists($pathPertama);

        // Mengganti logo membuang berkas lama dan menghasilkan URL baru.
        $kedua = $this->actingAs($this->admin)->post('/api/pengaturan/logo', [
            'logo' => UploadedFile::fake()->image('logo-baru.webp', 300, 300),
        ], ['Accept' => 'application/json'])->assertOk()->json('data.logo_url');

        $this->assertNotSame($pertama, $kedua);
        Storage::disk('public')->assertMissing($pathPertama);

        $this->actingAs($this->admin)->deleteJson('/api/pengaturan/logo')
            ->assertOk()
            ->assertJsonPath('data.logo_url', null);

        Storage::disk('public')->assertMissing(substr($kedua, strlen('/storage/')));
    }

    /**
     * @return array<string, array{\Closure(): UploadedFile}>
     */
    public static function logoTidakSah(): array
    {
        return [
            // SVG dapat memuat skrip dan disajikan dari origin aplikasi.
            'svg' => [fn () => UploadedFile::fake()->create('logo.svg', 4, 'image/svg+xml')],
            'lebih dari 1 MB' => [fn () => UploadedFile::fake()->image('besar.png', 800, 800)->size(1_500)],
            'bukan gambar' => [fn () => UploadedFile::fake()->create('logo.pdf', 10, 'application/pdf')],
            'terlalu kecil' => [fn () => UploadedFile::fake()->image('kecil.png', 16, 16)],
        ];
    }

    /**
     * @param  \Closure(): UploadedFile  $berkas
     */
    #[DataProvider('logoTidakSah')]
    public function test_logo_tidak_sah_ditolak(\Closure $berkas): void
    {
        Storage::fake('public');

        $this->actingAs($this->admin)
            ->post('/api/pengaturan/logo', ['logo' => $berkas()], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('logo');

        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_layar_pembuka_memakai_identitas_tersimpan(): void
    {
        Storage::fake('public');
        $pengaturan = app(PengaturanToko::class);
        $pengaturan->perbarui(['nama_toko' => 'Warung Bu Tini']);
        $url = $pengaturan->gantiLogo(UploadedFile::fake()->image('logo.png', 64, 64));

        $this->get('/')
            ->assertOk()
            ->assertSee('<title>POS · Warung Bu Tini</title>', escape: false)
            ->assertSee('Memuat Warung Bu Tini', escape: false)
            ->assertSee('<link rel="icon" href="'.$url.'">', escape: false)
            ->assertSee('"inisial":"BT"', escape: false);
    }

    public function test_layar_pembuka_hanya_membocorkan_identitas_publik(): void
    {
        app(PengaturanToko::class)->perbarui(['npwp' => '01.234.567.8-901.000', 'tarif_pajak' => 0.12]);

        $this->get('/')
            ->assertOk()
            ->assertDontSee('01.234.567.8-901.000')
            ->assertDontSee('tarif_pajak');
    }

    public function test_kunci_tak_dikenal_ditolak_service(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        app(PengaturanToko::class)->perbarui(['logo' => 'toko/palsu.png']);
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function namaDanInisial(): array
    {
        return [
            'kata toko dilewati' => ['Toko Sari Amerta', 'SA'],
            'kata warung dilewati' => ['Warung Bu Tini', 'BT'],
            'satu kata' => ['Indomaret', 'IN'],
            'huruf kecil' => ['toko jaya abadi', 'JA'],
            'hanya kata toko' => ['Toko', 'TO'],
        ];
    }

    #[DataProvider('namaDanInisial')]
    public function test_inisial_pengganti_logo(string $nama, string $inisial): void
    {
        $this->assertSame($inisial, PengaturanToko::inisial($nama));
    }
}
