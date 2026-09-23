<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Menegakkan tabel hak akses PERANCANGAN Bagian 2.2 di sisi server.
 *
 * Inti pengujiannya: menyembunyikan menu di antarmuka tidak cukup. Kasir yang
 * memanggil endpoint admin secara langsung harus tetap ditolak.
 */
class AccessControlTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return list<array{0: string, 1: string}>
     */
    public static function endpointAdmin(): array
    {
        return [
            ['get', '/api/users'],
            ['post', '/api/users'],
            ['get', '/api/suppliers'],
            ['post', '/api/suppliers'],
            ['post', '/api/products'],
            ['post', '/api/categories'],
            ['post', '/api/units'],
            ['post', '/api/customers'],
            ['post', '/api/purchases'],
            ['post', '/api/opnames'],
            ['get', '/api/reports/sales'],
            ['get', '/api/reports/profit-loss'],
            ['get', '/api/reports/stock'],
        ];
    }

    /**
     * @return list<array{0: string}>
     */
    public static function endpointUmum(): array
    {
        return [
            ['/api/user'],
            ['/api/dashboard'],
            ['/api/products'],
            ['/api/categories'],
            ['/api/transactions'],
        ];
    }

    #[DataProvider('endpointUmum')]
    public function test_tamu_ditolak(string $url): void
    {
        $this->getJson($url)->assertUnauthorized();
    }

    #[DataProvider('endpointAdmin')]
    public function test_kasir_ditolak_dari_endpoint_admin(string $metode, string $url): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->{$metode.'Json'}($url)->assertForbidden();
    }

    public function test_kasir_boleh_membaca_master_data_untuk_berjualan(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->getJson('/api/products')->assertOk();
        $this->actingAs($kasir)->getJson('/api/categories')->assertOk();
        $this->actingAs($kasir)->getJson('/api/units')->assertOk();
        $this->actingAs($kasir)->getJson('/api/customers')->assertOk();
    }

    public function test_kasir_tidak_boleh_melihat_supplier(): void
    {
        $kasir = User::factory()->kasir()->create();

        $this->actingAs($kasir)->getJson('/api/suppliers')->assertForbidden();
    }

    public function test_admin_boleh_mengakses_endpoint_admin(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->getJson('/api/users')->assertOk();
        $this->actingAs($admin)->getJson('/api/suppliers')->assertOk();
        $this->actingAs($admin)->getJson('/api/reports/stock')->assertOk();
    }

    public function test_akun_nonaktif_ditolak_meski_sudah_masuk(): void
    {
        $nonaktif = User::factory()->admin()->nonaktif()->create();

        $this->actingAs($nonaktif)->getJson('/api/dashboard')
            ->assertForbidden()
            ->assertJsonPath('message', 'Akun Anda dinonaktifkan.');
    }

    public function test_response_memakai_bentuk_seragam(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->getJson('/api/products')
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'message',
                'meta' => ['current_page', 'per_page', 'last_page', 'total'],
            ]);
    }
}
