<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Pajak & Diskon
    |--------------------------------------------------------------------------
    |
    | Nilainya mengikuti prototipe `docs/assets/js/data/transactions.js`.
    | Menu Pengaturan > Pajak & Diskon (PERANCANGAN Bagian 2) nantinya mengubah
    | nilai-nilai ini, sehingga tidak boleh ditulis tetap di dalam kode.
    |
    */

    'tarif_pajak' => (float) env('POS_TARIF_PAJAK', 0.11),

    'tarif_diskon_member' => (float) env('POS_TARIF_DISKON_MEMBER', 0.05),

    /*
    |--------------------------------------------------------------------------
    | Biaya Merchant Discount Rate (MDR)
    |--------------------------------------------------------------------------
    |
    | Biaya yang dipotong penyedia pembayaran untuk setiap transaksi non-tunai
    | (QRIS/GoPay/VA). Ketentuan Bank Indonesia untuk QRIS pedagang kecil 0,7%.
    | Dipakai Laporan Laba Rugi sebagai komponen beban.
    |
    */

    'tarif_mdr' => (float) env('POS_TARIF_MDR', 0.007),

    /*
    |--------------------------------------------------------------------------
    | Identitas Toko
    |--------------------------------------------------------------------------
    */

    'nama_toko' => env('POS_NAMA_TOKO', 'Toko Sari Amerta'),

    /*
    |--------------------------------------------------------------------------
    | Paginasi
    |--------------------------------------------------------------------------
    */

    'per_halaman' => 20,

];
