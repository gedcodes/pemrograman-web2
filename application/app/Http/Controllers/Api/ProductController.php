<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\BarcodeService;
use App\Support\ApiResponse;
use App\Support\Daftar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * CRUD produk, termasuk penyaringan kategori dan stok menipis, foto produk,
 * dan barcode internal untuk produk tanpa barcode pabrik.
 */
class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::query()->with(['category', 'unit']);

        $cari = trim((string) $request->query('q', ''));
        if ($cari !== '') {
            $query->where(function ($q) use ($cari): void {
                $q->where('nama_produk', 'like', "%{$cari}%")
                    ->orWhere('barcode', 'like', "%{$cari}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }

        if ($request->boolean('stok_menipis')) {
            $query->stokMenipis();
        }

        if ($request->has('aktif')) {
            $query->where('aktif', $request->boolean('aktif'));
        }

        if ($request->boolean('tanpa_barcode')) {
            $query->where(fn ($q) => $q->whereNull('barcode')->orWhere('barcode', ''));
        }

        return ApiResponse::paginated(
            Daftar::halaman($query, $request, ['nama_produk', 'barcode', 'harga_beli', 'harga_jual', 'stok'], 'nama_produk'),
            ProductResource::class,
        );
    }

    /**
     * Cari satu produk berdasarkan barcode, untuk pemindaian di halaman Kasir.
     *
     * Jalur ini sengaja terpisah dari `index` karena kasir memanggilnya pada
     * setiap pindaian: kolom `barcode` berindeks unik sehingga pencariannya
     * sekali tembak, bukan penyaringan LIKE seperti pada pencarian biasa.
     */
    public function barcode(string $kode): JsonResponse
    {
        $product = Product::query()
            ->with(['category', 'unit'])
            ->where('barcode', $kode)
            ->where('aktif', true)
            ->first();

        if ($product === null) {
            return response()->json([
                'message' => 'Produk dengan barcode tersebut tidak ditemukan.',
            ], 404);
        }

        return ApiResponse::ok(ProductResource::make($product));
    }

    public function store(ProductRequest $request): JsonResponse
    {
        $model = Product::create($request->only([
            'barcode', 'nama_produk', 'category_id', 'unit_id',
            'harga_beli', 'harga_jual', 'stok', 'stok_minimum', 'aktif',
        ]));

        return ApiResponse::created(ProductResource::make($model->load(['category', 'unit'])), 'Produk berhasil ditambahkan.');
    }

    public function show(Product $product): JsonResponse
    {
        return ApiResponse::ok(ProductResource::make($product->load(['category', 'unit'])));
    }

    public function update(ProductRequest $request, Product $product): JsonResponse
    {
        // `stok` sengaja tidak ada di daftar ini (dan ditolak ProductRequest):
        // StockService adalah satu-satunya pintu perubahan stok. `gambar` juga
        // tidak: foto hanya berubah lewat unggahGambar / hapusGambar, supaya
        // klien tidak dapat menunjuk ke berkas sembarang.
        $product->update($request->only([
            'barcode', 'nama_produk', 'category_id', 'unit_id',
            'harga_beli', 'harga_jual', 'stok_minimum', 'aktif',
        ]));

        return ApiResponse::ok(ProductResource::make($product->load(['category', 'unit'])), 'Produk berhasil diperbarui.');
    }

    /* ------------------------------------------------------------ foto */

    /**
     * Unggah atau ganti foto produk. Foto lama hasil unggahan dihapus setelah
     * yang baru tersimpan; foto contoh bawaan seeder tidak pernah dihapus.
     *
     * SVG ditolak karena dapat memuat skrip (lihat PengaturanController).
     */
    public function unggahGambar(Request $request, Product $product): JsonResponse
    {
        $request->validate(
            ['gambar' => ['required', 'file', 'mimes:png,jpg,jpeg,webp', 'max:2048', 'dimensions:min_width=64,min_height=64']],
            [
                'gambar.mimes' => 'Foto harus berupa gambar PNG, JPG, atau WebP.',
                'gambar.max' => 'Ukuran foto paling besar 2 MB.',
                'gambar.dimensions' => 'Foto minimal berukuran 64 × 64 piksel.',
            ],
        );

        /** @var UploadedFile $berkas */
        $berkas = $request->file('gambar');
        $path = Storage::disk('unggahan')->putFile(Product::FOLDER_GAMBAR, $berkas);
        if ($path === false) {
            return response()->json(['message' => 'Foto gagal disimpan.'], 500);
        }

        $lama = $product->gambarUnggahan() ? $product->gambar : null;
        $product->update(['gambar' => $path]);
        if ($lama !== null) {
            Storage::disk('unggahan')->delete($lama);
        }

        return ApiResponse::ok(ProductResource::make($product->load(['category', 'unit'])), 'Foto produk diperbarui.');
    }

    public function hapusGambar(Product $product): JsonResponse
    {
        if ($product->gambarUnggahan()) {
            Storage::disk('unggahan')->delete((string) $product->gambar);
        }
        $product->update(['gambar' => null]);

        return ApiResponse::ok(ProductResource::make($product->load(['category', 'unit'])), 'Foto produk dihapus.');
    }

    /* --------------------------------------------------------- barcode */

    /**
     * Satu barcode internal yang belum terpakai, untuk tombol "Buat otomatis"
     * di formulir. Belum disimpan ke produk mana pun sampai formulir disimpan;
     * keunikannya diperiksa ulang oleh ProductRequest saat itu.
     */
    public function barcodeBaru(BarcodeService $barcode): JsonResponse
    {
        return ApiResponse::ok(['barcode' => $barcode->buat()]);
    }

    /**
     * Beri barcode internal kepada produk yang belum punya: semuanya, atau
     * hanya yang disebut di `ids` (mis. dari halaman Cetak Label).
     */
    public function barcodeOtomatis(Request $request, BarcodeService $barcode): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['nullable', 'array', 'max:500'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        $ids = isset($data['ids']) && is_array($data['ids'])
            ? array_values(array_map('intval', $data['ids']))
            : null;
        $jumlah = $barcode->isiYangKosong($ids);

        return ApiResponse::ok(
            ['jumlah' => $jumlah],
            $jumlah === 0 ? 'Semua produk sudah punya barcode.' : "{$jumlah} produk diberi barcode baru.",
        );
    }

    /**
     * Ketergantungan diperiksa sendiri, bukan diserahkan kepada foreign key.
     *
     * Model ini memakai SoftDeletes, sehingga `delete()` hanyalah UPDATE pada
     * kolom `deleted_at` dan constraint RESTRICT tidak akan pernah berbunyi.
     * Tanpa pemeriksaan ini, data yang masih dirujuk akan hilang diam-diam.
     */
    public function destroy(Product $product): JsonResponse
    {
        if ($product->transactionItems()->exists()) {
            return response()->json([
                'message' => 'Produk ini masih dipakai baris penjualan sehingga tidak dapat dihapus.',
            ], 409);
        }

        if ($product->purchaseItems()->exists()) {
            return response()->json([
                'message' => 'Produk ini masih dipakai baris pembelian sehingga tidak dapat dihapus.',
            ], 409);
        }

        if ($product->stockMoves()->exists()) {
            return response()->json([
                'message' => 'Produk ini masih dipakai mutasi stok sehingga tidak dapat dihapus.',
            ], 409);
        }

        $product->delete();

        return ApiResponse::message('Produk berhasil dihapus.');
    }
}
