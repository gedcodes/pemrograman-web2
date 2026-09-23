/**
 * Data awal master (ER-D PERANCANGAN.md §3): KATEGORI, SATUAN, SUPPLIER, PELANGGAN.
 * Disalin ke localStorage saat pertama diubah; setelah itu dibaca dari sana
 * lewat core/db.js, sehingga halaman master bisa menambah, mengubah, dan menghapus.
 */

export const CATEGORY_SEED = [
  { id: 'KAT-001', nama: 'Makanan', deskripsi: 'Mi instan, makanan ringan, dan biskuit', aktif: true },
  { id: 'KAT-002', nama: 'Minuman', deskripsi: 'Air mineral, teh, kopi, dan susu kemasan', aktif: true },
  { id: 'KAT-003', nama: 'Sembako', deskripsi: 'Beras, minyak goreng, gula, telur, dan tepung', aktif: true },
  { id: 'KAT-004', nama: 'Kebersihan', deskripsi: 'Sabun, deterjen, pasta gigi, dan pewangi', aktif: true },
  { id: 'KAT-005', nama: 'Rokok', deskripsi: 'Rokok kretek dan filter, dijual per bungkus', aktif: true },
];

export const UNIT_SEED = [
  { id: 'SAT-001', nama: 'Pieces', singkatan: 'Pcs' },
  { id: 'SAT-002', nama: 'Botol', singkatan: 'Btl' },
  { id: 'SAT-003', nama: 'Bungkus', singkatan: 'Bks' },
  { id: 'SAT-004', nama: 'Pouch', singkatan: 'Pouch' },
  { id: 'SAT-005', nama: 'Sak / Karung', singkatan: 'Sak' },
  { id: 'SAT-006', nama: 'Kilogram', singkatan: 'Kg' },
  { id: 'SAT-007', nama: 'Cup', singkatan: 'Cup' },
];

/** pkp: Pengusaha Kena Pajak → fakturnya memuat PPN masukan. CV kecil umumnya belum PKP. */
const supplier = (id, nama, kontak_person, telepon, email, alamat, termin_hari, pkp = true) => ({
  id, nama, kontak_person, telepon, email, alamat, termin_hari, pkp, aktif: true,
});

export const SUPPLIER_SEED = [
  supplier('SUP-001', 'PT Indofood CBP Sukses Makmur Tbk', 'Hendra Wijaya', '0812-3456-7890', 'hendra.wijaya@icbp-bali.co.id', 'Jl. Bypass Ngurah Rai No. 88, Denpasar', 30),
  supplier('SUP-002', 'PT Tirta Investama (Danone Aqua)', 'Made Sudarta', '0819-8765-4321', 'made.sudarta@tirta-dist.co.id', 'Jl. Gatot Subroto Barat No. 212, Denpasar', 14),
  supplier('SUP-003', 'CV Amerta Jaya Distribusi', 'Ketut Sujana', '0878-1122-3344', 'order@amertajaya.id', 'Jl. Raya Sesetan No. 17, Denpasar', 7, false),
  supplier('SUP-004', 'PT Unilever Indonesia Distributor Bali', 'Ni Putu Riani', '0813-9988-7766', 'riani.putu@ulidist-bali.co.id', 'Jl. Cokroaminoto No. 45, Denpasar', 30),
  supplier('SUP-005', 'PT Mayora Indah Tbk', 'Agus Pratama', '0857-4433-2211', 'agus.pratama@mayora-bali.co.id', 'Jl. Imam Bonjol No. 380, Denpasar', 30),
  supplier('SUP-006', 'CV Surya Pangan Mandiri', 'Wayan Darma', '0812-6655-4433', 'suryapangan@gmail.com', 'Jl. Pulau Bungin No. 9, Denpasar', 0, false),
  supplier('SUP-007', 'PT Wings Surya Distribusi', 'Budi Santoso', '0821-3344-5566', 'budi.santoso@wings-dist.co.id', 'Jl. Mahendradatta No. 120, Denpasar', 14),
  supplier('SUP-008', 'PT Djarum Distribusi Retail', 'I Gusti Rai', '0818-7766-5544', 'gusti.rai@djarum-retail.co.id', 'Jl. Teuku Umar Barat No. 66, Denpasar', 7),
];

const customer = (id, nama, no_hp, tingkat, poin_loyalti, alamat, terdaftar) => ({
  id, nama, no_hp, tingkat, poin_loyalti, alamat, terdaftar, aktif: true,
});

export const CUSTOMER_SEED = [
  customer('CUST-001', 'Ni Made Dwi Lestari', '0819-4455-8890', 'Gold', 3510, 'Jl. Uluwatu II No. 88, Jimbaran', '2024-03-12'),
  customer('CUST-002', 'Rizky Maulana Hakim', '0857-1234-9988', 'Silver', 2140, 'Perum Puri Jimbaran Asri Blok C/7', '2024-07-02'),
  customer('CUST-003', 'Ibu Ketut Suartini', '0878-6011-2345', 'Gold', 6200, 'Jl. Bypass Ngurah Rai No. 450, Kuta', '2023-11-20'),
  customer('CUST-004', 'Putu Gede Arimbawa', '0813-2289-4411', 'Silver', 1650, 'Jl. Raya Sesetan No. 102, Denpasar', '2024-09-15'),
  customer('CUST-005', 'Komang Ayu Sintia', '0821-4477-8099', 'Reguler', 920, 'Jl. Taman Griya No. 24, Jimbaran', '2025-01-08'),
  customer('CUST-006', 'Pak Made Sukadana', '0818-0567-3321', 'Reguler', 650, 'Banjar Menega, Jimbaran', '2025-02-19'),
  customer('CUST-007', 'Amanda Christine', '0852-3901-7788', 'Reguler', 430, 'Jl. Pratama No. 36, Nusa Dua', '2025-05-27'),
  customer('CUST-008', 'Dewa Ayu Komang', '0812-7730-5164', 'Silver', 1180, 'Jl. Kampus Unud No. 5, Jimbaran', '2024-12-03'),
  customer('CUST-009', 'Ketut Budiarta', '0877-6021-4439', 'Gold', 2890, 'Jl. Goa Gong No. 71, Ungasan', '2024-04-22'),
  customer('CUST-010', 'Putu Hendra Pratama', '0896-3355-1270', 'Reguler', 360, 'Jl. Wanagiri No. 12, Jimbaran', '2025-08-30'),
];

export const CUSTOMER_TIERS = ['Reguler', 'Silver', 'Gold'];

/**
 * Beban operasional bulanan untuk Laporan Laba Rugi. Nilainya diprorata
 * sesuai panjang periode laporan. Biaya MDR dihitung dari transaksi non-tunai.
 */
export const MONTHLY_EXPENSES = [
  { id: 'gaji', nama: 'Gaji dua kasir paruh waktu', jumlah: 3_465_000 },
  { id: 'utilitas', nama: 'Listrik, air & internet kasir', jumlah: 912_400 },
  { id: 'perlengkapan', nama: 'Kertas struk, kantong belanja & ATK', jumlah: 386_700 },
  { id: 'retribusi', nama: 'Retribusi kebersihan & keamanan banjar', jumlah: 150_000 },
  { id: 'penyusutan', nama: 'Penyusutan peralatan kasir & rak', jumlah: 287_500 },
];

/** Biaya MDR QRIS/GoPay/VA per transaksi non-tunai (ketentuan Bank Indonesia 0,7%) */
export const MDR_RATE = 0.007;
