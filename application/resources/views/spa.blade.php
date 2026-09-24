<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>POS · Toko Sari Amerta</title>
    <meta name="theme-color" content="#0B2B27">
    @vite(['resources/js/spa/main.ts'])
</head>
<body>
    {{-- SPA mengambil alih seluruh routing halaman lewat Vue Router.
         Isi di bawah adalah layar pembuka yang tampil selama JavaScript dimuat
         dan sesi diperiksa; Vue menggantinya begitu navigasi pertama selesai. --}}
    <div id="spa">
        <div class="boot" role="status" aria-live="polite">
            <span class="boot-mark">SA</span>
            <span class="boot-putar" aria-hidden="true"></span>
            <span class="boot-teks">Memuat Toko Sari Amerta…</span>
        </div>
    </div>
</body>
</html>
