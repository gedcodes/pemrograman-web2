<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\OperationalExpenseFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Beban operasional bulanan (gaji, utilitas, perlengkapan, retribusi, penyusutan).
 *
 * Nilainya disimpan per bulan lalu diprorata sesuai panjang periode laporan,
 * mengikuti perilaku prototipe pada `docs/assets/js/data/master.js`.
 *
 * @property int $id
 * @property string $nama
 * @property int $jumlah_bulanan
 * @property string|null $keterangan
 * @property bool $aktif
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['nama', 'jumlah_bulanan', 'keterangan', 'aktif'])]
class OperationalExpense extends Model
{
    /** @use HasFactory<OperationalExpenseFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Nilai bawaan yang mencerminkan default basis data.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'jumlah_bulanan' => 0,
        'aktif' => true,
    ];

    /**
     * Hanya beban yang sedang berlaku.
     *
     * @param  Builder<OperationalExpense>  $query
     */
    #[Scope]
    protected function aktif(Builder $query): void
    {
        $query->where('aktif', true);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'jumlah_bulanan' => 'integer',
            'aktif' => 'boolean',
        ];
    }
}
