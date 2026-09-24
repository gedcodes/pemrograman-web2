<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ShiftFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property Carbon $waktu_buka
 * @property Carbon|null $waktu_tutup
 * @property int $modal_awal
 * @property int|null $kas_akhir
 * @property string|null $catatan
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read Collection<int, Transaction> $transactions
 */
#[Fillable(['user_id', 'waktu_buka', 'waktu_tutup', 'modal_awal', 'kas_akhir', 'catatan'])]
class Shift extends Model
{
    /** @use HasFactory<ShiftFactory> */
    use HasFactory;

    /**
     * Nilai bawaan yang mencerminkan default basis data.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'modal_awal' => 0,
    ];

    /**
     * Kasir yang membuka shift ini.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Transaksi yang dinaungi shift ini.
     *
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * Rekap kas shift, untuk layar Tutup Shift.
     *
     * Kas seharusnya = modal awal + penjualan TUNAI yang lunas. Penjualan
     * non-tunai tidak masuk laci, jadi dilaporkan terpisah. Selisih baru
     * ada setelah kasir menghitung laci (kas_akhir diisi): positif berarti
     * uang lebih, negatif berarti uang kurang.
     *
     * @return array{jumlah_transaksi: int, penjualan_tunai: int, penjualan_non_tunai: int, tagihan_menunggu: int, kas_seharusnya: int, selisih: int|null}
     */
    public function ringkasan(): array
    {
        $baris = $this->transactions()
            ->join('payments', 'payments.transaction_id', '=', 'transactions.id')
            ->selectRaw("SUM(CASE WHEN transactions.status = 'settlement' THEN 1 ELSE 0 END) as jumlah")
            ->selectRaw("SUM(CASE WHEN transactions.status = 'settlement' AND payments.metode = 'tunai' THEN transactions.total ELSE 0 END) as tunai")
            ->selectRaw("SUM(CASE WHEN transactions.status = 'settlement' AND payments.metode = 'non_tunai' THEN transactions.total ELSE 0 END) as non_tunai")
            ->selectRaw("SUM(CASE WHEN transactions.status = 'pending' THEN 1 ELSE 0 END) as menunggu")
            ->toBase()
            ->first();

        $tunai = (int) ($baris->tunai ?? 0);
        $kasSeharusnya = $this->modal_awal + $tunai;

        return [
            'jumlah_transaksi' => (int) ($baris->jumlah ?? 0),
            'penjualan_tunai' => $tunai,
            'penjualan_non_tunai' => (int) ($baris->non_tunai ?? 0),
            'tagihan_menunggu' => (int) ($baris->menunggu ?? 0),
            'kas_seharusnya' => $kasSeharusnya,
            'selisih' => $this->kas_akhir !== null ? $this->kas_akhir - $kasSeharusnya : null,
        ];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'waktu_buka' => 'datetime',
            'waktu_tutup' => 'datetime',
            'modal_awal' => 'integer',
            'kas_akhir' => 'integer',
        ];
    }
}
