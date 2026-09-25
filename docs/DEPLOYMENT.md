# Panduan Deployment & Go-Live Midtrans

Dokumen ini berisi langkah yang **harus dikerjakan manusia** — hal-hal yang menuntut akun, kredensial, atau akses server, sehingga tidak dapat diselesaikan dari dalam repositori.

---

## 1. Mengaktifkan Pembayaran Non-Tunai (Sandbox)

Tanpa langkah ini, tombol *Non-Tunai* akan menjawab `503` dengan pesan bahwa kredensial belum diisi. Seluruh fitur lain tetap berjalan normal.

### 1.1 Ambil kredensial

1. Daftar di <https://dashboard.sandbox.midtrans.com/register> (gratis, tidak perlu verifikasi bisnis).
2. Buka **Settings → Access Keys**.
3. Salin **Merchant ID**, **Client Key**, dan **Server Key**.

### 1.2 Isi `application/.env`

```dotenv
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxxxxxx
MIDTRANS_MERCHANT_ID=Gxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
```

Lalu bersihkan cache konfigurasi:

```powershell
php artisan config:clear
```

> **Jangan pernah meng-commit nilai ini.** `application/.env` sudah masuk `.gitignore`; yang ter-commit hanya `.env.example` yang nilainya sengaja kosong.

### 1.3 Ekspos `localhost` agar webhook dapat masuk

Midtrans memanggil server dari internet, sehingga `127.0.0.1` tidak terjangkau. Jalankan terowongan:

```powershell
ngrok http 8000
```

Salin URL `https://` yang muncul, misalnya `https://abc123.ngrok-free.app`.

### 1.4 Daftarkan URL webhook

Di dashboard Sandbox, buka **Settings → Configuration → Payment Notification URL**, lalu isi:

```
https://abc123.ngrok-free.app/api/midtrans/notification
```

Simpan. Midtrans akan mengirim notifikasi ke alamat itu setiap kali status pembayaran berubah.

### 1.5 Uji dengan kartu simulasi

Kartu uji resmi ada di <https://docs.midtrans.com/docs/testing-payment-on-sandbox>. Yang paling perlu dicoba:

| Skenario | Kartu | Hasil yang diharapkan |
| :-- | :-- | :-- |
| Berhasil | `4811 1111 1111 1114` | Status jadi `settlement`, stok berkurang, struk tercetak |
| Ditolak | `4911 1111 1111 1113` | Status jadi `deny`, stok **tidak** berubah |
| Perlu ditinjau | `4411 1111 1111 1118` | Status tetap `pending`, stok **tidak** berubah |

QRIS dan Virtual Account diuji lewat **Simulator** di dashboard Sandbox.

**Yang wajib diperiksa setiap kali:**

- Stok hanya berkurang ketika status benar-benar `settlement`.
- Tabel `payment_logs` bertambah satu baris per perubahan status, tanpa duplikat.
- Mengirim ulang notifikasi yang sama dari dashboard **tidak** mengurangi stok dua kali.

---

## 2. Naik ke Production

Perpindahan ini **tidak menyentuh satu baris kode pun**. Seluruh kredensial dibaca dari `.env`, dan seluruh pemanggilan SDK terkurung di `App\Services\MidtransService`.

### 2.1 Prasyarat

- Akun Midtrans Production yang sudah lolos verifikasi bisnis.
- Domain dengan **HTTPS aktif** — Midtrans menolak mengirim webhook ke alamat non-HTTPS.

### 2.2 Ganti kredensial

| Variabel | Sandbox | Production |
| :-- | :-- | :-- |
| `MIDTRANS_IS_PRODUCTION` | `false` | `true` |
| `MIDTRANS_SERVER_KEY` | `SB-Mid-server-…` | `Mid-server-…` |
| `MIDTRANS_CLIENT_KEY` | `SB-Mid-client-…` | `Mid-client-…` |
| `MIDTRANS_MERCHANT_ID` | dari dashboard sandbox | dari dashboard production |

Flag `MIDTRANS_IS_PRODUCTION` juga menentukan alamat `snap.js` yang dimuat browser, sehingga cukup satu tempat yang diubah.

### 2.3 Daftarkan ulang URL webhook

Dashboard **Production** memiliki konfigurasi terpisah dari Sandbox. Isi kembali Payment Notification URL dengan domain production:

```
https://domain-anda.com/api/midtrans/notification
```

### 2.4 Daftar periksa sebelum melayani uang sungguhan

- [ ] HTTPS aktif dan sertifikatnya sah
- [ ] `MIDTRANS_IS_PRODUCTION=true`
- [ ] URL webhook production terdaftar dan sudah diuji
- [ ] `APP_DEBUG=false` di server
- [ ] `.env` tidak pernah ter-commit (`git log --all -- application/.env` harus kosong)
- [ ] Satu transaksi kecil sungguhan diuji lalu direfund

---

## 3. Deployment Aplikasi

```bash
git pull
cd application
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan storage:link
npm ci
npm run build
php artisan config:cache
php artisan route:cache
```

### Yang perlu disiapkan di server

| Hal | Keterangan |
| :-- | :-- |
| PHP | 8.3 atau lebih baru |
| Database | MySQL 8.x; buat schema lalu isi `DB_*` di `.env` |
| `APP_KEY` | `php artisan key:generate` bila belum ada |
| Hak tulis | `storage/` dan `bootstrap/cache/` |
| `php artisan storage:link` | **Wajib sekali saja.** Logo toko disimpan di `storage/app/public/toko` dan disajikan lewat `/storage/...`. Tanpa tautan ini logo gagal dimuat, dan aplikasi menampilkan inisial toko sebagai gantinya |
| `SANCTUM_STATEFUL_DOMAINS` | **Wajib memuat domain frontend.** Bila tidak, seluruh panggilan API dari SPA akan dijawab `401` meskipun login berhasil |

> Jebakan `SANCTUM_STATEFUL_DOMAINS` ini sudah pernah terjadi saat pengembangan: server di port 8125 menolak seluruh permintaan karena daftarnya hanya memuat port 8000.

---

## 4. Akun Contoh (hasil seeder)

Kata sandi seluruhnya `password`. **Ganti atau hapus sebelum dipakai sungguhan.**

| Email | Peran |
| :-- | :-- |
| `surya.owner@sariamerta.test` | admin |
| `luh.ratna@sariamerta.test` | admin |
| `kadek.ayu@sariamerta.test` | kasir |
| `made.dwi@sariamerta.test` | kasir |
| `sari.kasir@sariamerta.test` | kasir (nonaktif) |
