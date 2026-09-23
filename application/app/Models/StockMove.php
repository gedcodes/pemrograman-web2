<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\StockMoveFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $product_id
 * @property string $tipe
 * @property int $qty
 * @property int $stok_sebelum
 * @property int $stok_sesudah
 * @property string|null $referensi_tipe
 * @property int|null $referensi_id
 * @property int|null $user_id
 * @property string|null $keterangan
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Product $product
 * @property-read User|null $user
 */
#[Fillable(['product_id', 'tipe', 'qty', 'stok_sebelum', 'stok_sesudah', 'referensi_tipe', 'referensi_id', 'user_id', 'keterangan'])]
class StockMove extends Model
{
    /** @use HasFactory<StockMoveFactory> */
    use HasFactory;

    /**
     * Produk yang stoknya bergerak.
     *
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Pengguna yang memicu pergerakan ini.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'stok_sebelum' => 'integer',
            'stok_sesudah' => 'integer',
        ];
    }
}
