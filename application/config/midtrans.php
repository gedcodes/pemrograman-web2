<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Kredensial Midtrans
    |--------------------------------------------------------------------------
    |
    | Server Key TIDAK PERNAH dikirim ke browser dan tidak pernah masuk
    | repositori (PERANCANGAN Bagian 5.4). Hanya Client Key yang boleh dipakai
    | di sisi klien, karena kunci itu memang dirancang untuk publik dan tidak
    | dapat mengubah transaksi.
    |
    | Perpindahan Sandbox ke Production cukup dengan mengubah nilai-nilai di
    | berkas .env -- tidak ada satu baris kode pun yang perlu disentuh.
    |
    */

    'server_key' => env('MIDTRANS_SERVER_KEY', ''),

    'client_key' => env('MIDTRANS_CLIENT_KEY', ''),

    'merchant_id' => env('MIDTRANS_MERCHANT_ID', ''),

    'is_production' => (bool) env('MIDTRANS_IS_PRODUCTION', false),

    /*
    |--------------------------------------------------------------------------
    | Perilaku SDK
    |--------------------------------------------------------------------------
    |
    | sanitized : membersihkan data pelanggan sebelum dikirim ke Midtrans.
    | 3ds       : mewajibkan 3D Secure untuk pembayaran kartu.
    |
    */

    'is_sanitized' => (bool) env('MIDTRANS_IS_SANITIZED', true),

    'is_3ds' => (bool) env('MIDTRANS_IS_3DS', true),

    /*
    |--------------------------------------------------------------------------
    | Masa Berlaku Pembayaran
    |--------------------------------------------------------------------------
    |
    | Setelah tenggat ini Midtrans menandai transaksi sebagai `expire`.
    | Dibuat pendek karena pelanggan menunggu di depan kasir.
    |
    */

    'expiry_duration' => (int) env('MIDTRANS_EXPIRY_MINUTES', 30),

];
