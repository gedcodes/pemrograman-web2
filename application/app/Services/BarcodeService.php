<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Barcode internal untuk produk yang tidak membawa barcode pabrik
 * (curah, racikan sendiri, titipan).
 *
 * Formatnya EAN-13 berawalan `20`. Awalan 20–29 dicadangkan GS1 untuk kode
 * internal toko ("restricted circulation"), jadi tidak akan pernah bertabrakan
 * dengan barcode pabrik yang sah. Prototipe juga sudah memakai awalan ini
 * (mis. Telur Ayam Negeri `2000140000105`).
 *
 *     20 · 10 digit acak · 1 digit cek
 *
 * Acak, bukan berurutan: tidak butuh penghitung bersama yang harus dikunci,
 * dan dua admin yang membuat barcode bersamaan tidak akan mendapat nomor sama
 * (keunikan tetap diperiksa, dan dijaga indeks unik basis data).
 */
final class BarcodeService
{
    public const AWALAN_INTERNAL = '20';

    private const PERCOBAAN_MAKS = 20;

    /**
     * Digit cek EAN-13 untuk 12 digit pertama: bobot 1 dan 3 berselang-seling
     * dari kiri, lalu digit yang menggenapkan jumlahnya ke kelipatan 10.
     */
    public static function digitCek(string $duaBelasDigit): int
    {
        if (preg_match('/^\d{12}$/', $duaBelasDigit) !== 1) {
            throw new \InvalidArgumentException('Digit cek EAN-13 butuh tepat 12 digit.');
        }

        $jumlah = 0;
        foreach (str_split($duaBelasDigit) as $i => $digit) {
            $jumlah += (int) $digit * ($i % 2 === 0 ? 1 : 3);
        }

        return (10 - $jumlah % 10) % 10;
    }

    public static function ean13Sah(string $kode): bool
    {
        return preg_match('/^\d{13}$/', $kode) === 1
            && self::digitCek(substr($kode, 0, 12)) === (int) $kode[12];
    }

    /**
     * Satu barcode internal yang belum dipakai produk mana pun, termasuk
     * produk yang sudah dihapus (indeks unik tetap berlaku untuk baris itu).
     */
    public function buat(): string
    {
        for ($i = 0; $i < self::PERCOBAAN_MAKS; $i++) {
            $badan = self::AWALAN_INTERNAL.str_pad((string) random_int(0, 9_999_999_999), 10, '0', STR_PAD_LEFT);
            $kode = $badan.self::digitCek($badan);

            if (! Product::withTrashed()->where('barcode', $kode)->exists()) {
                return $kode;
            }
        }

        // Praktis mustahil (10 miliar kemungkinan), tetapi lebih baik gagal
        // jelas daripada berputar selamanya.
        throw new RuntimeException('Gagal membuat barcode unik. Coba lagi.');
    }

    /**
     * Beri barcode internal kepada produk yang belum punya.
     *
     * @param  list<int>|null  $ids  Batasi pada produk ini; null = semua produk.
     * @return int Jumlah produk yang diberi barcode.
     */
    public function isiYangKosong(?array $ids = null): int
    {
        return DB::transaction(function () use ($ids): int {
            $produk = Product::query()
                ->where(fn ($q) => $q->whereNull('barcode')->orWhere('barcode', ''))
                ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids))
                ->lockForUpdate()
                ->get();

            foreach ($produk as $p) {
                // Disimpan satu per satu, sehingga `buat()` untuk produk
                // berikutnya sudah melihat kode yang baru saja dipakai.
                $p->update(['barcode' => $this->buat()]);
            }

            return $produk->count();
        });
    }
}
