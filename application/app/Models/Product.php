<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string|null $barcode
 * @property string $nama_produk
 * @property int $category_id
 * @property int $unit_id
 * @property int $harga_beli
 * @property int $harga_jual
 * @property int $stok
 * @property int $stok_minimum
 * @property string|null $gambar
 * @property bool $aktif
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Category $category
 * @property-read Unit $unit
 * @property-read float $margin
 * @property-read string|null $gambar_url
 * @property-read Collection<int, TransactionItem> $transactionItems
 * @property-read Collection<int, PurchaseItem> $purchaseItems
 * @property-read Collection<int, OpnameItem> $opnameItems
 * @property-read Collection<int, StockMove> $stockMoves
 */
#[Fillable(['barcode', 'nama_produk', 'category_id', 'unit_id', 'harga_beli', 'harga_jual', 'stok', 'stok_minimum', 'gambar', 'aktif'])]
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Folder foto unggahan di disk `unggahan` (public/unggahan/produk).
     *
     * Foto contoh dari seeder berada di tempat lain, yaitu `public/img-produk`
     * (mis. `products/aqua-botol-600ml.webp`), dan tidak pernah dihapus aplikasi.
     */
    public const FOLDER_GAMBAR = 'produk';

    /**
     * Nilai bawaan yang mencerminkan default basis data.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'harga_beli' => 0,
        'harga_jual' => 0,
        'stok' => 0,
        'stok_minimum' => 0,
        'aktif' => true,
    ];

    /**
     * Kategori produk ini.
     *
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Satuan produk ini.
     *
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * Baris penjualan yang memuat produk ini.
     *
     * @return HasMany<TransactionItem, $this>
     */
    public function transactionItems(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    /**
     * Baris pembelian yang memuat produk ini.
     *
     * @return HasMany<PurchaseItem, $this>
     */
    public function purchaseItems(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    /**
     * Baris stok opname yang memuat produk ini.
     *
     * @return HasMany<OpnameItem, $this>
     */
    public function opnameItems(): HasMany
    {
        return $this->hasMany(OpnameItem::class);
    }

    /**
     * Seluruh pergerakan stok produk ini.
     *
     * @return HasMany<StockMove, $this>
     */
    public function stockMoves(): HasMany
    {
        return $this->hasMany(StockMove::class);
    }

    /**
     * Margin keuntungan dalam persen.
     *
     * PERANCANGAN memakai definisi margin = laba dibagi HARGA JUAL (bukan harga beli).
     * Markup terhadap harga beli adalah angka lain dan tidak dihitung di sini.
     *
     * @return Attribute<float, never>
     */
    protected function margin(): Attribute
    {
        return Attribute::make(
            get: fn (): float => $this->harga_jual > 0
                ? round(($this->harga_jual - $this->harga_beli) / $this->harga_jual * 100, 2)
                : 0.0,
        );
    }

    /**
     * URL foto produk, dibentuk di server supaya klien tidak perlu tahu di
     * mana berkasnya disimpan. Relatif, bukan absolut dari APP_URL (lihat
     * catatan pada `PengaturanToko::urlLogo`).
     *
     * Kedua cabangnya menunjuk ke berkas nyata di dalam `public/`, jadi tidak
     * ada symlink yang perlu dibuat lebih dulu.
     *
     * @return Attribute<string|null, never>
     */
    protected function gambarUrl(): Attribute
    {
        return Attribute::make(
            get: fn (): ?string => match (true) {
                $this->gambar === null || $this->gambar === '' => null,
                $this->gambarUnggahan() => '/unggahan/'.$this->gambar,
                default => '/img-produk/'.$this->gambar,
            },
        );
    }

    /**
     * Apakah foto ini hasil unggahan (boleh dihapus aplikasi), bukan foto
     * contoh bawaan seeder di `public/img-produk`.
     *
     * Pemeriksaan prefiks ini pula yang menjaga `delete()` tetap di dalam
     * folder unggahan: path seeder tidak pernah ikut terhapus.
     */
    public function gambarUnggahan(): bool
    {
        return is_string($this->gambar) && str_starts_with($this->gambar, self::FOLDER_GAMBAR.'/');
    }

    /**
     * Produk yang stoknya sudah menyentuh atau turun di bawah batas minimum.
     *
     * @param  Builder<Product>  $query
     */
    #[Scope]
    protected function stokMenipis(Builder $query): void
    {
        $query->whereColumn('stok', '<=', 'stok_minimum');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'harga_beli' => 'integer',
            'harga_jual' => 'integer',
            'stok' => 'integer',
            'stok_minimum' => 'integer',
            'aktif' => 'boolean',
        ];
    }
}
