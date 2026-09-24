<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;

/**
 * Fortify dipakai tanpa tampilan (headless): yang tersisa hanya POST /login dan
 * POST /logout yang dipanggil SPA. Halaman login sendiri milik Vue Router.
 *
 * Untuk permintaan JSON, respons bawaan Fortify sudah tepat bagi SPA
 * (`{"two_factor": false}` saat masuk, 204 saat keluar), sehingga tidak ada
 * kelas respons khusus yang perlu didaftarkan.
 */
class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });
    }
}
