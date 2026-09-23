<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TransactionResource;
use App\Models\Product;
use App\Models\Transaction;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Data halaman Dashboard: empat kartu statistik, grafik tujuh hari,
 * dan daftar transaksi terakhir (PERANCANGAN Bagian 9).
 */
class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $hariIni = Carbon::today();

        $statHariIni = Transaction::query()->lunas()
            ->whereDate('tanggal', $hariIni)
            ->selectRaw('COUNT(*) as jumlah_transaksi')
            ->selectRaw('COALESCE(SUM(total), 0) as omzet')
            ->first();

        $produkTerjual = (int) DB::table('transaction_items as ti')
            ->join('transactions as t', 't.id', '=', 'ti.transaction_id')
            ->where('t.status', 'settlement')
            ->whereDate('t.tanggal', $hariIni)
            ->sum('ti.qty');

        // Satu sumber kebenaran untuk ambang stok menipis, sama seperti
        // yang dipakai ProductResource dan laporan stok.
        $stokMenipis = Product::query()->stokMenipis()->count();

        // Alias SENGAJA bukan `tanggal`: nama itu punya cast datetime pada model,
        // sehingga hasil DATE() akan dihidrasi menjadi Carbon dan kuncinya berubah
        // jadi "2026-09-17 00:00:00" -- tidak akan pernah cocok dengan pencarian
        // per tanggal di bawah, dan seluruh grafik menjadi nol.
        $grafik = Transaction::query()->lunas()
            ->where('tanggal', '>=', $hariIni->copy()->subDays(6)->startOfDay())
            ->selectRaw('DATE(tanggal) as hari')
            ->selectRaw('COUNT(*) as jumlah_transaksi')
            ->selectRaw('SUM(total) as omzet')
            ->groupBy('hari')
            ->orderBy('hari')
            ->get()
            ->keyBy('hari');

        // Hari tanpa transaksi tetap muncul sebagai nol, supaya garis grafik
        // tidak melompati tanggal yang kosong.
        $deret = [];
        for ($i = 6; $i >= 0; $i--) {
            $tanggal = $hariIni->copy()->subDays($i)->toDateString();
            $baris = $grafik->get($tanggal);

            $deret[] = [
                'tanggal' => $tanggal,
                'jumlah_transaksi' => (int) ($baris->jumlah_transaksi ?? 0),
                'omzet' => (int) ($baris->omzet ?? 0),
            ];
        }

        $terakhir = Transaction::query()
            ->with(['customer', 'payment'])
            ->orderByDesc('tanggal')
            ->limit(10)
            ->get();

        return ApiResponse::ok([
            'kartu' => [
                'omzet_hari_ini' => (int) ($statHariIni->omzet ?? 0),
                'jumlah_transaksi' => (int) ($statHariIni->jumlah_transaksi ?? 0),
                'produk_terjual' => $produkTerjual,
                'stok_menipis' => $stokMenipis,
            ],
            'grafik_7_hari' => $deret,
            'transaksi_terakhir' => TransactionResource::collection($terakhir)->resolve(),
        ]);
    }
}
