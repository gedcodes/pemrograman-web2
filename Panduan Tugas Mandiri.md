# Panduan Tugas Mandiri: Pengembangan Front-End Admin Panel Sistem Informasi

> **Mata Kuliah:** Pemrograman Web 2 (Client-Side Programming)
> **Bobot Tugas:** Tugas Ke-1 (Project-Based Learning)

**Target Utama:** Mahasiswa mampu merancang dan mengimplementasikan antarmuka (*user interface*) Halaman Admin Panel yang responsif, interaktif, dan informatif menggunakan teknologi Client-Side (HTML5, CSS3, dan JavaScript/Framework CSS).

---

## 📋 Deskripsi Tugas

Anda diminta untuk membangun sebuah **Admin Panel (Back-Office)** untuk satu sistem informasi spesifik.

Pada tugas ini yang berfokus pada *Client-Side Programming*, fokus utama adalah pada:

- Arsitektur informasi
- Kejelasan navigasi
- Estetika desain (UI)
- Pengalaman pengguna (UX)

Tanpa perlu menghubungkannya ke database server (**no back-end / mock data only**), atau data bisa disimpan di dalam **Google Spreadsheet**.

---

## 🎨 Ketentuan Tema Visual & Arsitektur UI

Untuk memastikan Admin Panel yang dibangun tidak hanya fungsional tetapi juga modern, adaptif, dan memiliki standar industri, setiap orang **wajib menerapkan salah satu** ketentuan estetika dan arsitektur UI berikut:
1. Neumorphism

### Referensi & Tools

- **Inspirasi desain:** lihat contoh desain dari berbagai sumber website, misalnya [Dribbble](https://dribbble.com/).
- **Tools desain yang disarankan:** Stitch by Google, Figma, dan Antigravity by Google sebagai code editor-nya.
- Cara penggunaan dapat dilihat pada video YouTube (video penggunaan Stitch).

---

## 📂 Pilihan Topik Sistem Informasi

Setiap mahasiswa **wajib memilih topik berdasarkan urutan presensi 1–10**, dan berulang untuk urutan ke-11 dan seterusnya:
1. Sistem Point of Sales (POS / Kasir Toko)

---

## 🛠️ Tahapan Pelaksanaan Tugas (Milestone)

Tugas ini dibagi menjadi **3 tahapan (Milestone)** yang wajib dikumpulkan secara berkala.

### Milestone 1 (Pekan Ke-3): Perencanaan Menu (.md) & UI Wireframing (Stitch / Figma)

Sebelum masuk ke tahap coding, Anda harus merencanakan struktur aplikasi secara tekstual dan visual (*Low-to-Mid Fidelity*).

**Dokumentasi (.md)**
Membuat daftar hirarki menu (Sidebar/Navbar) dan konsep ER-D sederhana menggunakan sintaks **Mermaid.js** di dalam file `PERANCANGAN.md`.

**UI Wireframing & Prototyping**

- **Stitch Google** (atau tools HTML/CSS wireframing sejenis) — untuk merancang tata letak komponen secara cepat, menyusun skema komponen polimorfik, atau memetakan *User Flow* antarmuka admin.
- **Figma** — untuk menyusun *Design System* awal (Color Palettes, Typography Styles, dan komponen reusable seperti Button, Form Input, dan Card) serta membuat *High-Fidelity UI Design* untuk halaman Dashboard dan Data Master.

**Output:**
File `PERANCANGAN.md` yang di dalamnya **wajib menyertakan**:
- Link publik ke project Figma
- Embed link / screenshot hasil rancangan dari Stitch atau Figma

---

### Milestone 2 (Pekan Ke-5): Slicing & Layouting (Mengubah Desain Figma ke HTML/CSS)

Pada tahap ini, mahasiswa mulai menerjemahkan rancangan visual yang sudah matang di Figma dan Stitch ke dalam kode Client-Side nyata.

- **Figma-to-Code:** Lakukan slicing elemen visual dari Figma (kode warna HEX, ukuran font, padding/margin, dan aset gambar/icon) ke dalam struktur HTML5 dan CSS3 (atau Tailwind CSS).
- **Layouting:** Membuat struktur layouting dasar Admin Panel (Sidebar, Header, Content Area, Footer) yang responsif berdasarkan grid/flexbox yang telah disimulasikan di Figma.

**Output:** Halaman Master/Template dasar (`layout.html`).

---

### Milestone 3 (Pekan Ke-7): Implementasi Komponen & Interaktivitas UI (JavaScript & Slicing)

Tahap akhir berupa pembuatan halaman-halaman spesifik berdasarkan topik yang dipilih.

**Pembuatan Halaman Spesifik — minimal 4 halaman:**

1. **Dashboard** — menampilkan ringkasan data (menggunakan cards, grafik/chart dengan library client-side seperti Chart.js).
2. **Halaman Data Tabel (Master)** — menampilkan data dalam bentuk tabel, lengkap dengan tombol aksi (Tambah, Edit, Hapus).
3. **Halaman Form (Input/Edit)** — form interaktif untuk manipulasi data dengan validasi input menggunakan JavaScript.
4. **Halaman Laporan/Detail** — halaman cetak atau rangkuman aktivitas sistem.

**Interaktivitas Client-Side:**
Menggunakan JavaScript untuk memanipulasi DOM, misalnya: toggle sidebar, memunculkan modal konfirmasi hapus, validasi form, atau manipulasi mock data di dalam tabel.

**Output:** Source code lengkap (HTML, CSS, JS) dan di-upload di **Vercel** atau **GitHub**, siap didemonstrasikan.

---

## 📝 Format Pengumpulan Tugas

**Repository Git:** Tugas dikumpulkan dengan cara mengunggah kode ke GitHub/GitLab masing-masing. Link repositori dikirimkan melalui **LMS Mentari**.

**Struktur Folder Proyek:** Proyek harus diorganisasi dengan rapi, contoh:

```text
├── docs/
│   └── perancangan.md      <-- Tugas Milestone 1
├── assets/
│   ├── css/
│   ├── js/
│   └── img/
├── pages/
│   ├── dashboard.html
│   ├── data-master.html
│   └── form.html / dll
└── index.html              <-- Halaman Utama/Login Admin
```

---

## 📊 Kriteria Penilaian

| No | Komponen Penilaian | Bobot | Indikator |
| :--: | :-- | :--: | :-- |
| 1 | Milestone 1 (Dokumentasi .md) | 20% | Kelengkapan struktur menu di `.md`, kejelasan User Flow/Wireframe di Stitch Google, serta kerapian Design System (warna, komponen, tipografi) yang dibuat di Figma. |
| 2 | Kualitas Kode HTML & CSS | 30% | Penggunaan tag semantik HTML5, kerapian struktur class CSS, kebersihan kode, dan responsivitas layout (*mobile-friendly*). |
| 3 | Interaktivitas JavaScript | 20% | Berfungsinya komponen interaktif (modal, sidebar toggle, validasi input, grafik chart). |
| 4 | Kesesuaian UI & UX Topik | 20% | Desain antarmuka sesuai karakteristik sistem yang dipilih (contoh: POS harus memiliki UI yang cepat untuk kasir, Dashboard Finance harus kaya akan grafik). |
| 5 | Presentasi | 10% | Kemampuan menjelaskan project saat demo. |

---

> **Selamat Mengerjakan!**
> Gunakan kreativitas Anda untuk membangun antarmuka aplikasi yang profesional dan nyaman digunakan.
