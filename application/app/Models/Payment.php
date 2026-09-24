<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $transaction_id
 * @property string $metode
 * @property string|null $order_id
 * @property string|null $payment_type
 * @property string|null $transaction_status
 * @property string|null $snap_token
 * @property Carbon|null $snap_kedaluwarsa
 * @property int $jumlah_bayar
 * @property int $kembalian
 * @property Carbon|null $waktu_settlement
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Transaction $transaction
 * @property-read Collection<int, PaymentLog> $logs
 */
#[Fillable(['transaction_id', 'metode', 'order_id', 'payment_type', 'transaction_status', 'snap_token', 'snap_kedaluwarsa', 'jumlah_bayar', 'kembalian', 'waktu_settlement'])]
class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    /**
     * Nilai bawaan yang mencerminkan default basis data.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'jumlah_bayar' => 0,
        'kembalian' => 0,
    ];

    /**
     * Transaksi yang dilunasi pembayaran ini.
     *
     * @return BelongsTo<Transaction, $this>
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /**
     * Jejak perubahan status pembayaran ini.
     *
     * @return HasMany<PaymentLog, $this>
     */
    public function logs(): HasMany
    {
        return $this->hasMany(PaymentLog::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'jumlah_bayar' => 'integer',
            'kembalian' => 'integer',
            'snap_kedaluwarsa' => 'datetime',
            'waktu_settlement' => 'datetime',
        ];
    }
}
