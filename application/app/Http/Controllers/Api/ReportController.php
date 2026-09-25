<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LaporanService;
use App\Services\UnduhLaporan;
use App\Support\ApiResponse;
use App\Support\Format;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

/**
 * Laporan penjualan, laba rugi, dan stok, beserta unduhan PDF/Excel-nya.
 *
 * Perhitungannya ada di `LaporanService`; tampilan JSON dan berkas unduhan
 * memakai hasil yang sama sehingga angkanya tidak mungkin berbeda.
 */
class ReportController extends Controller
{
    /** Batas panjang periode, supaya satu permintaan tidak memindai bertahun-tahun data. */
    private const HARI_MAKS = 1096;

    public function __construct(
        private readonly LaporanService $laporan,
        private readonly UnduhLaporan $unduh,
    ) {}

    public function sales(Request $request): JsonResponse
    {
        return ApiResponse::ok($this->laporan->penjualan(...$this->periode($request)));
    }

    public function profitLoss(Request $request): JsonResponse
    {
        return ApiResponse::ok($this->laporan->labaRugi(...$this->periode($request)));
    }

    public function stock(): JsonResponse
    {
        return ApiResponse::ok($this->laporan->stok());
    }

    /* -------------------------------------------------------------- unduhan */

    public function unduhPenjualan(Request $request): Response
    {
        [$dari, $sampai] = $this->periode($request);
        $data = $this->laporan->penjualan($dari, $sampai);
        $nama = 'laporan-penjualan_'.$dari->toDateString().'_'.$sampai->toDateString();

        return $this->kirim($request, $nama,
            fn () => $this->unduh->pdf('laporan.penjualan', $data, 'Laporan Penjualan', $this->unduh->labelPeriode($data['periode']), $request->user()?->name),
            fn () => $this->unduh->excelPenjualan($data),
        );
    }

    public function unduhLabaRugi(Request $request): Response
    {
        [$dari, $sampai] = $this->periode($request);
        $data = $this->laporan->labaRugi($dari, $sampai);
        $nama = 'laporan-laba-rugi_'.$dari->toDateString().'_'.$sampai->toDateString();

        return $this->kirim($request, $nama,
            fn () => $this->unduh->pdf('laporan.laba-rugi', $data, 'Laporan Laba Rugi', $this->unduh->labelPeriode($data['periode']), $request->user()?->name),
            fn () => $this->unduh->excelLabaRugi($data),
        );
    }

    public function unduhStok(Request $request): Response
    {
        $data = $this->laporan->stok(semuaProduk: true);
        $nama = 'laporan-stok_'.now()->format('Y-m-d_Hi');

        return $this->kirim($request, $nama,
            fn () => $this->unduh->pdf('laporan.stok', $data, 'Laporan Stok', 'Per '.Format::tanggal(now(), 'j M Y H:i'), $request->user()?->name),
            fn () => $this->unduh->excelStok($data),
        );
    }

    /**
     * @param  \Closure(): string  $pdf
     * @param  \Closure(): string  $excel
     */
    private function kirim(Request $request, string $nama, \Closure $pdf, \Closure $excel): Response
    {
        $format = $request->validate(['format' => ['required', 'in:pdf,xlsx']])['format'];

        [$isi, $mime] = $format === 'pdf'
            ? [$pdf(), 'application/pdf']
            : [$excel(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

        return response($isi, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => "attachment; filename=\"{$nama}.{$format}\"",
            // Laporan berisi data keuangan: jangan disimpan cache perantara.
            'Cache-Control' => 'no-store, private',
        ]);
    }

    /**
     * Periode laporan; bawaannya 7 hari terakhir.
     *
     * Divalidasi di sini: sebelumnya tanggal yang salah format langsung
     * dilempar ke Carbon dan berakhir 500.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    private function periode(Request $request): array
    {
        $request->validate([
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:dari'],
        ], [
            'sampai.after_or_equal' => 'Tanggal akhir tidak boleh sebelum tanggal awal.',
        ]);

        $dari = $request->filled('dari')
            ? Carbon::parse($request->string('dari')->value())->startOfDay()
            : Carbon::today()->subDays(6)->startOfDay();

        $sampai = $request->filled('sampai')
            ? Carbon::parse($request->string('sampai')->value())->endOfDay()
            : Carbon::today()->endOfDay();

        if ($this->laporan->jumlahHari($dari, $sampai) > self::HARI_MAKS) {
            abort(response()->json([
                'message' => 'Periode laporan paling panjang 3 tahun.',
                'errors' => ['dari' => ['Periode laporan paling panjang 3 tahun.']],
            ], 422));
        }

        return [$dari, $sampai];
    }
}
