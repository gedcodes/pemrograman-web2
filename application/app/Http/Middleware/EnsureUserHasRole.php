<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Menegakkan tabel hak akses PERANCANGAN Bagian 2.2 di sisi server.
 *
 * Menyembunyikan menu di antarmuka saja tidak cukup: kasir yang memanggil
 * endpoint admin secara langsung tetap harus ditolak.
 */
class EnsureUserHasRole
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user === null) {
            abort(401, 'Belum masuk.');
        }

        if (! $user->aktif) {
            abort(403, 'Akun Anda dinonaktifkan.');
        }

        if ($roles !== [] && ! in_array($user->peran, $roles, true)) {
            abort(403, 'Peran Anda tidak berhak mengakses sumber daya ini.');
        }

        return $next($request);
    }
}
