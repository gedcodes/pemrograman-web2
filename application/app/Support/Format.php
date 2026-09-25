<?php

declare(strict_types=1);

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Format tampilan Indonesia untuk berkas unduhan (PDF), sama dengan
 * `composables/format.ts` di SPA: Rp dengan titik ribuan, tanggal "24 Sep 2026".
 */
final class Format
{
    public static function angka(int|float $n, int $desimal = 0): string
    {
        return number_format($n, $desimal, ',', '.');
    }

    public static function rupiah(int|float $n): string
    {
        return ($n < 0 ? '−Rp' : 'Rp').self::angka(abs($n));
    }

    public static function persen(int|float $n): string
    {
        return self::angka($n, fmod((float) $n, 1.0) === 0.0 ? 0 : 2).'%';
    }

    public static function tanggal(string|DateTimeInterface $t, string $pola = 'j M Y'): string
    {
        $c = $t instanceof DateTimeInterface ? CarbonImmutable::instance($t) : new CarbonImmutable($t);

        return $c->settings(['locale' => 'id'])->translatedFormat($pola);
    }

    public static function bulan(string $tahunBulan): string
    {
        return self::tanggal($tahunBulan.'-01', 'M Y');
    }
}
