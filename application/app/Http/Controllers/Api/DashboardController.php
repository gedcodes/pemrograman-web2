<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TransactionResource;
use App\Models\Product;
use App\Models\Transaction;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Data halaman Dashboard: empat kartu statistik, grafik tujuh hari,
 * dan daftar transaksi terakhir (PERANCANGAN Bagian 9).
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        // PERANCANGAN Bagian 2.2: kasir mendapat Dashboard versi RINGKAS.
        // Omzet toko dan grafik penjualan adalah data pemilik, jadi tidak
        // dikirim sama sekali, bukan sekadar disembunyikan di tampilan.
        if ($user !== null && ! $user->isAdmin()) {
            return $this->ringkas($user->id);
        }

        return $this->lengkap();
    }

    /**
     * Versi kasir: angka milik kasir itu sendiri hari ini, ditambah jumlah
     * stok menipis yang memang perlu diketahui saat berjualan.
     */
    private function ringkas(int $userId): JsonResponse
    {
        $hariIni = Carbon::today();

        $milikSaya = fn () => Transaction::query()
            ->whereHas('shift', fn ($q) => $q->where('user_id', $userId))
            ->whereDate('tanggal', $hariIni);

        $stat = $milikSaya()->lunas()
            ->selectRaw('COUNT(*) as jumlah_transaksi')
            ->selectRaw('COALESCE(SUM(total), 0) as omzet')
            ->first();

        $produkTerjual = (int) DB::table('transaction_items as ti')
            ->join('transactions as t', 't.id', '=', 'ti.transaction_id')
            ->join('shifts as s', 's.id', '=', 't.shift_id')
            ->where('s.user_id', $userId)
            ->where('t.status', 'settlement')
            ->whereDate('t.tanggal', $hariIni)
            ->sum('ti.qty');

        $terakhir = $milikSaya()
            ->with(['customer', 'payment'])
            ->orderByDesc('tanggal')
            ->limit(5)
            ->get();

        return ApiResponse::ok([
            'ringkas' => true,
            'kartu' => [
                'omzet_hari_ini' => (int) ($stat->omzet ?? 0),
                'jumlah_transaksi' => (int) ($stat->jumlah_transaksi ?? 0),
                'produk_terjual' => $produkTerjual,
                'stok_menipis' => Product::query()->stokMenipis()->count(),
            ],
            'grafik_7_hari' => [],
            'transaksi_terakhir' => TransactionResource::collection($terakhir)->resolve(),
        ]);
    }

    private function lengkap(): JsonResponse
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
            'ringkas' => false,
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
