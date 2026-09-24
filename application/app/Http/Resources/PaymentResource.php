<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'metode' => $this->metode,
            'order_id' => $this->order_id,
            'payment_type' => $this->payment_type,
            'transaction_status' => $this->transaction_status,
            // Batas berlaku tagihan non-tunai yang sedang terbuka. Snap Token-nya
            // sendiri tidak dikirim di sini; hanya endpoint snap-token yang
            // menyerahkannya, dan hanya ketika kasir memang hendak membayar.
            'snap_kedaluwarsa' => $this->snap_kedaluwarsa,
            'jumlah_bayar' => $this->jumlah_bayar,
            'kembalian' => $this->kembalian,
            'waktu_settlement' => $this->waktu_settlement,
        ];
    }
}
