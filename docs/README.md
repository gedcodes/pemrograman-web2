# Frontend — Admin Panel POS Toko Sari Amerta

Kode client-side (HTML5, CSS3, JavaScript vanilla) untuk tugas Pemrograman Web 2. Semua data bersifat mock di sisi klien. Rancangan lengkap ada di [`PERANCANGAN.md`](PERANCANGAN.md), sedangkan referensi visual hasil Stitch ada di [`design/`](design/README.md).

## Menjalankan

Script memakai ES modules, jadi halaman **harus dibuka lewat server lokal**. Membuka file HTML dengan klik dua kali (`file://`) tidak akan berjalan.

- VS Code: klik kanan `layout.html` → **Open with Live Server**
- atau dari folder `docs/`: `python -m http.server 8000`, lalu buka <http://localhost:8000/layout.html>

Untuk deploy di GitHub Pages, pilih sumber **Deploy from a branch** dengan folder `/docs`. Untuk Vercel, set **Root Directory** ke `docs`.

## Struktur

```text
docs/
├── PERANCANGAN.md             Dokumen perancangan Milestone 1
├── index.html                 Halaman login (belum dibuat)
├── layout.html                Template master Milestone 2 + katalog komponen
├── pages/                     Satu berkas per menu sidebar: pages/<id-menu>.html
├── assets/
│   ├── css/
│   │   ├── main.css           Titik masuk — satu-satunya stylesheet yang ditautkan halaman
│   │   ├── tokens.css         Semua warna, bayangan, radius, tipografi, spasi, motion
│   │   ├── base.css           Reset, tipografi dasar, ikon, fokus keyboard
│   │   ├── layout.css         Rangka aplikasi (sidebar/topbar/konten/footer) + grid halaman
│   │   └── components.css     Tombol, form, kartu, badge, tabel, modal, toast, dsb.
│   ├── js/
│   │   ├── core/              format.js (rupiah/tanggal), storage.js, session.js
│   │   ├── data/              Mock data (users.js; produk & transaksi menyusul)
│   │   ├── layout/            menu.js (menu + hak akses), shell.js (render sidebar/topbar)
│   │   ├── components/        toast.js, modal.js (dialog konfirmasi)
│   │   └── pages/             Satu script per halaman
│   └── img/                   brand/, products/, avatars/, misc/ — aset lokal, bukan hotlink
└── design/                    Referensi desain Stitch — BUKAN kode produksi
```

## Membuat halaman baru

1. Salin kerangka `<head>` dan `<div class="app">…</div>` dari `layout.html` ke `pages/<id>.html`. Sesuaikan path aset dengan awalan `../`.
2. Isi `<body data-page="<id>">` dengan id menu yang sama di `assets/js/layout/menu.js`. Sidebar otomatis menandai menu aktif.
3. Buat `assets/js/pages/<id>.js`, panggil `initShell()`, lalu tulis logika halaman.
4. Ubah `ready: false` menjadi `ready: true` untuk menu itu di `menu.js`.

## Konvensi

- **Token saja.** Warna, bayangan, dan radius diambil dari `var(--…)` di `tokens.css`. Kode HEX tidak boleh muncul di berkas lain. Pengecualiannya hanya `rgba()` tembus pandang turunan warna token, misalnya untuk hover atau overlay.
- **Penamaan CSS: BEM** (`.card__title`, `.btn--primary`). State memakai atribut ARIA (`aria-current`, `aria-pressed`, `aria-busy`) atau kelas `.is-*`.
- **Angka & rupiah** diformat dengan `formatRupiah()` / `rupiahHtml()` dari `core/format.js`. Kolom angka di tabel memakai `class="col-num"`.
- **Ikon**: Material Symbols Outlined, ditulis `<span class="icon" aria-hidden="true">nama_ikon</span>`.
- **Pintasan keyboard**: `F2` dicadangkan untuk BAYAR di Kasir, `Ctrl/⌘ + K` untuk pencarian global, `Esc` menutup drawer/modal.
- **Tanpa** emoji, gradasi dekoratif, warna ungu, atau font serif (DESIGN.md §1.3).

## Status halaman

| Halaman | Berkas | Referensi desain (`design/stitch/…`) | Status |
| :-- | :-- | :-- | :-- |
| Layout & katalog komponen | `layout.html` | `style_guide_design_system` | ✅ selesai |
| Login | `index.html` | — (belum ada desain) | ⬜ |
| Dashboard | `pages/dashboard.html` | `dashboard_admin_pos_2` | ⬜ wajib |
| Kasir (POS) + modal pembayaran | `pages/kasir.html` | `kasir_pos_point_of_sale`, `modal_pembayaran_tunai_qris` | ⬜ nilai tambah |
| Riwayat Transaksi | `pages/riwayat-transaksi.html` | `riwayat_transaksi` | ⬜ |
| Retur Penjualan | `pages/retur-penjualan.html` | — | ⬜ |
| Produk (tabel master) | `pages/produk.html` | `master_data_produk`, `master_data_produk_daftar_tab_navigasi` | ⬜ wajib |
| Form tambah/edit produk | `pages/form-produk.html` | `form_tambah_edit_produk` | ⬜ wajib |
| Kategori Produk | `pages/kategori-produk.html` | `master_data_kategori_produk_*` | ⬜ |
| Satuan | `pages/satuan.html` | `master_data_satuan_*` | ⬜ |
| Supplier | `pages/supplier.html` | `master_data_supplier_*` | ⬜ |
| Pelanggan | `pages/pelanggan.html` | `master_data_pelanggan_*` | ⬜ |
| Stok Barang | `pages/stok-barang.html` | `inventori_stok_barang_*` | ⬜ |
| Barang Masuk | `pages/barang-masuk.html` | `inventori_barang_masuk_*` | ⬜ |
| Stok Opname | `pages/stok-opname.html` | `inventori_stok_opname_*` | ⬜ |
| Laporan Penjualan + struk | `pages/laporan-penjualan.html` | `laporan_penjualan`, `laporan_penjualan_pratinjau_struk` | ⬜ wajib |
| Laporan Laba Rugi | `pages/laporan-laba-rugi.html` | `laba_rugi` | ⬜ |
| Laporan Stok | `pages/laporan-stok.html` | `laporan_stok` | ⬜ |
| Cetak Ulang Struk | `pages/cetak-struk.html` | `cetak_struk_ulang` | ⬜ |
| Pengguna & Hak Akses | `pages/pengguna-akses.html` | `pengaturan_pengguna_hak_akses` | ⬜ |
| Profil Toko | `pages/profil-toko.html` | `pengaturan_profil_toko` | ⬜ |
| Metode Pembayaran | `pages/metode-pembayaran.html` | — | ⬜ |
| Pajak & Diskon | `pages/pajak-diskon.html` | — | ⬜ |

Keterangan "wajib" merujuk ke empat halaman minimum Milestone 3 (Panduan Tugas Mandiri).

## Keputusan desain yang perlu diketahui

- **Warna kanvas `#F2FBF8`** mengikuti hasil Stitch, bukan `#E4EDEA` di DESIGN.md §3.1. `#E4EDEA` tetap dipakai sebagai dasar input (`--surface-base`). Untuk mengganti, cukup ubah `--surface-canvas` di `tokens.css`.
- **Nama berkas halaman mengikuti slug menu** (`produk.html`, `laporan-penjualan.html`), bukan nama di PERANCANGAN.md §9 (`data-master.html`, `laporan.html`). Tabel §9 perlu disesuaikan.
- **Sidebar dan topbar dirender JavaScript** dari `menu.js`, sehingga menu dan hak akses (§2.2) hanya didefinisikan di satu tempat. Kasir tidak melihat Master Data, Laporan, dan Pengaturan.
- **Perilaku responsif**: sidebar penuh di ≥1280px, rail ikon di 1024–1279px, drawer di <1024px. Tabel lebar di-scroll di dalam kartunya sendiri, bukan di body.
