# Referensi Desain (Stitch)

Folder `stitch/` adalah ekspor Google Stitch untuk proyek ini. Setiap layar berisi `screen.png` (tangkapan layar) dan `code.html` (HTML + Tailwind Play CDN).

> **Hanya acuan visual.** Kode di sini tidak dipakai langsung di aplikasi. Halaman di `docs/pages/` ditulis ulang dengan design system di `docs/assets/css/`.

## Dokumen di dalamnya

| Berkas | Isi |
| :-- | :-- |
| `stitch/design.md` | Salinan identik `DESIGN.md` di root repo |
| `stitch/toko_sari_amerta_admin/DESIGN.md` | Token design system versi Stitch (warna Material 3 + aturan responsif) |
| `stitch/style_guide_design_system/` | Papan style guide: palet, tipografi, elevasi, tombol, form, badge |

## Perbaikan yang sudah diterapkan

Konfigurasi Tailwind di empat layar berikut kekurangan satu kurung kurawal `}`. Akibatnya JS-nya error dan tangkapan layar asli dari Stitch tampil hitam. Kurung sudah ditambahkan pada `code.html` dan `screen.png` diganti dengan hasil render ulang:

- `laporan_penjualan`
- `laba_rugi`
- `laporan_stok`
- `cetak_struk_ulang`

## Jangan ditiru dari kode Stitch

- **Tidak responsif.** Sidebar `fixed` 260px tanpa drawer maupun hamburger di semua layar.
- **Tidak ada elemen `<form>`.** Tombol simpan berjenis `type="button"`, dan angka diketik sebagai teks.
- **Kartu produk Kasir berupa `<div>`**, sehingga tidak bisa dipilih lewat keyboard.
- **`modal_pembayaran_tunai_qris` adalah papan presentasi** dua modal berdampingan, bukan dialog sungguhan.
- **Tujuh konfigurasi Tailwind berbeda.** Layar Pelanggan memakai token (`brand-*`, `neu-*`) dan ikon SVG sendiri.
- **Beberapa layar melanggar DESIGN.md.** Satuan dan Supplier jatuh ke font serif, dan Pelanggan memakai pil ungu.
- **Angka mock saling bertentangan antar layar.** Contohnya stok Beras dan Gula, jumlah stok menipis 12/14/20, dan PPN 30.506 yang seharusnya 30.504.
- **Grafik berupa SVG statis.** Aplikasi memakai Chart.js.
- **JS contoh tidak berfungsi.** Misalnya shortcut F2 memakai selector `:contains` yang tidak valid.
- **Gambar di-hotlink ke `lh3.googleusercontent.com`.** Versi lokalnya sudah ada di `docs/assets/img/`.

## Belum ada desainnya

Login, modal Buka Shift, Retur Penjualan, Metode Pembayaran, serta Pajak & Diskon. Halaman-halaman ini akan disusun dari komponen design system yang sudah ada.

## Pemetaan layar → halaman

Lihat tabel "Status halaman" di [`../README.md`](../README.md#status-halaman).
