<?php

use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // SPA disajikan dari origin yang sama, jadi autentikasinya memakai
        // cookie sesi Sanctum -- bukan token yang harus disimpan sendiri di browser.
        $middleware->statefulApi();

        // Bawaannya `route('login')`, padahal halaman login milik Vue Router dan
        // Fortify berjalan tanpa tampilan, sehingga rute bernama itu tidak ada
        // dan permintaan tamu non-JSON berakhir 500. Permintaan ke api/* tetap
        // dijawab JSON 401 lewat shouldRenderJsonWhen di bawah.
        $middleware->redirectGuestsTo('/login');

        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);

        $middleware->web(append: [
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
