<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| NILAI BAWAAN pengaturan toko
|--------------------------------------------------------------------------
|
| Nilai di berkas ini hanya dipakai selama pengaturannya belum pernah
| disimpan lewat menu Pengaturan → Pengaturan Toko. Begitu disimpan, nilai di
| tabel `settings` yang berlaku. Karena itu JANGAN membaca `config('pos.*')`
| langsung untuk nilai yang dapat diatur -- pakai `App\Services\PengaturanToko`.
|
*/

return [

    /*
    |--------------------------------------------------------------------------
    | Pajak & Diskon
    |--------------------------------------------------------------------------
    |
    | Nilainya mengikuti prototipe `docs/assets/js/data/transactions.js`.
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
    |
    | Profil toko dari prototipe `docs/assets/js/core/settings.js`. Tampil di
    | sidebar, halaman masuk, kop laporan, serta kepala dan kaki struk.
    |
    */

    'nama_toko' => env('POS_NAMA_TOKO', 'Toko Sari Amerta'),

    'toko' => [
        'slogan' => 'Sembako & Kebutuhan Harian',
        'alamat' => 'Jl. Raya Puputan No. 41, Renon, Denpasar',
        'telepon' => '(0361) 284910',
        'email' => 'halo@tokosariamerta.id',
        'npwp' => '08.214.590.2-905.000',
        'nib' => '9120008310921',
        'jam_buka' => '07:00',
        'jam_tutup' => '21:30',
        'struk_footer_1' => 'Terima kasih telah berbelanja',
        'struk_footer_2' => 'Barang yang sudah dibeli tidak dapat ditukar',
    ],

    /*
    |--------------------------------------------------------------------------
    | Paginasi
    |--------------------------------------------------------------------------
    */

    'per_halaman' => 20,

];
