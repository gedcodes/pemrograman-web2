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
            $query->orderByDesc('tanggal')->orderByDesc('id')
                ->paginate((int) $request->query('per_page', (string) config('pos.per_halaman'))),
            StockOpnameResource::class,
        );
    }

    public function show(StockOpname $opname): JsonResponse
    {
        return ApiResponse::ok(StockOpnameResource::make($opname->load(['user', 'items'])));
    }

    /**
     * Sesi opname langsung diselesaikan: stok sistem dipotret, selisihnya dihitung,
     * lalu stok disesuaikan ke hasil hitung fisik melalui StockService supaya
     * penyesuaiannya tetap tercatat pada buku besar mutasi.
     */
    public function store(StoreStockOpnameRequest $request): JsonResponse
    {
        $userId = $request->user()?->id;
        abort_if($userId === null, 401);

        /** @var list<array{product_id: int, stok_fisik: int}> $items */
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
                $stokSistem = $product->stok;
                $selisih = $item['stok_fisik'] - $stokSistem;

                OpnameItem::create([
                    'stock_opname_id' => $opname->id,
                    'product_id' => $product->id,
                    'stok_sistem' => $stokSistem,
                    'stok_fisik' => $item['stok_fisik'],
                    'selisih' => $selisih,
                ]);

                $this->stock->opname(
                    $product->id,
                    $item['stok_fisik'],
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
