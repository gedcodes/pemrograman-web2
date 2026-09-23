import {
    createRouter,
    createWebHistory,
    type RouteRecordRaw,
} from 'vue-router';
import { auth, muatSesi } from '../stores/auth';

/**
 * Peta rute SPA.
 *
 * `meta.admin` menandai halaman yang hanya untuk admin (PERANCANGAN Bagian 2.2).
 * Penjaga di bawah hanya MENYEMBUNYIKAN halaman; penegakan sebenarnya ada di
 * middleware `role` pada server. Kasir yang memanggil endpoint admin langsung
 * tetap ditolak 403 walau berhasil menipu router.
 */
const routes: RouteRecordRaw[] = [
    {
        path: '/login',
        name: 'login',
        component: () => import('../views/LoginView.vue'),
        meta: { tamu: true, judul: 'Masuk' },
    },
    {
        path: '/',
        component: () => import('../layouts/AppLayout.vue'),
        children: [
            {
                path: '',
                name: 'dashboard',
                component: () => import('../views/DashboardView.vue'),
                meta: { judul: 'Dashboard', grup: 'Dashboard' },
            },

            // ---- Transaksi
            {
                path: 'kasir',
                name: 'kasir',
                component: () => import('../views/KasirView.vue'),
                meta: { judul: 'Kasir', grup: 'Transaksi', lebar: true },
            },
            {
                path: 'transaksi',
                name: 'riwayat-transaksi',
                component: () => import('../views/RiwayatTransaksiView.vue'),
                meta: { judul: 'Riwayat Transaksi', grup: 'Transaksi' },
            },
            {
                path: 'retur',
                name: 'retur-penjualan',
                component: () => import('../views/ReturPenjualanView.vue'),
                meta: { judul: 'Retur Penjualan', grup: 'Transaksi' },
            },

            // ---- Master data
            {
                path: 'produk',
                name: 'produk',
                component: () => import('../views/ProdukView.vue'),
                meta: { judul: 'Produk', grup: 'Master Data' },
            },
            {
                path: 'produk/baru',
                name: 'produk-baru',
                component: () => import('../views/ProdukFormView.vue'),
                meta: {
                    judul: 'Tambah Produk',
                    grup: 'Master Data',
                    admin: true,
                },
            },
            {
                path: 'produk/:id/ubah',
                name: 'produk-ubah',
                component: () => import('../views/ProdukFormView.vue'),
                meta: {
                    judul: 'Ubah Produk',
                    grup: 'Master Data',
                    admin: true,
                },
            },
            {
                path: 'kategori',
                name: 'kategori-produk',
                component: () => import('../views/MasterSederhanaView.vue'),
                props: { jenis: 'kategori' },
                meta: {
                    judul: 'Kategori Produk',
                    grup: 'Master Data',
                    admin: true,
                },
            },
            {
                path: 'satuan',
                name: 'satuan',
                component: () => import('../views/MasterSederhanaView.vue'),
                props: { jenis: 'satuan' },
                meta: { judul: 'Satuan', grup: 'Master Data', admin: true },
            },
            {
                path: 'supplier',
                name: 'supplier',
                component: () => import('../views/MasterSederhanaView.vue'),
                props: { jenis: 'supplier' },
                meta: { judul: 'Supplier', grup: 'Master Data', admin: true },
            },
            {
                path: 'pelanggan',
                name: 'pelanggan',
                component: () => import('../views/MasterSederhanaView.vue'),
                props: { jenis: 'pelanggan' },
                meta: { judul: 'Pelanggan', grup: 'Master Data', admin: true },
            },

            // ---- Inventori
            {
                path: 'stok',
                name: 'stok-barang',
                component: () => import('../views/StokBarangView.vue'),
                meta: { judul: 'Stok Barang', grup: 'Inventori' },
            },
            {
                path: 'barang-masuk',
                name: 'barang-masuk',
                component: () => import('../views/BarangMasukView.vue'),
                meta: { judul: 'Barang Masuk', grup: 'Inventori' },
            },
            {
                path: 'stok-opname',
                name: 'stok-opname',
                component: () => import('../views/StokOpnameView.vue'),
                meta: { judul: 'Stok Opname', grup: 'Inventori' },
            },

            // ---- Laporan (admin saja)
            {
                path: 'laporan/penjualan',
                name: 'laporan-penjualan',
                component: () => import('../views/LaporanPenjualanView.vue'),
                meta: {
                    judul: 'Laporan Penjualan',
                    grup: 'Laporan',
                    admin: true,
                },
            },
            {
                path: 'laporan/laba-rugi',
                name: 'laporan-laba-rugi',
                component: () => import('../views/LaporanLabaRugiView.vue'),
                meta: {
                    judul: 'Laporan Laba Rugi',
                    grup: 'Laporan',
                    admin: true,
                },
            },
            {
                path: 'laporan/stok',
                name: 'laporan-stok',
                component: () => import('../views/LaporanStokView.vue'),
                meta: { judul: 'Laporan Stok', grup: 'Laporan', admin: true },
            },

            // ---- Pengaturan (admin saja)
            {
                path: 'pengguna',
                name: 'pengguna-akses',
                component: () => import('../views/PenggunaView.vue'),
                meta: {
                    judul: 'Pengguna & Hak Akses',
                    grup: 'Pengaturan',
                    admin: true,
                },
            },
            {
                path: 'pengaturan/beban',
                name: 'beban-operasional',
                component: () => import('../views/BebanOperasionalView.vue'),
                meta: {
                    judul: 'Beban Operasional',
                    grup: 'Pengaturan',
                    admin: true,
                },
            },
            {
                path: 'pengaturan/pembayaran',
                name: 'metode-pembayaran',
                component: () => import('../views/MetodePembayaranView.vue'),
                meta: {
                    judul: 'Metode Pembayaran',
                    grup: 'Pengaturan',
                    admin: true,
                },
            },
        ],
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'tidak-ditemukan',
        component: () => import('../views/TidakDitemukanView.vue'),
        meta: { tamu: true, judul: 'Halaman tidak ditemukan' },
    },
];

export const router = createRouter({
    // SPA disajikan di bawah /app, jadi base-nya harus disebutkan.
    history: createWebHistory('/app'),
    routes,
    scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
    // Sesi ditanyakan sekali saja saat aplikasi dinyalakan.
    if (!auth.siap) {
        await muatSesi();
    }

    const masuk = auth.user !== null;

    if (!to.meta.tamu && !masuk) {
        return { name: 'login', query: { lanjut: to.fullPath } };
    }

    if (to.name === 'login' && masuk) {
        return { name: 'dashboard' };
    }

    if (to.meta.admin && auth.user?.peran !== 'admin') {
        return { name: 'dashboard' };
    }

    return true;
});

router.afterEach((to) => {
    const judul = typeof to.meta.judul === 'string' ? to.meta.judul : 'POS';
    document.title = `${judul} · Toko Sari Amerta`;
});
