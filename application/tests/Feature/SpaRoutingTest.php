<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

/**
 * SPA POS disajikan langsung di root: seluruh alamat halaman milik Vue Router,
 * kecuali api/, sanctum/, storage/, dan up yang harus tetap sampai ke Laravel.
 */
class SpaRoutingTest extends TestCase
{
    public function test_root_langsung_menyajikan_spa(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertViewIs('spa')
            ->assertSee('id="spa"', escape: false);
    }

    public function test_tautan_dalam_disajikan_spa_agar_muat_ulang_tidak_404(): void
    {
        foreach (['/login', '/kasir', '/kasir/tablet', '/laporan/penjualan', '/produk/12/ubah'] as $alamat) {
            $this->get($alamat)->assertOk()->assertViewIs('spa');
        }
    }

    public function test_alamat_lama_di_bawah_app_dialihkan_beserta_query(): void
    {
        $this->get('/app')->assertRedirect('/');
        $this->get('/app/')->assertRedirect('/');
        $this->get('/app/kasir')->assertRedirect('/kasir');
        $this->get('/app/login?lanjut=%2Fkasir')->assertRedirect('/login?lanjut=%2Fkasir');
    }

    /**
     * Rute web didaftarkan sebelum rute api. Bila pengecualiannya bocor,
     * alamat API yang tidak dikenal akan dijawab HTML 200, bukan JSON 404.
     */
    public function test_prefiks_api_tidak_ditelan_spa(): void
    {
        $this->getJson('/api/tidak-ada')->assertNotFound()->assertHeader('content-type', 'application/json');
        $this->getJson('/api/user')->assertUnauthorized();
    }

    /**
     * Regresi: tanpa header JSON, middleware `auth` mencari rute bernama
     * `login` yang sudah tidak ada (Fortify tanpa tampilan) lalu berakhir 500.
     */
    public function test_tamu_tanpa_header_json_tetap_dijawab_401_bukan_500(): void
    {
        $this->get('/api/user', ['Accept' => 'text/html'])
            ->assertUnauthorized()
            ->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_cookie_csrf_sanctum_dan_health_check_tetap_milik_laravel(): void
    {
        $this->get('/sanctum/csrf-cookie')->assertNoContent()->assertCookie('XSRF-TOKEN');
        $this->get('/up')->assertOk()->assertDontSee('id="spa"', escape: false);
    }
}
