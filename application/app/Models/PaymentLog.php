<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\PaymentLogFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $payment_id
 * @property string|null $status_lama
 * @property string $status_baru
 * @property Carbon $waktu_perubahan
 * @property string|null $dikonfirmasi_oleh
 * @property array<string, mixed>|null $raw_payload
 * @property string|null $idempotency_key
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Payment $payment
 */
#[Fillable(['payment_id', 'status_lama', 'status_baru', 'waktu_perubahan', 'dikonfirmasi_oleh', 'raw_payload', 'idempotency_key'])]
class PaymentLog extends Model
{
    /** @use HasFactory<PaymentLogFactory> */
    use HasFactory;

    /**
     * Pembayaran yang dicatat pada log ini.
     *
     * @return BelongsTo<Payment, $this>
     */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'waktu_perubahan' => 'datetime',
            'raw_payload' => 'array',
        ];
    }
}
