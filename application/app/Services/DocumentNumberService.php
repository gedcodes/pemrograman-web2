<?php

declare(strict_types=1);

namespace App\Services;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Nomor dokumen harian berpola `PREFIX-YYYYMMDD-NNNN`, mengikuti pola
 * `dailyId()` pada prototipe `docs/assets/js/core/db.js`.
 *
 * Nomor diambil dari nilai tertinggi yang sudah ada pada hari itu. Bila dua
 * permintaan berbarengan sempat menghasilkan nomor sama, indeks unik pada
 * kolomnya yang menjadi penjaga terakhir -- bukan kode ini.
 */
class DocumentNumberService
{
    public function berikutnya(string $tabel, string $kolom, string $prefix, ?CarbonInterface $tanggal = null, int $lebar = 4): string
    {
        $tanggal ??= Carbon::now();
        $awalan = sprintf('%s-%s-', $prefix, $tanggal->format('Ymd'));

        $terakhir = DB::table($tabel)
            ->where($kolom, 'like', $awalan.'%')
            ->orderByDesc($kolom)
            ->value($kolom);

        $urutan = 1;
        if (is_string($terakhir)) {
            $urutan = ((int) substr($terakhir, strlen($awalan))) + 1;
        }

        return $awalan.str_pad((string) $urutan, $lebar, '0', STR_PAD_LEFT);
    }

    public function struk(?CarbonInterface $tanggal = null): string
    {
        return $this->berikutnya('transactions', 'no_struk', 'TRX', $tanggal);
    }

    public function barangMasuk(?CarbonInterface $tanggal = null): string
    {
        return $this->berikutnya('purchases', 'no_dokumen', 'BM', $tanggal, 3);
    }

    public function retur(?CarbonInterface $tanggal = null): string
    {
        return $this->berikutnya('sales_returns', 'no_dokumen', 'RTR', $tanggal, 3);
    }

    public function opname(?CarbonInterface $tanggal = null): string
    {
        return $this->berikutnya('stock_opnames', 'no_dokumen', 'OPN', $tanggal, 3);
    }
}
