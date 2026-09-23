<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD produk, termasuk penyaringan kategori dan stok menipis.
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

        return ApiResponse::paginated(
            $query->orderBy('nama_produk')->paginate((int) $request->query('per_page', (string) config('pos.per_halaman'))),
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
            'harga_beli', 'harga_jual', 'stok', 'stok_minimum', 'gambar', 'aktif',
        ]));

        return ApiResponse::created(ProductResource::make($model->load(['category', 'unit'])), 'Produk berhasil ditambahkan.');
    }

    public function show(Product $product): JsonResponse
    {
        return ApiResponse::ok(ProductResource::make($product->load(['category', 'unit'])));
    }

    public function update(ProductRequest $request, Product $product): JsonResponse
    {
        $product->update($request->only([
            'barcode', 'nama_produk', 'category_id', 'unit_id',
            'harga_beli', 'harga_jual', 'stok', 'stok_minimum', 'gambar', 'aktif',
        ]));

        return ApiResponse::ok(ProductResource::make($product->load(['category', 'unit'])), 'Produk berhasil diperbarui.');
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
