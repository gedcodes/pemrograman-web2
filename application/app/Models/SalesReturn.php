<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\SalesReturnFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $no_dokumen
 * @property int $transaction_id
 * @property Carbon $tanggal_retur
 * @property string $alasan
 * @property int $jumlah_refund
 * @property string $status_approval
 * @property int|null $diajukan_oleh
 * @property int|null $disetujui_oleh
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Transaction $transaction
 * @property-read User|null $pengaju
 * @property-read User|null $penyetuju
 */
#[Fillable(['no_dokumen', 'transaction_id', 'tanggal_retur', 'alasan', 'jumlah_refund', 'status_approval', 'diajukan_oleh', 'disetujui_oleh'])]
class SalesReturn extends Model
{
    /** @use HasFactory<SalesReturnFactory> */
    use HasFactory;

    /**
     * Nilai bawaan yang mencerminkan default basis data.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'jumlah_refund' => 0,
        'status_approval' => 'pending',
    ];

    /**
     * Transaksi yang diretur.
     *
     * @return BelongsTo<Transaction, $this>
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /**
     * Pengguna yang mengajukan retur.
     *
     * @return BelongsTo<User, $this>
     */
    public function pengaju(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diajukan_oleh');
    }

    /**
     * Admin yang menyetujui retur.
     *
     * @return BelongsTo<User, $this>
     */
    public function penyetuju(): BelongsTo
    {
        return $this->belongsTo(User::class, 'disetujui_oleh');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tanggal_retur' => 'date',
            'jumlah_refund' => 'integer',
        ];
    }
}
