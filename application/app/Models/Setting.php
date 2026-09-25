<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Satu baris pengaturan toko. Jangan dibaca langsung: pakai
 * `App\Services\PengaturanToko`, yang menggabungkannya dengan nilai bawaan
 * dan memastikan tipenya benar.
 *
 * @property int $id
 * @property string $kunci
 * @property mixed $nilai
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['kunci', 'nilai'])]
class Setting extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'nilai' => 'json',
        ];
    }
}
