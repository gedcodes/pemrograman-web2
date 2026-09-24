<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| SPA POS
|--------------------------------------------------------------------------
|
| Aplikasi ini hanya punya satu antarmuka: SPA Vue di resources/js/spa.
| Seluruh alamat halaman diserahkan kepada Vue Router, termasuk /login
| (yang GET; POST /login dan /logout tetap milik Fortify).
|
| Empat prefiks dikecualikan karena bukan halaman:
|   api/     -- REST API (routes/api.php)
|   sanctum/ -- cookie CSRF untuk SPA
|   storage/ -- berkas disk lokal yang disajikan Laravel
|   up       -- health check
| Rute web didaftarkan SEBELUM rute api, jadi tanpa pengecualian ini
| permintaan GET /api/... akan tertelan dan dijawab HTML, bukan JSON.
|
*/

// Alamat lama ketika SPA masih disajikan di bawah /app (sebelum 2026-09-24).
Route::get('app/{any?}', function (Request $request, ?string $any = null) {
    $query = $request->getQueryString();

    return redirect('/'.$any.($query ? '?'.$query : ''));
})->where('any', '.*');

Route::view('{any?}', 'spa')
    ->where('any', '^(?!(api|sanctum|storage|up)(/|$)).*')
    ->name('spa');
