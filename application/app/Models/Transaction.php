<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\TransactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $no_struk
 * @property Carbon $tanggal
 * @property int $shift_id
 * @property int|null $customer_id
 * @property int $subtotal
 * @property int $diskon
 * @property int $pajak
 * @property int $total
 * @property string $status
 * @property string|null $catatan
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Shift $shift
 * @property-read Customer|null $customer
 * @property-read Payment|null $payment
 * @property-read Collection<int, TransactionItem> $items
 * @property-read Collection<int, SalesReturn> $salesReturns
 */
#[Fillable(['no_struk', 'tanggal', 'shift_id', 'customer_id', 'subtotal', 'diskon', 'pajak', 'total', 'status', 'catatan'])]
class Transaction extends Model
{
    /** @use HasFactory<TransactionFactory> */
    use HasFactory;

    /**
     * Nilai bawaan yang mencerminkan default basis data.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'subtotal' => 0,
        'diskon' => 0,
        'pajak' => 0,
        'total' => 0,
        'status' => 'draft',
    ];

    /**
     * Shift kasir yang menaungi transaksi ini.
     *
     * @return BelongsTo<Shift, $this>
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    /**
     * Pelanggan transaksi ini, bila bukan pembeli umum.
     *
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * Baris barang pada transaksi ini.
     *
     * @return HasMany<TransactionItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    /**
     * Pembayaran transaksi ini.
     *
     * @return HasOne<Payment, $this>
     */
    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    /**
     * Retur yang diajukan atas transaksi ini.
     *
     * @return HasMany<SalesReturn, $this>
     */
    public function salesReturns(): HasMany
    {
        return $this->hasMany(SalesReturn::class);
    }

    /**
     * Transaksi yang pembayarannya sudah benar-benar lunas.
     *
     * Hanya status settlement yang dihitung sebagai lunas. Status pending berarti
     * pelanggan belum membayar, sehingga tidak boleh masuk laporan penjualan.
     *
     * @param  Builder<Transaction>  $query
     */
    #[Scope]
    protected function lunas(Builder $query): void
    {
        $query->where('status', 'settlement');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tanggal' => 'datetime',
            'subtotal' => 'integer',
            'diskon' => 'integer',
            'pajak' => 'integer',
            'total' => 'integer',
        ];
    }
}
