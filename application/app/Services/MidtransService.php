<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Transaction;
use Midtrans\Config;
use Midtrans\Snap;
use Midtrans\Transaction as MidtransTransaction;
use RuntimeException;
use Throwable;

/**
 * Satu-satunya tempat SDK Midtrans dipanggil.
 *
 * Controller tidak pernah menyentuh SDK secara langsung. Inilah yang membuat
 * perpindahan ke Core API di kemudian hari tidak menyentuh controller sama
 * sekali (PERANCANGAN Bagian 5.1).
 *
 * Server Key hanya hidup di sini dan di `.env`; tidak pernah dikirim ke browser.
 */
class MidtransService
{
    /**
     * Status Midtrans yang berarti pembayaran benar-benar diterima.
     */
    private const STATUS_LUNAS = ['capture', 'settlement'];

    /**
     * Status Midtrans yang berarti pembayaran gagal atau dibatalkan.
     */
    private const STATUS_GAGAL = ['deny', 'cancel', 'expire', 'failure'];

    public function __construct()
    {
        $this->konfigurasi();
    }

    /**
     * Apakah kredensial sudah diisi. Dipakai endpoint agar dapat menolak
     * dengan pesan jelas alih-alih gagal di dalam SDK.
     */
    public function siap(): bool
    {
        return (string) config('midtrans.server_key') !== ''
            && (string) config('midtrans.client_key') !== '';
    }

    public function clientKey(): string
    {
        return (string) config('midtrans.client_key');
    }

    public function modeProduction(): bool
    {
        return (bool) config('midtrans.is_production');
    }

    /**
     * Buat Snap Token untuk sebuah transaksi.
     *
     * Nominal dan rincian item dibaca dari basis data, tidak pernah dari klien.
     *
     * @throws RuntimeException
     */
    public function buatSnapToken(Transaction $transaction): string
    {
        if (! $this->siap()) {
            throw new RuntimeException('Kredensial Midtrans belum dikonfigurasi.');
        }

        $transaction->loadMissing(['items', 'customer', 'payment']);

        $orderId = $this->orderIdBerikutnya($transaction);
        $itemDetails = $this->rincianItem($transaction);

        // Midtrans menolak permintaan bila gross_amount tidak sama persis
        // dengan jumlah seluruh item_details.
        $jumlahItem = array_sum(array_map(
            static fn (array $i): int => $i['price'] * $i['quantity'],
            $itemDetails,
        ));

        if ($jumlahItem !== $transaction->total) {
            throw new RuntimeException(sprintf(
                'Rincian item (%d) tidak sama dengan total transaksi (%d).',
                $jumlahItem,
                $transaction->total,
            ));
        }

        $params = [
            'transaction_details' => [
                'order_id' => $orderId,
                'gross_amount' => $transaction->total,
            ],
            'item_details' => $itemDetails,
            'customer_details' => [
                'first_name' => $transaction->customer->nama ?? 'Pelanggan Umum',
                'phone' => $transaction->customer?->no_hp,
            ],
            'expiry' => [
                'unit' => 'minute',
                'duration' => (int) config('midtrans.expiry_duration'),
            ],
        ];

        /** @var string $token */
        $token = Snap::getSnapToken($params);

        $transaction->payment?->update([
            'order_id' => $orderId,
            'snap_token' => $token,
            'snap_kedaluwarsa' => now()->addMinutes((int) config('midtrans.expiry_duration')),
            'transaction_status' => 'pending',
        ]);

        return $token;
    }

    /**
     * Snap Token yang masih dapat dibuka ulang, bila ada.
     *
     * Membuka ulang token yang sama menampilkan tagihan yang SAMA di Midtrans
     * (QRIS atau nomor VA yang tadi), jadi pelanggan tidak perlu memindai kode
     * baru dan tidak ada order ganda. Sisa satu menit dianggap sudah habis,
     * supaya kasir tidak diberi tagihan yang kedaluwarsa saat sedang dibayar.
     */
    public function tokenAktif(Transaction $transaction): ?string
    {
        $payment = $transaction->payment;

        if ($transaction->status !== 'pending'
            || $payment === null
            || $payment->snap_token === null
            || $payment->snap_kedaluwarsa === null
            || $payment->snap_kedaluwarsa->isBefore(now()->addMinute())) {
            return null;
        }

        return $payment->snap_token;
    }

    /**
     * Tanyakan status sebuah order langsung ke Midtrans (Get Status API).
     *
     * Ini BUKAN callback browser yang dapat dipalsukan: server sendiri yang
     * menghubungi Midtrans dengan Server Key. Jawabannya berbentuk sama dengan
     * notifikasi webhook, sehingga dapat diproses oleh jalur yang sama.
     *
     * Mengembalikan null bila Midtrans belum mengenal order tersebut, yaitu
     * pelanggan membuka popup tetapi belum memilih metode pembayaran.
     *
     * @return array<string, mixed>|null
     *
     * @throws RuntimeException
     */
    public function cekStatus(string $orderId): ?array
    {
        try {
            $jawaban = MidtransTransaction::status($orderId);
        } catch (Throwable $e) {
            if ($e->getCode() === 404) {
                return null;
            }

            throw new RuntimeException('Gagal menanyakan status ke Midtrans: '.$e->getMessage(), 0, $e);
        }

        /** @var array<string, mixed> $payload */
        $payload = json_decode((string) json_encode($jawaban), true) ?: [];

        return $payload;
    }

    /**
     * Verifikasi keaslian notifikasi webhook.
     *
     * signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
     *
     * Endpoint webhook bersifat publik, sehingga siapa pun dapat mengirim POST
     * yang mengaku `settlement`. Tanpa pemeriksaan ini, status lunas dapat
     * dipalsukan oleh siapa saja (PERANCANGAN Bagian 5.4).
     *
     * @param  array<string, mixed>  $payload
     */
    public function signatureSah(array $payload): bool
    {
        $diterima = (string) ($payload['signature_key'] ?? '');

        if ($diterima === '') {
            return false;
        }

        $dihitung = hash('sha512',
            (string) ($payload['order_id'] ?? '')
            .(string) ($payload['status_code'] ?? '')
            .(string) ($payload['gross_amount'] ?? '')
            .(string) config('midtrans.server_key'),
        );

        // Perbandingan waktu tetap, supaya lama pemeriksaan tidak membocorkan
        // sejauh mana tebakan penyerang sudah benar.
        return hash_equals($dihitung, $diterima);
    }

    /**
     * Terjemahkan status Midtrans menjadi status transaksi aplikasi.
     *
     * `capture` pada kartu kredit masih dapat ditandai curang, sehingga
     * fraud_status ikut diperiksa sebelum dianggap lunas.
     */
    public function petakanStatus(string $transactionStatus, ?string $fraudStatus = null): string
    {
        if ($transactionStatus === 'capture' && $fraudStatus === 'challenge') {
            return 'pending';
        }

        if (in_array($transactionStatus, self::STATUS_LUNAS, true)) {
            return $fraudStatus === 'deny' ? 'deny' : 'settlement';
        }

        if (in_array($transactionStatus, self::STATUS_GAGAL, true)) {
            return $transactionStatus === 'failure' ? 'deny' : $transactionStatus;
        }

        return 'pending';
    }

    /**
     * Kunci idempoten sebuah notifikasi.
     *
     * Midtrans mengirim notifikasi yang sama berkali-kali. Kunci ini membuat
     * penolakan duplikat ditegakkan indeks unik basis data, bukan hanya kode.
     *
     * @param  array<string, mixed>  $payload
     */
    public function kunciIdempoten(array $payload): string
    {
        return hash('sha256', implode('|', [
            (string) ($payload['order_id'] ?? ''),
            (string) ($payload['status_code'] ?? ''),
            (string) ($payload['transaction_status'] ?? ''),
            (string) ($payload['gross_amount'] ?? ''),
            (string) ($payload['fraud_status'] ?? ''),
        ]));
    }

    /**
     * Susun rincian item: baris produk, lalu diskon sebagai nilai negatif,
     * lalu PPN sebagai baris tersendiri.
     *
     * @return list<array{id: string, price: int, quantity: int, name: string}>
     */
    private function rincianItem(Transaction $transaction): array
    {
        $items = [];

        foreach ($transaction->items as $item) {
            $items[] = [
                'id' => (string) $item->product_id,
                'price' => $item->harga_satuan,
                'quantity' => $item->qty,
                // Midtrans memotong nama item pada 50 karakter.
                'name' => mb_substr($item->nama_produk, 0, 50),
            ];
        }

        if ($transaction->diskon > 0) {
            $items[] = [
                'id' => 'DISKON',
                'price' => -$transaction->diskon,
                'quantity' => 1,
                'name' => 'Diskon member',
            ];
        }

        if ($transaction->pajak > 0) {
            $persen = round((float) config('pos.tarif_pajak') * 100);
            $items[] = [
                'id' => 'PPN',
                'price' => $transaction->pajak,
                'quantity' => 1,
                'name' => sprintf('PPN %d%%', $persen),
            ];
        }

        return $items;
    }

    /**
     * Midtrans menolak order_id yang pernah dipakai. Bila tagihan sebelumnya
     * kedaluwarsa lalu ditagih ulang, nomor percobaan ditambahkan di belakang:
     * SA-TRX-… → SA-TRX-…-R2 → SA-TRX-…-R3.
     *
     * Nomornya dibaca dari order_id TERAKHIR milik pembayaran ini. Cara lama
     * menghitung baris pembayaran, padahal satu transaksi hanya punya satu
     * baris, sehingga percobaan ketiga dan seterusnya selalu jatuh ke -R2 lagi
     * dan ditolak Midtrans sebagai order ganda.
     */
    public function orderIdBerikutnya(Transaction $transaction): string
    {
        $dasar = 'SA-'.$transaction->no_struk;
        $sebelumnya = $transaction->payment?->order_id;

        if ($sebelumnya === null) {
            return $dasar;
        }

        $ke = preg_match('/-R(\d+)$/', $sebelumnya, $cocok) === 1
            ? (int) $cocok[1] + 1
            : 2;

        return sprintf('%s-R%d', $dasar, $ke);
    }

    private function konfigurasi(): void
    {
        Config::$serverKey = (string) config('midtrans.server_key');
        Config::$clientKey = (string) config('midtrans.client_key');
        Config::$isProduction = (bool) config('midtrans.is_production');
        Config::$isSanitized = (bool) config('midtrans.is_sanitized');
        Config::$is3ds = (bool) config('midtrans.is_3ds');
    }
}
