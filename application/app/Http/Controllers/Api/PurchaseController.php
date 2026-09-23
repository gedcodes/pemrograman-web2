<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePurchaseRequest;
use App\Http\Resources\PurchaseResource;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Services\DocumentNumberService;
use App\Services\StockService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Barang masuk (purchasing). Menambah stok sekaligus mencatat mutasinya.
 */
class PurchaseController extends Controller
{
    public function __construct(
        private readonly StockService $stock,
        private readonly DocumentNumberService $nomor,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Purchase::query()->with('supplier');

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->integer('supplier_id'));
        }

        if ($request->filled('dari')) {
            $query->whereDate('tanggal_masuk', '>=', $request->date('dari'));
        }

        if ($request->filled('sampai')) {
            $query->whereDate('tanggal_masuk', '<=', $request->date('sampai'));
        }

        return ApiResponse::paginated(
            $query->orderByDesc('tanggal_masuk')->orderByDesc('id')
                ->paginate((int) $request->query('per_page', (string) config('pos.per_halaman'))),
            PurchaseResource::class,
        );
    }

    public function show(Purchase $purchase): JsonResponse
    {
        return ApiResponse::ok(PurchaseResource::make($purchase->load(['supplier', 'items'])));
    }

    /**
     * Dokumen penerimaan barang: header, barisnya, dan penambahan stok
     * seluruhnya ditulis dalam satu database transaction.
     */
    public function store(StorePurchaseRequest $request): JsonResponse
    {
        $userId = $request->user()?->id;

        /** @var list<array{product_id: int, qty: int, harga_beli: int}> $items */
        $items = $request->array('items');

        $purchase = DB::transaction(function () use ($request, $items, $userId): Purchase {
            $tanggal = $request->filled('tanggal_masuk')
                ? $request->date('tanggal_masuk')
                : now();

            $purchase = Purchase::create([
                'no_dokumen' => $this->nomor->barangMasuk($tanggal),
                'supplier_id' => $request->integer('supplier_id'),
                'user_id' => $userId,
                'tanggal_masuk' => $tanggal,
                'total_biaya' => 0,
                'catatan' => $request->string('catatan')->value() ?: null,
            ]);

            $total = 0;
            foreach ($items as $item) {
                $subtotal = $item['qty'] * $item['harga_beli'];
                $total += $subtotal;

                PurchaseItem::create([
                    'purchase_id' => $purchase->id,
                    'product_id' => $item['product_id'],
                    'qty' => $item['qty'],
                    'harga_beli' => $item['harga_beli'],
                    'subtotal' => $subtotal,
                ]);

                $this->stock->masuk(
                    $item['product_id'],
                    $item['qty'],
                    'purchase',
                    $purchase->id,
                    $userId,
                    'Barang masuk '.$purchase->no_dokumen,
                );
            }

            // Total dihitung dari baris, tidak pernah diterima dari klien.
            $purchase->update(['total_biaya' => $total]);

            return $purchase;
        });

        return ApiResponse::created(
            PurchaseResource::make($purchase->load(['supplier', 'items'])),
            'Barang masuk berhasil dicatat dan stok telah bertambah.',
        );
    }
}
