@extends('laporan.tata')

@php
    use App\Support\Format;

    $r = $data['ringkasan'];
    $p = $data['pembanding'];
    $titik = $data['tren']['titik'];
    $bulanan = $data['tren']['satuan'] === 'bulan';
    $maks = max(1, ...array_map(fn ($t) => $t['total'], $titik ?: [['total' => 0]]));
    $puncak = collect($titik)->sortByDesc('total')->first();
    // Label sumbu-x dijarangkan supaya tidak saling menimpa.
    $langkahLabel = max(1, (int) ceil(count($titik) / 12));
@endphp

@section('isi')
    <table class="kpi">
        <tr>
            <td>
                <div class="label">Total diterima</div>
                <div class="nilai">{{ Format::rupiah($r['total']) }}</div>
                <div class="kecil">
                    @if ($p['perubahan_persen'] === null)
                        Periode sebelumnya tanpa penjualan
                    @else
                        <span class="{{ $p['perubahan_persen'] >= 0 ? 'naik' : 'turun' }}">
                            {{ $p['perubahan_persen'] >= 0 ? '▲' : '▼' }} {{ Format::angka(abs($p['perubahan_persen']), 1) }}%
                        </span>
                        vs {{ Format::rupiah($p['total']) }} periode sebelumnya
                    @endif
                </div>
            </td>
            <td>
                <div class="label">Transaksi</div>
                <div class="nilai">{{ Format::angka($r['jumlah_transaksi']) }}</div>
            </td>
            <td>
                <div class="label">Rata-rata / transaksi</div>
                <div class="nilai">{{ Format::rupiah($r['rata_rata_transaksi']) }}</div>
            </td>
            <td>
                <div class="label">Diskon diberikan</div>
                <div class="nilai">{{ Format::rupiah($r['diskon']) }}</div>
            </td>
        </tr>
    </table>

    <h2>Tren pendapatan {{ $bulanan ? 'per bulan' : 'per hari' }}</h2>
    @if ($r['total'] === 0)
        <p class="muted">Tidak ada penjualan pada periode ini.</p>
    @else
        <p class="kecil">
            Tertinggi {{ Format::rupiah($puncak['total']) }} pada
            {{ $bulanan ? Format::bulan($puncak['kunci']) : Format::tanggal($puncak['mulai']) }}.
            Garis dasar = Rp0.
        </p>
        {{-- Kolom dari tabel HTML: satu-satunya bentuk grafik yang dirender
             dompdf dengan andal. Tinggi batang proporsional terhadap puncak. --}}
        {{-- table-layout: fixed + lebar sama rata: tanpa itu dompdf mempersempit
             kolom hari tanpa penjualan dan batang-batang di sebelahnya melebar. --}}
        @php $lebarKolom = round(100 / max(1, count($titik)), 3); @endphp
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border-bottom: 0.75pt solid #cbdad5; margin-top: 4pt;">
            <tr>
                @foreach ($titik as $t)
                    <td style="width: {{ $lebarKolom }}%; vertical-align: bottom; height: 110pt; padding: 0 0.75pt;">
                        @if ($t['total'] > 0)
                            <div style="height: {{ max(1, round($t['total'] / $maks * 105, 1)) }}pt; background: #00897b;"></div>
                        @endif
                    </td>
                @endforeach
            </tr>
            <tr>
                @foreach ($titik as $i => $t)
                    <td class="kecil" style="width: {{ $lebarKolom }}%; text-align: center; font-size: 5.5pt; padding-top: 2pt; white-space: nowrap; overflow: visible;">
                        @if ($i % $langkahLabel === 0)
                            {{ $bulanan ? Format::tanggal($t['mulai'], 'M y') : Format::tanggal($t['mulai'], 'j/n') }}
                        @endif
                    </td>
                @endforeach
            </tr>
        </table>
    @endif

    <h2>Rincian harian</h2>
    <table class="data">
        <thead>
            <tr>
                <th>Tanggal</th>
                <th class="num">Transaksi</th>
                <th class="num">Subtotal</th>
                <th class="num">Diskon</th>
                <th class="num">PPN</th>
                <th class="num">Total</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($data['harian'] as $h)
                <tr>
                    <td>{{ Format::tanggal($h['tanggal_str'], 'D, j M Y') }}</td>
                    <td class="num">{{ Format::angka($h['jumlah_transaksi']) }}</td>
                    <td class="num">{{ Format::angka($h['subtotal']) }}</td>
                    <td class="num">{{ Format::angka($h['diskon']) }}</td>
                    <td class="num">{{ Format::angka($h['pajak']) }}</td>
                    <td class="num">{{ Format::angka($h['total']) }}</td>
                </tr>
            @empty
                <tr><td colspan="6" class="muted">Tidak ada penjualan pada periode ini.</td></tr>
            @endforelse
        </tbody>
        @if (count($data['harian']) > 0)
            <tfoot>
                <tr>
                    <th>Jumlah</th>
                    <th class="num">{{ Format::angka($r['jumlah_transaksi']) }}</th>
                    <th class="num">{{ Format::angka($r['subtotal']) }}</th>
                    <th class="num">{{ Format::angka($r['diskon']) }}</th>
                    <th class="num">{{ Format::angka($r['pajak']) }}</th>
                    <th class="num">{{ Format::angka($r['total']) }}</th>
                </tr>
            </tfoot>
        @endif
    </table>
    <p class="kecil">Hari tanpa penjualan tidak ditampilkan di rincian; nilainya nol pada grafik tren.</p>
@endsection
