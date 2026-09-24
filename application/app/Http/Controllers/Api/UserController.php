<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Daftar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD pengguna. Seluruh endpointnya dibatasi peran admin pada definisi rute.
 */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query();

        $cari = trim((string) $request->query('q', ''));
        if ($cari !== '') {
            $query->where(function ($q) use ($cari): void {
                $q->where('name', 'like', "%{$cari}%")
                    ->orWhere('email', 'like', "%{$cari}%");
            });
        }

        if ($request->filled('peran')) {
            $query->where('peran', $request->string('peran')->value());
        }

        return ApiResponse::paginated(
            Daftar::halaman($query, $request, ['name', 'email', 'peran', 'aktif'], 'name'),
            UserResource::class,
        );
    }

    public function store(UserRequest $request): JsonResponse
    {
        $model = User::create(array_filter([
            'name' => $request->string('name')->value(),
            'email' => $request->string('email')->value(),
            'peran' => $request->string('peran')->value(),
            'aktif' => $request->boolean('aktif', true),
            'password' => $request->filled('password') ? $request->string('password')->value() : null,
        ], static fn (mixed $v): bool => $v !== null));

        return ApiResponse::created(UserResource::make($model), 'Pengguna berhasil ditambahkan.');
    }

    public function show(User $user): JsonResponse
    {
        return ApiResponse::ok(UserResource::make($user));
    }

    public function update(UserRequest $request, User $user): JsonResponse
    {
        $user->update(array_filter([
            'name' => $request->string('name')->value(),
            'email' => $request->string('email')->value(),
            'peran' => $request->string('peran')->value(),
            'aktif' => $request->boolean('aktif', true),
            'password' => $request->filled('password') ? $request->string('password')->value() : null,
        ], static fn (mixed $v): bool => $v !== null));

        return ApiResponse::ok(UserResource::make($user), 'Pengguna berhasil diperbarui.');
    }

    /**
     * Ketergantungan diperiksa sendiri, bukan diserahkan kepada foreign key.
     *
     * Model ini memakai SoftDeletes, sehingga `delete()` hanyalah UPDATE pada
     * kolom `deleted_at` dan constraint RESTRICT tidak akan pernah berbunyi.
     * Tanpa pemeriksaan ini, data yang masih dirujuk akan hilang diam-diam.
     */
    public function destroy(User $user): JsonResponse
    {
        if ($user->shifts()->exists()) {
            return response()->json([
                'message' => 'Pengguna ini masih dipakai shift sehingga tidak dapat dihapus.',
            ], 409);
        }

        if ($user->purchases()->exists()) {
            return response()->json([
                'message' => 'Pengguna ini masih dipakai dokumen barang masuk sehingga tidak dapat dihapus.',
            ], 409);
        }

        if ($user->stockOpnames()->exists()) {
            return response()->json([
                'message' => 'Pengguna ini masih dipakai sesi opname sehingga tidak dapat dihapus.',
            ], 409);
        }

        $user->delete();

        return ApiResponse::message('Pengguna berhasil dihapus.');
    }
}
