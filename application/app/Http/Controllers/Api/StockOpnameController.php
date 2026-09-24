<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStockOpnameRequest;
use App\Http\Resources\StockOpnameResource;
use App\Models\OpnameItem;
use App\Models\Product;
use App\Models\StockOpname;
use App\Services\DocumentNumberService;
use App\Services\StockService;
use App\Support\ApiResponse;
use App\Support\Daftar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Stok opname: mencatat hitung fisik, menghitung selisih, lalu menyesuaikan stok.
 */
class StockOpnameController extends Controller
{
    public function __construct(
        private readonly StockService $stock,
        private readonly DocumentNumberService $nomor,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = StockOpname::query()->with('user');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->value());
        }

        return ApiResponse::paginated(
            Daftar::halaman($query, $request, ['tanggal', 'no_dokumen'], 'tanggal', 'desc'),
            StockOpnameResource::class,
        );
    }

    public function show(StockOpname $opname): JsonResponse
    {
        return ApiResponse::ok(StockOpnameResource::make($opname->load(['user', 'items'])));
    }

    /**
     * Sesi opname langsung diselesaikan.
     *
     * Selisih dihitung terhadap stok buku SAAT LEMBAR HITUNG DIBUKA
     * (`stok_sistem` yang dikirim klien), lalu selisih itu diterapkan ke stok
     * terkini lewat StockService. Keputusan desain yang sama dengan prototipe:
     * menimpa stok dengan angka fisik akan menghapus penjualan yang terjadi
     * selama penghitungan. Klien yang tidak mengirim `stok_sistem` memakai
     * stok saat ini sebagai stok buku (perilaku lama).
     */
    public function store(StoreStockOpnameRequest $request): JsonResponse
    {
        $userId = $request->user()?->id;
        abort_if($userId === null, 401);

        /** @var list<array{product_id: int, stok_fisik: int, stok_sistem?: int|null}> $items */
        $items = $request->array('items');

        $opname = DB::transaction(function () use ($request, $items, $userId): StockOpname {
            $tanggal = $request->filled('tanggal') ? $request->date('tanggal') : now();

            $opname = StockOpname::create([
                'no_dokumen' => $this->nomor->opname($tanggal),
                'user_id' => $userId,
                'tanggal' => $tanggal,
                'status' => 'selesai',
                'catatan' => $request->string('catatan')->value() ?: null,
            ]);

            foreach ($items as $item) {
                $product = Product::query()->findOrFail($item['product_id']);
                $stokSistem = isset($item['stok_sistem']) ? (int) $item['stok_sistem'] : $product->stok;
                $selisih = $item['stok_fisik'] - $stokSistem;

                OpnameItem::create([
                    'stock_opname_id' => $opname->id,
                    'product_id' => $product->id,
                    'stok_sistem' => $stokSistem,
                    'stok_fisik' => $item['stok_fisik'],
                    'selisih' => $selisih,
                ]);

                $this->stock->sesuaikan(
                    $product->id,
                    $selisih,
                    'stock_opname',
                    $opname->id,
                    $userId,
                    'Penyesuaian opname '.$opname->no_dokumen,
                );
            }

            return $opname;
        });

        return ApiResponse::created(
            StockOpnameResource::make($opname->load(['user', 'items'])),
            'Stok opname selesai dan stok telah disesuaikan.',
        );
    }
}
