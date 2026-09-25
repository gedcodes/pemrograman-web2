{{-- Tata letak bersama laporan PDF (dompdf). CSS sengaja sederhana: dompdf
     hanya mendukung CSS 2.1 plus sebagian kecil CSS3, jadi tata letak memakai
     tabel, bukan flex/grid. --}}
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>{{ $judul }} · {{ $toko['nama_toko'] }}</title>
<style>
    @page { margin: 16mm 14mm 18mm; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 8.5pt; color: #16302c; }
    h2 { font-size: 10.5pt; margin: 14pt 0 6pt; color: #0b2b27; }
    .kecil { font-size: 7.5pt; color: #526e69; }
    .kop { width: 100%; border-collapse: collapse; border-bottom: 1.5pt solid #0b6b62; margin-bottom: 10pt; }
    .kop td { vertical-align: middle; padding-bottom: 8pt; }
    .kop-logo { width: 46pt; }
    .kop-logo img { width: 40pt; height: 40pt; }
    .inisial { width: 40pt; height: 40pt; line-height: 40pt; text-align: center; background: #0b6b62; color: #fff; font-weight: bold; font-size: 14pt; }
    .nama-toko { font-size: 12pt; font-weight: bold; color: #0b2b27; }
    .judul { font-size: 13pt; font-weight: bold; color: #0b6b62; text-align: right; }
    .kanan { text-align: right; }
    .num { text-align: right; white-space: nowrap; }
    table.data { width: 100%; border-collapse: collapse; }
    table.data th { background: #e4edea; color: #16302c; font-weight: bold; text-align: left; padding: 4pt 5pt; border-bottom: 0.75pt solid #cbdad5; }
    table.data th.num { text-align: right; }
    table.data td { padding: 3.5pt 5pt; border-bottom: 0.5pt solid #e4edea; }
    table.data tfoot th, table.data .jumlah td { background: #edf4f2; font-weight: bold; border-top: 0.75pt solid #cbdad5; }
    table.data thead { display: table-header-group; }
    table.data tr { page-break-inside: avoid; }
    .kpi { width: 100%; border-collapse: separate; border-spacing: 5pt 0; margin: 0 -5pt; }
    .kpi td { background: #edf4f2; padding: 7pt 8pt; width: 25%; vertical-align: top; }
    .kpi .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5pt; color: #526e69; }
    .kpi .nilai { font-size: 12pt; font-weight: bold; margin-top: 2pt; }
    .naik { color: #0b6b62; }
    .turun { color: #b42318; }
    .muted { color: #526e69; }
    .kaki { margin-top: 14pt; font-size: 7pt; color: #526e69; }
</style>
</head>
<body>
    <table class="kop">
        <tr>
            <td class="kop-logo">
                @if ($logo)
                    <img src="{{ $logo }}" alt="">
                @else
                    <div class="inisial">{{ $toko['inisial'] }}</div>
                @endif
            </td>
            <td>
                <div class="nama-toko">{{ $toko['nama_toko'] }}</div>
                <div class="kecil">{{ $toko['alamat'] }}@if ($toko['telepon']) · Telp. {{ $toko['telepon'] }}@endif</div>
                @if ($toko['npwp'])<div class="kecil">NPWP {{ $toko['npwp'] }}</div>@endif
            </td>
            <td class="kanan">
                <div class="judul">{{ $judul }}</div>
                <div class="kecil">{{ $subjudul }}</div>
            </td>
        </tr>
    </table>

    @yield('isi')

    <div class="kaki">
        {{-- Aplikasi berjalan dalam UTC (config/app.php); labelnya ditulis
             supaya jam di berkas tidak disangka waktu setempat. --}}
        Dibuat {{ \App\Support\Format::tanggal(now(), 'j M Y H:i') }} {{ config('app.timezone') }}
        @if ($pembuat) oleh {{ $pembuat }} @endif
        · {{ $catatanKaki ?? 'Hanya memuat transaksi berstatus lunas.' }}
    </div>
</body>
</html>
