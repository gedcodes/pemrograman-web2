# DESIGN — Admin Panel Point of Sales (POS / Kasir Toko)

> **Dokumen turunan dari** [`PERANCANGAN.md`](PERANCANGAN.md) · **Milestone 1 — Pemrograman Web 2**
> **Nama:** I GEDE YOGA SETIAWAN · **NIM:** 231011401028
> **Fungsi dokumen:** spesifikasi visual yang siap dieksekusi. Bagian 9 berisi *prompt* siap tempel untuk **Google Stitch**.

---

## 0. Cara Memakai Dokumen Ini

| Bagian | Untuk apa |
| :-- | :-- |
| 1–2 | Arah desain & alasannya. Dibaca sekali, dipakai sebagai rem saat tergoda menambah dekorasi. |
| 3–6 | *Design tokens*. Ini yang nanti jadi `:root { --var }` di CSS Milestone 3. |
| 7–8 | Spesifikasi komponen dan denah tiap halaman. Dibaca berdampingan dengan prompt Stitch. |
| 9 | **Prompt Pack Stitch.** Salin satu blok, tempel ke Stitch, generate. |
| 10–11 | QA visual + daftar bagian `PERANCANGAN.md` yang perlu disinkronkan. |

**Alur kerja yang disarankan:**

1. Generate **Prompt 1 (Style Guide)** dulu di Stitch. Ini mengunci bahasa visual — layar berikutnya jadi jauh lebih konsisten.
2. Lanjut ke **Prompt 2 (Dashboard)** dan **Prompt 3 (Kasir)**. Dua layar ini yang paling menentukan nilai.
3. Sisanya menyusul. Export tiap layar ke `docs/img/`.
4. Pindahkan hasil terbaik ke Figma untuk dirapikan dan dijadikan komponen (syarat Bagian 8 `PERANCANGAN.md`).

---

## 1. Arah Desain — *Teal Soft UI*

`PERANCANGAN.md` menetapkan tema **Neumorphism**. Dokumen ini mempertahankan tema itu, tetapi mengganti basis warnanya dari biru-abu netral (`#E0E5EC`) menjadi **hijau kebiruan (teal)** dan menambahkan tiga koreksi supaya hasilnya terasa modern dan elegan, bukan seperti eksperimen neumorphism 2020 yang sulit dibaca.

### 1.1 Tiga Prinsip

**Prinsip 1 — Lembut untuk *chrome*, tegas untuk *data*.**
Neumorphism dipakai pada rangka aplikasi: kartu, tombol sekunder, input, panel. Begitu yang ditampilkan adalah **data padat** — tabel produk, riwayat transaksi, struk — permukaannya berubah jadi **putih bersih `#FFFFFF`** dengan bayangan difusi tipis. Alasannya sederhana: bayangan ganda pada 20 baris tabel menghasilkan bubur visual. Ini melanjutkan keputusan yang sudah benar di §6.7 `PERANCANGAN.md`, hanya dinaikkan jadi aturan sistem.

**Prinsip 2 — Teal punya rumah, bukan taburan.**
Warna utama tidak disebar ke mana-mana. Teal hidup di tiga tempat saja: **sidebar** (permukaan teal pekat `#0B2B27`), **tombol aksi utama** (isian solid `#0B6B62`), dan **focus ring**. Sisanya netral. Aksen yang jarang justru terbaca mahal; aksen di mana-mana terbaca murah.

**Prinsip 3 — Sidebar gelap adalah jawaban atas kelemahan neumorphism.**
`PERANCANGAN.md` sendiri sudah menandai masalahnya: bayangan berkontras 1,6:1 tidak boleh jadi satu-satunya penanda menu aktif. Alih-alih menambal dengan border, sidebar dijadikan **permukaan teal pekat**. Kontras sidebar terhadap kanvas mencapai **12,67:1**, menu aktif jadi tidak mungkin salah baca, dan aplikasi mendapat jangkar visual yang membuat kanvas teal-muda di sebelahnya terasa lapang. Satu keputusan menyelesaikan masalah aksesibilitas sekaligus masalah estetika.

### 1.2 Dial Desain

| Dial | Nilai | Konsekuensi konkret |
| :-- | :--: | :-- |
| **Design Variance** | 8 / 10 | Layout asimetris. Grid pakai satuan pecahan (`2fr 1fr 1fr`), bukan kolom sama rata. |
| **Motion Intensity** | 6 / 10 | Transisi CSS halus 220ms, *stagger* saat muat, umpan balik taktil saat ditekan. Tanpa animasi berat. |
| **Visual Density** | 4 / 10 umum · 6 / 10 tabel | Lapang di dashboard & kasir, rapat dan efisien di tabel data. |

### 1.3 Yang Dilarang Keras

Daftar ini mencegah desain jatuh ke pola generik:

- **Tanpa emoji** di UI final. Ikon memakai set garis konsisten (Phosphor / Material Symbols, `stroke-width` seragam 1,5). Emoji pada Bagian 2 `PERANCANGAN.md` hanya penanda dokumen, bukan aset desain.
- **Tanpa ungu, tanpa gradasi neon, tanpa *outer glow*.** Kedalaman datang dari bayangan bertinta, bukan dari cahaya.
- **Tanpa hitam murni `#000000`** dan tanpa putih murni sebagai kanvas.
- **Tanpa font serif** di mana pun. Ini perangkat lunak, bukan majalah.
- **Tanpa baris tiga kartu seragam.** Pola "tiga kartu sejajar sama besar" dilarang; pakai bento asimetris.
- **Tanpa H1 raksasa.** Hierarki dibentuk oleh bobot dan warna, bukan sekadar ukuran.
- **Tanpa data palsu yang malas.** Tidak ada "John Doe", tidak ada `99,9%`, tidak ada `Rp 1.000.000` bulat. Pakai nama dan angka yang terasa nyata.

---

## 2. Identitas Toko (untuk Konsistensi Mock Data)

Supaya semua layar bercerita hal yang sama, seluruh desain memakai satu identitas fiktif:

| Item | Nilai |
| :-- | :-- |
| Nama toko | **Toko Sari Amerta** |
| Jenis | Retail sembako & kebutuhan harian |
| Kasir bertugas | Ni Kadek Ayu Pramesti (shift pagi) |
| Pemilik / Admin | I Wayan Surya Adnyana |
| Contoh produk | Indomie Goreng Rendang 85g · Aqua Botol 600ml · Teh Pucuk Harum 350ml · Beras Pandan Wangi 5kg · Minyak Bimoli 1L |
| Contoh angka | Omzet hari ini `Rp 4.317.500` · 47 transaksi · 12 produk stok menipis |

> Angka dibuat "berantakan" dengan sengaja. Angka bulat langsung terbaca sebagai *placeholder*.

---

## 3. Design Tokens — Warna

Semua rasio di bawah dihitung dengan rumus *relative luminance* WCAG 2.1 dan sudah diverifikasi, bukan ditaksir.

### 3.1 Permukaan & Bayangan

| Token | HEX | Fungsi |
| :-- | :-- | :-- |
| `--surface-base` | `#E4EDEA` | Kanvas aplikasi + semua permukaan neumorphic |
| `--surface-raised` | `#EDF4F2` | Panel yang perlu naik sedikit (panel keranjang kasir) |
| `--surface-crisp` | `#FFFFFF` | Tabel data, modal, struk — tempat keterbacaan menang atas kelembutan |
| `--surface-sunken` | `#D7E4E0` | Dasar *well*, track slider, area drop |
| `--shadow-light` | `#FFFFFF` | Sorotan kiri-atas |
| `--shadow-dark` | `rgba(122,152,145,·)` | Bayangan kanan-bawah, bertinta teal |
| `--divider` | `#CBDAD5` | Garis pemisah 1px |

Sumber cahaya **konsisten dari kiri-atas** di seluruh aplikasi, tanpa kecuali.

### 3.2 Teks

| Token | HEX | Rasio vs `#E4EDEA` | Rasio vs putih | Status |
| :-- | :-- | :--: | :--: | :--: |
| `--text-primary` | `#16302C` | 11,79:1 | 14,06:1 | AAA |
| `--text-secondary` | `#47625D` | 5,55:1 | 6,62:1 | AA |
| `--text-muted` | `#526E69` | 4,64:1 | 5,54:1 | AA |

> Token `--text-muted` adalah **batas bawah**. Jangan memperterang teks apa pun melewati nilai ini, sehalus apa pun kelihatannya.

### 3.3 Skala Teal (Warna Utama)

| Token | HEX | Rasio vs base | Dipakai untuk |
| :-- | :-- | :--: | :-- |
| `--teal-950` | `#0B2B27` | 12,67:1 | Permukaan sidebar |
| `--teal-900` | `#06403B` | — | Teks di atas tint teal |
| `--teal-800` | `#09514A` | 7,69:1 | *Hover* tombol primary, judul beraksen |
| `--teal-700` | `#0B6B62` | 5,34:1 | **Isian tombol primary** (6,38:1 dengan teks putih) |
| `--teal-600` | `#0D7C74` | 4,24:1 | Focus ring, border aktif, ikon aksen |
| `--teal-400` | `#45C9B8` | — | Indikator terang **hanya di atas sidebar gelap** (7,41:1) |
| `--teal-100` | `#D0E7E3` | — | Latar tint, baris terpilih, badge info |

> `--teal-400` **tidak pernah** dipakai di atas kanvas terang — rasionya hanya 1,9:1 di sana. Ia eksklusif milik sidebar.

### 3.4 Isian Tombol (Teks Putih di Atasnya)

| Token | HEX | Rasio vs putih | Dipakai untuk |
| :-- | :-- | :--: | :-- |
| `--btn-primary` | `#0B6B62` | 6,38:1 | Simpan, Tambah, aksi utama |
| `--btn-success` | `#1B7A43` | 5,37:1 | **BAYAR**, Konfirmasi Lunas |
| `--btn-danger` | `#B23A16` | 5,98:1 | Hapus, Batalkan transaksi |
| `--btn-neutral` | `#1F3A35` | 12,25:1 | Cetak, aksi sekunder tegas |

### 3.5 Warna Status (Teks di Atas Kanvas Base)

| Token | HEX | Rasio | Makna |
| :-- | :-- | :--: | :-- |
| `--success-text` | `#12694A` | 5,60:1 | Lunas, stok aman |
| `--warning-text` | `#6F5000` | 6,23:1 | Pending, stok menipis |
| `--danger-text` | `#9E3210` | 6,03:1 | Gagal, stok habis |
| `--info-text` | `#0B6158` | 6,14:1 | Informasi netral |

### 3.6 Badge Status

| Status | Teks | Latar | Rasio | Ikon pendamping |
| :-- | :-- | :-- | :--: | :-- |
| Stok aman / `settlement` | `#12694A` | `#CFE7DB` | 5,12:1 | check-circle |
| Stok menipis / `pending` | `#6F5000` | `#F7E6B5` | 6,00:1 | clock |
| Stok habis / `expire` `cancel` | `#9E3210` | `#F6DACF` | 5,43:1 | x-circle |
| Info / `draft` | `#0B6158` | `#D0E7E3` | 5,66:1 | file-dashed |

> **Aturan wajib:** badge status **selalu** berbentuk pil dengan ikon + label teks. Tombol aksi **selalu** berbentuk persegi-membulat dengan isian solid. Perbedaan bentuk inilah yang mencegah badge hijau `settlement` tertukar dengan tombol hijau `BAYAR` — bukan sekadar perbedaan warna.

### 3.7 Warna Sidebar (di Atas `#0B2B27`)

| Token | HEX | Rasio | Fungsi |
| :-- | :-- | :--: | :-- |
| `--sidebar-idle` | `#A8C6C0` | 8,28:1 | Item menu tidak aktif |
| `--sidebar-active` | `#FFFFFF` | 15,12:1 | Item menu aktif |
| `--sidebar-label` | `#7FA39D` | 5,49:1 | Label grup ("MASTER DATA") |
| `--sidebar-indicator` | `#45C9B8` | 7,41:1 | Batang penanda 3px di kiri item aktif |
| `--sidebar-active-bg` | `rgba(255,255,255,0.08)` | — | Latar item aktif |

### 3.8 Palet Grafik (Chart.js, Dashboard)

Deret kategorikal, urut prioritas. Semua ≥ 3:1 terhadap kanvas, jadi aman sebagai penanda grafik:

| Urutan | HEX | Rasio vs base | Contoh pemakaian |
| :--: | :-- | :--: | :-- |
| 1 | `#0B6B62` | 5,34:1 | Penjualan (deret utama) |
| 2 | `#2B5C78` | 6,06:1 | Pembanding / periode lalu |
| 3 | `#9A6B06` | 3,93:1 | Deret ketiga |
| 4 | `#B23A16` | 5,01:1 | Deret keempat |

**Aturan grafik:**

- Label sumbu dan angka memakai token teks (`--text-secondary`), **tidak pernah** mewarisi warna deret.
- Garis grid `#CBDAD5` setebal 1px, hanya horizontal. Tanpa garis grid vertikal.
- Area di bawah garis diisi `rgba(11,107,98,0.10)` — halus, bukan blok pekat.
- Satu grafik maksimal dua deret. Lebih dari itu, ganti jadi tabel.

---

## 4. Design Tokens — Tipografi

Tiga keluarga font, semuanya tersedia di Google Fonts sehingga Stitch dan Figma sama-sama mengenalinya.

| Keluarga | Peran | Alasan pemilihan |
| :-- | :-- | :-- |
| **Outfit** | Judul & angka display | Geometris, berkarakter, terasa mahal pada bobot 500–600 |
| **Plus Jakarta Sans** | Teks isi, label, tabel | Terbaca sangat baik pada 14–16px; lahir dari proyek identitas kota Jakarta, jadi pas konteksnya |
| **JetBrains Mono** | Kolom angka & kode | Lebar digit seragam mutlak — wajib untuk kolom harga |

> **Font `Inter` sengaja tidak dipakai.** Font itu sudah jadi bawaan default hampir semua template dan ciri khasnya nol. **Font serif dilarang total** di seluruh aplikasi.

### 4.1 Skala Tipe

| Peran | Font | Size / Line-height | Weight | Tracking |
| :-- | :-- | :-- | :--: | :-- |
| Display — total belanja | Outfit | 40 / 44 | 600 | −0,02em |
| H1 — judul halaman | Outfit | 26 / 34 | 600 | −0,015em |
| H2 — judul section | Outfit | 20 / 28 | 600 | −0,01em |
| H3 — judul kartu | Outfit | 16 / 24 | 500 | 0 |
| Body — teks umum | Plus Jakarta Sans | 15 / 24 | 400 | 0 |
| Body strong | Plus Jakarta Sans | 15 / 24 | 600 | 0 |
| Small — label & sel tabel | Plus Jakarta Sans | 13,5 / 20 | 400 | 0 |
| Overline — label grup | Plus Jakarta Sans | 11 / 16 | 600 | +0,08em, UPPERCASE |
| Caption — helper & error | Plus Jakarta Sans | 12 / 18 | 500 | 0 |
| **Numerik tabel** | JetBrains Mono | 13,5 / 20 | 500 | 0 |

### 4.2 Aturan Angka (Kritis untuk POS)

Pembagian tugas yang disengaja:

- **Angka hero** (total belanja, kartu omzet) → **Outfit 600** + `font-variant-numeric: tabular-nums`. Elegan, besar, tetap sejajar.
- **Angka data** (kolom harga, stok, subtotal di tabel/keranjang) → **JetBrains Mono 500**, rata kanan. Presisi mengalahkan keanggunan di sini; kasir memindai kolom secara vertikal.
- Format Rupiah konsisten: `Rp 4.317.500` — ada spasi setelah `Rp`, pemisah ribuan titik, tanpa desimal.
- Prefiks `Rp` diberi `--text-muted` dan ukuran 0,8em, sementara nominalnya penuh. Mata langsung tertuju ke angka.
- H1 halaman **tidak pernah** melebihi 26px. Hierarki dibawa oleh bobot dan warna.

---

## 5. Spacing, Radius, Grid

### 5.1 Spacing

Skala kelipatan 4px: **`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`**

| Konteks | Nilai |
| :-- | :-- |
| Padding dalam kartu neumorphic | `24px` (minimum `16px` — bayangan butuh ruang agar tidak terpotong) |
| Jarak antar kartu di grid | `20px` |
| Padding sel tabel | `14px 16px` |
| Jarak label ke input | `8px` |
| Padding halaman (konten utama) | `32px` desktop · `16px` mobile |
| Tinggi baris tabel | `52px` |

### 5.2 Radius

| Elemen | Radius |
| :-- | :-- |
| Tombol, input, select | `14px` |
| Kartu, panel | `24px` |
| Modal | `28px` |
| Item sidebar | `12px` |
| Badge, chip, avatar | `999px` (pil penuh) |
| Kartu produk (grid kasir) | `20px` |

### 5.3 Grid & Breakpoint

- Lebar sidebar `260px`, mengecil jadi `72px` (ikon saja) di bawah `1280px`.
- Konten utama dibatasi `max-width: 1440px`, di tengah.
- Breakpoint: `sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`.
- **Semua layout asimetris wajib runtuh jadi satu kolom penuh di bawah `768px`.** Tidak ada *horizontal scroll* pada body, titik. Tabel lebar dibungkus kontainer `overflow-x: auto` sendiri.
- Tinggi penuh memakai `min-height: 100dvh`, **bukan** `100vh` — satuan `vh` melompat di Safari iOS.

---

## 6. Elevation, Bayangan, dan Motion

### 6.1 Resep Bayangan

Bayangan gelap **bertinta teal**, bukan abu-abu netral. Ini yang membuat kedalaman terasa menyatu dan bukan kotor.

| State | `box-shadow` |
| :-- | :-- |
| **Raised sm** — badge, chip, tombol kecil | `4px 4px 10px rgba(122,152,145,.30), -4px -4px 10px rgba(255,255,255,.90)` |
| **Raised md** — kartu, tombol sekunder | `10px 10px 24px rgba(122,152,145,.32), -8px -8px 20px rgba(255,255,255,.92)` |
| **Raised lg** — modal, popover | `24px 24px 60px rgba(90,120,113,.28), -16px -16px 40px rgba(255,255,255,.90)` |
| **Inset** — input, tombol toggle aktif | `inset 4px 4px 10px rgba(122,152,145,.38), inset -3px -3px 8px rgba(255,255,255,.85)` |
| **Crisp** — permukaan putih (tabel, struk) | `0 18px 40px -18px rgba(22,48,44,.14), 0 0 0 1px rgba(203,218,213,.80)` |
| **Flat** — baris tabel | `none`, hanya `border-bottom: 1px solid #CBDAD5` |
| **Focus** | `0 0 0 1.5px #0D7C74, 0 0 0 5px rgba(13,124,116,.24)` |

### 6.2 Motion

Satu kurva untuk seluruh aplikasi:

```css
--ease: cubic-bezier(0.16, 1, 0.3, 1);
--dur-fast: 140ms;   /* umpan balik tekan */
--dur-base: 220ms;   /* hover, perubahan state */
--dur-slow: 340ms;   /* modal, panel geser */
```

| Interaksi | Perilaku |
| :-- | :-- |
| Hover tombol/kartu | Bayangan sedikit melebar + `translateY(-1px)` |
| Tekan (`:active`) | `scale(.985)` dan bayangan berubah jadi **inset** — permukaan benar-benar terasa ditekan |
| Muat daftar/grid | *Stagger* 60ms per item, `opacity 0→1` + `translateY(8px→0)` |
| Modal muncul | Overlay fade 200ms, panel `scale(.96→1)` 340ms |
| Toast | Masuk dari kanan-atas, tahan 3,5 detik, keluar dengan fade |
| Baris tabel hover | Latar jadi `rgba(11,107,98,.05)`, tanpa gerakan |

**Aturan teknis:** hanya `transform` dan `opacity` yang dianimasikan — **tidak pernah** `width`, `height`, `top`, atau `left`. Seluruh animasi dibungkus `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }`.

---

## 7. Spesifikasi Komponen

### 7.1 Button

| Varian | Tampilan |
| :-- | :-- |
| **Primary** | Isian `#0B6B62`, teks putih 600, radius 14, padding `12px 22px`, bayangan `0 6px 16px -6px rgba(11,107,98,.55)` |
| **Success** | Isian `#1B7A43`. Khusus **BAYAR** — tinggi `56px`, lebar penuh, teks 17px 600 |
| **Danger** | Isian `#B23A16` |
| **Neutral** | Isian `#1F3A35` |
| **Soft** (sekunder) | Sewarna base + *raised md*, teks `#16302C` 500 |
| **Ghost** | Transparan, teks `#0B6158`, hover dapat latar `rgba(11,107,98,.07)` |

State wajib: `default · hover · active · focus-visible · disabled · loading`.
`disabled` = opacity 0,45 + bayangan dilepas + `cursor: not-allowed`.
`loading` = teks diganti spinner 16px, lebar tombol **dikunci** agar layout tidak melompat.

### 7.2 Form Input

- Label **di atas** input, `Small 600`, jarak `8px`.
- Input: permukaan **inset**, tinggi `48px`, padding `0 16px`, radius `14px`, tanpa border di state normal.
- `:focus` → inset + focus ring teal. Efek inset saja **tidak cukup** sebagai penanda fokus.
- **Error** → ring `#B23A16` 1,5px + ikon peringatan di kanan dalam + teks error `Caption` warna `#9E3210` di bawah input. Tiga penanda sekaligus, karena warna saja tidak boleh jadi satu-satunya pembawa informasi.
- Input pencarian produk: ikon *magnifier* di kiri, ikon *barcode* di kanan sebagai tombol, *placeholder* `"Scan barcode atau ketik nama produk"`.
- Helper text selalu ada di markup meski kosong, supaya tinggi form tidak bergeser saat error muncul.

### 7.3 Sidebar Item

Lebar `260px`, permukaan `#0B2B27`, padding `24px 16px`.

- **Header:** logo monogram bulat teal `#45C9B8` berisi huruf "SA", di sebelahnya "Toko Sari Amerta" (Outfit 600, putih) dan "ADMIN PANEL" (Overline, `#7FA39D`).
- **Label grup:** Overline `#7FA39D`, margin atas `24px`.
- **Item default:** ikon 20px + teks 14px `#A8C6C0`, tinggi `44px`, radius `12px`.
- **Item hover:** latar `rgba(255,255,255,.05)`.
- **Item aktif:** latar `rgba(255,255,255,.08)`, teks + ikon **putih 600**, dan **batang indikator `3px × 20px` warna `#45C9B8`** menempel di tepi kiri. Tiga penanda — latar, bobot teks, indikator warna — persis menjawab peringatan §6.2 `PERANCANGAN.md`.
- **Footer:** kartu profil kecil — avatar inisial, "Ni Kadek Ayu Pramesti", "Kasir · Shift Pagi", ikon logout.

### 7.4 Data Table

- Kontainer: permukaan **putih `#FFFFFF`** dengan bayangan *crisp*, radius `24px`, `overflow: hidden`.
- Header: latar `#F4F8F7`, teks Overline `#47625D`, `position: sticky; top: 0`.
- Baris: tinggi `52px`, pemisah `1px #CBDAD5`, **tanpa bayangan per baris**.
- Kolom numerik rata kanan, JetBrains Mono.
- Kolom aksi di paling kanan: ikon Edit dan Hapus, opacity 0,55 → 1 saat baris di-hover (tetap terlihat dan tetap bisa difokus lewat keyboard).
- Baris terpilih: latar `#D0E7E3` + batang teal `3px` di kiri.
- Toolbar di atas tabel: search (kiri, lebar `320px`), filter kategori (dropdown), tombol Primary "Tambah Produk" (kanan).
- Pagination di bawah: "Menampilkan 1–10 dari 248 produk" di kiri, kontrol halaman pil di kanan.

### 7.5 Badge / Chip

Pil `999px`, padding `4px 12px`, `Small 600`, ikon 14px di kiri. Warna mengikuti §3.6. Bayangan *raised sm* opsional dan hanya untuk chip filter yang bisa diklik — badge status **datar**, karena ia bukan kontrol.

### 7.6 Modal

- Overlay `rgba(11,43,39,.45)` + `backdrop-filter: blur(6px)`.
- Panel: `#FFFFFF`, radius `28px`, bayangan *raised lg*, lebar `480px` (konfirmasi) / `620px` (pembayaran).
- Struktur: judul H2 → pesan Body → tombol kanan-bawah, aksi destruktif paling kanan.
- Fokus terkunci di dalam modal, `Esc` menutup, tombol batal mendapat fokus awal pada modal hapus.

### 7.7 Kartu Produk (Grid Kasir)

Ukuran `≈180×200px`, radius `20px`, permukaan base + *raised md*.
Isi: thumbnail `72×72` di atas (radius 16, latar `#D7E4E0`) → nama produk maksimal 2 baris (`Small 600`) → harga (JetBrains Mono, `--text-primary`) → badge stok kecil di pojok kanan atas.
**Hover:** naik 2px, bayangan melebar. **Klik:** menekan jadi inset 140ms lalu kembali — konfirmasi fisik bahwa item masuk keranjang.
**Stok habis:** kartu opacity 0,5, tidak bisa diklik, badge merah "Habis".

### 7.8 Baris Keranjang

Satu baris = nama produk (`Small 600`) + harga satuan (`Caption`, muted) di kiri; *stepper* qty `− 2 +` di tengah; subtotal (JetBrains Mono 600) rata kanan; ikon hapus muncul saat hover.
Pemisah antar baris `1px #CBDAD5`. Tanpa kartu per baris.

### 7.9 Toast

Pil melebar, `#FFFFFF`, bayangan *crisp*, ikon status di kiri dalam lingkaran tint, teks `Small`, tombol tutup di kanan. Muncul di kanan-atas. Garis progres tipis `2px` di dasar toast yang menyusut selama 3,5 detik.

### 7.10 State Wajib (Sering Terlupa)

Setiap tampilan berbasis data **harus** punya empat state ini:

| State | Spesifikasi |
| :-- | :-- |
| **Loading** | *Skeleton* berbentuk sama dengan konten aslinya (balok radius 8, `#D7E4E0`, animasi *shimmer* 1,4 detik). **Bukan** spinner bulat di tengah layar. |
| **Empty** | Ilustrasi garis sederhana, judul H3, satu kalimat penjelas, dan satu tombol Primary yang menyelesaikan masalahnya. Contoh: *"Keranjang masih kosong — scan barcode produk pertama untuk memulai transaksi."* |
| **Error** | Pesan inline di dekat sumber masalah, bukan alert global. Sertakan tombol "Coba lagi". |
| **No result** | Berbeda dari Empty: *"Tidak ada produk yang cocok dengan 'indomi goreng'"* + tombol "Hapus filter". |

---

## 8. Denah Halaman

### 8.1 Dashboard — Bento Asimetris

Empat kartu statistik sejajar sama besar **tidak dipakai** — polanya generik dan memberi bobot sama pada informasi yang bobotnya jelas berbeda. Omzet hari ini lebih penting dari tiga metrik lain, jadi ia mendapat ruang lebih.

```
┌───────────────────────────────────────────────────────────────┐
│ H1 "Dashboard"        Selasa, 16 September 2026   [Hari Ini ▾]│
├──────────────────────────────┬───────────────┬────────────────┤
│  OMZET HARI INI       (2fr)  │ TRANSAKSI(1fr)│ PRODUK TERJUAL │
│  Rp 4.317.500                │ 47            │ 186 item       │
│  ▲ 12,4% vs kemarin          │ ▲ 6 transaksi │ ▼ 3,1%         │
│  ░░▁▂▄▃▅▇ sparkline 7 hari   ├───────────────┼────────────────┤
│                              │ STOK MENIPIS  │ MARGIN KOTOR   │
│                              │ 12 produk     │ 23,8%          │
├──────────────────────────────┴───────┬───────┴────────────────┤
│  GRAFIK PENJUALAN 7 HARI      (70%)  │ STOK MENIPIS    (30%)  │
│  Chart.js line + area teal           │ daftar 5 produk +      │
│  grid horizontal saja                │ badge qty + tombol     │
│                                      │ "Buat Pesanan"         │
├──────────────────────────────────────┴────────────────────────┤
│  TRANSAKSI TERAKHIR  — tabel putih, 5 baris, badge status     │
└───────────────────────────────────────────────────────────────┘
```

### 8.2 Kasir (POS) — Dua Zona, Prioritas Kecepatan

```
┌──────────────────────────────────────┬────────────────────────┐
│ Search besar + tombol barcode        │  KERANJANG      (420px)│
│ Chip kategori: Semua·Makanan·Minuman │  sticky, tinggi penuh  │
├──────────────────────────────────────┤  ───────────────────── │
│                                      │  Ni Kadek Ayu · #TRX-  │
│   GRID PRODUK 4 kolom                │  20260916-0048         │
│   kartu 180×200, scroll vertikal     │  ───────────────────── │
│                                      │  baris item (scroll)   │
│                                      │  ───────────────────── │
│                                      │  Subtotal   Rp 291.900 │
│                                      │  Diskon     − Rp 14.595│
│                                      │  PPN 11%     Rp 30.506 │
│                                      │  ═════════════════════ │
│                                      │  TOTAL    Rp 307.811   │
│                                      │  [ BAYAR  ·  F2 ]      │
│                                      │  [Tahan] [Batalkan]    │
└──────────────────────────────────────┴────────────────────────┘
```

Panel keranjang memakai `--surface-raised` supaya terbaca sebagai lapisan di atas kanvas. Total belanja memakai Display 40px. Tombol BAYAR setinggi 56px dengan pintasan `F2` tercetak di dalamnya — kasir yang sudah hafal tidak perlu mengangkat tangan dari keyboard.

### 8.3 Modal Pembayaran — Dua Metode

Dua tab di dalam satu modal `620px`:

- **Tab Tunai:** total besar di atas → input "Uang Diterima" (inset, JetBrains Mono, angka besar) → deretan chip nominal cepat `Uang Pas · Rp 310.000 · Rp 350.000 · Rp 400.000` → panel kembalian yang muncul dengan animasi ketika nominal cukup. Nominal kurang → ring merah + pesan inline, tombol Konfirmasi nonaktif.
- **Tab Non-Tunai (Midtrans):** QR Payment Link `220×220` di kartu putih, nominal di bawahnya, catatan "Buka link di tab baru", lalu dua tombol: Success "Konfirmasi Lunas" dan Soft "Simpan sebagai Pending". Di bawahnya banner info tipis warna `--info-text` yang menjelaskan konfirmasi dilakukan manual — sesuai batasan §4.3 `PERANCANGAN.md`.

### 8.4 Master Data Produk

Satu permukaan putih besar berisi toolbar + tabel + pagination. Kolom: `☐ · Gambar · Nama Produk · Kategori · Harga Beli · Harga Jual · Stok · Status · Aksi`. Judul halaman dan tombol "Tambah Produk" berada **di luar** permukaan tabel, rata atas.

### 8.5 Form Produk — Asimetris 2fr / 1fr

Kolom kiri (`2fr`): kartu "Informasi Produk" (nama, barcode, kategori, satuan, supplier) lalu kartu "Harga & Stok" (harga beli, harga jual, stok awal, stok minimum) dalam grid dua kolom.
Kolom kanan (`1fr`): kartu *upload* gambar (area *dashed* `#CBDAD5`, radius 20), kartu ringkasan margin yang **menghitung ulang secara langsung** ("Margin per unit Rp 650 · 22,8%"), dan kartu status dengan toggle "Produk aktif dijual". Bar aksi menempel di bawah (`sticky bottom`) berisi Ghost "Batal" dan Primary "Simpan Produk".

Validasi inline sesuai §4.2 `PERANCANGAN.md`: nama wajib, harga jual > harga beli, stok tidak boleh negatif.

### 8.6 Laporan & Struk

Kiri (`2fr`): pemilih periode + tiga ringkasan dalam satu permukaan (dipisah garis vertikal tipis, bukan tiga kartu terpisah) + grafik batang + tabel produk terlaris.
Kanan (`1fr`): pratinjau struk pada permukaan putih `320px` dengan tepi bawah bergerigi (zig-zag), isi memakai JetBrains Mono seluruhnya agar menyerupai cetakan termal. Tombol "Cetak Struk" Neutral di bawahnya. `@media print` menyembunyikan semua elemen kecuali struk.

---

## 9. Prompt Pack untuk Google Stitch

> **Cara pakai:** buka [stitch.withgoogle.com](https://stitch.withgoogle.com), pilih mode **Web**, salin **satu blok utuh** di bawah, tempel, generate. Setiap blok sudah memuat gaya visualnya sendiri sehingga bisa dijalankan dalam urutan apa pun. Prompt sengaja ditulis dalam bahasa Inggris karena Stitch memberi hasil paling akurat dengan input bahasa Inggris.
>
> Kalau hasil pertama belum pas, jangan menulis ulang dari nol — pakai fitur *edit / refine* Stitch dengan instruksi pendek. Contoh kalimat perbaikan ada di §9.10.

### 9.1 STYLE BLOCK (Referensi)

Blok ini sudah tertanam di setiap prompt. Disimpan terpisah kalau sewaktu-waktu perlu ditempel manual:

```text
STYLE: Modern soft-UI (subtle neumorphism) POS admin dashboard. Calm, smooth, elegant. Teal.
Canvas #E4EDEA. Neumorphic cards are the SAME color as the canvas, lifted by dual shadows:
white highlight from top-left, soft grey-teal shadow rgba(122,152,145,0.32) bottom-right.
Card radius 24px, generous 24px padding. Data tables, modals and receipts sit on crisp
white #FFFFFF surfaces with a thin 1px #CBDAD5 border instead of neumorphic shadows.
Left sidebar is a deep teal slab #0B2B27, full height, 260px: idle items #A8C6C0, active
item white bold with a 3px #45C9B8 indicator bar on its left edge.
Primary buttons: solid teal #0B6B62, white text, 14px radius. Pay button: solid green #1B7A43.
Secondary buttons: neumorphic, no fill. Text #16302C primary, #47625D secondary.
Status pills: green #CFE7DB/#12694A, amber #F7E6B5/#6F5000, red #F6DACF/#9E3210.
Fonts: Outfit semibold for headings and big numbers, Plus Jakarta Sans for body and labels,
JetBrains Mono for numeric table columns and prices.
Light source always top-left. No emoji, no gradients, no glow, no purple, no serif fonts.
Airy 8px spacing grid, line icons with uniform stroke weight.
```

---

### 9.2 Prompt 1 — Style Guide / Design System Board

**Jalankan ini pertama.** Hasilnya jadi acuan Stitch untuk layar berikutnya, sekaligus memenuhi syarat Bagian 8 `PERANCANGAN.md`.

```text
Design a design-system style guide page for a retail POS admin panel called "Toko Sari Amerta".

STYLE: Modern soft-UI (subtle neumorphism), calm, smooth, elegant, teal. Canvas #E4EDEA.
Neumorphic surfaces are the same color as the canvas, lifted by a white highlight from the
top-left and a soft grey-teal shadow rgba(122,152,145,0.32) from the bottom-right, 24px radius.
Fonts: Outfit semibold for headings, Plus Jakarta Sans for body, JetBrains Mono for numbers.
Light source always top-left. No emoji, no gradients, no glow, no purple, no serif.

Layout: stacked sections on one long page, each section titled in Outfit 20px semibold.

1. HEADER: page title "Design System", subtitle "Toko Sari Amerta — Admin Panel POS", and a
   circular teal monogram logo with the letters SA.
2. COLOR: swatch cards in a 4-column grid. Each swatch is a rounded 88px square with its hex
   code below it in JetBrains Mono. Rows: Surfaces (#E4EDEA, #EDF4F2, #FFFFFF, #D7E4E0);
   Teal scale (#0B2B27, #09514A, #0B6B62, #0D7C74, #45C9B8, #D0E7E3); Text (#16302C, #47625D,
   #526E69); Status (#12694A, #6F5000, #9E3210, #0B6158).
3. TYPOGRAPHY: a specimen list showing Outfit 40px semibold "Rp 4.317.500", Outfit 26px
   "Judul Halaman", Plus Jakarta Sans 15px paragraph text, and JetBrains Mono 13px numbers.
4. ELEVATION: four square tiles demonstrating raised-small, raised-medium, inset/pressed, and
   a crisp white card, each labeled underneath.
5. BUTTONS: a row of buttons in default and pressed state — solid teal Primary, solid green
   Success labeled "BAYAR", solid rust Danger, dark Neutral, and a soft neumorphic Secondary.
6. FORM: a text input with its label above it, shown in three states side by side: default
   (inset), focused (teal ring), and error (red ring with a red helper message below).
7. BADGES: pill badges with a small line icon — green "Stok Aman", amber "Stok Menipis",
   red "Stok Habis", teal "Draft".
8. COMPONENTS: a small neumorphic product card, a white table row, and a toast notification.
```

---

### 9.3 Prompt 2 — Dashboard

```text
Design a POS admin dashboard web page for a retail store called "Toko Sari Amerta".

STYLE: Modern soft-UI (subtle neumorphism), smooth and elegant, teal. Canvas #E4EDEA.
Neumorphic cards are the same color as the canvas, lifted by a white top-left highlight and a
soft grey-teal bottom-right shadow, 24px radius, 24px padding. Tables sit on crisp white
#FFFFFF surfaces with a 1px #CBDAD5 border. Headings in Outfit semibold, body in Plus Jakarta
Sans, all numbers with tabular figures. Light source top-left. No emoji, no gradients, no glow,
no purple, no serif fonts.

LEFT SIDEBAR, 260px wide, deep teal slab #0B2B27, full height:
a circular teal monogram "SA" with "Toko Sari Amerta" beside it and "ADMIN PANEL" underneath in
small uppercase #7FA39D. Menu groups with uppercase labels in #7FA39D: UTAMA (Dashboard),
TRANSAKSI (Kasir, Riwayat Transaksi, Retur Penjualan), MASTER DATA (Produk, Kategori, Supplier,
Pelanggan), INVENTORI (Stok Barang, Barang Masuk), LAPORAN (Penjualan, Laba Rugi). Idle items
#A8C6C0 with line icons; the active item "Dashboard" is white and bold with a subtly lighter
background and a 3px #45C9B8 bar on its left edge. At the bottom, a small profile row: initials
avatar, "Ni Kadek Ayu Pramesti", "Kasir · Shift Pagi", and a logout icon.

MAIN AREA, 32px padding, asymmetric bento grid — do NOT use four equal stat cards:

Top bar: page title "Dashboard" in Outfit 26px, the date "Selasa, 16 September 2026" in muted
text, a neumorphic date-range selector reading "Hari Ini", a bell icon with a red dot, and a
solid teal button "Buka Kasir".

Row 1, a grid of 2fr 1fr 1fr:
- A LARGE card spanning the 2fr column: small uppercase label "OMZET HARI INI", the number
  "Rp 4.317.500" in Outfit 40px semibold, a green pill "+12,4% vs kemarin", and a soft teal
  area sparkline of the last 7 days filling the lower half of the card.
- The 1fr columns hold four smaller stacked cards, two per column: "TRANSAKSI" 47 with
  "+6 transaksi"; "PRODUK TERJUAL" 186 item with a red "-3,1%"; "STOK MENIPIS" 12 produk in
  amber; "MARGIN KOTOR" 23,8%.

Row 2, split 70/30:
- A wide card "Penjualan 7 Hari Terakhir" with a smooth teal line chart, a soft teal filled area
  below the line, horizontal grid lines only, and rupiah labels on the vertical axis.
- A narrow card "Stok Menipis" listing five products, each with a small thumbnail, the product
  name, and an amber pill showing remaining stock: Beras Pandan Wangi 5kg (3), Minyak Bimoli 1L
  (5), Gula Pasir Gulaku 1kg (6), Teh Pucuk Harum 350ml (8), Sabun Lifebuoy 250ml (9). A soft
  secondary button "Buat Pesanan" at the bottom.

Row 3: a crisp white table card titled "Transaksi Terakhir" with columns No. Struk, Waktu,
Kasir, Metode, Total, Status. Five rows, numbers right-aligned in monospace, and pill status
badges: green "Lunas", amber "Pending", green "Lunas", green "Lunas", red "Dibatalkan".
```

---

### 9.4 Prompt 3 — Kasir (POS)

Layar paling penting. Kalau waktu terbatas, kerjakan yang ini dan Dashboard saja.

```text
Design a point-of-sale cashier screen for a retail store admin panel, optimized for speed.

STYLE: Modern soft-UI (subtle neumorphism), smooth and elegant, teal. Canvas #E4EDEA.
Neumorphic surfaces share the canvas color, lifted by a white top-left highlight and a soft
grey-teal bottom-right shadow. Headings in Outfit semibold, body in Plus Jakarta Sans, prices
and totals in tabular figures. Light source top-left. No emoji, no gradients, no glow, no
purple, no serif fonts.

LEFT SIDEBAR, 260px, deep teal #0B2B27, same menu as the rest of the panel, but the active item
is "Kasir (POS)" — white and bold with a 3px #45C9B8 bar on its left edge.

MAIN AREA split into two zones.

LEFT ZONE (flexible width):
- A tall search field, 56px, inset/pressed neumorphic style, a magnifier icon on the left, the
  placeholder "Scan barcode atau ketik nama produk", and a barcode-scanner icon button on the
  right in solid teal.
- A horizontal row of rounded filter chips: "Semua" (active, solid teal, white text),
  "Makanan", "Minuman", "Sembako", "Kebersihan", "Rokok".
- A 4-column grid of product cards, 20px radius, neumorphic. Each card has a 72px rounded
  product thumbnail on a slightly darker teal-grey tile, the product name on two lines in
  semibold 13px, the price below in tabular numbers, and a tiny stock pill in the top-right
  corner. Products: Indomie Goreng Rendang 85g Rp 3.500; Aqua Botol 600ml Rp 4.000; Teh Pucuk
  Harum 350ml Rp 5.500; Beras Pandan Wangi 5kg Rp 78.000; Minyak Bimoli 1L Rp 19.500; Gula
  Pasir Gulaku 1kg Rp 17.800; Kopi Kapal Api 165g Rp 12.300; Sabun Lifebuoy 250ml Rp 21.400.
  One card (Beras Pandan Wangi) is dimmed and disabled with a red "Habis" pill.

RIGHT ZONE, a fixed 420px cart panel, full height, on a slightly lighter surface #EDF4F2, sticky:
- Header: "Keranjang" in Outfit 20px, the transaction number "#TRX-20260916-0048" in small muted
  monospace, and a trash icon on the right.
- A row showing the cashier: small avatar, "Ni Kadek Ayu Pramesti", "Shift Pagi".
- A scrollable list of cart lines separated by thin 1px #CBDAD5 dividers, NOT cards. Each line:
  the product name in semibold on top with the unit price in small muted text below, a small
  minus/quantity/plus stepper in the middle, and the line subtotal right-aligned in bold tabular
  numbers. Lines: Indomie Goreng Rendang 85g x12 Rp 42.000; Aqua Botol 600ml x24 Rp 96.000;
  Minyak Bimoli 1L x6 Rp 117.000; Kopi Kapal Api 165g x3 Rp 36.900.
- A summary block: Subtotal Rp 291.900, Diskon Member -Rp 14.595 in green, PPN 11% Rp 30.506,
  then a thicker divider and "TOTAL" with "Rp 307.811" in Outfit 40px semibold.
- A full-width 56px solid green #1B7A43 button reading "BAYAR" with a small "F2" key-hint chip
  inside it on the right.
- Below it, two half-width soft neumorphic buttons: "Tahan Transaksi" and "Batalkan".
```

---

### 9.5 Prompt 4 — Modal Pembayaran (Tunai & Non-Tunai)

```text
Design two payment modal dialogs for a POS cashier screen, shown side by side on one page for
comparison.

STYLE: Modern soft-UI, smooth and elegant, teal. The page behind is canvas #E4EDEA, blurred and
dimmed with a dark teal overlay rgba(11,43,39,0.45). Modal panels are crisp white #FFFFFF,
28px radius, with a wide soft shadow. Headings in Outfit semibold, body in Plus Jakarta Sans,
amounts in large tabular figures. No emoji, no gradients, no glow, no purple, no serif fonts.

MODAL A — "Pembayaran Tunai", 620px wide:
- Title "Pembayaran" in Outfit 20px, close icon top-right.
- Two tabs below the title: "Tunai" (active, with a solid teal underline and a teal bold label)
  and "Non-Tunai / QRIS" (inactive, muted).
- A soft teal-tinted panel showing the label "TOTAL TAGIHAN" and "Rp 307.811" in Outfit 40px.
- A label "Uang Diterima" above a large inset input containing "Rp 350.000" in 28px tabular
  numbers.
- A row of quick-amount chips: "Uang Pas", "Rp 310.000", "Rp 350.000" (active), "Rp 400.000".
- A green-tinted #CFE7DB result panel with the label "KEMBALIAN" and "Rp 42.189" in dark green
  Outfit 32px.
- Footer buttons aligned right: a soft neumorphic "Batal" and a solid green "Konfirmasi &
  Cetak Struk".

MODAL B — "Pembayaran Non-Tunai", 620px wide, with the "Non-Tunai / QRIS" tab active:
- The same total panel showing "Rp 307.811".
- A centered white card containing a 220px QR code placeholder with a small teal logo in its
  center, and the caption "Scan QRIS · GoPay · Virtual Account" below it.
- A ghost button with an external-link icon reading "Buka Payment Link di Tab Baru".
- A thin teal-tinted information banner with an info icon: "Status pembayaran dikonfirmasi
  manual oleh kasir setelah memverifikasi di layar Midtrans."
- Footer: a soft neumorphic "Simpan sebagai Pending" on the left and a solid green "Konfirmasi
  Lunas" on the right.
```

---

### 9.6 Prompt 5 — Master Data Produk

```text
Design a product master-data table page for a retail POS admin panel.

STYLE: Modern soft-UI, smooth and elegant, teal. Canvas #E4EDEA. The table lives on a crisp
white #FFFFFF card with 24px radius, a 1px #CBDAD5 border and a wide soft shadow — rows are flat
with thin dividers, never individually shadowed. Everything else on the page is neumorphic.
Headings in Outfit semibold, body in Plus Jakarta Sans, numeric columns in JetBrains Mono,
right-aligned. No emoji, no gradients, no glow, no purple, no serif fonts.

LEFT SIDEBAR, 260px, deep teal #0B2B27, with "Produk" as the active item — white and bold with a
3px #45C9B8 bar on its left edge, nested under an uppercase "MASTER DATA" group label.

MAIN AREA, 32px padding:
- Header row: title "Data Produk" in Outfit 26px with the subtitle "248 produk terdaftar" below
  it, and on the right a soft neumorphic "Import CSV" button next to a solid teal
  "+ Tambah Produk" button.
- A toolbar above the table: a 320px inset search field with a magnifier icon and the
  placeholder "Cari nama atau barcode produk", two neumorphic dropdowns reading "Semua Kategori"
  and "Semua Status", and on the far right a small icon button for column settings.
- The white table card with a sticky header row on a very light #F4F8F7 background, column
  labels in small uppercase letter-spaced #47625D: checkbox, GAMBAR, NAMA PRODUK, KATEGORI,
  HARGA BELI, HARGA JUAL, STOK, STATUS, AKSI.
- Eight rows, 52px tall, separated by 1px #CBDAD5 lines. Each row: a 36px rounded product
  thumbnail, the product name in semibold with its barcode in small muted monospace below it,
  a category chip, two right-aligned price columns, a right-aligned stock number, a status pill,
  and two faint edit and delete icons at the far right.
  Rows: Indomie Goreng Rendang 85g / Makanan / Rp 2.850 / Rp 3.500 / 184 / green "Aman";
  Aqua Botol 600ml / Minuman / Rp 3.100 / Rp 4.000 / 96 / green "Aman";
  Beras Pandan Wangi 5kg / Sembako / Rp 68.400 / Rp 78.000 / 3 / amber "Menipis";
  Minyak Bimoli 1L / Sembako / Rp 16.900 / Rp 19.500 / 5 / amber "Menipis";
  Teh Pucuk Harum 350ml / Minuman / Rp 4.600 / Rp 5.500 / 142 / green "Aman";
  Gula Pasir Gulaku 1kg / Sembako / Rp 15.200 / Rp 17.800 / 0 / red "Habis";
  Kopi Kapal Api 165g / Minuman / Rp 10.100 / Rp 12.300 / 67 / green "Aman";
  Sabun Lifebuoy 250ml / Kebersihan / Rp 18.300 / Rp 21.400 / 41 / green "Aman".
  The third row is selected: a light teal #D0E7E3 background with a 3px teal bar on its left.
- Footer inside the card: "Menampilkan 1–8 dari 248 produk" on the left and rounded pagination
  controls 1 2 3 … 31 on the right.
```

---

### 9.7 Prompt 6 — Form Tambah / Edit Produk

```text
Design an "add product" form page for a retail POS admin panel, including validation states.

STYLE: Modern soft-UI, smooth and elegant, teal. Canvas #E4EDEA, neumorphic cards in the same
color lifted by a white top-left highlight and a soft grey-teal bottom-right shadow, 24px radius,
24px padding. Input fields are inset/pressed, 48px tall, 14px radius, with their label above
them. Headings in Outfit semibold, body in Plus Jakarta Sans. No emoji, no gradients, no glow,
no purple, no serif fonts.

LEFT SIDEBAR, 260px, deep teal #0B2B27, with "Produk" active under the "MASTER DATA" group.

MAIN AREA, 32px padding:
- A breadcrumb "Master Data / Produk / Tambah Produk" in small muted text, then the title
  "Tambah Produk" in Outfit 26px.
- An asymmetric two-column layout, the left column twice as wide as the right.

LEFT COLUMN:
- Card "Informasi Produk": a full-width "Nama Produk" field containing "Indomie Goreng Rendang
  85g"; below it a two-column row with "Barcode" containing 8998866200196 in monospace and a
  "Kategori" dropdown set to "Makanan"; below that a two-column row with a "Satuan" dropdown set
  to "Pcs" and a "Supplier" dropdown set to "CV Amerta Jaya Distribusi".
- Card "Harga & Stok": a two-column row with "Harga Beli" containing Rp 2.850 and "Harga Jual"
  containing Rp 3.500, both prefixed with a muted "Rp"; below it "Stok Awal" containing 184 and
  "Stok Minimum" in an ERROR STATE — a red 1.5px ring, a warning icon inside the field on the
  right, the value -5, and red helper text below reading "Stok minimum tidak boleh negatif".
  Show one other field in focus state with a teal ring, for contrast.

RIGHT COLUMN:
- Card "Gambar Produk": a dashed-border upload zone with a rounded image icon, the text "Tarik
  gambar ke sini atau klik untuk memilih" and small muted helper text "PNG atau JPG, maksimal
  2 MB".
- Card "Ringkasan Margin": rows reading "Margin per unit  Rp 650" and "Persentase margin  22,8%"
  in tabular numbers, with a small green pill "Sehat".
- Card "Status": a toggle switch labeled "Produk aktif dijual", switched on.

A sticky action bar pinned to the bottom of the content area on a neumorphic surface: a ghost
"Batal" button on the left and a solid teal "Simpan Produk" button on the right.
```

---

### 9.8 Prompt 7 — Laporan Penjualan & Pratinjau Struk

```text
Design a sales report page with a printable receipt preview for a retail POS admin panel.

STYLE: Modern soft-UI, smooth and elegant, teal. Canvas #E4EDEA with neumorphic cards in the
same color. The table and the receipt sit on crisp white #FFFFFF surfaces. Headings in Outfit
semibold, body in Plus Jakarta Sans, all figures in JetBrains Mono, right-aligned. No emoji,
no gradients, no glow, no purple, no serif fonts.

LEFT SIDEBAR, 260px, deep teal #0B2B27, with "Laporan Penjualan" active under the uppercase
"LAPORAN" group label.

MAIN AREA, 32px padding:
- Header: title "Laporan Penjualan" in Outfit 26px, subtitle "1 – 16 September 2026", and on the
  right a neumorphic date-range picker plus a dark neutral "Export PDF" button.
- An asymmetric two-column layout, the left column twice as wide as the right.

LEFT COLUMN:
- Three summary figures sharing ONE neumorphic surface, separated by thin vertical dividers
  rather than three separate cards: "Total Penjualan Rp 61.482.300", "Jumlah Transaksi 738",
  "Rata-rata per Transaksi Rp 83.310".
- A card "Penjualan per Hari" containing a teal bar chart of 16 bars with horizontal grid lines
  only, the tallest bar highlighted in a darker teal.
- A crisp white table card "Produk Terlaris" with columns RANK, PRODUK, TERJUAL, OMZET, MARGIN.
  Five rows: 1 Indomie Goreng Rendang 85g / 1.284 pcs / Rp 4.494.000 / Rp 834.600;
  2 Aqua Botol 600ml / 967 pcs / Rp 3.868.000 / Rp 870.300; 3 Teh Pucuk Harum 350ml / 812 pcs /
  Rp 4.466.000 / Rp 730.800; 4 Kopi Kapal Api 165g / 449 pcs / Rp 5.522.700 / Rp 987.800;
  5 Minyak Bimoli 1L / 318 pcs / Rp 6.201.000 / Rp 826.800. The rank column uses small circular
  teal-tinted badges.

RIGHT COLUMN:
- A card titled "Pratinjau Struk" containing a narrow 320px white receipt with a torn zig-zag
  bottom edge. The receipt content is entirely monospace: the store name "TOKO SARI AMERTA", the
  address "Jl. Raya Puputan No. 41, Denpasar", a dashed divider, "No. Struk: TRX-20260916-0048",
  "16/09/2026 10:47", "Kasir: Ni Kadek Ayu P.", a dashed divider, four item lines each showing
  quantity, name and amount, a dashed divider, Subtotal Rp 291.900, Diskon -Rp 14.595, PPN 11%
  Rp 30.506, TOTAL Rp 307.811 in bold, Tunai Rp 350.000, Kembali Rp 42.189, a dashed divider,
  and the closing line "Terima kasih telah berbelanja".
- Below the receipt, a full-width dark neutral button with a printer icon reading "Cetak Struk"
  and a soft neumorphic button "Kirim via WhatsApp".
```

---

### 9.9 Prompt 8 — Riwayat Transaksi (Opsional)

```text
Design a transaction history page for a retail POS admin panel, with strong status filtering.

STYLE: Modern soft-UI, smooth and elegant, teal. Canvas #E4EDEA with neumorphic controls; the
table sits on a crisp white #FFFFFF card with flat rows and thin #CBDAD5 dividers. Headings in
Outfit semibold, body in Plus Jakarta Sans, amounts in JetBrains Mono, right-aligned. No emoji,
no gradients, no glow, no purple, no serif fonts.

LEFT SIDEBAR, 260px, deep teal #0B2B27, with "Riwayat Transaksi" active under the "TRANSAKSI"
group label.

MAIN AREA, 32px padding:
- Header: title "Riwayat Transaksi" in Outfit 26px with the subtitle "738 transaksi bulan ini".
- A filter bar: an inset search field with the placeholder "Cari nomor struk atau nama
  pelanggan", a date-range picker, a "Semua Kasir" dropdown, and a row of status filter chips —
  "Semua" (active, solid teal), "Lunas", "Pending" (amber tinted), "Dibatalkan" (red tinted).
- A slim alert strip above the table on an amber-tinted #F7E6B5 surface with a clock icon:
  "3 transaksi non-tunai masih berstatus Pending dan perlu dikonfirmasi." with a small ghost
  button "Lihat" on the right.
- The white table card with columns NO. STRUK, WAKTU, KASIR, PELANGGAN, METODE, TOTAL, STATUS,
  AKSI. Eight rows, 52px tall. The METODE column uses small outlined chips reading "Tunai",
  "QRIS", "GoPay" or "Transfer VA". The STATUS column uses pill badges: green "Lunas", amber
  "Pending", red "Dibatalkan". The AKSI column holds a faint eye icon and a printer icon. Use
  customer names such as Ni Kadek Ayu Pramesti, I Wayan Surya Adnyana, Rizky Maulana Hakim and
  "Umum", with totals such as Rp 307.811, Rp 84.250, Rp 1.246.900, Rp 52.400.
- Footer inside the card: "Menampilkan 1–8 dari 738 transaksi" on the left and rounded
  pagination on the right.
```

---

### 9.10 Kalimat Perbaikan untuk Stitch

Kalau hasil generate meleset, pakai instruksi pendek ini pada fitur *refine* — jangan menulis ulang prompt penuh:

| Masalah yang muncul | Kalimat perbaikan |
| :-- | :-- |
| Kartu terlihat datar / bayangan hilang | `Make the cards more neumorphic: same color as the background, with a white highlight from the top-left and a soft grey-teal shadow from the bottom-right.` |
| Teal-nya terlalu terang / norak | `Desaturate the teal. Use #0B6B62 for buttons and #0B2B27 for the sidebar. Remove any glow or gradient.` |
| Sidebar jadi terang | `Make the left sidebar a solid deep teal #0B2B27 slab, full height, with light #A8C6C0 menu items and a white active item.` |
| Tabel jadi kartu per baris | `Put the table on one flat white card. Rows must be flat with thin 1px dividers, no shadow on individual rows.` |
| Font berubah jadi generik | `Use Outfit for all headings and large numbers, Plus Jakarta Sans for body text, JetBrains Mono for the numeric columns.` |
| Layout jadi simetris membosankan | `Make the layout asymmetric: the first card should span twice the width of the others instead of four equal cards.` |
| Muncul emoji / ikon warna-warni | `Replace all emoji with simple monochrome line icons of uniform stroke weight.` |
| Angka terlihat palsu | `Use realistic Indonesian rupiah amounts with thousand separators, like Rp 4.317.500, not round numbers.` |
| Terlalu padat | `Increase the padding inside cards to 24px and the gap between cards to 20px. Give the page more breathing room.` |

---

## 10. Checklist QA Visual

Jalankan sebelum menyimpan hasil ke `docs/img/`:

- [ ] Sumber cahaya **selalu** kiri-atas. Tidak ada satu pun bayangan yang terbalik arah.
- [ ] Tidak ada teks di bawah rasio 4,5:1. Ukur ulang kalau Stitch mengubah warna.
- [ ] Menu sidebar aktif punya **tiga** penanda: latar, bobot teks, batang indikator.
- [ ] Semua kolom angka rata kanan dan lebar digitnya seragam.
- [ ] Tidak ada baris tiga kartu seragam di halaman mana pun.
- [ ] Tidak ada emoji, gradasi, *glow*, warna ungu, atau font serif.
- [ ] `Rp` selalu diikuti spasi, pemisah ribuan pakai titik, tanpa desimal.
- [ ] Badge status berbentuk pil + ikon; tombol aksi berbentuk persegi-membulat. Tidak tertukar.
- [ ] Tabel duduk di permukaan putih, bukan permukaan neumorphic.
- [ ] Nama orang dan angka terasa nyata, bukan *placeholder*.
- [ ] Layar 1280px tidak menghasilkan *horizontal scroll*.
- [ ] Setiap layar berbasis data punya rancangan state *loading*, *empty*, dan *error*.

---

## 11. Sinkronisasi dengan `PERANCANGAN.md`

Dokumen ini **menggantikan** Bagian 6 (Design System) pada `PERANCANGAN.md`. Supaya kedua berkas tidak saling bertentangan saat dinilai, lakukan penyesuaian berikut:

| Lokasi di `PERANCANGAN.md` | Perubahan yang diperlukan |
| :-- | :-- |
| Tabel identitas, baris "Tema Visual" | Ubah jadi **Neumorphism — Teal Soft UI** |
| §6.2 Color Palette | Ganti seluruh tabel warna dengan Bagian 3 dokumen ini |
| §6.3 Typography | Ganti Poppins/Inter dengan Outfit / Plus Jakarta Sans / JetBrains Mono (Bagian 4) |
| §6.4 Spacing & Radius | Perbarui sesuai Bagian 5 (radius naik: input 14, card 24, modal 28) |
| §6.5 Resep Bayangan | Ganti dengan tabel bayangan bertinta teal di §6.1 |
| §6.7 Adaptasi Neumorphism | Tambahkan poin keempat: **sidebar teal pekat** sebagai solusi penanda menu aktif |
| §5.2 diagram Mermaid | Ganti `fill:#E0E5EC,stroke:#A3B1C6` jadi `fill:#E4EDEA,stroke:#A8BEB8` |
| §7 dan §8 | Tempel link project Stitch dan Figma setelah generate selesai |

> **Catatan untuk laporan:** perpindahan palet dari biru-abu ke teal bukan keputusan estetis semata. Basis `#E0E5EC` yang lama netral sepenuhnya, sehingga warna aksen apa pun terasa menempel dari luar. Basis `#E4EDEA` sudah membawa sedikit teal, jadi tombol dan sidebar teal terbaca sebagai bagian dari sistem yang sama, bukan tempelan. Perbedaan ini kecil di atas kertas tapi sangat terasa di layar — dan itulah yang membedakan tampilan "rapi" dari tampilan "dirancang".
