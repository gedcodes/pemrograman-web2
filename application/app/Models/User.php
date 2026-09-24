<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string $peran
 * @property bool $aktif
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, Shift> $shifts
 * @property-read Collection<int, Purchase> $purchases
 * @property-read Collection<int, StockOpname> $stockOpnames
 */
#[Fillable(['name', 'email', 'peran', 'aktif', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Shift kasir yang pernah dibuka pengguna ini.
     *
     * @return HasMany<Shift, $this>
     */
    public function shifts(): HasMany
    {
        return $this->hasMany(Shift::class);
    }

    /**
     * Dokumen barang masuk yang dicatat pengguna ini.
     *
     * @return HasMany<Purchase, $this>
     */
    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }

    /**
     * Sesi stok opname yang dilakukan pengguna ini.
     *
     * @return HasMany<StockOpname, $this>
     */
    public function stockOpnames(): HasMany
    {
        return $this->hasMany(StockOpname::class);
    }

    /**
     * Apakah pengguna ini berperan sebagai admin / pemilik.
     *
     * Dipakai middleware hak akses pada PERANCANGAN Bagian 2.2.
     */
    public function isAdmin(): bool
    {
        return $this->peran === 'admin';
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'aktif' => 'boolean',
        ];
    }
}
