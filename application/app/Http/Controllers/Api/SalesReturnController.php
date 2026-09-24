<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSalesReturnRequest;
use App\Http\Resources\SalesReturnResource;
use App\Models\SalesReturn;
use App\Services\DocumentNumberService;
use App\Support\ApiResponse;
use App\Support\Daftar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Retur penjualan.
 *
 * PERANCANGAN Bagian 2.2: admin menyetujui seketika, sedangkan pengajuan dari
 * kasir menunggu persetujuan.
 *
 * CATATAN KETERBATASAN: entitas RETUR pada ERD Bagian 3 hanya memuat alasan dan
 * jumlah refund, tanpa rincian barang. Karena itu persetujuan retur TIDAK dapat
 * mengembalikan stok -- tidak ada informasi produk mana yang diretur. Retur di
 * sini murni catatan keuangan. Mengembalikan stok menuntut tabel rincian retur.
 */
class SalesReturnController extends Controller
{
    public function __construct(private readonly DocumentNumberService $nomor) {}

    public function index(Request $request): JsonResponse
    {
        $query = SalesReturn::query()->with(['transaction', 'pengaju', 'penyetuju']);

        if ($request->filled('status_approval')) {
            $query->where('status_approval', $request->string('status_approval')->value());
        }

        return ApiResponse::paginated(
            Daftar::halaman($query, $request, ['tanggal_retur', 'no_dokumen', 'jumlah_refund', 'status_approval'], 'tanggal_retur', 'desc'),
            SalesReturnResource::class,
        );
    }

    public function show(SalesReturn $retur): JsonResponse
    {
        return ApiResponse::ok(SalesReturnResource::make(
            $retur->load(['transaction.items', 'pengaju', 'penyetuju']),
        ));
    }

    public function store(StoreSalesReturnRequest $request): JsonResponse
    {
        $user = $request->user();
        abort_if($user === null, 401);

        $admin = $user->isAdmin();
        $tanggal = $request->filled('tanggal_retur') ? $request->date('tanggal_retur') : now();

        $retur = SalesReturn::create([
            'no_dokumen' => $this->nomor->retur($tanggal),
            'transaction_id' => $request->integer('transaction_id'),
            'tanggal_retur' => $tanggal,
            'alasan' => $request->string('alasan')->value(),
            'jumlah_refund' => $request->integer('jumlah_refund'),
            'status_approval' => $admin ? 'approved' : 'pending',
            'diajukan_oleh' => $user->id,
            'disetujui_oleh' => $admin ? $user->id : null,
        ]);

        return ApiResponse::created(
            SalesReturnResource::make($retur->load(['transaction', 'pengaju', 'penyetuju'])),
            $admin
                ? 'Retur dicatat dan langsung disetujui.'
                : 'Retur diajukan dan menunggu persetujuan admin.',
        );
    }

    /**
     * Persetujuan retur oleh admin. Rutenya dibatasi peran admin.
     */
    public function setujui(Request $request, SalesReturn $retur): JsonResponse
    {
        if ($retur->status_approval !== 'pending') {
            return response()->json([
                'message' => 'Retur ini sudah diproses sebelumnya.',
            ], 409);
        }

        $retur->update([
            'status_approval' => 'approved',
            'disetujui_oleh' => $request->user()?->id,
        ]);

        return ApiResponse::ok(
            SalesReturnResource::make($retur->load(['transaction', 'pengaju', 'penyetuju'])),
            'Retur disetujui.',
        );
    }

    /**
     * Penolakan retur oleh admin.
     */
    public function tolak(Request $request, SalesReturn $retur): JsonResponse
    {
        if ($retur->status_approval !== 'pending') {
            return response()->json([
                'message' => 'Retur ini sudah diproses sebelumnya.',
            ], 409);
        }

        $retur->update([
            'status_approval' => 'rejected',
            'disetujui_oleh' => $request->user()?->id,
        ]);

        return ApiResponse::ok(
            SalesReturnResource::make($retur->load(['transaction', 'pengaju', 'penyetuju'])),
            'Retur ditolak.',
        );
    }
}
