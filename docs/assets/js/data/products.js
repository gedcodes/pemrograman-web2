/**
 * Data awal PRODUK (ER-D PERANCANGAN.md §3). Disalin ke localStorage saat
 * pertama dipakai; setelah itu perubahan CRUD dan penjualan kasir
 * tersimpan di sana (lihat core/db.js).
 *
 * gambar: path relatif terhadap assets/img/, data URL hasil unggahan, atau null.
 */

const product = (id, barcode, nama, kategori, satuan, supplier, harga_beli, harga_jual, stok, stok_minimum, gambar = null) => ({
  id,
  barcode,
  nama,
  kategori,
  satuan,
  supplier,
  harga_beli,
  harga_jual,
  stok,
  stok_minimum,
  gambar,
  aktif: true,
  backorder: false,
});

export const PRODUCT_SEED = [
  product('PRD-001', '8998866200196', 'Indomie Goreng Rendang 85g', 'KAT-001', 'SAT-001', 'SUP-001', 2850, 3500, 184, 40, 'products/indomie-goreng-rendang-85g.webp'),
  product('PRD-002', '8992753211102', 'Aqua Botol 600ml', 'KAT-002', 'SAT-002', 'SUP-002', 3100, 4000, 96, 24, 'products/aqua-botol-600ml.webp'),
  product('PRD-003', '8997009511032', 'Teh Pucuk Harum 350ml', 'KAT-002', 'SAT-002', 'SUP-005', 4600, 5500, 142, 30, 'products/teh-pucuk-harum-350ml.webp'),
  product('PRD-004', '8993175102043', 'Beras Pandan Wangi 5kg', 'KAT-003', 'SAT-005', 'SUP-003', 68400, 78000, 3, 10, 'products/beras-pandan-wangi-5kg.webp'),
  product('PRD-005', '8992314552019', 'Minyak Bimoli 1L', 'KAT-003', 'SAT-004', 'SUP-001', 16900, 19500, 5, 15, 'products/minyak-bimoli-1l.webp'),
  product('PRD-006', '8991002341094', 'Gula Pasir Gulaku 1kg', 'KAT-003', 'SAT-001', 'SUP-006', 15200, 17800, 0, 20, 'products/gula-pasir-gulaku-1kg.webp'),
  product('PRD-007', '8991001120034', 'Kopi Kapal Api 165g', 'KAT-002', 'SAT-001', 'SUP-006', 10100, 12300, 67, 15, 'products/kopi-kapal-api-165g.webp'),
  product('PRD-008', '8999999014522', 'Sabun Lifebuoy 250ml', 'KAT-004', 'SAT-002', 'SUP-004', 18300, 21400, 41, 12, 'products/sabun-lifebuoy-250ml.webp'),
  product('PRD-009', '2000140000259', 'Kopi Bubuk Robusta Sari Amerta 250g', 'KAT-002', 'SAT-001', 'SUP-003', 29500, 38500, 22, 8, 'products/kopi-robusta-sari-amerta-250g.webp'),
  product('PRD-010', '8998866200318', 'Indomie Kuah Ayam Bawang 69g', 'KAT-001', 'SAT-001', 'SUP-001', 2700, 3300, 150, 40),
  product('PRD-011', '8998866601610', 'Pop Mie Ayam Pedas 75g', 'KAT-001', 'SAT-007', 'SUP-001', 4200, 5200, 48, 12),
  product('PRD-012', '8998866602877', 'Chiki Balls Keju 55g', 'KAT-001', 'SAT-003', 'SUP-001', 4500, 5500, 60, 15),
  product('PRD-013', '8996001301142', 'Roma Kelapa 300g', 'KAT-001', 'SAT-003', 'SUP-005', 9800, 11500, 34, 10),
  product('PRD-014', '2000140000105', 'Telur Ayam Negeri', 'KAT-003', 'SAT-006', 'SUP-006', 26500, 29800, 18, 10),
  product('PRD-015', '8998866601276', 'Tepung Terigu Segitiga Biru 1kg', 'KAT-003', 'SAT-001', 'SUP-001', 11800, 13900, 26, 10),
  product('PRD-016', '8996001600146', 'Le Minerale 600ml', 'KAT-002', 'SAT-002', 'SUP-005', 2900, 3800, 88, 24),
  product('PRD-017', '8998009010231', 'Ultra Milk Cokelat 250ml', 'KAT-002', 'SAT-001', 'SUP-006', 5300, 6500, 7, 12),
  product('PRD-018', '8999999036227', 'Rinso Anti Noda 770g', 'KAT-004', 'SAT-003', 'SUP-004', 21900, 25500, 15, 6),
  product('PRD-019', '8999999049326', 'Sunlight Jeruk Nipis 755ml', 'KAT-004', 'SAT-004', 'SUP-004', 14200, 16800, 6, 8),
  product('PRD-020', '8999999707974', 'Pepsodent Pencegah Gigi Berlubang 190g', 'KAT-004', 'SAT-001', 'SUP-004', 11400, 13500, 28, 8),
  product('PRD-021', '8992727002035', 'So Klin Pewangi 900ml', 'KAT-004', 'SAT-004', 'SUP-007', 12600, 14900, 0, 6),
  product('PRD-022', '8998989110129', 'Gudang Garam Surya 12', 'KAT-005', 'SAT-003', 'SUP-008', 26800, 29000, 45, 20),
  product('PRD-023', '8999909096004', 'Sampoerna Mild 16', 'KAT-005', 'SAT-003', 'SUP-008', 30200, 32500, 38, 20),
  product('PRD-024', '8993188110015', 'Djarum Super 12', 'KAT-005', 'SAT-003', 'SUP-008', 22400, 24500, 4, 10),
];
