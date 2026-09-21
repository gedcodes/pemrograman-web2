/**
 * Satu-satunya definisi menu sidebar (PERANCANGAN.md §2) beserta hak akses
 * per peran (§2.2). Nama berkas halaman = pages/<id>.html.
 *
 * ready: false → halaman belum dibangun; klik menampilkan toast "segera hadir".
 * Ubah menjadi true setiap kali halaman selesai dibuat.
 */

const ALL = ['admin', 'kasir'];
const ADMIN = ['admin'];

export const MENU = [
  {
    label: 'Utama',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ALL, ready: false }],
  },
  {
    label: 'Transaksi',
    items: [
      { id: 'kasir', label: 'Kasir (POS)', icon: 'point_of_sale', roles: ALL, ready: false },
      { id: 'riwayat-transaksi', label: 'Riwayat Transaksi', icon: 'receipt_long', roles: ALL, ready: false },
      { id: 'retur-penjualan', label: 'Retur Penjualan', icon: 'assignment_return', roles: ALL, ready: false },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { id: 'produk', label: 'Produk', icon: 'inventory_2', roles: ADMIN, ready: false },
      { id: 'kategori-produk', label: 'Kategori Produk', icon: 'sell', roles: ADMIN, ready: false },
      { id: 'satuan', label: 'Satuan', icon: 'straighten', roles: ADMIN, ready: false },
      { id: 'supplier', label: 'Supplier', icon: 'local_shipping', roles: ADMIN, ready: false },
      { id: 'pelanggan', label: 'Pelanggan', icon: 'group', roles: ADMIN, ready: false },
    ],
  },
  {
    label: 'Inventori',
    items: [
      { id: 'stok-barang', label: 'Stok Barang', icon: 'layers', roles: ALL, ready: false },
      { id: 'barang-masuk', label: 'Barang Masuk', icon: 'move_to_inbox', roles: ALL, ready: false },
      { id: 'stok-opname', label: 'Stok Opname', icon: 'fact_check', roles: ALL, ready: false },
    ],
  },
  {
    label: 'Laporan',
    items: [
      { id: 'laporan-penjualan', label: 'Laporan Penjualan', icon: 'bar_chart', roles: ADMIN, ready: false },
      { id: 'laporan-laba-rugi', label: 'Laporan Laba Rugi', icon: 'trending_up', roles: ADMIN, ready: false },
      { id: 'laporan-stok', label: 'Laporan Stok', icon: 'pie_chart', roles: ADMIN, ready: false },
      { id: 'cetak-struk', label: 'Cetak Ulang Struk', icon: 'print', roles: ADMIN, ready: false },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { id: 'pengguna-akses', label: 'Pengguna & Hak Akses', icon: 'admin_panel_settings', roles: ADMIN, ready: false },
      { id: 'profil-toko', label: 'Profil Toko', icon: 'storefront', roles: ADMIN, ready: false },
      { id: 'metode-pembayaran', label: 'Metode Pembayaran', icon: 'credit_card', roles: ADMIN, ready: false },
      { id: 'pajak-diskon', label: 'Pajak & Diskon', icon: 'percent', roles: ADMIN, ready: false },
    ],
  },
];

/** Menu yang boleh dilihat oleh peran tertentu; grup kosong dibuang. */
export function getMenuForRole(role) {
  return MENU.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
