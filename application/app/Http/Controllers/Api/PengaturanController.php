<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PengaturanRequest;
use App\Services\PengaturanToko;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

/**
 * Pengaturan Toko: identitas, struk, pajak & diskon, dan pembayaran.
 *
 * Dibaca SEMUA peran (Kasir butuh tarif pajak/diskon untuk pratinjau
 * keranjang, dan identitas toko untuk struk), diubah hanya admin.
 */
class PengaturanController extends Controller
{
    public function __construct(private readonly PengaturanToko $pengaturan) {}

    public function show(): JsonResponse
    {
        return ApiResponse::ok($this->pengaturan->untukApi());
    }

    public function update(PengaturanRequest $request): JsonResponse
    {
        $this->pengaturan->perbarui($request->validated());

        return ApiResponse::ok($this->pengaturan->untukApi(), 'Pengaturan toko disimpan.');
    }

    /**
     * SVG sengaja ditolak: berkas SVG dapat memuat skrip, dan logo disajikan
     * dari origin yang sama dengan aplikasi.
     */
    public function unggahLogo(Request $request): JsonResponse
    {
        $request->validate(
            ['logo' => ['required', 'file', 'mimes:png,jpg,jpeg,webp', 'max:1024', 'dimensions:min_width=32,min_height=32']],
            [
                'logo.mimes' => 'Logo harus berupa gambar PNG, JPG, atau WebP.',
                'logo.max' => 'Ukuran logo paling besar 1 MB.',
                'logo.dimensions' => 'Logo minimal berukuran 32 × 32 piksel.',
            ],
        );

        /** @var UploadedFile $berkas */
        $berkas = $request->file('logo');
        $this->pengaturan->gantiLogo($berkas);

        return ApiResponse::ok($this->pengaturan->untukApi(), 'Logo toko diperbarui.');
    }

    public function hapusLogo(): JsonResponse
    {
        $this->pengaturan->hapusLogo();

        return ApiResponse::ok($this->pengaturan->untukApi(), 'Logo toko dihapus.');
    }
}
