<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UnitRequest;
use App\Http\Resources\UnitResource;
use App\Models\Unit;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD satuan jual.
 */
class UnitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Unit::query();

        $cari = trim((string) $request->query('q', ''));
        if ($cari !== '') {
            $query->where(function ($q) use ($cari): void {
                $q->where('nama_satuan', 'like', "%{$cari}%")
                    ->orWhere('simbol', 'like', "%{$cari}%");
            });
        }

        return ApiResponse::paginated(
            $query->orderBy('nama_satuan')->paginate((int) $request->query('per_page', (string) config('pos.per_halaman'))),
            UnitResource::class,
        );
    }

    public function store(UnitRequest $request): JsonResponse
    {
        $model = Unit::create($request->only(['nama_satuan', 'simbol']));

        return ApiResponse::created(UnitResource::make($model), 'Satuan berhasil ditambahkan.');
    }

    public function show(Unit $unit): JsonResponse
    {
        return ApiResponse::ok(UnitResource::make($unit));
    }

    public function update(UnitRequest $request, Unit $unit): JsonResponse
    {
        $unit->update($request->only(['nama_satuan', 'simbol']));

        return ApiResponse::ok(UnitResource::make($unit), 'Satuan berhasil diperbarui.');
    }

    /**
     * Ketergantungan diperiksa sendiri, bukan diserahkan kepada foreign key.
     *
     * Model ini memakai SoftDeletes, sehingga `delete()` hanyalah UPDATE pada
     * kolom `deleted_at` dan constraint RESTRICT tidak akan pernah berbunyi.
     * Tanpa pemeriksaan ini, data yang masih dirujuk akan hilang diam-diam.
     */
    public function destroy(Unit $unit): JsonResponse
    {
        if ($unit->products()->exists()) {
            return response()->json([
                'message' => 'Satuan ini masih dipakai produk sehingga tidak dapat dihapus.',
            ], 409);
        }

        $unit->delete();

        return ApiResponse::message('Satuan berhasil dihapus.');
    }
}
