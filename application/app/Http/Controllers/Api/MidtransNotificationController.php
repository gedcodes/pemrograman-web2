<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MidtransService;
use App\Services\PaymentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Endpoint webhook Midtrans.
 *
 * Rute ini sengaja TIDAK berada di balik autentikasi: Midtrans memanggilnya
 * dari luar tanpa sesi. Penjaganya adalah verifikasi `signature_key` --
 * satu-satunya bukti bahwa notifikasi memang berasal dari Midtrans.
 */
class MidtransNotificationController extends Controller
{
    public function __construct(
        private readonly MidtransService $midtrans,
        private readonly PaymentNotificationService $notifikasi,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        /** @var array<string, mixed> $payload */
        $payload = $request->all();

        if (! $this->midtrans->signatureSah($payload)) {
            // Endpoint ini publik, jadi percobaan pemalsuan memang mungkin
            // terjadi dan perlu tercatat.
            Log::warning('Notifikasi Midtrans ditolak: signature tidak sah.', [
                'order_id' => $payload['order_id'] ?? null,
                'ip' => $request->ip(),
            ]);

            return response()->json(['message' => 'Signature tidak sah.'], 403);
        }

        $hasil = $this->notifikasi->proses($payload);

        // Midtrans menganggap notifikasi berhasil terkirim bila menerima 200.
        // Notifikasi duplikat pun dibalas 200, supaya Midtrans berhenti
        // mengulang alih-alih terus mencoba tanpa henti.
        return response()->json([
            'message' => $hasil['alasan'],
            'status' => $hasil['status'],
        ], 200);
    }
}
