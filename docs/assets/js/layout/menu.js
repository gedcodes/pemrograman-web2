/**
 * Satu-satunya definisi menu sidebar (PERANCANGAN.md §2) beserta hak akses
 * per peran (§2.2). Nama berkas halaman = pages/<id>.html.
 *
 * roles      peran yang boleh membuka menu
 * kasirNote  batasan tambahan untuk kasir (ditampilkan di matriks hak akses)
 * ready      false → halaman belum dibangun; klik menampilkan toast "segera hadir"
 */

const ALL = ['admin', 'kasir'];
const ADMIN = ['admin'];

export const MENU = [
  {
    label: 'Utama',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ALL, kasirNote: 'Versi ringkas', ready: true },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { id: 'kasir', label: 'Kasir (POS)', icon: 'point_of_sale', roles: ALL, ready: true },
      { id: 'riwayat-transaksi', label: 'Riwayat Transaksi', icon: 'receipt_long', roles: ALL, kasirNote: 'Transaksi sendiri', ready: true },
      { id: 'retur-penjualan', label: 'Retur Penjualan', icon: 'assignment_return', roles: ALL, kasirNote: 'Perlu approval', ready: true },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { id: 'produk', label: 'Produk', icon: 'inventory_2', roles: ADMIN, ready: true },
      { id: 'kategori-produk', label: 'Kategori Produk', icon: 'sell', roles: ADMIN, ready: true },
      { id: 'satuan', label: 'Satuan', icon: 'straighten', roles: ADMIN, ready: true },
      { id: 'supplier', label: 'Supplier', icon: 'local_shipping', roles: ADMIN, ready: true },
      { id: 'pelanggan', label: 'Pelanggan', icon: 'group', roles: ADMIN, ready: true },
    ],
  },
  {
    label: 'Inventori',
    items: [
      { id: 'stok-barang', label: 'Stok Barang', icon: 'layers', roles: ALL, kasirNote: 'Lihat saja', ready: true },
      { id: 'barang-masuk', label: 'Barang Masuk', icon: 'move_to_inbox', roles: ALL, kasirNote: 'Lihat saja', ready: true },
      { id: 'stok-opname', label: 'Stok Opname', icon: 'fact_check', roles: ALL, kasirNote: 'Lihat saja', ready: true },
    ],
  },
  {
    label: 'Laporan',
    items: [
      { id: 'laporan-penjualan', label: 'Laporan Penjualan', icon: 'bar_chart', roles: ADMIN, ready: true },
      { id: 'laporan-laba-rugi', label: 'Laporan Laba Rugi', icon: 'trending_up', roles: ADMIN, ready: true },
      { id: 'laporan-stok', label: 'Laporan Stok', icon: 'pie_chart', roles: ADMIN, ready: true },
      { id: 'cetak-struk', label: 'Cetak Ulang Struk', icon: 'print', roles: ADMIN, ready: true },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { id: 'pengguna-akses', label: 'Pengguna & Hak Akses', icon: 'admin_panel_settings', roles: ADMIN, ready: true },
      { id: 'profil-toko', label: 'Profil Toko', icon: 'storefront', roles: ADMIN, ready: true },
      { id: 'metode-pembayaran', label: 'Metode Pembayaran', icon: 'credit_card', roles: ADMIN, ready: true },
      { id: 'pajak-diskon', label: 'Pajak & Diskon', icon: 'percent', roles: ADMIN, ready: true },
    ],
  },
];

export function findMenuItem(id) {
  return MENU.flatMap((group) => group.items).find((item) => item.id === id) ?? null;
}

/** Menu yang boleh dilihat oleh peran tertentu; grup kosong dibuang. */
export function getMenuForRole(role) {
  return MENU.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
