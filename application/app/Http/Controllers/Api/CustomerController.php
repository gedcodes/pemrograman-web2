<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Support\ApiResponse;
use App\Support\Daftar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD pelanggan.
 */
class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Customer::query();

        $cari = trim((string) $request->query('q', ''));
        if ($cari !== '') {
            $query->where(function ($q) use ($cari): void {
                $q->where('nama', 'like', "%{$cari}%")
                    ->orWhere('no_hp', 'like', "%{$cari}%");
            });
        }

        return ApiResponse::paginated(
            Daftar::halaman($query, $request, ['nama', 'no_hp', 'poin_loyalti'], 'nama'),
            CustomerResource::class,
        );
    }

    public function store(CustomerRequest $request): JsonResponse
    {
        $model = Customer::create($request->only(['nama', 'no_hp', 'poin_loyalti']));

        return ApiResponse::created(CustomerResource::make($model), 'Pelanggan berhasil ditambahkan.');
    }

    public function show(Customer $customer): JsonResponse
    {
        return ApiResponse::ok(CustomerResource::make($customer));
    }

    public function update(CustomerRequest $request, Customer $customer): JsonResponse
    {
        $customer->update($request->only(['nama', 'no_hp', 'poin_loyalti']));

        return ApiResponse::ok(CustomerResource::make($customer), 'Pelanggan berhasil diperbarui.');
    }

    /**
     * Ketergantungan diperiksa sendiri, bukan diserahkan kepada foreign key.
     *
     * Model ini memakai SoftDeletes, sehingga `delete()` hanyalah UPDATE pada
     * kolom `deleted_at` dan constraint RESTRICT tidak akan pernah berbunyi.
     * Tanpa pemeriksaan ini, data yang masih dirujuk akan hilang diam-diam.
     */
    public function destroy(Customer $customer): JsonResponse
    {
        if ($customer->transactions()->exists()) {
            return response()->json([
                'message' => 'Pelanggan ini masih dipakai transaksi sehingga tidak dapat dihapus.',
            ], 409);
        }

        $customer->delete();

        return ApiResponse::message('Pelanggan berhasil dihapus.');
    }
}
