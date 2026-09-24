<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SupplierRequest;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use App\Support\ApiResponse;
use App\Support\Daftar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD supplier.
 */
class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query();

        $cari = trim((string) $request->query('q', ''));
        if ($cari !== '') {
            $query->where(function ($q) use ($cari): void {
                $q->where('nama_supplier', 'like', "%{$cari}%")
                    ->orWhere('kontak', 'like', "%{$cari}%");
            });
        }

        return ApiResponse::paginated(
            Daftar::halaman($query, $request, ['nama_supplier', 'kontak', 'alamat'], 'nama_supplier'),
            SupplierResource::class,
        );
    }

    public function store(SupplierRequest $request): JsonResponse
    {
        $model = Supplier::create($request->only(['nama_supplier', 'kontak', 'alamat']));

        return ApiResponse::created(SupplierResource::make($model), 'Supplier berhasil ditambahkan.');
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return ApiResponse::ok(SupplierResource::make($supplier));
    }

    public function update(SupplierRequest $request, Supplier $supplier): JsonResponse
    {
        $supplier->update($request->only(['nama_supplier', 'kontak', 'alamat']));

        return ApiResponse::ok(SupplierResource::make($supplier), 'Supplier berhasil diperbarui.');
    }

    /**
     * Ketergantungan diperiksa sendiri, bukan diserahkan kepada foreign key.
     *
     * Model ini memakai SoftDeletes, sehingga `delete()` hanyalah UPDATE pada
     * kolom `deleted_at` dan constraint RESTRICT tidak akan pernah berbunyi.
     * Tanpa pemeriksaan ini, data yang masih dirujuk akan hilang diam-diam.
     */
    public function destroy(Supplier $supplier): JsonResponse
    {
        if ($supplier->purchases()->exists()) {
            return response()->json([
                'message' => 'Supplier ini masih dipakai dokumen barang masuk sehingga tidak dapat dihapus.',
            ], 409);
        }

        $supplier->delete();

        return ApiResponse::message('Supplier berhasil dihapus.');
    }
}
