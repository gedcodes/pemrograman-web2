<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Payment;
use App\Models\PaymentLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Pemrosesan notifikasi (webhook) Midtrans.
 *
 * Tiga aturan yang mengikat kelas ini, sesuai PERANCANGAN Bagian 4.3:
 *
 * 1. Stok HANYA berkurang saat status benar-benar menjadi `settlement`, bukan
 *    saat Snap Token dibuat. Tanpa ini transaksi yang batal ikut memakan stok.
 * 2. Pemrosesan harus idempoten. Midtrans mengirim notifikasi yang sama
 *    berkali-kali; tanpa penjagaan, stok dapat berkurang dua kali.
 * 3. Body notifikasi tidak pernah dipercaya tanpa verifikasi signature.
 *    Pemeriksaannya dilakukan pemanggil sebelum kelas ini dijalankan.
 */
class PaymentNotificationService
{
    public function __construct(
        private readonly MidtransService $midtrans,
        private readonly TransactionService $transactions,
    ) {}

    /**
     * Cocokkan status sebuah pembayaran dengan catatan Midtrans.
     *
     * Cadangan bagi webhook yang terlambat atau tidak pernah tiba, misalnya
     * saat aplikasi berjalan di localhost tanpa terowongan. Server sendiri
     * yang bertanya ke Midtrans, lalu jawabannya diproses lewat jalur yang
     * SAMA dengan webhook: signature, idempotensi, dan aturan stok tetap
     * berlaku. Browser tidak pernah menentukan status lunas.
     *
     * Mengembalikan null bila Midtrans belum mengenal order-nya.
     *
     * @return array{status: string, diproses: bool, alasan: string}|null
     *
     * @throws RuntimeException
     */
    public function sinkronkan(Payment $payment): ?array
    {
        if ($payment->order_id === null) {
            return null;
        }

        $payload = $this->midtrans->cekStatus($payment->order_id);

        if ($payload === null) {
            return null;
        }

        // Jawaban Get Status API membawa signature_key yang dihitung sama
        // seperti notifikasi. Tetap diperiksa, sebagai lapis pengaman kedua.
        if (isset($payload['signature_key']) && ! $this->midtrans->signatureSah($payload)) {
            throw new RuntimeException('Jawaban status Midtrans memiliki signature yang tidak sah.');
        }

        return $this->proses($payload, 'midtrans-status-api');
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  string  $sumber  asal pembaruan, dicatat di payment_logs
     * @return array{status: string, diproses: bool, alasan: string}
     */
    public function proses(array $payload, string $sumber = 'midtrans-webhook'): array
    {
        $orderId = (string) ($payload['order_id'] ?? '');

        $payment = Payment::query()->where('order_id', $orderId)->first();

        if ($payment === null) {
            Log::warning('Notifikasi Midtrans untuk order_id tak dikenal.', ['order_id' => $orderId]);

            return ['status' => 'unknown', 'diproses' => false, 'alasan' => 'order_id tidak dikenal'];
        }

        $kunci = $this->midtrans->kunciIdempoten($payload);

        // Penjaga pertama: notifikasi yang sama persis sudah pernah masuk.
        if (PaymentLog::query()->where('idempotency_key', $kunci)->exists()) {
            return [
                'status' => (string) $payment->transaction_status,
                'diproses' => false,
                'alasan' => 'notifikasi duplikat',
            ];
        }

        $statusBaru = $this->midtrans->petakanStatus(
            (string) ($payload['transaction_status'] ?? ''),
            isset($payload['fraud_status']) ? (string) $payload['fraud_status'] : null,
        );

        return DB::transaction(function () use ($payment, $payload, $kunci, $statusBaru, $sumber): array {
            // Baris dikunci agar dua notifikasi yang tiba bersamaan tidak
            // sama-sama lolos pemeriksaan lalu mengurangi stok dua kali.
            $payment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
            $transaction = $payment->transaction()->lockForUpdate()->firstOrFail();

            $statusLama = (string) $transaction->status;

            // Penjaga kedua: status yang sudah final tidak boleh mundur lagi.
            if (in_array($statusLama, ['settlement', 'cancel', 'expire', 'deny'], true)
                && $statusLama !== $statusBaru) {
                $this->catat($payment->id, $statusLama, $statusBaru, $payload, $kunci, 'diabaikan-status-final');

                return [
                    'status' => $statusLama,
                    'diproses' => false,
                    'alasan' => 'status sudah final',
                ];
            }

            $payment->update([
                'payment_type' => isset($payload['payment_type']) ? (string) $payload['payment_type'] : $payment->payment_type,
                'transaction_status' => (string) ($payload['transaction_status'] ?? ''),
                'jumlah_bayar' => (int) round((float) ($payload['gross_amount'] ?? $transaction->total)),
                'waktu_settlement' => $statusBaru === 'settlement' ? now() : null,
            ]);

            $transaction->update(['status' => $statusBaru]);

            // Perpindahan menjadi lunas inilah satu-satunya pemicu stok berkurang.
            if ($statusBaru === 'settlement' && $statusLama !== 'settlement') {
                $this->transactions->kurangiStok($transaction->load('items'));
            }

            $this->catat($payment->id, $statusLama, $statusBaru, $payload, $kunci, $sumber);

            return ['status' => $statusBaru, 'diproses' => true, 'alasan' => 'status diperbarui'];
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function catat(int $paymentId, string $lama, string $baru, array $payload, string $kunci, string $oleh): void
    {
        PaymentLog::create([
            'payment_id' => $paymentId,
            'status_lama' => $lama,
            'status_baru' => $baru,
            'waktu_perubahan' => now(),
            'dikonfirmasi_oleh' => $oleh,
            'raw_payload' => $payload,
            'idempotency_key' => $kunci,
        ]);
    }
}
