<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Transaction;
use App\Services\MidtransService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Pembuatan Snap Token dan pemeriksaan status pembayaran.
 */
class PaymentController extends Controller
{
    public function __construct(private readonly MidtransService $midtrans) {}

    /**
     * Konfigurasi yang boleh diketahui browser.
     *
     * Hanya Client Key yang dikirim; Server Key tidak pernah meninggalkan server.
     */
    public function konfigurasi(): JsonResponse
    {
        return ApiResponse::ok([
            'client_key' => $this->midtrans->clientKey(),
            'is_production' => $this->midtrans->modeProduction(),
            'siap' => $this->midtrans->siap(),
            'snap_url' => $this->midtrans->modeProduction()
                ? 'https://app.midtrans.com/snap/snap.js'
                : 'https://app.sandbox.midtrans.com/snap/snap.js',
        ]);
    }

    /**
     * Minta Snap Token untuk sebuah transaksi.
     */
    public function snapToken(Transaction $transaction): JsonResponse
    {
        if (! $this->midtrans->siap()) {
            return response()->json([
                'message' => 'Pembayaran non-tunai belum aktif: kredensial Midtrans belum diisi di berkas .env.',
            ], 503);
        }

        if ($transaction->status === 'settlement') {
            return response()->json([
                'message' => 'Transaksi ini sudah lunas.',
            ], 409);
        }

        try {
            $token = $this->midtrans->buatSnapToken($transaction);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => 'Gagal membuat Snap Token: '.$e->getMessage(),
            ], 502);
        }

        return ApiResponse::ok([
            'snap_token' => $token,
            'order_id' => $transaction->payment?->fresh()?->order_id,
            'client_key' => $this->midtrans->clientKey(),
        ], 'Snap Token dibuat.');
    }

    /**
     * Cadangan bila webhook terlambat: klien dapat menanyakan status terkini.
     *
     * Ini hanya MEMBACA keadaan basis data. Status resmi tetap ditentukan
     * webhook, karena callback di browser dapat dimanipulasi.
     */
    public function status(Transaction $transaction): JsonResponse
    {
        $transaction->loadMissing('payment');

        return ApiResponse::ok([
            'status' => $transaction->status,
            'payment' => $transaction->payment !== null
                ? PaymentResource::make($transaction->payment)->resolve()
                : null,
        ]);
    }
}
