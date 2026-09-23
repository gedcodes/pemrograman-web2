# Frontend — Admin Panel POS Toko Sari Amerta

Kode client-side (HTML5, CSS3, JavaScript vanilla) untuk tugas Pemrograman Web 2. Semua data bersifat mock di sisi klien. Rancangan lengkap ada di [`PERANCANGAN.md`](PERANCANGAN.md), sedangkan referensi visual hasil Stitch ada di [`design/`](design/README.md).

## Menjalankan

Script memakai ES modules, jadi halaman **harus dibuka lewat server lokal**. Membuka file HTML dengan klik dua kali (`file://`) tidak akan berjalan.

- VS Code: klik kanan `index.html` → **Open with Live Server**
- atau dari folder `docs/`: `python -m http.server 8000`, lalu buka <http://localhost:8000/>

Halaman pertama adalah **login** (`index.html`). Klik salah satu akun demo untuk mengisi username dan PIN:

| Akun | Peran | Username | PIN |
| :-- | :-- | :-- | :-- |
| I Wayan Surya Adnyana | Admin / Pemilik | `surya.owner` | `240918` |
| Ni Luh Putu Ratna | Admin (Supervisor) | `luh.ratna` | `150326` |
| Ni Kadek Ayu Pramesti | Kasir shift pagi | `kadek.ayu` | `081126` |
| I Made Dwi Antara | Kasir shift siang | `made.dwi` | `190327` |
| Ni Wayan Sari Dewi | Kasir (nonaktif, contoh penolakan login) | `sari.kasir` | `220427` |

Admin masuk ke Dashboard, kasir langsung ke halaman Kasir. Membuka halaman mana pun tanpa login akan dialihkan ke login lalu kembali ke halaman tersebut.

Data contoh tersimpan di `localStorage` browser. Tombol ikon ↺ di halaman Data Produk mengembalikan semua data (produk, master, transaksi, inventori, retur) ke kondisi awal. Pengaturan toko dikembalikan lewat tombol **Kembalikan Default** di tiap halaman Pengaturan.

Untuk deploy di GitHub Pages, pilih sumber **Deploy from a branch** dengan folder `/docs`. Untuk Vercel, set **Root Directory** ke `docs`.

## Struktur

```text
docs/
├── PERANCANGAN.md             Dokumen perancangan Milestone 1
├── index.html                 Halaman login
├── layout.html                Template master Milestone 2 + katalog komponen
├── pages/                     Satu berkas per menu sidebar: pages/<id-menu>.html
│                              + form turunan: form-produk, form-barang-masuk, form-stok-opname
├── assets/
│   ├── css/
│   │   ├── main.css           Titik masuk — satu-satunya stylesheet yang ditautkan halaman
│   │   ├── tokens.css         Semua warna, bayangan, radius, tipografi, spasi, motion
│   │   ├── base.css           Reset, tipografi dasar, ikon, fokus keyboard
│   │   ├── layout.css         Rangka aplikasi (sidebar/topbar/konten/footer) + grid halaman
│   │   ├── components.css     Tombol, form, kartu, badge, tabel, modal, toast, timeline, notifikasi, …
│   │   ├── pos.css            Tata letak khusus halaman Kasir
│   │   ├── pages.css          Pola satu-dua halaman: login, tabel laba rugi, matriks akses
│   │   └── print.css          Mode cetak laporan & struk termal 80mm
│   ├── js/
│   │   ├── core/              db.js (satu-satunya akses data), analytics.js (ringkasan, laba rugi,
│   │   │                      mutasi stok), pricing.js, settings.js, session.js (login), shift.js,
│   │   │                      validation.js, format.js, dates.js, storage.js, …
│   │   ├── data/              Data awal: master.js, products.js, users.js, inventory.js,
│   │   │                      transactions.js (riwayat 62 hari, deterministik)
│   │   ├── layout/            menu.js (menu + hak akses), shell.js (sidebar, topbar, notifikasi,
│   │   │                      pencarian global, penjaga login)
│   │   ├── components/        table-view, form-dialog, period-picker, modal, toast, badges,
│   │   │                      charts (Chart.js), receipt, pagination, money-input, …
│   │   └── pages/             Satu script per halaman
│   └── img/                   brand/, products/, avatars/, misc/ — aset lokal, bukan hotlink
└── design/                    Referensi desain Stitch — BUKAN kode produksi
```

## Membuat halaman baru

1. Salin kerangka `<head>` dan `<div class="app">…</div>` dari salah satu berkas di `pages/`.
2. Isi `<body data-page="<id>">` dengan id menu yang sama di `assets/js/layout/menu.js`. Sidebar otomatis menandai menu aktif. Tambahkan `data-roles="admin"` bila halaman lebih ketat dari menunya (contoh: `form-barang-masuk.html`).
3. Buat `assets/js/pages/<id>.js`, panggil `initShell()` (mengembalikan `false` bila belum login atau tidak berhak), lalu tulis logika halaman.
4. Komponen yang biasanya dipakai:
   - `createTableView()` — tabel berpaginasi + empty state (`components/table-view.js`)
   - `createFormDialog()` — dialog tambah/ubah dengan validasi per kolom (`components/form-dialog.js`)
   - `createPeriodPicker()` — preset periode + rentang tanggal tervalidasi (`components/period-picker.js`)
   - `validateForm()` / `bindLiveValidation()` — validasi form halaman penuh (`core/validation.js`)

## Konvensi

- **Token saja.** Warna, bayangan, dan radius diambil dari `var(--…)` di `tokens.css`. Kode HEX tidak boleh muncul di berkas lain. Pengecualiannya hanya `rgba()` tembus pandang turunan warna token, misalnya untuk hover atau overlay.
- **Penamaan CSS: BEM** (`.card__title`, `.btn--primary`). State memakai atribut ARIA (`aria-current`, `aria-pressed`, `aria-busy`) atau kelas `.is-*`.
- **Angka & rupiah** diformat dengan `formatRupiah()` / `rupiahHtml()` dari `core/format.js`. Kolom angka di tabel memakai `class="col-num"`.
- **Ikon**: Material Symbols Outlined, ditulis `<span class="icon" aria-hidden="true">nama_ikon</span>`.
- **Data**: halaman tidak pernah membaca `localStorage` langsung. Semua lewat `core/db.js`, dan semua angka (total, margin, stok menipis, laba) dihitung, tidak ditulis tangan. Setiap perubahan stok lewat `applyStockChanges()` agar tercatat di Riwayat Mutasi.
- **Validasi**: setiap kolom punya `<p class="field__message" data-hint="…">` di markup. Error ditandai ring merah + ikon + teks, tidak pernah warna saja.
- **Pintasan keyboard**:

  | Tombol | Fungsi |
  | :-- | :-- |
  | `F2` | BAYAR di Kasir |
  | `/` | Fokus ke kolom scan/cari di Kasir dan lembar Stok Opname |
  | `Enter` | Tambahkan hasil scan · konfirmasi bayar tunai · pindah ke baris berikutnya di lembar opname |
  | `↑` `↓` | Pindah transaksi di Cetak Ulang Struk |
  | `Ctrl/⌘ + K` | Pencarian global |
  | `Ctrl/⌘ + S` | Simpan form (Produk, Barang Masuk, Profil Toko, Pajak & Diskon) |
  | `Esc` | Tutup drawer / dialog / panel notifikasi |
- **Tanpa** emoji, gradasi dekoratif, warna ungu, atau font serif (DESIGN.md §1.3).

## Status halaman

Semua menu di PERANCANGAN.md §2 sudah dibangun.

| Halaman | Berkas | Referensi desain (`design/stitch/…`) | Status |
| :-- | :-- | :-- | :-- |
| Login | `index.html` | — (tidak ada desain Stitch) | ✅ |
| Layout & katalog komponen | `layout.html` | `style_guide_design_system` | ✅ Milestone 2 |
| Dashboard | `pages/dashboard.html` | `dashboard_admin_pos_2` | ✅ wajib |
| Kasir (POS) + modal pembayaran | `pages/kasir.html` | `kasir_pos_point_of_sale`, `modal_pembayaran_tunai_qris` | ✅ nilai tambah |
| Riwayat Transaksi + konfirmasi pending | `pages/riwayat-transaksi.html` | `riwayat_transaksi` | ✅ |
| Retur Penjualan | `pages/retur-penjualan.html` | — | ✅ |
| Produk (tabel master) | `pages/produk.html` | `master_data_produk`, `master_data_produk_daftar_tab_navigasi` | ✅ wajib |
| Form tambah/edit produk | `pages/form-produk.html` | `form_tambah_edit_produk` | ✅ wajib |
| Kategori Produk | `pages/kategori-produk.html` | `master_data_kategori_produk_*` | ✅ |
| Satuan | `pages/satuan.html` | `master_data_satuan_*` | ✅ |
| Supplier | `pages/supplier.html` | `master_data_supplier_*` | ✅ |
| Pelanggan | `pages/pelanggan.html` | `master_data_pelanggan_*` | ✅ |
| Stok Barang + riwayat mutasi | `pages/stok-barang.html` | `inventori_stok_barang_*` | ✅ |
| Barang Masuk (daftar) | `pages/barang-masuk.html` | `inventori_barang_masuk_daftar_data` | ✅ |
| Barang Masuk (form penerimaan) | `pages/form-barang-masuk.html` | `inventori_barang_masuk_form_penerimaan` | ✅ |
| Stok Opname (daftar sesi) | `pages/stok-opname.html` | `inventori_stok_opname_daftar_sesi` | ✅ |
| Stok Opname (lembar hitung) | `pages/form-stok-opname.html` | `inventori_stok_opname_form_sesi_hitung` | ✅ |
| Laporan Penjualan + struk | `pages/laporan-penjualan.html` | `laporan_penjualan`, `laporan_penjualan_pratinjau_struk` | ✅ wajib |
| Laporan Laba Rugi | `pages/laporan-laba-rugi.html` | `laba_rugi` | ✅ |
| Laporan Stok & Mutasi | `pages/laporan-stok.html` | `laporan_stok` | ✅ |
| Cetak Ulang Struk | `pages/cetak-struk.html` | `cetak_struk_ulang` | ✅ |
| Pengguna & Hak Akses | `pages/pengguna-akses.html` | `pengaturan_pengguna_hak_akses` | ✅ |
| Profil Toko | `pages/profil-toko.html` | `pengaturan_profil_toko` | ✅ |
| Metode Pembayaran | `pages/metode-pembayaran.html` | — | ✅ |
| Pajak & Diskon | `pages/pajak-diskon.html` | — | ✅ |

Keterangan "wajib" merujuk ke empat halaman minimum Milestone 3 (Panduan Tugas Mandiri).

## Keputusan desain yang perlu diketahui

- **Warna kanvas `#F2FBF8`** mengikuti hasil Stitch, bukan `#E4EDEA` di DESIGN.md §3.1. `#E4EDEA` tetap dipakai sebagai dasar input (`--surface-base`). Untuk mengganti, cukup ubah `--surface-canvas` di `tokens.css`.
- **Nama berkas halaman mengikuti slug menu** (`produk.html`, `laporan-penjualan.html`). Tabel PERANCANGAN.md §9 sudah disesuaikan.
- **Sidebar dan topbar dirender JavaScript** dari `menu.js`, sehingga menu dan hak akses (§2.2) hanya didefinisikan di satu tempat. Matriks di halaman Pengguna & Hak Akses juga dibaca dari sana. Kasir tidak melihat Master Data, Laporan, dan Pengaturan; halaman Inventori terbuka dalam mode lihat saja.
- **Login tiruan**: username + PIN dicocokkan dengan data pengguna di browser. PIN disimpan apa adanya karena tidak ada back-end; di aplikasi sungguhan kredensial wajib diverifikasi dan di-hash di server. Lima kali salah PIN mengunci form 30 detik.
- **Perilaku responsif**: sidebar penuh di ≥1280px, rail ikon di 1024–1279px, drawer di <1024px. Tabel lebar di-scroll di dalam kartunya sendiri, bukan di body.
- **Margin = laba kotor ÷ harga jual** (definisi akuntansi standar), konsisten di Dashboard, Data Produk, dan Laporan. Form Produk juga menampilkan *markup* (÷ harga beli) dengan label terpisah.
- **PPN ditambahkan di atas harga** setelah diskon member: `total = (subtotal − diskon) × (1 + PPN)`. Tarifnya diatur di Pajak & Diskon dan **disimpan pada setiap transaksi**, sehingga struk lama tetap menampilkan tarif saat transaksi terjadi.
- **Riwayat transaksi tiruan** dibangkitkan untuk 62 hari terakhir dengan seed tanggal, jadi angkanya sama setiap kali dibuka. Riwayat hari ini dikunci pada jam pertama aplikasi dibuka. Transaksi setelah itu berasal dari halaman Kasir.
- **Midtrans Payment Link**: URL diatur di Pengaturan → Metode Pembayaran (default ada di `core/settings.js`). Validasi hanya menerima domain sandbox `midtrans.com`. URL ini publik, bukan rahasia. Server Key tidak pernah dipakai.
- **Stok hanya berkurang untuk transaksi lunas.** Transaksi non-tunai yang disimpan sebagai *pending* baru mengurangi stok setelah dikonfirmasi di Riwayat Transaksi.
- **Retur**: refund proporsional terhadap total struk (porsi diskon dan PPN ikut dikembalikan), maksimal 7 hari. Retur dari kasir menunggu approval admin; stok bertambah hanya bila barang layak jual dan retur disetujui.
- **Stok opname** menerapkan *selisih* (fisik − stok buku saat sesi dimulai) ke stok terkini, bukan menimpa angkanya, agar penjualan selama penghitungan tidak hilang. Mode *blind count* menyembunyikan stok buku dari petugas.
- **Laporan Stok** menghitung stok awal mundur dari stok saat ini: `awal = akhir − masuk − penyesuaian + terjual`. Riwayat penjualan lama tidak tercatat per item di Riwayat Mutasi; mutasi hanya berisi barang masuk, retur, opname, penyesuaian, dan penjualan dari Kasir.
- **Laba Rugi** memakai beban operasional bulanan tiruan (`MONTHLY_EXPENSES` di `data/master.js`) yang diprorata per hari, MDR 0,7% dari transaksi non-tunai, dan PPh Final UMKM 0,5% dari pendapatan bersih. PPN keluaran tidak dihitung sebagai pendapatan.
- **Supplier PKP / non-PKP**: faktur dari supplier PKP otomatis memuat PPN masukan di form Barang Masuk; CV kecil (non-PKP) tidak.
