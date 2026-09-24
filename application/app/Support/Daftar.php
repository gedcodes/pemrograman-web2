<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Urutan dan paginasi untuk semua endpoint daftar.
 *
 * Klien memilih kolom urut lewat `?urut=kolom&arah=asc|desc`. Nama kolom
 * TIDAK pernah diteruskan mentah ke SQL: hanya kolom di daftar izin yang
 * diterima, sisanya jatuh ke urutan bawaan. `per_page` dibatasi supaya
 * satu permintaan tidak dapat menarik seluruh tabel sekaligus.
 */
final class Daftar
{
    public const PER_HALAMAN_MAKS = 200;

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @param  list<string>  $kolomBoleh  kolom yang boleh dipakai mengurutkan
     * @param  'asc'|'desc'  $arahBawaan
     * @return LengthAwarePaginator<int, TModel>
     */
    public static function halaman(
        Builder $query,
        Request $request,
        array $kolomBoleh,
        string $bawaan,
        string $arahBawaan = 'asc',
    ): LengthAwarePaginator {
        $urut = $request->string('urut')->value();

        if (in_array($urut, $kolomBoleh, true)) {
            $arah = $request->string('arah')->lower()->value() === 'desc' ? 'desc' : 'asc';
        } else {
            $urut = $bawaan;
            $arah = $arahBawaan;
        }

        $model = $query->getModel();

        // Pengurut kedua `id` membuat urutan stabil: baris bernilai sama
        // tidak berpindah-pindah halaman saat halaman berganti.
        return $query
            ->orderBy($model->qualifyColumn($urut), $arah)
            ->orderBy($model->getQualifiedKeyName(), $arah)
            ->paginate(self::perHalaman($request));
    }

    public static function perHalaman(Request $request): int
    {
        $diminta = (int) $request->query('per_page', (string) config('pos.per_halaman'));

        return max(1, min(self::PER_HALAMAN_MAKS, $diminta));
    }
}
