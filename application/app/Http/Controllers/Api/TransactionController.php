<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Models\Shift;
use App\Models\Transaction;
use App\Services\TransactionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Transaksi kasir dan riwayatnya.
 */
class TransactionController extends Controller
{
    public function __construct(private readonly TransactionService $transactions) {}

    /**
     * Riwayat transaksi dengan penyaringan tanggal, status, dan kasir.
     *
     * Kasir hanya boleh melihat transaksi shift miliknya sendiri
     * (PERANCANGAN Bagian 2.2), sedangkan admin melihat semuanya.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Transaction::query()->with(['customer', 'payment', 'shift.user']);

        if ($user !== null && ! $user->isAdmin()) {
            $query->whereHas('shift', fn ($q) => $q->where('user_id', $user->id));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->value());
        }

        if ($request->filled('dari')) {
            $query->whereDate('tanggal', '>=', $request->date('dari'));
        }

        if ($request->filled('sampai')) {
            $query->whereDate('tanggal', '<=', $request->date('sampai'));
        }

        if ($request->filled('q')) {
            $query->where('no_struk', 'like', '%'.$request->string('q')->value().'%');
        }

        return ApiResponse::paginated(
            $query->orderByDesc('tanggal')->paginate((int) $request->query('per_page', (string) config('pos.per_halaman'))),
            TransactionResource::class,
        );
    }

    public function show(Transaction $transaction): JsonResponse
    {
        return ApiResponse::ok(TransactionResource::make(
            $transaction->load(['items', 'payment', 'customer', 'shift.user']),
        ));
    }

    /**
     * Buat transaksi baru.
     *
     * Seluruh penulisan terjadi dalam satu database transaction di dalam
     * TransactionService; harga dan total dihitung ulang di server.
     */
    public function store(StoreTransactionRequest $request): JsonResponse
    {
        $user = $request->user();
        abort_if($user === null, 401);

        $shift = Shift::query()
            ->where('user_id', $user->id)
            ->whereNull('waktu_tutup')
            ->latest('waktu_buka')
            ->first();

        if ($shift === null) {
            return response()->json([
                'message' => 'Belum ada shift yang dibuka. Buka shift terlebih dahulu.',
            ], 409);
        }

        /** @var list<array{product_id: int, qty: int}> $items */
        $items = $request->array('items');

        $transaction = $this->transactions->buat(
            kasir: $user,
            shift: $shift,
            items: $items,
            metode: $request->string('metode')->value(),
            customerId: $request->filled('customer_id') ? $request->integer('customer_id') : null,
            jumlahBayar: $request->filled('jumlah_bayar') ? $request->integer('jumlah_bayar') : null,
            catatan: $request->string('catatan')->value() ?: null,
        );

        return ApiResponse::created(
            TransactionResource::make($transaction),
            $transaction->status === 'settlement'
                ? 'Transaksi berhasil disimpan.'
                : 'Transaksi dibuat dan menunggu pembayaran.',
        );
    }
}
