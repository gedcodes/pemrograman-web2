<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\Format;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Chart\Chart;
use PhpOffice\PhpSpreadsheet\Chart\DataSeries;
use PhpOffice\PhpSpreadsheet\Chart\DataSeriesValues;
use PhpOffice\PhpSpreadsheet\Chart\PlotArea;
use PhpOffice\PhpSpreadsheet\Chart\Title;
use PhpOffice\PhpSpreadsheet\Shared\Date as TanggalExcel;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Berkas unduhan laporan: PDF (dompdf) dan Excel (PhpSpreadsheet).
 *
 * Isi laporannya selalu berasal dari `LaporanService`, sama dengan yang tampil
 * di layar. Kelas ini hanya mengurus bentuk berkasnya.
 *
 * Di Excel, angka ditulis sebagai ANGKA (bukan teks berformat) dan tanggal
 * sebagai tanggal Excel, supaya pemilik toko dapat langsung menjumlah,
 * menyaring, dan membuat grafik sendiri.
 */
final class UnduhLaporan
{
    private const FORMAT_RUPIAH = '#,##0;[Red]-#,##0';

    private const WARNA_KEPALA = 'FFE4EDEA';

    public function __construct(private readonly PengaturanToko $pengaturan) {}

    /* ------------------------------------------------------------------ PDF */

    /**
     * @param  view-string  $view
     * @param  array<string, mixed>  $data
     */
    public function pdf(string $view, array $data, string $judul, string $subjudul, ?string $pembuat, bool $mendatar = false): string
    {
        $html = view($view, [
            'data' => $data,
            'judul' => $judul,
            'subjudul' => $subjudul,
            'pembuat' => $pembuat,
            'toko' => $this->pengaturan->untukApi(),
            'logo' => $this->logoDataUri(),
        ])->render();

        $opsi = new Options;
        $opsi->setDefaultFont('DejaVu Sans');
        // Hanya huruf yang dipakai yang disematkan: ±40 KB, bukan ±550 KB.
        $opsi->setIsFontSubsettingEnabled(true);
        // Tidak ada sumber luar: logo disisipkan sebagai data URI.
        $opsi->setIsRemoteEnabled(false);

        $pdf = new Dompdf($opsi);
        $pdf->loadHtml($html, 'UTF-8');
        $pdf->setPaper('A4', $mendatar ? 'landscape' : 'portrait');
        $pdf->render();

        // Nomor halaman di pojok kanan bawah setiap halaman.
        $kanvas = $pdf->getCanvas();
        $kanvas->page_text(
            $kanvas->get_width() - 110,
            $kanvas->get_height() - 30,
            'Halaman {PAGE_NUM} dari {PAGE_COUNT}',
            $pdf->getFontMetrics()->getFont('DejaVu Sans'),
            7,
            [0.32, 0.43, 0.41],
        );

        return (string) $pdf->output();
    }

    /**
     * Logo toko sebagai data URI, karena dompdf tidak diizinkan membaca berkas
     * atau alamat di luar dirinya.
     */
    private function logoDataUri(): ?string
    {
        $path = $this->pengaturan->semua()['logo'] ?? null;
        if (! is_string($path) || ! Storage::disk('public')->exists($path)) {
            return null;
        }

        $isi = (string) Storage::disk('public')->get($path);
        $kecil = $this->kecilkan($isi, 160);
        if ($kecil !== null) {
            return 'data:image/png;base64,'.base64_encode($kecil);
        }

        $mime = Storage::disk('public')->mimeType($path) ?: 'image/png';

        return 'data:'.$mime.';base64,'.base64_encode($isi);
    }

    /**
     * Logo di kop hanya tampil 40 pt. Logo unggahan bisa ribuan piksel dan
     * ratusan KB -- tanpa pengecilan, SETIAP laporan PDF ikut membengkak
     * (logo 1254 px membuat berkas ±550 KB). Transparansi dipertahankan.
     */
    private function kecilkan(string $gambar, int $sisiMaks): ?string
    {
        if (! function_exists('imagecreatefromstring')) {
            return null;
        }

        $asal = @imagecreatefromstring($gambar);
        if ($asal === false) {
            return null;
        }

        $lebar = imagesx($asal);
        $tinggi = imagesy($asal);
        $skala = min(1, $sisiMaks / max($lebar, $tinggi));
        $l = max(1, (int) round($lebar * $skala));
        $t = max(1, (int) round($tinggi * $skala));

        $hasil = imagecreatetruecolor($l, $t);
        imagealphablending($hasil, false);
        imagesavealpha($hasil, true);
        imagefill($hasil, 0, 0, (int) imagecolorallocatealpha($hasil, 0, 0, 0, 127));
        imagecopyresampled($hasil, $asal, 0, 0, 0, 0, $l, $t, $lebar, $tinggi);

        ob_start();
        imagepng($hasil, null, 9);

        return (string) ob_get_clean();
    }

    /* ---------------------------------------------------------------- Excel */

    /**
     * @param  array<string, mixed>  $d  hasil LaporanService::penjualan
     */
    public function excelPenjualan(array $d): string
    {
        $buku = $this->bukuBaru('Laporan Penjualan');
        $r = $d['ringkasan'];
        $p = $d['pembanding'];

        // ---- Ringkasan
        $s = $buku->getActiveSheet()->setTitle('Ringkasan');
        $baris = $this->kop($s, 'Laporan Penjualan', $this->labelPeriode($d['periode']));
        $s->fromArray([
            ['Pos', 'Nilai'],
            ['Jumlah transaksi', $r['jumlah_transaksi']],
            ['Subtotal (Rp)', $r['subtotal']],
            ['Diskon (Rp)', $r['diskon']],
            ['PPN (Rp)', $r['pajak']],
            ['Total diterima (Rp)', $r['total']],
            ['Rata-rata per transaksi (Rp)', $r['rata_rata_transaksi']],
            ['Total periode sebelumnya (Rp)', $p['total']],
            ['Perubahan vs periode sebelumnya (%)', $p['perubahan_persen'] === null ? '-' : $p['perubahan_persen'] / 100],
        ], null, "A{$baris}");
        $this->gayaKepala($s, "A{$baris}:B{$baris}");
        $s->getStyle('B'.($baris + 2).':B'.($baris + 7))->getNumberFormat()->setFormatCode(self::FORMAT_RUPIAH);
        $s->getStyle('B'.($baris + 8))->getNumberFormat()->setFormatCode('0.0%;[Red]-0.0%');
        $s->getStyle('A'.($baris + 5).':B'.($baris + 5))->getFont()->setBold(true);
        $s->setCellValue('A'.($baris + 10), 'Periode sebelumnya: '.$this->labelPeriode(['dari' => $p['dari'], 'sampai' => $p['sampai']]).'. Hanya transaksi berstatus lunas.');
        $s->getStyle('A'.($baris + 10))->getFont()->setItalic(true)->setSize(9);
        $this->lebarOtomatis($s, ['A', 'B']);

        // ---- Tren (rapat: hari/bulan kosong = 0), beserta grafik garis
        $t = $buku->createSheet()->setTitle('Tren');
        $bulanan = $d['tren']['satuan'] === 'bulan';
        $t->fromArray([[$bulanan ? 'Bulan' : 'Tanggal', 'Transaksi', 'Total (Rp)']], null, 'A1');
        $this->gayaKepala($t, 'A1:C1');
        $i = 2;
        foreach ($d['tren']['titik'] as $titik) {
            $t->setCellValue("A{$i}", TanggalExcel::PHPToExcel(Carbon::parse($titik['mulai'])));
            $t->setCellValue("B{$i}", $titik['jumlah_transaksi']);
            $t->setCellValue("C{$i}", $titik['total']);
            $i++;
        }
        $akhir = $i - 1;
        $t->getStyle("A2:A{$akhir}")->getNumberFormat()->setFormatCode($bulanan ? 'mmm yyyy' : 'dd mmm yyyy');
        $t->getStyle("C2:C{$akhir}")->getNumberFormat()->setFormatCode(self::FORMAT_RUPIAH);
        $this->lebarOtomatis($t, ['A', 'B', 'C']);
        if ($akhir >= 2) {
            $this->grafikTren($t, $akhir);
        }

        // ---- Rincian harian (hanya hari yang ada penjualan) + baris jumlah berumus
        $h = $buku->createSheet()->setTitle('Rincian Harian');
        $h->fromArray([['Tanggal', 'Transaksi', 'Subtotal (Rp)', 'Diskon (Rp)', 'PPN (Rp)', 'Total (Rp)']], null, 'A1');
        $this->gayaKepala($h, 'A1:F1');
        $i = 2;
        foreach ($d['harian'] as $baris) {
            $h->setCellValue("A{$i}", TanggalExcel::PHPToExcel(Carbon::parse($baris['tanggal_str'])));
            $h->fromArray([[$baris['jumlah_transaksi'], $baris['subtotal'], $baris['diskon'], $baris['pajak'], $baris['total']]], null, "B{$i}");
            $i++;
        }
        $akhir = $i - 1;
        $h->setCellValue("A{$i}", 'Jumlah');
        foreach (['B', 'C', 'D', 'E', 'F'] as $kolom) {
            $h->setCellValue("{$kolom}{$i}", $akhir >= 2 ? "=SUM({$kolom}2:{$kolom}{$akhir})" : 0);
        }
        $this->gayaJumlah($h, "A{$i}:F{$i}");
        $h->getStyle("A2:A{$akhir}")->getNumberFormat()->setFormatCode('ddd, dd mmm yyyy');
        $h->getStyle("C2:F{$i}")->getNumberFormat()->setFormatCode(self::FORMAT_RUPIAH);
        $h->setAutoFilter("A1:F{$akhir}");
        $this->lebarOtomatis($h, ['A', 'B', 'C', 'D', 'E', 'F']);

        $buku->setActiveSheetIndex(0);

        return $this->simpan($buku, true);
    }

    /**
     * @param  array{periode: array{dari: string, sampai: string, jumlah_hari: int}, unit_terjual: int, pendapatan_kotor: int, diskon: int, penjualan_bersih: int, harga_pokok_penjualan: int, laba_kotor: int, margin_kotor: float, beban: array{operasional: int, mdr: int, total: int, rincian: list<array{nama: string, jumlah_bulanan: int, jumlah_periode: int}>, nilai_non_tunai: int, tarif_mdr: float}, laba_bersih: int, margin_bersih: float, pajak_dipungut: int}  $d  hasil LaporanService::labaRugi
     */
    public function excelLabaRugi(array $d): string
    {
        $buku = $this->bukuBaru('Laporan Laba Rugi');
        $s = $buku->getActiveSheet()->setTitle('Laba Rugi');
        $b = $d['beban'];

        $baris = $this->kop($s, 'Laporan Laba Rugi', $this->labelPeriode($d['periode']));
        $s->fromArray([['Pos', 'Jumlah (Rp)']], null, "A{$baris}");
        $this->gayaKepala($s, "A{$baris}:B{$baris}");

        $awal = $baris + 1;
        $baris = $awal;
        $tulis = function (string $label, int|string $nilai, bool $jumlah = false) use ($s, &$baris): int {
            $s->setCellValue("A{$baris}", $label);
            $s->setCellValue("B{$baris}", $nilai);
            if ($jumlah) {
                $this->gayaJumlah($s, "A{$baris}:B{$baris}");
            }

            return $baris++;
        };

        // Pengurang ditulis NEGATIF dan subtotal memakai rumus, sehingga
        // lembar ini tetap benar bila pemilik menyunting satu angka.
        $kotor = $tulis("Pendapatan kotor ({$d['unit_terjual']} unit terjual)", $d['pendapatan_kotor']);
        $diskon = $tulis('Diskon member', -$d['diskon']);
        $bersih = $tulis('Penjualan bersih', "=B{$kotor}+B{$diskon}", true);
        $hpp = $tulis('Harga pokok penjualan', -$d['harga_pokok_penjualan']);
        $labaKotor = $tulis('Laba kotor', "=B{$bersih}+B{$hpp}", true);

        $bebanAwal = $baris;
        foreach ($b['rincian'] as $r) {
            $tulis("Beban: {$r['nama']} (".Format::rupiah($r['jumlah_bulanan'])."/bulan, diprorata {$d['periode']['jumlah_hari']}/30 hari)", -$r['jumlah_periode']);
        }
        $tulis('Biaya MDR '.Format::persen($b['tarif_mdr'] * 100).' dari non-tunai '.Format::rupiah($b['nilai_non_tunai']), -$b['mdr']);
        $bebanAkhir = $baris - 1;

        $labaBersih = $tulis($d['laba_bersih'] < 0 ? 'RUGI BERSIH' : 'LABA BERSIH', "=B{$labaKotor}+SUM(B{$bebanAwal}:B{$bebanAkhir})", true);
        $s->getStyle("A{$labaBersih}:B{$labaBersih}")->getFont()->setSize(12);

        $s->getStyle("B{$awal}:B{$labaBersih}")->getNumberFormat()->setFormatCode(self::FORMAT_RUPIAH);

        $baris++;
        $s->fromArray([
            ['Margin kotor', $d['margin_kotor'] / 100],
            ['Margin bersih', $d['margin_bersih'] / 100],
            ['PPN dipungut (titipan negara, bukan pendapatan)', $d['pajak_dipungut']],
        ], null, "A{$baris}");
        $s->getStyle("B{$baris}:B".($baris + 1))->getNumberFormat()->setFormatCode('0.00%;[Red]-0.00%');
        $s->getStyle('B'.($baris + 2))->getNumberFormat()->setFormatCode(self::FORMAT_RUPIAH);

        $this->lebarOtomatis($s, ['A', 'B']);

        return $this->simpan($buku);
    }

    /**
     * @param  array<string, mixed>  $d  hasil LaporanService::stok(semuaProduk: true)
     */
    public function excelStok(array $d): string
    {
        $buku = $this->bukuBaru('Laporan Stok');

        $s = $buku->getActiveSheet()->setTitle('Ringkasan');
        $baris = $this->kop($s, 'Laporan Stok', 'Per '.Format::tanggal(now(), 'j F Y H:i'));
        $s->fromArray([
            ['Pos', 'Nilai'],
            ['Jumlah produk', $d['jumlah_produk']],
            ['Total unit', $d['total_unit']],
            ['Nilai persediaan, harga beli (Rp)', $d['nilai_persediaan']],
            ['Produk stok menipis', $d['produk_stok_menipis']],
            ['Produk habis', $d['produk_habis']],
        ], null, "A{$baris}");
        $this->gayaKepala($s, "A{$baris}:B{$baris}");
        $s->getStyle('B'.($baris + 3))->getNumberFormat()->setFormatCode(self::FORMAT_RUPIAH);
        $this->lebarOtomatis($s, ['A', 'B']);

        $kepala = ['Barcode', 'Produk', 'Kategori', 'Satuan', 'Stok', 'Stok minimum', 'Harga beli (Rp)', 'Harga jual (Rp)', 'Nilai persediaan (Rp)', 'Status'];

        foreach (['Semua Produk' => $d['daftar_produk'], 'Stok Menipis' => $d['daftar_stok_menipis']] as $judul => $daftar) {
            $t = $buku->createSheet()->setTitle($judul);
            $t->fromArray([$kepala], null, 'A1');
            $this->gayaKepala($t, 'A1:J1');
            $i = 2;
            foreach ($daftar as $p) {
                // Barcode ditulis sebagai TEKS: sebagai angka, Excel memotongnya
                // menjadi 8,99887E+12 dan membuang nol di depan.
                $t->setCellValueExplicit("A{$i}", (string) ($p['barcode'] ?? ''), DataType::TYPE_STRING);
                $t->fromArray([[
                    $p['nama_produk'],
                    $p['category']['nama_kategori'] ?? '',
                    $p['unit']['simbol'] ?? '',
                    $p['stok'],
                    $p['stok_minimum'],
                    $p['harga_beli'],
                    $p['harga_jual'],
                ]], null, "B{$i}");
                $t->setCellValue("I{$i}", "=E{$i}*G{$i}");
                $t->setCellValue("J{$i}", $p['stok'] <= 0 ? 'Habis' : ($p['stok_menipis'] ? 'Menipis' : 'Aman'));
                $i++;
            }
            $akhir = $i - 1;
            if ($akhir >= 2) {
                $t->getStyle("G2:I{$akhir}")->getNumberFormat()->setFormatCode(self::FORMAT_RUPIAH);
                $t->setAutoFilter("A1:J{$akhir}");
            }
            $t->freezePane('C2');
            $this->lebarOtomatis($t, range('A', 'J'));
        }

        $buku->setActiveSheetIndex(0);

        return $this->simpan($buku);
    }

    /* -------------------------------------------------------------- bantuan */

    private function bukuBaru(string $judul): Spreadsheet
    {
        $buku = new Spreadsheet;
        $buku->getProperties()
            ->setCreator((string) $this->pengaturan->semua()['nama_toko'])
            ->setTitle($judul);
        $buku->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11);

        return $buku;
    }

    /**
     * Tiga baris kop (nama toko, judul, periode). Mengembalikan baris pertama
     * yang bebas untuk isi.
     */
    private function kop(Worksheet $s, string $judul, string $periode): int
    {
        $s->setCellValue('A1', (string) $this->pengaturan->semua()['nama_toko']);
        $s->setCellValue('A2', $judul);
        $s->setCellValue('A3', $periode);
        $s->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $s->getStyle('A2')->getFont()->setBold(true)->setSize(12)->getColor()->setARGB('FF0B6B62');
        $s->getStyle('A3')->getFont()->setItalic(true)->getColor()->setARGB('FF526E69');

        return 5;
    }

    private function gayaKepala(Worksheet $s, string $rentang): void
    {
        $gaya = $s->getStyle($rentang);
        $gaya->getFont()->setBold(true);
        $gaya->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB(self::WARNA_KEPALA);
        $gaya->getBorders()->getBottom()->setBorderStyle(Border::BORDER_THIN);
        $gaya->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
    }

    private function gayaJumlah(Worksheet $s, string $rentang): void
    {
        $gaya = $s->getStyle($rentang);
        $gaya->getFont()->setBold(true);
        $gaya->getBorders()->getTop()->setBorderStyle(Border::BORDER_THIN);
    }

    /**
     * @param  list<string>  $kolom
     */
    private function lebarOtomatis(Worksheet $s, array $kolom): void
    {
        foreach ($kolom as $k) {
            $s->getColumnDimension($k)->setAutoSize(true);
        }
    }

    private function grafikTren(Worksheet $t, int $akhir): void
    {
        $lembar = "'Tren'";
        $seri = new DataSeries(
            DataSeries::TYPE_LINECHART,
            DataSeries::GROUPING_STANDARD,
            [0],
            [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "{$lembar}!\$C\$1", null, 1)],
            [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "{$lembar}!\$A\$2:\$A\${$akhir}", null, $akhir - 1)],
            [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, "{$lembar}!\$C\$2:\$C\${$akhir}", null, $akhir - 1)],
        );

        $grafik = new Chart(
            'tren_pendapatan',
            new Title('Tren pendapatan'),
            // Satu deret: legenda hanya mengulang judul.
            null,
            new PlotArea(null, [$seri]),
        );
        $grafik->setTopLeftPosition('E2');
        $grafik->setBottomRightPosition('P22');
        $t->addChart($grafik);
    }

    /**
     * @param  array{dari: string, sampai: string}  $periode
     */
    public function labelPeriode(array $periode): string
    {
        return Format::tanggal($periode['dari'], 'j M Y').' – '.Format::tanggal($periode['sampai'], 'j M Y');
    }

    private function simpan(Spreadsheet $buku, bool $denganGrafik = false): string
    {
        $penulis = new Xlsx($buku);
        $penulis->setIncludeCharts($denganGrafik);

        ob_start();
        $penulis->save('php://output');

        return (string) ob_get_clean();
    }
}
