<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\OpnameItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $stock_opname_id
 * @property int $product_id
 * @property int $stok_sistem
 * @property int $stok_fisik
 * @property int $selisih
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read StockOpname $opname
 * @property-read Product $product
 */
#[Fillable(['stock_opname_id', 'product_id', 'stok_sistem', 'stok_fisik', 'selisih'])]
class OpnameItem extends Model
{
    /** @use HasFactory<OpnameItemFactory> */
    use HasFactory;

    /**
     * Sesi opname induk baris ini.
     *
     * @return BelongsTo<StockOpname, $this>
     */
    public function opname(): BelongsTo
    {
        return $this->belongsTo(StockOpname::class, 'stock_opname_id');
    }

    /**
     * Produk yang dihitung pada baris ini -- termasuk yang sudah dihapus,
     * supaya riwayat opname lama tetap menampilkan nama barangnya.
     *
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stok_sistem' => 'integer',
            'stok_fisik' => 'integer',
            'selisih' => 'integer',
        ];
    }
}
