<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Perhitungan harga, dipakai bersama oleh kasir, riwayat, dan laporan
 * supaya angka di semua tempat selalu sama.
 *
 * Rumusnya disalin persis dari `docs/assets/js/core/pricing.js`:
 *
 *     subtotal = jumlah(harga_satuan x qty)
 *     diskon   = bulat(subtotal x tarif diskon)
 *     DPP      = subtotal - diskon
 *     pajak    = bulat(DPP x tarif pajak)
 *     total    = DPP + pajak
 *
 * Perhatikan urutannya: diskon member dipotong lebih dulu, baru PPN dikenakan
 * di atas dasar pengenaan pajak. Membalik urutan ini menghasilkan total berbeda.
 */
class PricingService
{
    /**
     * @param  list<array{qty: int, harga_satuan: int}>  $lines
     * @return array{subtotal: int, diskon: int, pajak: int, total: int}
     */
    public function hitung(array $lines, bool $member = false): array
    {
        $subtotal = 0;
        foreach ($lines as $line) {
            $subtotal += $line['qty'] * $line['harga_satuan'];
        }

        $tarifDiskon = $member ? (float) config('pos.tarif_diskon_member') : 0.0;
        $tarifPajak = (float) config('pos.tarif_pajak');

        $diskon = (int) round($subtotal * $tarifDiskon);
        $dpp = $subtotal - $diskon;
        $pajak = (int) round($dpp * $tarifPajak);

        return [
            'subtotal' => $subtotal,
            'diskon' => $diskon,
            'pajak' => $pajak,
            'total' => $dpp + $pajak,
        ];
    }
}
