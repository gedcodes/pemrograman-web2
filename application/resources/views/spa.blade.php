<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>POS · {{ $toko['nama_toko'] }}</title>
    <meta name="theme-color" content="#0B2B27">
    @if ($toko['logo_url'])
        <link rel="icon" href="{{ $toko['logo_url'] }}">
    @else
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    @endif
    {{-- Identitas publik toko (nama, slogan, logo), dibaca stores/toko.ts.
         Hanya berisi yang memang boleh dilihat tamu di halaman masuk. --}}
    <script>window.__TOKO__ = @json($toko);</script>
    @vite(['resources/js/spa/main.ts'])
</head>
<body>
    {{-- SPA mengambil alih seluruh routing halaman lewat Vue Router.
         Isi di bawah adalah layar pembuka yang tampil selama JavaScript dimuat
         dan sesi diperiksa; Vue menggantinya begitu navigasi pertama selesai. --}}
    <div id="spa">
        <div class="boot" role="status" aria-live="polite">
            @if ($toko['logo_url'])
                <img class="boot-mark boot-logo" src="{{ $toko['logo_url'] }}" alt="">
            @else
                <span class="boot-mark">{{ $toko['inisial'] }}</span>
            @endif
            <span class="boot-putar" aria-hidden="true"></span>
            <span class="boot-teks">Memuat {{ $toko['nama_toko'] }}…</span>
        </div>
    </div>
</body>
</html>
