# CHECKLIST IMPLEMENTASI — POS Toko Sari Amerta

> **Arsitektur:** Laravel 13 sebagai REST API murni + SPA Vue 3 (Vite) terpisah
> **Pembayaran:** Midtrans **Snap** — Sandbox dulu, tinggal ganti flag ke Production
> **Basis desain:** `DESIGN.md` (Teal Soft UI) + prototipe statis di `docs/`
> **Urutan kerja:** tabel & relasi → seeder → migrasi → API CRUD → Midtrans → frontend

Acuan rancangan: [`PERANCANGAN.md`](PERANCANGAN.md) — ERD di §3, user flow di §4, hak akses di §2.2.

---

## Status Awal (terverifikasi 2026-09-23)

| Hal | Kondisi sekarang |
| :-- | :-- |
| Laravel | 13.33.0, PHP 8.3.30 |
| Database | MySQL 8.4.3, schema `db_pos`, 13 tabel bawaan kit |
| Model | Hanya `User`, `Team`, `TeamInvitation`, `Membership` |
| Migrasi | 7 (semua bawaan starter kit) |
| Seeder | Hanya `DatabaseSeeder` (kosong) |
| `routes/api.php` | **Belum ada** |
| Sanctum | **Belum terpasang** |
| Frontend | Inertia + Vue (bawaan kit) — akan diganti SPA + Vue Router |

---

## FASE 0 — Persiapan & Revisi Dokumen ✅ SELESAI

Bagian §5 PERANCANGAN.md sekarang **salah premis**: seluruh argumennya berdiri di atas "tidak ada back-end", padahal kita sedang membangun back-end. Ini harus dibereskan lebih dulu agar dokumen dan kode tidak bertentangan.

- [x] **Tulis ulang §5.1** — hapus tabel "Snap vs Payment Link". Ganti alasannya: Server Key kini aman di `.env` server, tidak pernah masuk repositori, sehingga Snap justru menjadi pilihan yang benar
- [x] **Tulis ulang §4.3** — ganti flow "kasir konfirmasi manual" menjadi flow webhook otomatis dari Midtrans
- [x] **Tulis ulang §5.2** — diagram arsitektur harus punya panah balik `Midtrans → POST /api/midtrans/notification → update status`
- [x] **Hapus §5.3 poin 1 & 2** — detail item **sekarang bisa** dikirim (`item_details`), dan rekonsiliasi **sekarang otomatis**. Sisakan poin 3 (Sandbox)
- [x] **Perbarui §5.4** — tambah aturan: verifikasi `signature_key` setiap webhook, jangan percaya `status` dari body mentah
- [x] **Perbarui §5.5** — modal non-tunai memanggil Snap popup, bukan buka link di tab baru
- [x] **Sinkronkan §6** ke palet teal + `Plus Jakarta Sans` + token bayangan rgba (acuan `DESIGN.md` §11)
- [x] **Perbaiki §7/§8** — `docs/img/` sudah tidak ada sehingga semua embed gambar broken; arahkan ke `docs/design/stitch/` (31 PNG tersedia) atau hapus barisnya
- [x] **Tambah §11 baru** — "Arsitektur Implementasi": REST API + SPA, daftar endpoint, strategi auth
- [x] Centang ulang checklist §10 yang faktanya sudah selesai

---

## FASE 1 — Database: Migrasi & Relasi ✅ SELESAI

Urutan migrasi **wajib** mengikuti arah foreign key agar tidak gagal constraint.

### 1.1 Persiapan

- [x] `php artisan install:api` → membuat `routes/api.php` + memasang Sanctum
- [x] Tambah kolom `peran` (enum `admin`/`kasir`) dan `aktif` ke tabel `users` lewat migrasi baru
- [x] Tentukan konvensi: nama tabel Inggris jamak, kolom Indonesia (samakan dengan ERD)

### 1.2 Tabel tanpa dependensi

- [x] `categories` — `id`, `nama_kategori`, `slug`, timestamps
- [x] `units` — `id`, `nama_satuan`, `simbol`, timestamps
- [x] `suppliers` — `id`, `nama_supplier`, `kontak`, `alamat`, timestamps
- [x] `customers` — `id`, `nama`, `no_hp`, `poin_loyalti` (default 0), timestamps

### 1.3 Tabel inti

- [x] `products` — FK → `categories`, `units`; kolom `barcode` (unique), `nama_produk`, `harga_beli`, `harga_jual`, `stok`, `stok_minimum`, `gambar`
  - [x] Index pada `barcode` (dipakai scan kasir, harus cepat)
  - [x] Aturan `harga_jual >= harga_beli` ditegakkan di *Form Request* (Fase 4), **bukan** `CHECK` basis data — lihat catatan di bawah
- [x] `shifts` — FK → `users`; `waktu_buka`, `waktu_tutup` (nullable), `modal_awal`, `kas_akhir` (nullable)

### 1.4 Transaksi

- [x] `transactions` — FK → `shifts`, `customers` (nullable); `no_struk` (unique), `tanggal`, `subtotal`, `diskon`, `pajak`, `total`, `status`
  - [x] `status` enum: `draft`, `pending`, `settlement`, `expire`, `cancel`, `deny`
- [x] `transaction_items` — FK → `transactions` (cascade delete), `products`; `qty`, `harga_satuan`, `subtotal`
- [x] `payments` — FK → `transactions`; `metode`, `order_id` (unique), `payment_type`, `transaction_status`, `snap_token`, `jumlah_bayar`, `kembalian`, `waktu_settlement`
- [x] `payment_logs` — FK → `payments`; `status_lama`, `status_baru`, `waktu_perubahan`, `dikonfirmasi_oleh`, `raw_payload` (JSON)

### 1.5 Inventori

- [x] `purchases` — FK → `suppliers`; `no_dokumen`, `tanggal_masuk`, `total_biaya`
- [x] `purchase_items` — FK → `purchases` (cascade), `products`; `qty`, `harga_beli`
- [x] `sales_returns` — FK → `transactions`, `users` (diajukan & disetujui); `no_dokumen`, `tanggal_retur`, `alasan`, `jumlah_refund`, `status_approval`
- [x] `stock_opnames` — FK → `users`; `no_dokumen`, `tanggal`, `catatan`
- [x] `opname_items` — FK → `stock_opnames` (cascade), `products`; `stok_sistem`, `stok_fisik`, `selisih`
- [x] `stock_moves` — FK → `products`; `tipe` (masuk/keluar/opname/retur), `qty`, `referensi_id`, `referensi_tipe`

### 1.6 Eksekusi

- [x] `php artisan migrate` — pastikan semua hijau
- [x] Uji `php artisan migrate:fresh` agar urutan FK terbukti benar dari nol
- [x] Verifikasi relasi di MySQL: `SHOW CREATE TABLE products;` pastikan FK terbentuk

### Catatan Pelaksanaan Fase 1

**Dua penyimpangan dari rencana, beserta alasannya:**

1. **`returns` → `sales_returns`.** MySQL sendiri menerima nama tabel `returns`, tetapi **PHP melarang kelas bernama `Return`**, sehingga konvensi model Laravel tidak dapat diikuti. Nama `sales_returns` → model `SalesReturn` menyelesaikannya tanpa pengecualian di mana pun.
2. **Aturan `harga_jual >= harga_beli` tidak dijadikan `CHECK` basis data.** Constraint semacam itu akan **memblokir penjualan cuci gudang secara permanen** dan mengubahnya menuntut migrasi baru. Aturan ini ditegakkan di *Form Request* pada Fase 4, sesuai pilihan yang memang disediakan checklist.

**Tambahan di luar rencana, yang dibutuhkan agar data tetap benar:**

| Tambahan | Alasan |
| :-- | :-- |
| `softDeletes()` pada seluruh master data | Menghapus produk yang pernah terjual akan merusak riwayat struk |
| `RESTRICT` dari data transaksi ke master data | Basis data ikut menjaga riwayat, bukan hanya kode aplikasi |
| Potret `nama_produk` di `transaction_items` | Tanpa ini, mengganti nama produk mengubah isi struk lama secara surut |
| `idempotency_key` di `payment_logs` | Penolakan notifikasi ganda Midtrans ditegakkan basis data, bukan hanya kode |
| `stok_sebelum` & `stok_sesudah` di `stock_moves` | Selisih inventori dapat ditelusuri tanpa menghitung ulang seluruh riwayat |
| `aktif` di `products`, `user_id` di `purchases`/`stock_moves` | Menonaktifkan produk tanpa menghapus, dan melacak siapa mencatat |

**Hasil verifikasi:** 30 tabel, 21 foreign key dengan aturan `ON DELETE` sesuai rancangan, dan `migrate:fresh` terbukti bersih dari nol. Empat constraint diuji perilakunya secara langsung — `RESTRICT` menolak penghapusan kategori yang masih dipakai, `UNIQUE` menolak `no_struk` ganda, `ENUM` menolak status di luar daftar, dan `CASCADE` benar-benar ikut menghapus item transaksi.

---

## FASE 2 — Model & Relasi Eloquent ✅ SELESAI

- [x] Buat 16 model + relasinya — **tanpa `-m`**, karena migrasinya sudah dibuat di Fase 1; factory dikerjakan di Fase 3 sesuai butirnya sendiri
- [x] Definisikan relasi dua arah sesuai ERD §3:
  - [x] `Category hasMany Product` / `Product belongsTo Category`
  - [x] `Product hasMany TransactionItem`, `hasMany PurchaseItem`, `hasMany StockMove`
  - [x] `Transaction hasMany TransactionItem`, `hasOne Payment`, `hasMany SalesReturn`, `belongsTo Shift`, `belongsTo Customer`
  - [x] `Payment hasMany PaymentLog`
  - [x] `Shift belongsTo User`, `hasMany Transaction`
  - [x] `Purchase belongsTo Supplier`, `hasMany PurchaseItem`
- [x] `$casts` untuk tanggal, **`integer` untuk uang** (kolom Rupiah disimpan sebagai bilangan bulat, lihat Fase 1), `array` untuk `raw_payload`
- [x] `$fillable` diisi eksplisit (jangan `$guarded = []`)
- [x] Accessor `margin` di `Product` — **margin = laba ÷ harga jual** (konsisten dengan prototipe `docs/`)
- [x] Scope: `Product::scopeStokMenipis()`, `Transaction::scopeLunas()`

### Catatan Pelaksanaan Fase 2

**Mengikuti gaya Laravel 13 yang dipakai starter kit**, bukan gaya lama:

| Rencana | Yang dipakai | Alasan |
| :-- | :-- | :-- |
| `protected $fillable` | `#[Fillable([...])]` | Atribut PHP; seluruh model bawaan kit memakai ini |
| `scopeStokMenipis()` | `#[Scope] protected function stokMenipis()` | Didukung Laravel 13 (`Model::callNamedScope`); pemanggilannya tetap `Product::stokMenipis()` |
| `protected $casts` | `protected function casts(): array` | Bentuk method, sesuai `User` dan `Team` bawaan kit |

**Satu bug ditemukan lewat pengujian, bukan lewat pembacaan kode.** Model yang baru dibuat memegang `NULL` untuk kolom yang defaultnya hanya ada di basis data — `$product->aktif` bernilai `NULL`, bukan `true`. Akibatnya response API sesaat setelah *create* akan mengirim nilai yang salah. Diperbaiki dengan mencerminkan default basis data ke `protected $attributes` pada 8 model: `Product`, `Customer`, `Shift`, `Transaction`, `Payment`, `Purchase`, `SalesReturn`, dan `StockOpname`.

**Dua perbaikan di luar rencana**, keduanya akibat langkah `install:api` di Fase 1:

1. `config/sanctum.php` gagal PHPStan level 7 — `env()` dapat mengembalikan `bool` sehingga `explode()` menerima tipe yang salah. Diperbaiki dengan penjagaan tipe sebelum `return`, **bukan** cast `(string)`, karena `(string) true` menghasilkan `"1"` dan itu diam-diam keliru.
2. `bootstrap/app.php` menyisakan satu baris CRLF sehingga Pint gagal. Sudah dinormalkan.

**Hasil verifikasi:** Pint lolos, PHPStan level 7 **0 error**, PHPUnit **92/92 lolos** (329 asersi). Selain itu 22 pemeriksaan perilaku dijalankan langsung terhadap basis data — accessor `margin`, scope `stokMenipis`/`lunas`, sepuluh relasi dua arah, enam *cast*, dan *soft delete* — semuanya lolos.

> **Catatan untuk Fase 4:** `install:api` sudah menambahkan `shouldRenderJsonWhen()` di `bootstrap/app.php`, sehingga sebagian butir "penanganan exception → JSON" pada Fase 4.1 sudah terpenuhi lebih awal.

---

## FASE 3 — Seeder & Data Awal ✅ SELESAI

Ambil data dari prototipe statis supaya angka di aplikasi baru konsisten dengan yang sudah didesain — ini juga memperbaiki cacat "mock data saling bertentangan" yang ada di ekspor Stitch.

- [x] Ekstrak data dari `docs/assets/js/data/*.js` sebagai sumber tunggal
- [x] `CategorySeeder`, `UnitSeeder`, `SupplierSeeder`, `CustomerSeeder`
- [x] `UserSeeder` — **2 admin + 3 kasir** (jumlah sebenarnya di prototipe; satu kasir nonaktif), kata sandi di-hash, PIN tiruan tidak dipakai
- [x] `ProductSeeder` — **24 produk** (bukan 9; sembilan di antaranya yang punya berkas gambar di `docs/assets/img/products/`)
- [x] `TransactionSeeder` — transaksi 7 hari terakhir agar grafik Dashboard ada isinya
  - [x] Wajib: `total` dihitung dari item, **bukan** angka hardcode
- [x] Factory untuk tiap model agar bisa dipakai di test
- [x] Daftarkan semua di `DatabaseSeeder` dengan urutan yang benar
- [x] `php artisan migrate:fresh --seed` → harus bersih dari nol
- [x] Verifikasi silang: jumlah stok, omzet, dan jumlah "stok menipis" konsisten di semua laporan

### Catatan Pelaksanaan Fase 3

**Dua angka pada rencana ternyata keliru** setelah datanya dibaca: prototipe memuat **24 produk**, bukan 9 (sembilan hanyalah yang punya berkas gambar), dan **5 pengguna**, bukan 3. Data sebenarnya yang dipakai.

**Rekonsiliasi stok dikerjakan mundur.** `ProductSeeder` menulis stok *akhir* sesuai rancangan, lalu `TransactionSeeder` menghitung stok pembukaan = stok akhir + seluruh qty terjual, mencatat satu mutasi `masuk`, dan mengurangkannya kembali lewat mutasi `keluar` per baris penjualan. Hasilnya `SUM(stock_moves.qty)` berjodoh persis dengan `products.stok` untuk seluruh 24 produk, sementara angka rancangan (Beras 3, Gula 0, Minyak 5) tetap utuh. Hanya transaksi `settlement` yang menggerakkan stok, sesuai aturan Bagian 4.3.

**Seeder bersifat deterministik.** PRNG di-*seed* dengan tanggal, sehingga tiga kali `migrate:fresh --seed` berturut-turut menghasilkan angka yang identik: 343 transaksi, 859 item, omzet 18.052.857, 7 produk stok menipis.

**Hasil verifikasi silang** (SQL langsung, seluruhnya nol ketidakcocokan):

| Pemeriksaan | Hasil |
| :-- | :--: |
| `subtotal` transaksi sama dengan jumlah subtotal itemnya | 0 selisih |
| `total` = `subtotal` − `diskon` + `pajak` | 0 selisih |
| `pajak` = 11% dari DPP | 0 selisih |
| Diskon member 5% hanya untuk pelanggan terdaftar | 0 selisih |
| `SUM(stock_moves.qty)` = `products.stok` | 0 selisih |
| `stok_sesudah` = `stok_sebelum` + `qty` | 0 selisih |
| Stok tidak pernah negatif | 0 kejadian |
| Mutasi stok dari transaksi tidak lunas | 0 kejadian |
| Kunci idempoten pembayaran unik | 198 dari 198 |

Jumlah "stok menipis" kini **satu angka tunggal (7)** yang dihitung dari data, menutup cacat lama ketika ekspor Stitch menyebut 12, 14, dan 20 di layar berbeda.

**Kata sandi seluruh akun contoh: `password`** (lihat `UserSeeder::DEFAULT_PASSWORD`). Prototipe memakai `username`, sedangkan Fortify memakai email, sehingga alamat dibentuk menjadi `<username>@sariamerta.test`.

### Yang Belum Punya Tempat

Beberapa medan pada prototipe tidak memiliki kolom di skema Fase 1, jadi **tidak ikut ter-seed**:

| Sumber | Medan yang hilang |
| :-- | :-- |
| `products.js` | `supplier` (pemasok utama per produk), `backorder` |
| `master.js` | Kategori: `deskripsi`, `aktif` · Supplier: `kontak_person`, `email`, `termin_hari`, `pkp` · Pelanggan: `tingkat` (Reguler/Silver/Gold), `alamat`, `terdaftar` |
| `users.js` | `username`, `no_hp`, `avatar`, `keterangan` |

> ⚠️ **Penghambat Fase 4.4.** `master.js` memuat `MONTHLY_EXPENSES` (lima pos beban operasional bulanan) dan `MDR_RATE` (0,7% biaya QRIS/GoPay/VA). Keduanya dipakai prototipe untuk menghitung **Laporan Laba Rugi**, tetapi **tidak ada tabelnya** — ERD Bagian 3 memang tidak memodelkan beban operasional. Endpoint `GET /api/reports/profit-loss` pada Fase 4.4 karena itu belum dapat menghasilkan laba bersih, hanya laba kotor. Perlu diputuskan: tambah tabel `operational_expenses` + kolom tarif MDR, atau batasi laporan pada laba kotor saja.

---

## FASE 4 — Backend REST API ✅ SELESAI

### 4.1 Fondasi

- [x] Konfigurasi Sanctum — SPA satu origin pakai cookie (`statefulApi`), bukan token
- [x] Atur `bootstrap/app.php`: middleware `api`, penanganan exception → JSON
- [x] Buat `App\Http\Resources\*` untuk semua response (jangan balikkan model mentah)
- [x] Buat `App\Http\Requests\*` untuk validasi (aturan §9: harga jual > harga beli, stok tidak negatif)
- [x] Format response seragam: `{ data, message, meta }`
- [x] Middleware `role:admin` untuk menegakkan hak akses §2.2

### 4.2 Endpoint CRUD

Pakai `apiResource` untuk masing-masing:

- [x] `/api/categories`, `/api/units`, `/api/suppliers`, `/api/customers`
- [x] `/api/products` + `GET /api/products/barcode/{kode}` (khusus scan kasir)
- [x] `/api/users` (admin saja)

### 4.3 Endpoint Operasional

- [x] `POST /api/shifts/open` dan `POST /api/shifts/close`
- [x] `POST /api/transactions` — buat transaksi + item dalam **satu DB transaction**
  - [x] Kurangi stok & catat `stock_moves` di dalam transaksi yang sama
  - [x] Tolak bila stok tidak cukup (flow §4.1)
- [x] `GET /api/transactions` — filter tanggal, status, kasir + pagination
- [x] `POST /api/returns` — auto-approve bila admin, `pending` bila kasir (§2.2)
- [x] `POST /api/purchases` — tambah stok + catat `stock_moves`
- [x] `POST /api/opnames` — hitung selisih, sesuaikan stok

### 4.4 Endpoint Laporan

- [x] `GET /api/reports/sales` — rekap per periode
- [x] `GET /api/reports/profit-loss` — laba = (harga_jual − harga_beli) × qty
- [x] `GET /api/reports/stock` — termasuk daftar stok menipis
- [x] `GET /api/dashboard` — 4 stat card + data grafik 7 hari

### 4.5 Pengujian

- [x] Feature test untuk tiap endpoint (PHPUnit sudah terpasang)
- [x] Uji kasus gagal: stok kurang, harga jual < harga beli, akses kasir ke menu admin
- [x] **Backend harus lulus semua test sebelum menyentuh frontend**

### Catatan Pelaksanaan Fase 4

**53 rute API**, 13 controller, 16 Resource, 12 Form Request, 4 service. Pint lolos, PHPStan level 7 **0 error**, PHPUnit **171 lolos / 544 asersi** (79 di antaranya tes API baru).

Selain tes otomatis, seluruh tumpukan diuji langsung terhadap MySQL berisi data seed: login Fortify, sesi cookie Sanctum, lalu dashboard, laporan, dan pencarian barcode — angkanya cocok dengan hasil verifikasi Fase 3.

**Bug yang hanya ketahuan lewat analisis statis.** PHPStan menandai `catch (QueryException)` pada seluruh `destroy()` sebagai *dead catch*, dan setelah ditelusuri memang benar: kelima model master memakai `SoftDeletes`, sehingga `delete()` hanyalah `UPDATE deleted_at` dan foreign key `RESTRICT` **tidak akan pernah berbunyi**. Jalur 409 yang saya tulis mustahil tercapai, dan kategori yang masih dipakai produk akan terhapus diam-diam. Diganti dengan pemeriksaan ketergantungan eksplisit — yang sekaligus memberi pesan lebih jelas ("masih dipakai produk").

**Penafsiran hak akses Bagian 2.2.** Tabel itu menandai Master Data terlarang bagi kasir, tetapi halaman Kasir jelas membutuhkan daftar produk, kategori, satuan, dan pelanggan untuk dapat berjualan. Yang dilarang dibaca sebagai **pengelolaannya**: kasir boleh MEMBACA, sedangkan tambah/ubah/hapus hanya admin. Supplier tidak dipakai di halaman Kasir sehingga tetap tertutup penuh. Ditegakkan middleware `role`, bukan sekadar disembunyikan di antarmuka — dan diuji: 13 endpoint admin dipastikan menolak kasir dengan 403.

**Keputusan rancangan yang perlu dicatat:**

| Hal | Penanganan |
| :-- | :-- |
| Harga dari klien | Diabaikan. Server membaca harga sendiri dari basis data dan menghitung ulang seluruh total (diuji: klien mengirim `harga_satuan: 1` tetap ditagih harga asli) |
| Perubahan stok | Hanya lewat `StockService`, dengan `lockForUpdate()` agar dua kasir tidak saling menimpa |
| Transaksi non-tunai | Berstatus `pending` dan **belum** mengurangi stok, menunggu webhook Fase 5 |
| Baris produk kembar | Digabung sebelum dihitung |
| Nomor dokumen | Dibentuk server berpola `PREFIX-YYYYMMDD-NNN` |
| Tarif pajak & diskon | Di `config/pos.php`, bukan ditulis tetap, agar menu Pengaturan dapat mengubahnya |

> ⚠️ **Penting untuk Fase 6.** Sanctum hanya memakai sesi cookie bila header `Origin`/`Referer` cocok dengan `config('sanctum.stateful')`. Saat pengujian langsung, server di port 8125 menghasilkan 401 meskipun login berhasil, karena daftarnya hanya memuat port 8000. **Origin dev server Vite (biasanya `localhost:5173`) wajib ditambahkan ke `SANCTUM_STATEFUL_DOMAINS`**, atau seluruh panggilan API dari SPA akan 401.

### Dua Keterbatasan yang Disadari

1. **`GET /api/reports/profit-loss` hanya menghasilkan laba kotor.** Beban operasional belum punya tabel (lihat catatan Fase 3). Selain itu harga pokok dibaca dari `products.harga_beli` **saat ini**, bukan harga beli saat penjualan terjadi — `transaction_items` memotret nama dan harga jual, tetapi tidak harga beli. Selama harga beli belum berubah angkanya tepat; setelah berubah, laba periode lampau ikut bergeser.
2. **Persetujuan retur tidak mengembalikan stok.** Entitas RETUR pada ERD Bagian 3 hanya memuat alasan dan jumlah refund, tanpa rincian barang, sehingga tidak ada informasi produk mana yang diretur. Retur saat ini murni catatan keuangan.

---

## FASE 5 — Integrasi Midtrans Snap ⚠️ SEBAGIAN (kode selesai, uji sandbox terhalang)

### 5.1 Persiapan

- [x] `composer require midtrans/midtrans-php`
- [x] Tambah ke `.env` (dan `.env.example` **tanpa nilai asli**) — kuncinya ditambahkan **dengan nilai kosong**; mengisinya butuh akun Anda:
      `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_MERCHANT_ID`, `MIDTRANS_IS_PRODUCTION=false`
- [x] Buat `config/midtrans.php` yang membaca env tersebut
- [x] **Pastikan `.env` tetap di `.gitignore`** — Server Key tidak boleh masuk repositori (§5.4)

### 5.2 Service Layer

- [x] `App\Services\MidtransService` — bungkus semua panggilan SDK di sini, jangan di controller
- [x] Set `Config::$serverKey`, `$isProduction`, `$isSanitized`, `$is3ds` dari config
- [x] `createSnapToken(Transaction $trx)` — kirim `transaction_details`, `item_details`, `customer_details`
  - [x] `gross_amount` **wajib** sama persis dengan jumlah `item_details`, kalau tidak Midtrans menolak

### 5.3 Endpoint Pembayaran

- [x] `POST /api/transactions/{id}/snap-token` — balikkan token, simpan ke `payments`
- [x] `POST /api/midtrans/notification` — webhook
  - [x] **Verifikasi `signature_key`** = SHA512(`order_id` + `status_code` + `gross_amount` + ServerKey)
  - [x] Tolak request yang signature-nya tidak cocok — jangan pernah percaya body mentah
  - [x] Petakan status: `capture`/`settlement` → lunas, `pending` → pending, `deny`/`expire`/`cancel` → gagal
  - [x] Tulis setiap perubahan ke `payment_logs` beserta payload mentahnya
  - [x] Buat idempoten — Midtrans mengirim notifikasi yang sama berkali-kali
- [x] `GET /api/transactions/{id}/status` — untuk polling cadangan bila webhook telat

### 5.4 Pengujian Sandbox

- [ ] Ekspos localhost agar webhook bisa masuk (ngrok / expose), daftarkan URL-nya di dashboard Midtrans  — **TERHALANG: butuh akun Midtrans Anda**
- [ ] Uji kartu sukses, pending, dan deny memakai kartu simulasi Midtrans  — **TERHALANG: butuh akun Midtrans Anda**
- [ ] Uji QRIS dan VA lewat simulator sandbox  — **TERHALANG: butuh akun Midtrans Anda**
- [x] Pastikan stok **hanya** berkurang saat status benar-benar lunas
- [x] Test unit untuk verifikasi signature (termasuk kasus signature palsu)

### 5.5 Kesiapan Production

- [x] Pastikan perpindahan cukup lewat `MIDTRANS_IS_PRODUCTION=true` + ganti key — **tanpa ubah kode**
- [x] Dokumentasikan langkah go-live di `docs/DEPLOYMENT.md`
- [ ] Daftarkan URL webhook production di dashboard Midtrans  — **TERHALANG: butuh akun Midtrans Anda**
- [ ] Pastikan HTTPS aktif (Midtrans menolak webhook non-HTTPS di production)  — **TERHALANG: butuh akun Midtrans Anda**

### Catatan Pelaksanaan Fase 5

**Seluruh kode selesai dan teruji; yang tersisa hanya yang menuntut akun Midtrans Anda.**

`MidtransService` (satu-satunya tempat SDK dipanggil), `PaymentNotificationService` (pemroses webhook), dua controller, dan tiga endpoint. Pint lolos, PHPStan level 7 **0 error**, PHPUnit **195 lolos / 602 asersi** — **24 di antaranya khusus Midtrans**.

**Pengujian dilakukan tanpa akun Midtrans** dengan cara menyuntikkan Server Key palsu lewat `config()` lalu menyusun payload beserta signature yang sah sendiri. Yang diuji adalah aturan yang kita tulis, bukan layanan Midtrans:

| Yang diuji | Hasil |
| :-- | :-- |
| Signature palsu ditolak `403`, tanpa perubahan data | lolos |
| Signature kosong ditolak | lolos |
| `gross_amount` diubah setelah signature dihitung → ditolak | lolos |
| Webhook berjalan tanpa autentikasi (dijaga signature) | lolos |
| `settlement` melunasi transaksi **dan** mengurangi stok | lolos |
| Notifikasi dikirim 3x → stok tetap berkurang **sekali** | lolos |
| `pending` dan `expire` **tidak** mengurangi stok | lolos |
| `capture` + `fraud_status=challenge` tetap `pending` | lolos |
| Status final tidak dapat dimundurkan jadi `cancel` | lolos |
| `order_id` tak dikenal dibalas tanpa mengubah apa pun | lolos |
| Pemetaan 8 status Midtrans | lolos |
| Response konfigurasi **tidak** memuat Server Key | lolos |

**Tiga lapis penjaga idempotensi**, karena Midtrans mengirim notifikasi yang sama berkali-kali:

1. Indeks unik `payment_logs.idempotency_key` (hash dari order_id + status_code + transaction_status + gross_amount + fraud_status).
2. `lockForUpdate()` pada baris payment dan transaction, supaya dua notifikasi yang tiba bersamaan tidak sama-sama lolos pemeriksaan.
3. Status yang sudah final ditolak untuk diubah lagi.

**Keputusan rancangan lain:**

- `gross_amount` **wajib** sama persis dengan jumlah `item_details`, jadi diskon dikirim sebagai baris bernilai negatif dan PPN sebagai baris tersendiri. Ketidakcocokan dilempar sebagai exception sebelum permintaan dikirim, bukan dibiarkan ditolak Midtrans.
- `order_id` memakai `SA-{no_struk}`; bila pembayaran kedaluwarsa lalu ditagih ulang, ditambahkan akhiran `-R2`, `-R3`, karena Midtrans menolak `order_id` yang pernah dipakai.
- Endpoint `GET /api/transactions/{id}/status` disediakan sebagai cadangan bila webhook terlambat — hanya membaca basis data; status resmi tetap ditentukan webhook, sebab callback di browser dapat dimanipulasi.
- Bila kredensial kosong, endpoint Snap Token menjawab `503` dengan pesan jelas, bukan gagal di dalam SDK. Seluruh fitur lain tetap berjalan normal.

Langkah go-live lengkap ditulis di [`DEPLOYMENT.md`](DEPLOYMENT.md).

### ⛔ Yang Terhalang dan Menunggu Anda

Lima butir di bawah **tidak saya kerjakan** karena menuntut akun, kredensial, atau akses dashboard yang hanya Anda miliki:

| Butir | Yang dibutuhkan |
| :-- | :-- |
| Isi `MIDTRANS_SERVER_KEY` / `CLIENT_KEY` / `MERCHANT_ID` | Daftar di dashboard Sandbox Midtrans |
| Ekspos localhost + daftarkan URL webhook | ngrok, lalu isi Payment Notification URL di dashboard |
| Uji kartu sukses / pending / deny | Kredensial sandbox aktif |
| Uji QRIS dan VA lewat simulator | Kredensial sandbox aktif |
| Pendaftaran webhook production + HTTPS | Akun production dan server Anda |

Kuncinya sudah ditambahkan ke `.env` dan `.env.example` **dengan nilai kosong**, jadi tinggal diisi. Setelah itu jalankan `php artisan config:clear`. Panduannya langkah demi langkah ada di [`DEPLOYMENT.md`](DEPLOYMENT.md) bagian 1.

---

## FASE 6 — Frontend SPA (Vite + Vue 3) ✅ SELESAI

### 6.1 Pembersihan Starter Kit

- [x] Lepas Inertia dari `vite.config.ts` dan `app.ts` — 2026-09-23 sempat diputuskan tidak dilepas; **2026-09-24 dilepas tuntas**, SPA pindah ke root (lihat bagian terakhir dokumen ini)
- [x] Pasang `vue-router` dan `axios`, atur base URL + `withCredentials` untuk Sanctum
- [x] Susun ulang `resources/js/`: `router/`, `views/`, `components/`, `stores/`, `composables/`, `api/`

### 6.2 Design System

- [x] Pindahkan token dari `docs/assets/css/tokens.css` ke CSS variables global (palet teal, Plus Jakarta Sans)
- [x] Bangun komponen dasar sesuai §6.6: `BaseButton`, `BaseInput`, `BaseCard`, `DataTable`, `BaseModal`, `StatusBadge`, `ToastHost`, `SidebarItem`
- [x] Terapkan §6.7: baris tabel **flat** (bukan neumorphic), tombol aksi utama solid, focus ring 3px selalu terlihat
- [x] `font-variant-numeric: tabular-nums` untuk semua angka uang (§6.3)

### 6.3 Layout & Routing

- [x] `AppLayout` — sidebar + topbar, responsif (rail 72px di 1024–1279px, drawer di bawah 1024px)
- [x] Vue Router dengan navigation guard berbasis peran (§2.2)
- [x] Halaman login + alur auth Sanctum

### 6.4 Halaman

Prioritas mengikuti §9 — **4 halaman wajib dulu**, Kasir sesudahnya:

- [x] Dashboard — 4 stat card + grafik 7 hari + transaksi terakhir
- [x] Produk (Data Master) — tabel + search + filter kategori + badge stok
- [x] Form Produk — validasi client **dan** server
- [x] Laporan Penjualan — rekap periode + struk siap cetak (`@media print`)
- [x] **Kasir** — grid produk, panel keranjang, scan barcode, modal bayar (Tunai / Snap)
  - [x] Muat `snap.js` dengan Client Key, panggil `window.snap.pay(token)`
  - [x] Tangani callback `onSuccess` / `onPending` / `onError` / `onClose`
  - [x] Shortcut keyboard F2 = Bayar (§4.1)
- [x] Sisa 16 halaman menu lain sesuai §9

### 6.5 Penyelesaian

- [x] Loading state & error handling di semua panggilan API
- [x] Uji responsif di 360px, 768px, 1024px, 1440px
- [x] `npm run build` bersih, `npm run types:check` lolos

### Catatan Pelaksanaan Fase 6

**33 berkas SPA**: 17 halaman, 7 komponen, layout, router, klien API, dua store, dan satu berkas CSS design system. Seluruh pemeriksaan hijau — Pint, PHPStan level 7 **0 error**, PHPUnit **197 lolos / 608 asersi**, lint frontend bersih, dan `vue-tsc` tanpa galat.

**Diuji di browser sungguhan (Chrome via Playwright), bukan hanya dikompilasi.** Login, lalu ke-18 halaman dikunjungi satu per satu: semuanya render dengan judul benar, **nol galat console**, dan **nol horizontal scroll** pada 1440px, 1100px, dan 390px. Masuk sebagai kasir memastikan penjaga peran bekerja: `/laporan/penjualan` dialihkan kembali ke dashboard dan menu menyusut dari 18 jadi 8 item.

> ⚠️ **Satu keputusan yang saya tahan untuk Anda: melepas Inertia.**
>
> Checklist meminta Inertia dilepas dari `vite.config.ts` dan `app.ts`. Melakukannya akan **merusak sekitar 92 tes bawaan starter kit** yang sekarang lolos (login, registrasi, 2FA, passkey, profil, teams) karena seluruhnya menguji halaman Inertia. Menghapus tes yang lolos adalah tindakan yang sulit dibatalkan dan bukan keputusan yang pantas saya ambil sendirian.
>
> Karena itu SPA dibangun **secara aditif**: disajikan di `/app/*` lewat `routes/web.php`, dengan entry Vite sendiri (`resources/js/spa/main.ts`) berdampingan dengan entry Inertia. Tidak ada satu pun berkas lama yang dihapus atau diubah perilakunya.
>
> Bila Anda ingin Inertia benar-benar dilepas, itu pekerjaan tersendiri: hapus plugin `inertia()` dan `wayfinder()`, buang `resources/js/pages`, ganti tampilan Fortify, dan hapus tes yang menguji halaman Inertia.

### Dua Bug yang Hanya Ketahuan Karena Dilihat, Bukan Dites

1. **Grafik Dashboard menampilkan nol untuk ketujuh hari**, padahal kartu di atasnya menunjukkan omzet Rp 2.671.204. Penyebabnya `DATE(tanggal) as tanggal`: alias itu bertabrakan dengan cast `datetime` pada model, sehingga hasilnya dihidrasi menjadi Carbon dan kuncinya berubah jadi `"2026-09-17 00:00:00"` — tidak pernah cocok dengan pencarian `"2026-09-17"`. Tes lama lolos karena hanya memeriksa **jumlah** titik grafik, bukan nilainya. Alias diganti jadi `hari` (dan `tanggal_str` pada laporan penjualan), dan **dua tes regresi ditambahkan** yang memeriksa nilainya.
2. **Horizontal scroll di 390px** — yang justru baru muncul setelah bug pertama diperbaiki, karena sebelumnya grafiknya kosong sehingga tidak meluap. Label angka (`1.986.240`) lebih lebar daripada kolomnya. Label disembunyikan di bawah 768px; batang dan nama hari tetap menyampaikan bentuk grafik.

**Satu jebakan konfigurasi:** berkas `public/hot` tertinggal dari dev server Vite yang pernah berjalan, sehingga Laravel menunjuk ke `http://[::1]:5174` alih-alih memakai hasil build. Halaman termuat tetapi kosong. Berkas itu dihapus.

**Keputusan rancangan:**

| Hal | Penanganan |
| :-- | :-- |
| Autentikasi | Cookie sesi Sanctum, **bukan** token di `localStorage` — cookie httpOnly tidak terbaca JavaScript |
| State | Objek reaktif Vue biasa, tanpa Pinia; yang dibutuhkan hanya satu store bersama |
| Grafik | CSS murni, tanpa pustaka grafik — satu deret batang tidak sepadan dengan menambah dependensi |
| Empat master data sederhana | Satu komponen `MasterSederhanaView` berkonfigurasi, supaya keempatnya tidak lambat laun menyimpang |
| Total di keranjang | Hanya pratinjau; server tetap menghitung ulang semuanya |
| Gambar produk | Disalin dari prototipe ke `public/img-produk/` |

**Catatan pengujian responsif:** diuji pada 390px, 1100px, dan 1440px — bukan persis 360/768/1024/1440 seperti tertulis di checklist. Ketiganya mewakili tiga mode tata letak yang berbeda: drawer, rail 72px, dan sidebar penuh.

---

## FASE 7 — Pengujian & Deploy ⚠️ SELESAI (deploy menunggu server Anda)

- [x] Uji end-to-end alur kasir: buka shift → scan → bayar **tunai** → struk (di browser sungguhan). Bagian **Snap → webhook** diuji terpisah lewat 24 tes otomatis, karena alur langsungnya menuntut kredensial Midtrans Anda
- [x] Verifikasi hak akses: login sebagai kasir, pastikan menu admin benar-benar tertutup di API (bukan sekadar disembunyikan di UI)
- [x] `composer run ci:check` hijau (lint + types + test)
- [x] Audit keamanan: tidak ada Server Key, tidak ada kredensial, `.env` tidak ter-commit
- [ ] Deploy + jalankan migrasi di server  — **TERHALANG: butuh server Anda** (langkahnya ada di [`DEPLOYMENT.md`](DEPLOYMENT.md) bagian 3)
- [x] Perbarui `docs/README.md` dan checklist §10 PERANCANGAN.md

---

## Catatan Penting

1. **Stok hanya berkurang saat pembayaran benar-benar lunas.** Untuk Snap, ini berarti saat webhook `settlement` masuk — bukan saat token dibuat. Kalau tidak, transaksi yang di-*cancel* akan memakan stok.
2. **Webhook wajib idempoten.** Midtrans mengirim notifikasi yang sama berulang kali; tanpa penjagaan, `payment_logs` membengkak dan stok bisa berkurang dua kali.
3. **Jangan pernah percaya body webhook tanpa verifikasi signature.** Endpoint ini publik — siapa pun bisa mengirim POST palsu yang mengaku "settlement".
4. **Semua perhitungan uang dihitung ulang di server.** Total dari frontend hanya dipakai sebagai pembanding, tidak pernah langsung disimpan.
5. **Prototipe `docs/` menjadi acuan visual, bukan acuan logika.** Logika bisnis yang benar ada di dokumen ini dan di PERANCANGAN.md.

### Catatan Pelaksanaan Fase 7

**Uji end-to-end di Chrome sungguhan (Playwright): 14 pemeriksaan, seluruhnya lolos, nol galat halaman.**

| Yang diuji | Hasil |
| :-- | :-- |
| Login sebagai kasir | lolos |
| Shift terbuka | lolos |
| Pindai barcode `8998866200196` masuk keranjang | lolos |
| Tambah qty jadi 3 | lolos |
| Total 3 x 3.500 + PPN 11% = **Rp 11.655** | lolos |
| Pintasan **F2** membuka modal bayar | lolos |
| Bayar Rp 20.000, kembalian **Rp 8.345** | lolos |
| Struk terbit dengan nomor `TRX-20260923-0052` | lolos |
| Stok berkurang **tepat 3** (184 → 181) | lolos |
| Keranjang direset setelah transaksi | lolos |
| Kasir ditolak `403` di `/api/reports/sales` | lolos |
| Kasir ditolak `403` di `/api/users` | lolos |
| Kasir ditolak `403` di `/api/suppliers` | lolos |

Penolakan `403` itu diuji lewat `fetch` langsung dari dalam browser, bukan dengan memeriksa menu — membuktikan hak akses ditegakkan server, bukan sekadar disembunyikan antarmuka.

**`composer run ci:check` hijau seluruhnya**: lint frontend, `vue-tsc`, Pint, PHPStan level 7 (0 error), dan PHPUnit **197 lolos / 608 asersi**.

**Audit keamanan — enam pemeriksaan, seluruhnya bersih:**

1. Tidak ada berkas `.env` yang ter-track git.
2. `.env` **tidak pernah** muncul di riwayat git (`git log --all`).
3. Tidak ada pola Server Key, Client Key, maupun `APP_KEY` di berkas mana pun yang ter-track.
4. `.env.example` memuat kunci Midtrans dengan nilai kosong.
5. `midtrans.server_key` hanya dirujuk di tiga tempat, seluruhnya di dalam `MidtransService`.
6. Kata `server_key` **tidak muncul sama sekali** di `resources/js` — tidak ada jalan bagi kunci itu untuk sampai ke browser.

**Dokumentasi diperbarui:** `docs/README.md` kini menjelaskan kedua tahap proyek beserta cara menjalankan aplikasi penuh, akun contoh, dan dua jebakan yang sempat memakan waktu (`SANCTUM_STATEFUL_DOMAINS` dan berkas `public/hot`). Checklist §10 PERANCANGAN.md sudah diverifikasi ulang — butir "tidak ada Server Key di repositori" kini terbukti lewat audit di atas.

---

## Ringkasan Akhir

**128 dari 134 butir selesai (95%).** Enam yang tersisa seluruhnya menunggu akses milik Anda, bukan menunggu pekerjaan:

- **5 butir uji sandbox Midtrans** — menunggu kredensial diisi ke `.env` (panduan di [`DEPLOYMENT.md`](DEPLOYMENT.md) bagian 1). Kodenya sudah selesai dan dicakup 24 tes otomatis.
- **1 butir deploy** — menunggu server Anda ([`DEPLOYMENT.md`](DEPLOYMENT.md) bagian 3).

**Yang berdiri:** 31 tabel dengan 21 foreign key, 17 model, 8 seeder, 58 endpoint API, integrasi Midtrans Snap lengkap dengan webhook ber-signature dan idempoten, serta SPA Vue 3 berisi 18 halaman yang responsif dari 390px sampai 1440px. `composer run ci:check` hijau: **206 tes / 659 asersi**, PHPStan level 7 nol error.

---

## Lanjutan 2026-09-23 — Keputusan yang Diambil Setelah Peninjauan

Empat pertanyaan yang sebelumnya menggantung sudah dijawab.

### 1. Inertia — dibiarkan apa adanya

SPA tetap disajikan di `/app/*` berdampingan dengan halaman Inertia bawaan kit. Tidak ada tes yang dikorbankan.

### 2. Beban operasional — tabel ditambahkan, laporan kini sampai laba bersih

Tabel `operational_expenses` (nama, `jumlah_bulanan`, aktif) beserta model, factory, seeder, dan CRUD admin di `/api/expenses`. Nilainya disimpan **per bulan** lalu diprorata terhadap panjang periode laporan, persis seperti perilaku prototipe. Tarif MDR 0,7% dipindahkan ke `config/pos.php` dan dihitung dari nilai transaksi non-tunai yang lunas.

Halaman **Pengaturan → Beban Operasional** ditambahkan ke SPA, lengkap dengan ringkasan total per bulan dan setara per hari.

Hasil pada data seed (periode 7 hari):

| Baris | Nilai |
| :-- | --: |
| Laba kotor | 2.159.535 (13,28%) |
| Beban operasional (prorata 7/30) | −1.213.706 |
| Biaya MDR 0,7% dari non-tunai 10.183.829 | −71.287 |
| **Laba bersih** | **874.542 (5,38%)** |

### 3. Potret harga beli — ditambahkan

Kolom `transaction_items.harga_beli` memotret harga modal saat penjualan terjadi. Sebelumnya laporan membaca `products.harga_beli` yang berlaku sekarang, sehingga menaikkan harga modal sebuah produk **menggeser laba periode yang sudah lewat**. Tes `test_menaikkan_harga_beli_tidak_menggeser_laba_lampau` menjaga perilaku ini: harga modal dinaikkan dari 10.000 ke 14.000 setelah penjualan, dan laba periode itu tetap 20.000.

Rincian retur **tidak** dikerjakan sesuai keputusan Anda, jadi persetujuan retur tetap belum mengembalikan stok.

### 4. Kredensial Midtrans — Anda isi sendiri

Kunci tidak pernah melewati percakapan ini. Setelah `.env` diisi dan `php artisan config:clear` dijalankan, lima butir uji sandbox dapat diteruskan.

### Dua Bug Ditemukan Saat Meninjau Hasilnya

1. **Rugi ditampilkan hijau.** Laba bersih negatif diwarnai sebagai keberhasilan. Kini rugi berwarna merah dan labelnya berubah menjadi "RUGI BERSIH".
2. **Horizontal scroll di 390px pada setiap halaman bertabel.** Penyebabnya sistemik: `<span class="sr-only">` memakai `position: absolute` tanpa leluhur ber-posisi, sehingga ia lolos dari kontainer gulir tabel dan melebarkan dokumen sampai 539px. Diperbaiki sekali di `.table-scroll` (`position: relative`), berlaku untuk seluruh halaman bertabel.

Periode bawaan Laporan Laba Rugi juga diselaraskan dari 30 hari menjadi **7 hari**, mengikuti bawaan API dan Laporan Penjualan — sebelumnya beban sebulan penuh dibandingkan dengan penjualan seminggu, sehingga laporan tampak rugi besar padahal datanya memang hanya 7 hari.

### Perbaikan Setelah Percobaan Manual Pertama

Saat aplikasi dicoba langsung, login menghasilkan `RuntimeException: This password does not use the Bcrypt algorithm`. Penelusuran menemukan **dua masalah terpisah**.

**1. Hash kata sandi di basis data rusak.** Yang tersimpan `$10$…` sepanjang 57 karakter dengan algoritma terbaca `unknown`, padahal bcrypt yang sah 60 karakter berawalan `$2y$12$` — tiga karakter `$2y` hilang dan cost-nya 10, bukan 12 seperti setelan `.env`. Hilang setelah `migrate:fresh --seed`.

> **Asalnya tidak dapat dijelaskan.** `UserSeeder` terbukti menghasilkan `$2y$12$…` yang sah dan lolos `Hash::check`, sehingga tidak ada jalur kode di proyek ini yang dapat memproduksi hash cost-10 tanpa prefiks. Kemungkinan terbesar baris itu ditulis dari luar aplikasi atau tersisa dari seed lama.

**2. Pengguna hasil seeder tidak punya tim — ini cacat pada seeder.** Setelah masalah pertama beres, login Inertia tetap gagal dengan `Missing required parameter for [Route: dashboard]`. Rute bawaan starter kit ter-scope tim (`{current_team}/dashboard`), dan `UserFactory` membuatkan tim pribadi lewat `afterCreating()`, tetapi `UserSeeder` memakai `User::create()` langsung sehingga `current_team_id` tetap `NULL`.

Cacat ini **lolos dari 203 tes** karena seluruh tes memakai `UserFactory`, sedangkan yang dipakai sehari-hari adalah `UserSeeder`. `UserSeeder` kini membuat tim pribadi per pengguna, dengan slug ditulis eksplisit karena `DatabaseSeeder` memakai `WithoutModelEvents` yang mematikan hook pembangkit slug pada `Team`.

Ditambahkan `tests/Feature/SeederTest.php` yang menguji **hasil seeder**, bukan hasil factory: hash bcrypt 60 karakter yang cocok dengan kata sandi bawaan, tim pribadi per pengguna, dan komposisi peran. Kedua pintu login kini terbukti bekerja — `/login` mengarah ke `/suryaowner/dashboard`, `/app/login` ke `/app/`.

### Yang Masih Terbuka

| Hal | Status |
| :-- | :-- |
| Deploy ke server | Menunggu server Anda |
| 5 butir uji sandbox Midtrans | Menunggu kredensial di `.env` |
| Rincian retur (stok tidak kembali) | **Diputuskan tidak dikerjakan** |
| Figma untuk §8/§10 PERANCANGAN | Butir rubrik, belum dibuat |
| Medan prototipe tanpa kolom | `tingkat` pelanggan, `termin_hari` & `pkp` supplier, `supplier` utama produk |
| ~~Dua pintu masuk (`/login` Inertia vs `/app/login` SPA)~~ | **Selesai 2026-09-24** — template dihapus, SPA di root |

---

## Lanjutan 2026-09-24 — Template Laravel Dihapus, SPA Pindah ke Root

Keputusan 2026-09-23 untuk membiarkan Inertia **dibatalkan**. Starter kit Laravel dihapus tuntas, dan <http://127.0.0.1:8000> kini langsung membuka aplikasi POS. Alamatnya menjadi `/kasir`, `/produk`, `/login`, dan seterusnya, tanpa prefiks `/app`.

### Yang dihapus

| Lapis | Isi |
| :-- | :-- |
| Frontend | Seluruh `resources/js` di luar `spa/` (halaman, komponen shadcn, layout, Wayfinder), `app.ts`, `app.css`, `app.blade.php`, `components.json` |
| Backend | Teams (model, controller, policy, rule, notifikasi, enum), halaman Settings, middleware Inertia/appearance/team, kelas respons Fortify khusus, `CreateNewUser`, `ResetUserPassword` |
| Fitur Fortify | Registrasi, reset kata sandi, verifikasi email, 2FA, passkey. Fortify kini **tanpa tampilan**: yang tersisa hanya `POST /login` dan `POST /logout` yang dipakai SPA |
| Paket | Composer: `inertiajs/inertia-laravel`, `laravel/wayfinder`, `laravel/chisel`. npm: Inertia, Wayfinder, passkeys, Tailwind, dan utilitas shadcn (`clsx`, `cva`, `tailwind-merge`, `vue-sonner`, `vue-input-otp`) |
| Tes | ±90 tes starter kit (Teams, Settings, 2FA, verifikasi, reset) |

`laravel/passkeys` tetap terpasang karena dibutuhkan Fortify, tetapi fiturnya tidak aktif. Rute `user/confirm-password` Fortify juga tetap terdaftar karena selalu didaftarkan Fortify apa pun fitur yang aktif. Rute itu hanya dapat dipakai pengguna yang sudah masuk.

### Basis data

- Empat migrasi template (teams, `current_team_id`, passkeys, kolom 2FA) dihapus dari repositori.
- Migrasi baru `2026_09_24_120001_drop_starter_kit_tables` men-drop sisa tabel dan kolomnya dari basis data yang sudah terlanjur memilikinya. Semua langkahnya dijaga `hasTable`/`hasColumn`, sehingga pada instalasi baru migrasi ini tidak melakukan apa pun. Catatan migrasi lama ikut dibersihkan.
- **Tanpa `migrate:fresh`, data POS tetap utuh.** Setelah migrasi `db_pos` masih memuat 350 transaksi dan 5 pengguna. Yang terhapus hanya 5 tim pribadi hasil seeder. Dump sebelum migrasi disimpan sebagai cadangan.

### Routing

`routes/web.php` kini hanya berisi dua rute:

1. `GET app/{any?}` mengalihkan alamat lama ke padanannya di root, beserta query string. Contohnya `/app/login?lanjut=%2Fkasir` menjadi `/login?lanjut=%2Fkasir`.
2. `GET {any?}` menyajikan `spa.blade.php` untuk semua alamat, kecuali `api/`, `sanctum/`, `storage/`, dan `up`. Pengecualian ini wajib: rute web didaftarkan **sebelum** rute api, sehingga tanpa pengecualian, `GET /api/...` yang tak dikenal akan dijawab HTML 200, bukan JSON 404.

Vue Router memakai `createWebHistory()` tanpa base.

### Satu regresi ditemukan dan diperbaiki

Uji langsung terhadap server menemukan `GET /api/user` **tanpa** header JSON berakhir `500 Route [login] not defined`. Middleware `auth` membangun URL redirect tamu lewat `route('login')`, dan rute bernama itu dulu disediakan tampilan Fortify yang kini dimatikan. SPA tidak terkena karena selalu mengirim `Accept: application/json`, tetapi klien lain akan kena. Diperbaiki dengan `redirectGuestsTo('/login')` di `bootstrap/app.php`, dan tes regresinya ditambahkan.

### Hasil verifikasi

- `composer run ci:check` hijau: lint dan format, `vue-tsc`, Vitest **41 lolos**, Pint, PHPStan level 7 **0 error**, PHPUnit **146 lolos**. Tes baru: `SpaRoutingTest` untuk root, tautan dalam, pengalihan `/app`, dan prefiks yang dikecualikan. `AuthenticationTest` ditulis ulang untuk login JSON.
- Uji di Chrome sungguhan terhadap `http://127.0.0.1:8000`:
  - Tamu yang membuka root dibawa ke `/login`. Admin mendarat di `/`, kasir di `/kasir`.
  - Dari 19 tautan yang diperiksa, tidak ada yang masih menunjuk `/app`.
  - Muat ulang langsung `/produk` dan `/laporan/penjualan` tetap berjalan, begitu juga `/app/produk` yang dialihkan ke `/produk`.
  - `/settings/profile` kini menampilkan 404 milik SPA.
  - Keluar kembali ke `/login`, dan penjaga peran tetap menolak kasir dari laporan.
  - Satu-satunya respons galat adalah `401 GET /api/user` saat tamu membuka root. Itu memang cara SPA mendeteksi pengunjung belum masuk.


---

## Lanjutan 2026-09-24 — Pengaturan Toko

Menu baru **Pengaturan → Pengaturan Toko** (`/pengaturan/toko`, khusus admin). Halaman ini menggabungkan rancangan Profil Toko dan Pajak & Diskon dari prototipe (`docs/pages/profil-toko.html`, `pajak-diskon.html`), dua halaman yang sebelumnya belum dibangun.

### Yang dapat diatur

| Bagian | Isian | Dipakai di |
| :-- | :-- | :-- |
| Identitas | Logo (PNG/JPG/WebP, maks. 1 MB), nama toko, slogan | Sidebar, halaman masuk, layar pembuka, judul tab, favicon, kop laporan, mode tablet, kepala struk |
| Alamat & kontak | Alamat, telepon, email, jam buka & tutup | Kepala struk |
| Legalitas | NPWP (15/16 digit), NIB (13 digit) | Kepala struk (NPWP) |
| Struk | Cetak logo ya/tidak, kaki struk dua baris | Struk Kasir dan cetak ulang di Riwayat |
| Pajak & diskon | Status PKP, tarif PPN (0–20%), diskon member (0–30%) | `PricingService` di server dan pratinjau keranjang Kasir |
| Pembayaran non-tunai | Tarif MDR (0–5%), batas waktu bayar (5–1.440 menit) | Laporan Laba Rugi, masa berlaku tagihan Midtrans |

Di sisi kanan halaman ada **pratinjau struk** yang berubah saat mengetik, sebelum disimpan. Halaman ini juga punya penanda "Belum disimpan", dialog konfirmasi bila meninggalkan halaman, dan pintasan Ctrl+S.

### Rancangan

- **Tabel `settings` berbentuk kunci-nilai** (`kunci`, `nilai` JSON). Menambah pengaturan baru tidak butuh migrasi, cukup satu baris di `PengaturanToko::skema()`, aturan validasinya di `PengaturanRequest`, dan isiannya di halaman.
- **`App\Services\PengaturanToko` adalah satu-satunya pintu.** Kunci yang belum pernah disimpan memakai nilai bawaan dari `config/pos.php`, jadi tabel kosong pun menghasilkan aplikasi yang berjalan normal. Service ini juga memastikan tipe setiap nilai benar (tarif selalu `float`, saklar selalu `bool`). Sengaja tidak di-cache, karena cache yang basi pada tarif pajak berarti kasir menagih angka yang salah.
- **Tiga tempat yang dulu membaca `config('pos.*')` langsung** kini memakai service: `PricingService` (PPN dan diskon), `ReportController` (MDR), dan `MidtransService` (batas waktu bayar).
- **Pratinjau keranjang Kasir tidak lagi menulis tetap `0.11` dan `0.05`.** Sebelumnya, mengubah tarif akan membuat pratinjau berbeda dari total yang dihitung server. Label "PPN 11%" dan "Diskon member 5%" juga dibentuk dari tarif, dan baris PPN disembunyikan bila toko bukan PKP.
- **Mengubah tarif tidak mengubah transaksi lama**, karena nominal diskon dan pajak disimpan per transaksi. Untuk alasan yang sama, rincian PPN yang dikirim ke Midtrans kini berlabel "PPN" tanpa persen: tagihan yang ditagih ulang dapat terjadi setelah tarif berubah.
- **Identitas publik dirender server.** Nama, slogan, logo, dan inisial disisipkan ke `spa.blade.php` (`window.__TOKO__`), sehingga layar pembuka, judul tab, favicon, dan halaman masuk langsung benar tanpa berkedip dari nama bawaan. Yang disisipkan sengaja hanya identitas; tarif dan NPWP tidak ikut (dijaga tes).
- **Inisial pengganti logo dihitung di server saja** ("Toko Sari Amerta" → "SA", kata "toko"/"warung" dilewati). Dengan begitu Blade dan SPA tidak pernah berbeda pendapat.
- **Logo:**
  - Disimpan di disk `public` dengan nama acak, jadi setiap logo baru punya URL baru dan tidak tertahan cache browser.
  - Berkas lama dihapus setelah yang baru tersimpan.
  - URL-nya relatif (`/storage/...`), bukan absolut dari `APP_URL`.
  - **SVG ditolak**, karena dapat memuat skrip dan disajikan dari origin aplikasi.
  - Bila berkas gagal dimuat, misalnya karena `storage:link` belum dibuat, komponen `MerekToko` menampilkan inisial, bukan ikon gambar rusak.
- **Hak akses:** GET `/api/pengaturan` boleh untuk semua peran, karena Kasir butuh tarif dan identitas struk. PUT `/api/pengaturan`, POST dan DELETE `/api/pengaturan/logo` hanya untuk admin.

### Satu bug lama ikut ditemukan

`router.afterEach` mengganti judul tab juga untuk navigasi yang **dibatalkan**. Memilih "Kembali ke formulir" pada dialog perubahan belum disimpan membuat judul tab berganti ke halaman yang tidak jadi dibuka; ini juga terjadi di Form Produk. Judul kini dihitung dari rute yang benar-benar aktif lewat `watchEffect`, sekaligus langsung ikut berubah saat nama toko disimpan.

### Langkah tambahan

`php artisan storage:link` wajib dijalankan sekali, baik lokal maupun di server. Langkah ini sudah ditambahkan ke README dan DEPLOYMENT bagian 3.

### Hasil verifikasi

- `composer run ci:check` hijau: Vitest **46 lolos**, PHPUnit **183 lolos / 598 asersi**, PHPStan level 7 **0 error**. Tes baru:
  - `PengaturanApiTest`: nilai bawaan, hak akses, 12 kasus validasi, siklus logo unggah–ganti–hapus tanpa sisa berkas, 4 jenis logo tidak sah, isi layar pembuka, dan inisial.
  - Tarif baru, toko non-PKP, dan transaksi lama tidak berubah di `TransactionApiTest`.
  - Tarif MDR di `ReportApiTest`.
  - Tarif pratinjau kasir di `useKasir.test.ts`.
  - `InputPersen.test.ts`.
- Uji di Chrome sungguhan (24 pemeriksaan, seluruhnya lolos):
  - Menyimpan lewat Ctrl+S mengirim tarif sebagai pecahan. Sidebar dan judul tab langsung berubah tanpa muat ulang.
  - SVG ditolak dan PNG diterima. Logo termuat lewat `storage:link` dan tampil di sidebar, pratinjau struk, halaman masuk, serta favicon.
  - Kasir menampilkan "PPN 12%".
  - Tidak ada scroll horizontal di 390px.
  - Data uji dikembalikan ke nilai bawaan setelahnya.

---

## Lanjutan 2026-09-24 — Foto Produk, Perbesar Foto, Barcode Otomatis & Cetak Label

### 1. Foto produk kini dapat diunggah

Sebelumnya Form Produk **tidak punya isian foto sama sekali**. Kolom `gambar` hanya berisi path teks yang diisi seeder, menunjuk ke `public/img-produk/`.

- **Form Produk** mendapat kartu *Foto produk* di sisi kanan: pilih, ganti, hapus, dan pratinjau yang dapat diperbesar. Foto dipilih lebih dulu lalu diunggah **setelah** produk tersimpan, karena produk baru belum punya id sebelum itu. Bila produknya tersimpan tetapi fotonya gagal, data produk tidak dibuang: formulir berpindah ke mode ubah supaya foto dapat dicoba lagi.
- **Endpoint baru (admin):** `POST /api/products/{id}/gambar` dan `DELETE /api/products/{id}/gambar`. Format PNG/JPG/WebP, maks. 2 MB, minimal 64 px. SVG ditolak karena dapat memuat skrip. Foto disimpan di disk `public` folder `produk/` dengan nama acak, dan foto lama hasil unggahan dihapus setelah yang baru tersimpan.
- **`gambar_url` dibentuk server** (`Product::gambarUrl`). Foto unggahan menjadi `/storage/produk/...`, sedangkan foto contoh seeder tetap `/img-produk/products/...`. Foto contoh seeder **tidak pernah dihapus** aplikasi (dijaga tes).
- **`gambar` tidak lagi dapat ditulis lewat `PUT /api/products`**, supaya klien tidak dapat menunjuk ke berkas sembarang (dijaga tes dengan `../../.env`).

### 2. Transaksi "Menunggu" dan "Kedaluwarsa": pertanyaan, bukan perubahan

Keduanya **tidak** mengurangi stok dan **tidak** dihitung sebagai penjualan. Buktinya dari kode dan data:

| Bagian | Yang dihitung |
| :-- | :-- |
| Stok | Hanya berkurang saat status menjadi `settlement` (`TransactionService`, `PaymentNotificationService`). Di `db_pos`: **0 mutasi stok** dari transaksi yang tidak lunas |
| Laporan Penjualan & Laba Rugi | `Transaction::lunas()` / `status = 'settlement'` |
| Dashboard | `lunas()` |
| Rekap shift | Penjualan tunai/non-tunai hanya dari `settlement`; `pending` dihitung terpisah sebagai "tagihan menunggu" |

**Temuan dari pengecekan status langsung ke Midtrans Sandbox (hanya membaca, tanpa mengubah data):**

| Transaksi | Di aplikasi | Di Midtrans |
| :-- | :-- | :-- |
| TRX-20260923-0053 (Rp86.580) | pending | **settlement (sudah dibayar)** |
| TRX-20260923-0054 (Rp547.452) | pending | **settlement (sudah dibayar)** |
| TRX-20260923-0052 | pending | expire |
| TRX-20260923-0003, -0032 | pending | tidak dikenal (data seeder, tidak pernah dibuatkan tagihan) |

Status di aplikasi tertinggal karena webhook Midtrans tidak dapat menjangkau `localhost`. Dua transaksi yang sudah dibayar belum mengurangi stok dan belum masuk laporan. Tombol **Periksa** di Riwayat Transaksi menyinkronkannya satu per satu. **Belum dijalankan**, karena mengubah data dan stok.

### 3. Perbesar foto

Komponen `PratinjauGambar` (modal, tutup dengan Esc atau klik di luar) dengan tombol *Buka ukuran asli*. Thumbnail di Master Produk dan pratinjau di Form Produk dapat diklik; thumbnail tanpa foto tetap ikon biasa.

### 4. Barcode otomatis & cetak label

- **Format barcode internal: EAN-13 berawalan `20`** (`App\Services\BarcodeService`). Awalan 20–29 dicadangkan GS1 untuk kode internal toko, sehingga tidak bertabrakan dengan barcode pabrik; prototipe pun sudah memakai awalan ini. Nomornya acak (bukan berurutan) dengan digit cek sah, dan keunikannya diperiksa termasuk terhadap produk yang sudah dihapus.
- **Dipakai di tiga tempat:**
  - Tombol **Buat otomatis** di Form Produk (`GET /api/products/barcode-baru`), lengkap dengan pratinjau barcode.
  - Banner **"N produk belum punya barcode"** di Master Produk, dengan konfirmasi (`POST /api/products/barcode-otomatis`).
  - Tombol **Buat barcode** di halaman cetak, untuk produk dalam daftar cetak saja (`ids`).
- **Halaman Cetak Label Barcode** (`/produk/cetak-label`, dari tombol *Cetak Label* atau ikon printer per baris):
  - Pilih produk (cari atau *Semua produk aktif*) beserta jumlah label per produk.
  - Dua ukuran kertas: **A4 21 label (63,5 × 38,1 mm)** atau **printer label thermal 50 × 30 mm**.
  - Nama toko dan harga dapat ditampilkan atau disembunyikan.
- **Simbologi dipilih otomatis:** EAN-13/EAN-8 bila digit ceknya sah, selain itu **Code 128**. Sebagian data contoh prototipe (mis. Telur `2000140000105`) digit ceknya salah, dan tetap tercetak serta terbaca sebagai Code 128. Barcode digambar SVG oleh **JsBarcode** (MIT), pustaka pertama di proyek ini untuk urusan gambar. Pertimbangannya: barcode yang salah satu garis saja tidak terbaca pemindai, jadi pustaka yang teruji luas lebih aman daripada encoder buatan sendiri.
- **Digit cek EAN dihitung di dua tempat** (PHP untuk membuat, TypeScript untuk memilih simbologi) dan keduanya diuji dengan contoh yang sama.

### Bug yang ditemukan saat pengujian cetak

Saat dicetak, `<main class="konten">` masih membawa padding 32 px dan tinggi minimal satu layar. Akibatnya:

- Printer thermal mencetak **2 stiker kosong** (25 halaman untuk 23 label).
- Pada A4 seluruh label **bergeser ±8,5 mm ke bawah**, sehingga meleset dari kotak lembar stiker. Tes jumlah halaman A4 tetap lolos, jadi bug ini baru ketahuan setelah posisi label diukur.

Diperbaiki dengan menolkan padding dan tinggi pembungkus aplikasi hanya saat halaman berisi lembar label dicetak.

### Hasil verifikasi

- `composer run ci:check` hijau: Vitest **54 lolos**, PHPUnit **202 lolos / 666 asersi**, PHPStan level 7 **0 error**. Tes baru:
  - `ProdukGambarDanBarcodeTest` (19 tes): siklus foto, foto seeder tidak terhapus, path tidak dapat disuntik, 4 jenis foto tidak sah, hak akses, digit cek, barcode baru, isi massal, penyaring `tanpa_barcode`, dan barcode berspasi.
  - `barcode.test.ts`.
- Uji di Chrome sungguhan (29 pemeriksaan, seluruhnya lolos) memakai dua produk uji sementara yang dihapus permanen setelahnya:
  - Unggah foto lewat formulir, perbesar dari form dan dari daftar.
  - Barcode otomatis, satu per satu maupun massal.
  - **Garis barcode di label dibaca ulang oleh dekoder EAN-13 terpisah** dan hasilnya sama persis dengan kodenya, termasuk barcode asli Indomie.
  - PDF A4: 2 halaman berukuran 210 × 297 mm, label pertama tepat di tepi margin. PDF thermal: 23 halaman berukuran 50 × 30 mm.
  - Tanpa scroll horizontal di 390 px.
  - Barcode baru dipindai di Kasir dan masuk keranjang.

---

## Lanjutan 2026-09-24 — Tren Pendapatan, Pemilih Tanggal, Unduh PDF/Excel, Rincian Opname, Foto di Pemilih Produk

### 1. Tren pendapatan di Laporan Penjualan

- **Kartu ringkasan:**
  - Total diterima, dengan perubahan dibanding **periode sebelumnya yang sama panjang**. Perubahannya ditandai ikon naik/turun dan tanda +/−, tidak hanya warna.
  - Jumlah transaksi.
  - Rata-rata per transaksi.
  - Diskon.
- **Grafik area `GrafikTren`** (SVG, tanpa pustaka grafik), mengikuti skill *dataviz*:
  - Garis 2 px dengan arsiran 10%, garis bantu tipis tanpa putus-putus.
  - Sumbu Y berangka bulat dalam format Indonesia ringkas ("1 jt", "1,5 jt").
  - Label langsung hanya pada titik tertinggi, bukan di setiap titik.
  - Crosshair dan tooltip saat disorot, dan dapat dijelajahi keyboard (← → Home End).
  - Tinggi wadah sudah termasuk pita label sumbu X, sehingga tidak ada gulir bertingkat.
- **Warna deret `#00897b` dipilih lewat validator palet**, bukan ditaksir. Teal merek (`--teal-600`) gagal pada ambang *chroma* dan terbaca keabu-abuan sebagai garis data.
- **Deret tren rapat, dibentuk di server** (`LaporanService::tren`): hari tanpa penjualan tetap ada bernilai nol. Tanpa itu garis melompati hari sepi dan menggambarkan penjualan yang tidak pernah terjadi. Periode di atas **62 hari** otomatis dirangkum **per bulan**.

### 2. Pemilih tanggal flatpickr

`<input type="date">` bawaan browser diganti komponen `InputTanggal` (flatpickr 4.6, MIT):

- Berbahasa Indonesia, minggu dimulai Senin.
- Tampilan "24 Sep 2026", nilai yang dikirim tetap "2026-09-24".
- Tema teal yang sama dengan design system.
- Tampilan di ponsel sama dengan di desktop, tidak jatuh ke pemilih bawaan OS.

`FilterPeriode` kini memakai **satu kalender rentang** yang langsung menerapkan periode begitu ujung keduanya dipilih, sehingga tombol Terapkan tidak diperlukan lagi. Presetnya bertambah **90 hari** dan **Tahun ini**. Tanggal masuk di form Barang Masuk juga memakai komponen ini.

### 3. Unduh PDF & Excel menggantikan Cetak

- Tombol **Cetak** di Laporan Penjualan dan Laba Rugi diganti **Unduh PDF** dan **Unduh Excel**. Laporan Stok juga mendapat keduanya.
- **Berkas dibuat server**, dengan dompdf untuk PDF dan PhpSpreadsheet untuk Excel (keduanya berlisensi bebas). Endpoint: `GET /api/reports/{sales|profit-loss|stock}/unduh?format=pdf|xlsx` (khusus admin, `Cache-Control: no-store`).
- **Isinya dari `LaporanService`**, yang juga dipakai tampilan JSON, sehingga angka di layar, PDF, dan Excel dijamin sama. Seluruh perhitungan laporan dipindahkan dari controller ke service ini.
- **PDF:**
  - Kop berisi logo dan identitas dari Pengaturan Toko.
  - Kartu ringkasan, grafik kolom tren, dan tabel dengan kepala yang berulang di setiap halaman.
  - Nomor halaman "Halaman X dari Y".
- **Excel:**
  - Angka ditulis sebagai **angka** (bukan teks) dan tanggal sebagai **tanggal Excel**, sehingga bisa langsung dijumlah dan disaring.
  - Baris jumlah dan laba bersih memakai **rumus**.
  - Lembar Tren memuat **grafik garis Excel**.
  - Barcode disimpan sebagai **teks**; sebagai angka, Excel membuang nol di depan dan menampilkannya sebagai `8,99E+12`.
  - Kolom diberi penyaring dan baris kepala dibekukan.
- **Struk kasir dan label barcode tetap dicetak.** Keduanya dikirim ke printer fisik (thermal/stiker); menggantinya dengan unduhan akan memutus alur kerja kasir.

### 4. Barang apa saja yang diopname

- Riwayat opname kini menampilkan kolom **Dihitung** (jumlah produk) dan **Berselisih**, plus tombol **Lihat** yang membuka rincian sesi:
  - Foto, nama, dan barcode produk.
  - Stok sistem, stok fisik, dan selisih.
  - Nilai selisih (selisih × harga beli).
  - Ringkasan lebih/kurang, dan penyaring "hanya yang berselisih".
- **Barang yang dihitung dan cocok kini ikut tercatat.** Sebelumnya hanya barang berselisih yang disimpan, sehingga pemilik tidak bisa tahu barang mana yang sudah diperiksa. Lembar hitung mendapat centang **Dihitung** per baris: otomatis tercentang saat angkanya diubah, bisa dicentang sendiri bila jumlahnya cocok, atau sekaligus lewat tombol untuk semua baris yang tampil. Isian awal sama dengan stok sistem, jadi angka yang tidak berubah belum tentu sudah dihitung. Karena itulah dibutuhkan tanda eksplisit.
- Server mencatat barang cocok dengan selisih 0 **tanpa** menulis mutasi stok (`StockService::sesuaikan` mengabaikan selisih 0).
- Relasi produk pada rincian opname menyertakan produk yang sudah dihapus, sehingga riwayat lama tetap menampilkan nama barangnya.

### 5. Foto di pemilih produk Barang Masuk

`BaseSelect` kini mendukung foto per opsi (`gambar` di `OpsiPilihan`): foto 40 px di daftar, ikon pengganti bila produk tanpa foto supaya daftar tetap sejajar, dan foto kecil di kotak pilihan setelah dipilih. Dipakai di Barang Masuk dan Cetak Label. Pemakaian `BaseSelect` lain tidak berubah karena propertinya opsional.

### Temuan & perbaikan selama pengujian

- **Periode laporan tidak divalidasi.** Tanggal salah format langsung dilempar ke Carbon dan berakhir 500. Kini dijawab 422; `sampai` harus ≥ `dari`, dan panjang periode paling lama 3 tahun.
- **PDF ±555 KB**, karena logo toko 1254 px disematkan utuh. Kini logo dikecilkan ke 160 px sebelum disematkan, sehingga PDF menjadi ±57 KB.
- **Grafik kolom PDF rusak.** dompdf mempersempit kolom hari tanpa penjualan sehingga batang di sebelahnya melebar dan menyatu. Diperbaiki dengan `table-layout: fixed`.
- **Label tanggal terakhir sumbu X terpotong** di tepi kanan. Kini dirata-kanankan.
- **Aplikasi berjalan dalam UTC** (`config/app.php`), sementara toko berada di Denpasar (WITA, UTC+8). Batas "hari" di laporan dan dashboard mengikuti UTC, sehingga penjualan sebelum pukul 08.00 WITA masuk ke hari sebelumnya. **Belum diubah**: mengganti zona waktu berarti menggeser seluruh cap waktu yang sudah tersimpan, dan itu perlu keputusan tersendiri. Sementara itu, cap waktu "Dibuat" di PDF diberi label zona waktunya supaya tidak menyesatkan.

### Hasil verifikasi

- `composer run ci:check` hijau: Vitest **58 lolos**, PHPUnit **218 lolos / 743 asersi**, PHPStan level 7 **0 error**. Tes baru:
  - `LaporanTrenDanUnduhTest` (16 tes): tren rapat, rangkuman bulanan, pembanding, validasi periode, dan isi PDF/Excel yang dibaca ulang dengan PhpSpreadsheet (rumus, grafik, barcode sebagai teks, laba bersih Excel = layar).
  - Dua tes opname: barang cocok tercatat tanpa mutasi, dan produk terhapus tetap tampil.
  - `GrafikTren.test.ts`.
- **Berkas PDF dirender menjadi gambar dan diperiksa visual**: 30 hari (harian), 120 hari (bulanan), Laba Rugi, dan Stok (2 halaman).
- **Uji di Chrome sungguhan (32 pemeriksaan, seluruhnya lolos)** tanpa menulis ke `db_pos`, karena penyimpanan opname dan Barang Masuk dicegat di browser:
  - Grafik, hover, keyboard, dan preset.
  - Rentang flatpickr memuat ulang laporan secara otomatis.
  - Unduhan PDF/Excel ketiga laporan: nama berkas dan isinya sah.
  - Rincian opname, dan centang Dihitung yang mengirim barang cocok dengan selisih 0.
  - Foto di pemilih produk benar-benar termuat.
  - Tanpa scroll horizontal di 390 px.
