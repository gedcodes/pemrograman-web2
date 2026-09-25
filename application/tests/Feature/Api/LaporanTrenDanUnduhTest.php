<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Product;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Tren pendapatan, periode pembanding, validasi periode, dan unduhan
 * PDF/Excel ketiga laporan.
 */
class LaporanTrenDanUnduhTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Product $produk;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-09-24 10:00:00');

        $this->admin = User::factory()->admin()->create();
        $this->produk = Product::factory()->create([
            'barcode' => '0012345678905', 'harga_beli' => 10_000, 'harga_jual' => 15_000, 'stok' => 5, 'stok_minimum' => 10,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function lunas(string $tanggal, int $qty, string $status = 'settlement'): Transaction
    {
        $shift = Shift::create(['user_id' => $this->admin->id, 'waktu_buka' => $tanggal, 'modal_awal' => 0]);
        $subtotal = $qty * 15_000;

        $trx = Transaction::factory()->create([
            'shift_id' => $shift->id, 'tanggal' => $tanggal, 'subtotal' => $subtotal,
            'diskon' => 0, 'pajak' => 0, 'total' => $subtotal, 'status' => $status,
        ]);
        TransactionItem::factory()->create([
            'transaction_id' => $trx->id, 'product_id' => $this->produk->id, 'nama_produk' => $this->produk->nama_produk,
            'qty' => $qty, 'harga_satuan' => 15_000, 'harga_beli' => 10_000, 'subtotal' => $subtotal,
        ]);

        return $trx;
    }

    /* ---------------------------------------------------------------- tren */

    public function test_tren_rapat_hari_tanpa_penjualan_bernilai_nol(): void
    {
        $this->lunas('2026-09-20 09:00:00', 2);
        $this->lunas('2026-09-22 09:00:00', 1);
        $this->lunas('2026-09-22 15:00:00', 1);
        $this->lunas('2026-09-21 09:00:00', 5, 'pending');

        $d = $this->actingAs($this->admin)
            ->getJson('/api/reports/sales?dari=2026-09-18&sampai=2026-09-24')
            ->assertOk()->json('data');

        $this->assertSame('hari', $d['tren']['satuan']);
        $this->assertCount(7, $d['tren']['titik']);
        $this->assertSame(
            ['2026-09-18' => 0, '2026-09-19' => 0, '2026-09-20' => 30_000, '2026-09-21' => 0, '2026-09-22' => 30_000, '2026-09-23' => 0, '2026-09-24' => 0],
            array_column($d['tren']['titik'], 'total', 'kunci'),
        );
        $this->assertSame(2, $d['tren']['titik'][4]['jumlah_transaksi']);
        // Rincian harian tetap hanya hari yang ada penjualannya.
        $this->assertCount(2, $d['harian']);
        $this->assertSame(20_000, $d['ringkasan']['rata_rata_transaksi']);
    }

    public function test_periode_lebih_dari_62_hari_dirangkum_per_bulan(): void
    {
        $this->lunas('2026-07-05 09:00:00', 1);
        $this->lunas('2026-07-30 09:00:00', 1);
        $this->lunas('2026-09-10 09:00:00', 2);

        $d = $this->actingAs($this->admin)
            ->getJson('/api/reports/sales?dari=2026-07-01&sampai=2026-09-24')
            ->json('data');

        $this->assertSame('bulan', $d['tren']['satuan']);
        $this->assertSame(
            ['2026-07' => 30_000, '2026-08' => 0, '2026-09' => 30_000],
            array_column($d['tren']['titik'], 'total', 'kunci'),
        );
        $this->assertSame('2026-07-01', $d['tren']['titik'][0]['mulai']);
    }

    public function test_pembanding_periode_sebelumnya_yang_sama_panjang(): void
    {
        // Periode 7 hari: 18–24 Sep; sebelumnya 11–17 Sep.
        $this->lunas('2026-09-12 09:00:00', 4); // 60.000
        $this->lunas('2026-09-20 09:00:00', 6); // 90.000

        $d = $this->actingAs($this->admin)
            ->getJson('/api/reports/sales?dari=2026-09-18&sampai=2026-09-24')
            ->json('data.pembanding');

        $this->assertSame(['2026-09-11', '2026-09-17'], [$d['dari'], $d['sampai']]);
        $this->assertSame(60_000, $d['total']);
        $this->assertEquals(50.0, $d['perubahan_persen']);
    }

    public function test_pembanding_kosong_tidak_menghasilkan_persen_tak_hingga(): void
    {
        $this->lunas('2026-09-20 09:00:00', 1);

        $this->actingAs($this->admin)
            ->getJson('/api/reports/sales?dari=2026-09-18&sampai=2026-09-24')
            ->assertJsonPath('data.pembanding.perubahan_persen', null);
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function periodeTidakSah(): array
    {
        return [
            'format salah' => ['dari=24-09-2026', 'dari'],
            'sampai sebelum dari' => ['dari=2026-09-20&sampai=2026-09-10', 'sampai'],
            'lebih dari 3 tahun' => ['dari=2022-01-01&sampai=2026-09-24', 'dari'],
        ];
    }

    #[DataProvider('periodeTidakSah')]
    public function test_periode_tidak_sah_dijawab_422_bukan_500(string $query, string $field): void
    {
        $this->actingAs($this->admin)->getJson("/api/reports/sales?{$query}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    }

    /* -------------------------------------------------------------- unduhan */

    private function unduh(string $url): TestResponse
    {
        return $this->actingAs($this->admin)->get($url, ['Accept' => 'application/json']);
    }

    private function bacaExcel(TestResponse $r): Spreadsheet
    {
        $berkas = tempnam(sys_get_temp_dir(), 'uji').'.xlsx';
        file_put_contents($berkas, $r->getContent());

        // Pembaca PhpSpreadsheet melewatkan grafik kecuali diminta.
        $pembaca = IOFactory::createReader('Xlsx');
        $pembaca->setIncludeCharts(true);

        return $pembaca->load($berkas);
    }

    public function test_unduh_pdf_penjualan(): void
    {
        $this->lunas('2026-09-20 09:00:00', 2);

        $r = $this->unduh('/api/reports/sales/unduh?format=pdf&dari=2026-09-18&sampai=2026-09-24')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'attachment; filename="laporan-penjualan_2026-09-18_2026-09-24.pdf"');

        $this->assertStringStartsWith('%PDF-', (string) $r->getContent());
        $this->assertStringContainsString('no-store', (string) $r->headers->get('Cache-Control'));
    }

    public function test_unduh_excel_penjualan_berisi_angka_rumus_dan_grafik(): void
    {
        $this->lunas('2026-09-20 09:00:00', 2);
        $this->lunas('2026-09-22 09:00:00', 1);

        $r = $this->unduh('/api/reports/sales/unduh?format=xlsx&dari=2026-09-18&sampai=2026-09-24')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $buku = $this->bacaExcel($r);
        $this->assertSame(['Ringkasan', 'Tren', 'Rincian Harian'], $buku->getSheetNames());

        $tren = $buku->getSheetByName('Tren');
        $this->assertNotNull($tren);
        $this->assertSame(8, $tren->getHighestRow()); // kepala + 7 hari
        // Angka tersimpan sebagai ANGKA, bukan teks berformat.
        $this->assertSame(30_000, $tren->getCell('C4')->getValue());
        $this->assertCount(1, $tren->getChartCollection());

        $harian = $buku->getSheetByName('Rincian Harian');
        $this->assertNotNull($harian);
        $this->assertSame('=SUM(F2:F3)', $harian->getCell('F4')->getValue());
        $this->assertEquals(45_000, $harian->getCell('F4')->getCalculatedValue());
    }

    public function test_unduh_excel_laba_rugi_memakai_rumus_yang_cocok_dengan_layar(): void
    {
        $this->lunas('2026-09-20 09:00:00', 4);

        $layar = $this->actingAs($this->admin)
            ->getJson('/api/reports/profit-loss?dari=2026-09-18&sampai=2026-09-24')->json('data');

        $s = $this->bacaExcel($this->unduh('/api/reports/profit-loss/unduh?format=xlsx&dari=2026-09-18&sampai=2026-09-24')->assertOk())
            ->getActiveSheet();

        $labaBersih = null;
        foreach ($s->getRowIterator() as $baris) {
            $a = (string) $s->getCell('A'.$baris->getRowIndex())->getValue();
            if (in_array($a, ['LABA BERSIH', 'RUGI BERSIH'], true)) {
                $labaBersih = $s->getCell('B'.$baris->getRowIndex())->getCalculatedValue();
            }
        }

        $this->assertEquals($layar['laba_bersih'], $labaBersih);
    }

    public function test_unduh_excel_stok_menyimpan_barcode_sebagai_teks(): void
    {
        $r = $this->unduh('/api/reports/stock/unduh?format=xlsx')->assertOk();
        $semua = $this->bacaExcel($r)->getSheetByName('Semua Produk');

        $this->assertNotNull($semua);
        // Sebagai angka, Excel akan membuang nol di depan dan menulis 1,23E+10.
        $this->assertSame('0012345678905', $semua->getCell('A2')->getValue());
        $this->assertSame('=E2*G2', $semua->getCell('I2')->getValue());
        $this->assertEquals(50_000, $semua->getCell('I2')->getCalculatedValue());
    }

    public function test_unduh_pdf_laba_rugi_dan_stok(): void
    {
        foreach (['/api/reports/profit-loss/unduh?format=pdf', '/api/reports/stock/unduh?format=pdf'] as $url) {
            $r = $this->unduh($url)->assertOk()->assertHeader('Content-Type', 'application/pdf');
            $this->assertStringStartsWith('%PDF-', (string) $r->getContent());
        }
    }

    public function test_format_unduhan_tidak_dikenal_ditolak(): void
    {
        $this->unduh('/api/reports/sales/unduh?format=docx')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('format');
    }

    public function test_kasir_tidak_boleh_mengunduh_laporan(): void
    {
        $kasir = User::factory()->kasir()->create();

        foreach (['sales', 'profit-loss', 'stock'] as $laporan) {
            $this->actingAs($kasir)->getJson("/api/reports/{$laporan}/unduh?format=pdf")->assertForbidden();
        }
    }
}
