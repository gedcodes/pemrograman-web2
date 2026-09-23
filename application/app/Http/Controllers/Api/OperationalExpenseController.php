<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\OperationalExpenseRequest;
use App\Http\Resources\OperationalExpenseResource;
use App\Models\OperationalExpense;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD beban operasional bulanan, dipakai Laporan Laba Rugi.
 */
class OperationalExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = OperationalExpense::query();

        if ($request->boolean('hanya_aktif')) {
            $query->aktif();
        }

        return ApiResponse::paginated(
            $query->orderByDesc('jumlah_bulanan')
                ->paginate((int) $request->query('per_page', (string) config('pos.per_halaman'))),
            OperationalExpenseResource::class,
        );
    }

    public function store(OperationalExpenseRequest $request): JsonResponse
    {
        $beban = OperationalExpense::create($request->validated());

        return ApiResponse::created(
            OperationalExpenseResource::make($beban),
            'Beban operasional berhasil ditambahkan.',
        );
    }

    public function show(OperationalExpense $beban): JsonResponse
    {
        return ApiResponse::ok(OperationalExpenseResource::make($beban));
    }

    public function update(OperationalExpenseRequest $request, OperationalExpense $beban): JsonResponse
    {
        $beban->update($request->validated());

        return ApiResponse::ok(
            OperationalExpenseResource::make($beban),
            'Beban operasional berhasil diperbarui.',
        );
    }

    /**
     * Beban tidak dirujuk tabel lain, sehingga tidak perlu pemeriksaan
     * ketergantungan seperti pada master data yang lain.
     */
    public function destroy(OperationalExpense $beban): JsonResponse
    {
        $beban->delete();

        return ApiResponse::message('Beban operasional berhasil dihapus.');
    }
}
