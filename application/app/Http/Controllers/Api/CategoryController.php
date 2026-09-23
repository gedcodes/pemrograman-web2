<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD kategori produk.
 */
class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Category::query();

        $cari = trim((string) $request->query('q', ''));
        if ($cari !== '') {
            $query->where(function ($q) use ($cari): void {
                $q->where('nama_kategori', 'like', "%{$cari}%");
            });
        }

        return ApiResponse::paginated(
            $query->orderBy('nama_kategori')->paginate((int) $request->query('per_page', (string) config('pos.per_halaman'))),
            CategoryResource::class,
        );
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        $model = Category::create([
            'nama_kategori' => $request->string('nama_kategori')->value(),
            'slug' => $request->filled('slug')
                ? $request->string('slug')->value()
                : str($request->string('nama_kategori')->value())->slug()->value(),
        ]);

        return ApiResponse::created(CategoryResource::make($model), 'Kategori berhasil ditambahkan.');
    }

    public function show(Category $category): JsonResponse
    {
        return ApiResponse::ok(CategoryResource::make($category));
    }

    public function update(CategoryRequest $request, Category $category): JsonResponse
    {
        $category->update([
            'nama_kategori' => $request->string('nama_kategori')->value(),
            'slug' => $request->filled('slug')
                ? $request->string('slug')->value()
                : str($request->string('nama_kategori')->value())->slug()->value(),
        ]);

        return ApiResponse::ok(CategoryResource::make($category), 'Kategori berhasil diperbarui.');
    }

    /**
     * Ketergantungan diperiksa sendiri, bukan diserahkan kepada foreign key.
     *
     * Model ini memakai SoftDeletes, sehingga `delete()` hanyalah UPDATE pada
     * kolom `deleted_at` dan constraint RESTRICT tidak akan pernah berbunyi.
     * Tanpa pemeriksaan ini, data yang masih dirujuk akan hilang diam-diam.
     */
    public function destroy(Category $category): JsonResponse
    {
        if ($category->products()->exists()) {
            return response()->json([
                'message' => 'Kategori ini masih dipakai produk sehingga tidak dapat dihapus.',
            ], 409);
        }

        $category->delete();

        return ApiResponse::message('Kategori berhasil dihapus.');
    }
}
