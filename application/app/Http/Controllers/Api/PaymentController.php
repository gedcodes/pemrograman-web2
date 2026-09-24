<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Transaction;
use App\Services\MidtransService;
use App\Services\PaymentNotificationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Pembuatan Snap Token dan pemeriksaan status pembayaran.
 */
class PaymentController extends Controller
{
    /** Status akhir yang tidak dapat ditagih lagi (lihat PaymentNotificationService). */
    private const STATUS_GAGAL = ['expire', 'cancel', 'deny'];

    public function __construct(
        private readonly MidtransService $midtrans,
        private readonly PaymentNotificationService $notifikasi,
    ) {}

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
     * Snap Token untuk membayar (atau MELANJUTKAN pembayaran) sebuah transaksi.
     *
     * Urutannya disengaja:
     *
     * 1. Token yang masih berlaku dibuka ulang, bukan diganti. Pelanggan yang
     *    popup-nya tidak sengaja ditutup melihat QRIS / nomor VA yang sama.
     * 2. Bila token sudah habis, tagihan lama ditanyakan dulu ke Midtrans.
     *    Tanpa langkah ini, tagihan lama yang ternyata sudah dibayar (tetapi
     *    webhook-nya belum tiba) akan ditagih ulang dan pelanggan membayar dua kali.
     * 3. Baru setelah itu tagihan baru dibuat dengan order_id berakhiran -R2, -R3.
     */
    public function snapToken(Transaction $transaction): JsonResponse
    {
        if (! $this->midtrans->siap()) {
            return response()->json([
                'message' => 'Pembayaran non-tunai belum aktif: kredensial Midtrans belum diisi di berkas .env.',
            ], 503);
        }

        $transaction->loadMissing('payment');

        if ($penolakan = $this->tolakBilaTidakBisaDitagih($transaction)) {
            return $penolakan;
        }

        // (1) Buka ulang tagihan yang masih berjalan.
        if ($token = $this->midtrans->tokenAktif($transaction)) {
            return $this->jawabToken($transaction, $token, dipakaiUlang: true);
        }

        // (2) Tagihan lama sudah habis masa berlakunya: pastikan belum dibayar.
        if ($transaction->payment?->order_id !== null) {
            try {
                $hasil = $this->notifikasi->sinkronkan($transaction->payment);
            } catch (RuntimeException $e) {
                report($e);

                return response()->json([
                    'message' => 'Status tagihan sebelumnya tidak dapat dipastikan ke Midtrans. Coba lagi sebentar.',
                ], 502);
            }

            $transaction->refresh()->load('payment');

            if ($penolakan = $this->tolakBilaTidakBisaDitagih($transaction)) {
                return $penolakan;
            }

            // Midtrans masih menunggu pembayaran tagihan lama (pelanggan sudah
            // memilih metode dan batas waktunya belum habis): buka yang itu.
            $tokenLama = $transaction->payment?->snap_token;
            if ($hasil !== null && $hasil['status'] === 'pending' && $tokenLama !== null) {
                return $this->jawabToken($transaction, $tokenLama, dipakaiUlang: true);
            }
        }

        // (3) Tagihan baru.
        try {
            $token = $this->midtrans->buatSnapToken($transaction);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => 'Gagal membuat Snap Token: '.$e->getMessage(),
            ], 502);
        }

        return $this->jawabToken($transaction, $token, dipakaiUlang: false);
    }

    /**
     * Status terkini sebuah transaksi.
     *
     * Transaksi yang masih pending dicocokkan dulu ke Midtrans (Get Status API),
     * lalu diproses lewat jalur yang sama dengan webhook. Ini membuat tombol
     * "Periksa" berguna ketika webhook terlambat, atau tidak dapat masuk sama
     * sekali seperti saat aplikasi berjalan di localhost.
     *
     * Status lunas tetap TIDAK pernah ditentukan browser: server sendiri yang
     * bertanya ke Midtrans memakai Server Key.
     */
    public function status(Transaction $transaction): JsonResponse
    {
        $transaction->loadMissing('payment');
        $dicek = false;

        if ($transaction->status === 'pending'
            && $transaction->payment?->order_id !== null
            && $this->midtrans->siap()) {
            try {
                $this->notifikasi->sinkronkan($transaction->payment);
                $dicek = true;
            } catch (RuntimeException $e) {
                // Midtrans tidak terjangkau: jawab dengan keadaan basis data saja.
                report($e);
            }

            $transaction->refresh()->load('payment');
        }

        return ApiResponse::ok([
            'status' => $transaction->status,
            'dicek_ke_midtrans' => $dicek,
            'payment' => $transaction->payment !== null
                ? PaymentResource::make($transaction->payment)->resolve()
                : null,
        ]);
    }

    private function tolakBilaTidakBisaDitagih(Transaction $transaction): ?JsonResponse
    {
        if ($transaction->status === 'settlement') {
            return response()->json([
                'message' => 'Transaksi ini sudah lunas.',
                'data' => ['status' => 'settlement'],
            ], 409);
        }

        // Status gagal bersifat final: webhook untuk tagihan barunya akan ditolak
        // penjaga status final, sehingga pembayaran pelanggan tidak tercatat.
        // Kasir harus membuat transaksi baru.
        if (in_array($transaction->status, self::STATUS_GAGAL, true)) {
            $label = [
                'expire' => 'kedaluwarsa',
                'cancel' => 'dibatalkan',
                'deny' => 'ditolak',
            ][$transaction->status];

            return response()->json([
                'message' => "Tagihan ini sudah {$label}. Buat transaksi baru di halaman Kasir.",
                'data' => ['status' => $transaction->status],
            ], 409);
        }

        return null;
    }

    private function jawabToken(Transaction $transaction, string $token, bool $dipakaiUlang): JsonResponse
    {
        $payment = $transaction->payment?->fresh();

        return ApiResponse::ok([
            'snap_token' => $token,
            'order_id' => $payment?->order_id,
            'berlaku_sampai' => $payment?->snap_kedaluwarsa,
            'dipakai_ulang' => $dipakaiUlang,
            'client_key' => $this->midtrans->clientKey(),
        ], $dipakaiUlang ? 'Tagihan yang sama dibuka kembali.' : 'Snap Token dibuat.');
    }
}
