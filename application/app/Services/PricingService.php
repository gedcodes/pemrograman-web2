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
 *
 * Tarifnya dibaca dari Pengaturan Toko pada saat transaksi dibuat. Nominal
 * diskon dan pajak disimpan per transaksi, sehingga mengubah tarif tidak
 * mengubah struk atau laporan yang sudah lewat.
 */
class PricingService
{
    public function __construct(private readonly PengaturanToko $pengaturan) {}

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

        $tarifDiskon = $member ? $this->pengaturan->tarifDiskonMember() : 0.0;
        $tarifPajak = $this->pengaturan->tarifPajakBerlaku();

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
