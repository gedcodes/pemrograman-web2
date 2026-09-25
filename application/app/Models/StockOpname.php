<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\StockOpnameFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $no_dokumen
 * @property int $user_id
 * @property Carbon $tanggal
 * @property string $status
 * @property string|null $catatan
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read Collection<int, OpnameItem> $items
 * @property-read int|null $items_count
 * @property-read int|null $berselisih_count
 */
#[Fillable(['no_dokumen', 'user_id', 'tanggal', 'status', 'catatan'])]
class StockOpname extends Model
{
    /** @use HasFactory<StockOpnameFactory> */
    use HasFactory;

    /**
     * Nilai bawaan yang mencerminkan default basis data.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'draft',
    ];

    /**
     * Pengguna yang melakukan opname.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Baris hitung pada sesi opname ini.
     *
     * @return HasMany<OpnameItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(OpnameItem::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
        ];
    }
}
