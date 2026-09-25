@extends('laporan.tata')

@php
    use App\Support\Format;

    $status = fn (array $p): string => $p['stok'] <= 0 ? 'Habis' : ($p['stok_menipis'] ? 'Menipis' : 'Aman');
@endphp

@section('isi')
    <table class="kpi">
        <tr>
            <td>
                <div class="label">Jumlah produk</div>
                <div class="nilai">{{ Format::angka($data['jumlah_produk']) }}</div>
            </td>
            <td>
                <div class="label">Nilai persediaan</div>
                <div class="nilai">{{ Format::rupiah($data['nilai_persediaan']) }}</div>
                <div class="kecil">Dinilai pada harga beli</div>
            </td>
            <td>
                <div class="label">Stok menipis</div>
                <div class="nilai">{{ Format::angka($data['produk_stok_menipis']) }}</div>
            </td>
            <td>
                <div class="label">Habis</div>
                <div class="nilai {{ $data['produk_habis'] > 0 ? 'turun' : '' }}">{{ Format::angka($data['produk_habis']) }}</div>
            </td>
        </tr>
    </table>

    <h2>Perlu dipesan ulang ({{ $data['produk_stok_menipis'] }})</h2>
    <table class="data">
        <thead>
            <tr><th>Produk</th><th>Kategori</th><th class="num">Stok</th><th class="num">Minimum</th><th class="num">Kekurangan</th></tr>
        </thead>
        <tbody>
            @forelse ($data['daftar_stok_menipis'] as $p)
                <tr>
                    <td>{{ $p['nama_produk'] }}<br><span class="kecil">{{ $p['barcode'] ?? 'tanpa barcode' }}</span></td>
                    <td>{{ $p['category']['nama_kategori'] ?? '-' }}</td>
                    <td class="num {{ $p['stok'] <= 0 ? 'turun' : '' }}">{{ Format::angka($p['stok']) }} {{ $p['unit']['simbol'] ?? '' }}</td>
                    <td class="num">{{ Format::angka($p['stok_minimum']) }}</td>
                    <td class="num">{{ Format::angka(max(0, $p['stok_minimum'] - $p['stok'])) }}</td>
                </tr>
            @empty
                <tr><td colspan="5" class="muted">Tidak ada produk yang menipis.</td></tr>
            @endforelse
        </tbody>
    </table>

    <h2>Seluruh produk</h2>
    <table class="data">
        <thead>
            <tr><th>Produk</th><th>Kategori</th><th class="num">Stok</th><th class="num">Harga beli</th><th class="num">Nilai</th><th>Status</th></tr>
        </thead>
        <tbody>
            @foreach ($data['daftar_produk'] as $p)
                <tr>
                    <td>{{ $p['nama_produk'] }}@unless ($p['aktif']) <span class="muted">(nonaktif)</span>@endunless</td>
                    <td>{{ $p['category']['nama_kategori'] ?? '-' }}</td>
                    <td class="num">{{ Format::angka($p['stok']) }} {{ $p['unit']['simbol'] ?? '' }}</td>
                    <td class="num">{{ Format::angka($p['harga_beli']) }}</td>
                    <td class="num">{{ Format::angka($p['stok'] * $p['harga_beli']) }}</td>
                    <td class="{{ $p['stok'] <= 0 ? 'turun' : '' }}">{{ $status($p) }}</td>
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <th colspan="4">Nilai persediaan</th>
                <th class="num">{{ Format::angka($data['nilai_persediaan']) }}</th>
                <th></th>
            </tr>
        </tfoot>
    </table>
@endsection
