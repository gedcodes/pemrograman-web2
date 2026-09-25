@extends('laporan.tata')

@php
    use App\Support\Format;

    $b = $data['beban'];
    $rugi = $data['laba_bersih'] < 0;
@endphp

@section('isi')
    <table class="kpi">
        <tr>
            <td>
                <div class="label">Penjualan bersih</div>
                <div class="nilai">{{ Format::rupiah($data['penjualan_bersih']) }}</div>
            </td>
            <td>
                <div class="label">Laba kotor</div>
                <div class="nilai">{{ Format::rupiah($data['laba_kotor']) }}</div>
                <div class="kecil">Margin {{ Format::persen($data['margin_kotor']) }}</div>
            </td>
            <td>
                <div class="label">Total beban</div>
                <div class="nilai">{{ Format::rupiah($b['total']) }}</div>
            </td>
            <td>
                <div class="label">{{ $rugi ? 'Rugi bersih' : 'Laba bersih' }}</div>
                <div class="nilai {{ $rugi ? 'turun' : 'naik' }}">{{ Format::rupiah($data['laba_bersih']) }}</div>
                <div class="kecil">Margin {{ Format::persen($data['margin_bersih']) }}</div>
            </td>
        </tr>
    </table>

    <h2>Perhitungan laba rugi</h2>
    <table class="data">
        <thead>
            <tr><th>Pos</th><th class="num">Jumlah (Rp)</th></tr>
        </thead>
        <tbody>
            <tr><td>Pendapatan kotor ({{ Format::angka($data['unit_terjual']) }} unit terjual)</td><td class="num">{{ Format::angka($data['pendapatan_kotor']) }}</td></tr>
            <tr><td>Diskon member</td><td class="num">({{ Format::angka($data['diskon']) }})</td></tr>
            <tr class="jumlah"><td>Penjualan bersih</td><td class="num">{{ Format::angka($data['penjualan_bersih']) }}</td></tr>
            <tr><td>Harga pokok penjualan</td><td class="num">({{ Format::angka($data['harga_pokok_penjualan']) }})</td></tr>
            <tr class="jumlah"><td>Laba kotor · margin {{ Format::persen($data['margin_kotor']) }}</td><td class="num">{{ Format::angka($data['laba_kotor']) }}</td></tr>
            @foreach ($b['rincian'] as $r)
                <tr>
                    <td>Beban: {{ $r['nama'] }} <span class="muted">({{ Format::rupiah($r['jumlah_bulanan']) }}/bulan × {{ $data['periode']['jumlah_hari'] }}/30 hari)</span></td>
                    <td class="num">({{ Format::angka($r['jumlah_periode']) }})</td>
                </tr>
            @endforeach
            <tr>
                <td>Biaya MDR {{ Format::persen($b['tarif_mdr'] * 100) }} × non-tunai {{ Format::rupiah($b['nilai_non_tunai']) }}</td>
                <td class="num">({{ Format::angka($b['mdr']) }})</td>
            </tr>
            <tr class="jumlah">
                <td>{{ $rugi ? 'RUGI BERSIH' : 'LABA BERSIH' }} · margin {{ Format::persen($data['margin_bersih']) }}</td>
                <td class="num {{ $rugi ? 'turun' : '' }}">{{ Format::angka($data['laba_bersih']) }}</td>
            </tr>
        </tbody>
    </table>

    <p class="kecil">
        Harga pokok memakai harga beli saat penjualan terjadi. Beban operasional bulanan
        diprorata terhadap {{ $data['periode']['jumlah_hari'] }} hari. PPN yang dipungut
        ({{ Format::rupiah($data['pajak_dipungut']) }}) adalah titipan negara dan tidak dihitung sebagai pendapatan.
    </p>
@endsection
