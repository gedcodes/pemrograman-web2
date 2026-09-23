<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { adalahAdmin, auth, keluar } from '../stores/auth';
import { toast } from '../stores/toast';
import ToastHost from '../components/ToastHost.vue';

const route = useRoute();
const router = useRouter();

/** Drawer di bawah 1024px; tertutup secara bawaan. */
const drawerTerbuka = ref(false);

interface ItemMenu {
    nama: string;
    label: string;
    ikon: string;
    admin?: boolean;
}

interface GrupMenu {
    label: string;
    item: ItemMenu[];
}

const menu: GrupMenu[] = [
    {
        label: '',
        item: [{ nama: 'dashboard', label: 'Dashboard', ikon: '▦' }],
    },
    {
        label: 'Transaksi',
        item: [
            { nama: 'kasir', label: 'Kasir', ikon: '🛒' },
            {
                nama: 'riwayat-transaksi',
                label: 'Riwayat Transaksi',
                ikon: '🧾',
            },
            { nama: 'retur-penjualan', label: 'Retur Penjualan', ikon: '↩' },
        ],
    },
    {
        label: 'Master Data',
        item: [
            { nama: 'produk', label: 'Produk', ikon: '📦' },
            {
                nama: 'kategori-produk',
                label: 'Kategori',
                ikon: '🏷',
                admin: true,
            },
            { nama: 'satuan', label: 'Satuan', ikon: '⚖', admin: true },
            { nama: 'supplier', label: 'Supplier', ikon: '🚚', admin: true },
            { nama: 'pelanggan', label: 'Pelanggan', ikon: '👤', admin: true },
        ],
    },
    {
        label: 'Inventori',
        item: [
            { nama: 'stok-barang', label: 'Stok Barang', ikon: '🏬' },
            { nama: 'barang-masuk', label: 'Barang Masuk', ikon: '⬇' },
            { nama: 'stok-opname', label: 'Stok Opname', ikon: '📋' },
        ],
    },
    {
        label: 'Laporan',
        item: [
            {
                nama: 'laporan-penjualan',
                label: 'Penjualan',
                ikon: '📈',
                admin: true,
            },
            {
                nama: 'laporan-laba-rugi',
                label: 'Laba Rugi',
                ikon: '💰',
                admin: true,
            },
            { nama: 'laporan-stok', label: 'Stok', ikon: '📊', admin: true },
        ],
    },
    {
        label: 'Pengaturan',
        item: [
            {
                nama: 'pengguna-akses',
                label: 'Pengguna & Akses',
                ikon: '🔑',
                admin: true,
            },
            {
                nama: 'beban-operasional',
                label: 'Beban Operasional',
                ikon: '📉',
                admin: true,
            },
            {
                nama: 'metode-pembayaran',
                label: 'Metode Pembayaran',
                ikon: '💳',
                admin: true,
            },
        ],
    },
];

/** Menu disaring sesuai peran, sejalan dengan penjaga router dan middleware server. */
const menuTampil = computed(() =>
    menu
        .map((g) => ({
            ...g,
            item: g.item.filter((i) => !i.admin || adalahAdmin.value),
        }))
        .filter((g) => g.item.length > 0),
);

const judul = computed(() =>
    typeof route.meta.judul === 'string' ? route.meta.judul : '',
);
const grup = computed(() =>
    typeof route.meta.grup === 'string' ? route.meta.grup : '',
);
const lebarPenuh = computed(() => route.meta.lebar === true);

watch(
    () => route.fullPath,
    () => {
        drawerTerbuka.value = false;
    },
);

async function padaKeluar() {
    await keluar();
    toast.info('Anda telah keluar.');
    await router.push({ name: 'login' });
}
</script>

<template>
    <div class="shell">
        <!-- Latar gelap drawer, hanya muncul di layar sempit. -->
        <div
            v-if="drawerTerbuka"
            class="backdrop no-print"
            @click="drawerTerbuka = false"
        />

        <aside class="sidebar no-print" :class="{ 'is-open': drawerTerbuka }">
            <div class="brand">
                <span class="brand-mark">SA</span>
                <span class="brand-teks">
                    <strong>Sari Amerta</strong>
                    <small>Point of Sales</small>
                </span>
            </div>

            <nav class="nav">
                <template v-for="(g, gi) in menuTampil" :key="gi">
                    <p v-if="g.label" class="nav-grup">{{ g.label }}</p>
                    <RouterLink
                        v-for="i in g.item"
                        :key="i.nama"
                        :to="{ name: i.nama }"
                        class="nav-item"
                        active-class="is-active"
                    >
                        <span class="nav-ikon" aria-hidden="true">{{
                            i.ikon
                        }}</span>
                        <span class="nav-label">{{ i.label }}</span>
                    </RouterLink>
                </template>
            </nav>

            <div class="sidebar-kaki">
                <div class="pengguna">
                    <span class="nav-label">
                        <strong>{{ auth.user?.name }}</strong>
                        <small>{{
                            auth.user?.peran === 'admin'
                                ? 'Admin / Pemilik'
                                : 'Kasir'
                        }}</small>
                    </span>
                </div>
                <button class="keluar" @click="padaKeluar">
                    <span aria-hidden="true">⎋</span>
                    <span class="nav-label">Keluar</span>
                </button>
            </div>
        </aside>

        <div class="utama">
            <header class="topbar no-print">
                <button
                    class="btn btn-ghost btn-sm hanya-sempit"
                    aria-label="Buka menu"
                    @click="drawerTerbuka = true"
                >
                    ☰
                </button>
                <div>
                    <p v-if="grup" class="overline">{{ grup }}</p>
                    <h1 class="topbar-judul">{{ judul }}</h1>
                </div>
            </header>

            <main class="konten" :class="{ 'konten-lebar': lebarPenuh }">
                <RouterView />
            </main>
        </div>

        <ToastHost />
    </div>
</template>

<style scoped>
.shell {
    display: flex;
    min-height: 100dvh;
}

/* ---------------------------------------------------------------- sidebar */

/* Sidebar teal pekat, bukan permukaan neumorphic. Ini menyelesaikan masalah
   tersulit neumorphism: menandai menu aktif tanpa bergantung pada bayangan
   (DESIGN.md Bagian 6.7 poin 4). */
.sidebar {
    position: sticky;
    top: 0;
    z-index: var(--z-sidebar);
    display: flex;
    flex-direction: column;
    width: var(--sidebar-w);
    flex: 0 0 var(--sidebar-w);
    height: 100dvh;
    background: var(--sidebar-bg);
    color: var(--sidebar-idle);
    box-shadow: var(--shadow-sidebar);
    transition: width var(--dur-base) var(--ease);
}

.brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-5);
}

.brand-mark {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: var(--radius-sm);
    background: var(--teal-700);
    color: #fff;
    font: var(--text-h3);
}

.brand-teks,
.pengguna .nav-label {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
}

.brand-teks strong,
.pengguna strong {
    color: var(--sidebar-active);
    font: var(--text-body-strong);
}

.brand-teks small,
.pengguna small {
    color: var(--sidebar-label);
    font: var(--text-caption);
}

.nav {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--space-3) var(--space-4);
}

.nav-grup {
    font: var(--text-overline);
    letter-spacing: var(--tracking-overline);
    text-transform: uppercase;
    color: var(--sidebar-label);
    padding: var(--space-4) var(--space-3) var(--space-2);
}

.nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    margin-bottom: 2px;
    border-radius: var(--radius-sm);
    color: var(--sidebar-idle);
    font: var(--text-small);
    transition: background-color var(--dur-base) var(--ease);
}

.nav-item:hover {
    background: var(--sidebar-hover-bg);
    color: var(--sidebar-active);
}

/* Penanda aktif: teks putih + batang indikator, bukan sekadar bayangan. */
.nav-item.is-active {
    background: var(--sidebar-active-bg);
    color: var(--sidebar-active);
    font: var(--text-label);
}

.nav-item.is-active::before {
    content: '';
    position: absolute;
    left: -4px;
    top: 20%;
    height: 60%;
    width: 3px;
    border-radius: var(--radius-pill);
    background: var(--sidebar-indicator);
}

.nav-ikon {
    width: 24px;
    flex: 0 0 24px;
    text-align: center;
    font-size: 1rem;
}

.sidebar-kaki {
    padding: var(--space-4);
    background: var(--sidebar-footer-bg);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.keluar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3);
    background: none;
    border: 0;
    border-radius: var(--radius-sm);
    color: var(--sidebar-idle);
    font: var(--text-small);
    cursor: pointer;
}

.keluar:hover {
    background: var(--sidebar-hover-bg);
    color: var(--sidebar-danger);
}

/* ---------------------------------------------------------------- utama */

.utama {
    flex: 1;
    min-width: 0; /* tanpa ini, tabel lebar memaksa seluruh halaman menggulung */
    display: flex;
    flex-direction: column;
}

.topbar {
    position: sticky;
    top: 0;
    z-index: var(--z-topbar);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-height: var(--topbar-h);
    padding: 0 var(--page-pad);
    background: var(--surface-canvas);
    border-bottom: 1px solid var(--divider);
}

.topbar-judul {
    font: var(--text-h2);
    letter-spacing: var(--tracking-h2);
}

.konten {
    flex: 1;
    padding: var(--page-pad);
    max-width: var(--content-max);
    width: 100%;
    margin-inline: auto;
}

/* Halaman Kasir memakai lebar penuh: dua zona tanpa batas 1440px. */
.konten-lebar {
    max-width: none;
}

.hanya-sempit {
    display: none;
}

.backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-backdrop);
    background: rgba(11, 43, 39, 0.45);
}

/* ---------------------------------------------------------------- responsif */

/* 1024-1279px: sidebar menyusut jadi rail ikon 72px. */
@media (max-width: 1279px) and (min-width: 1024px) {
    .sidebar {
        width: var(--sidebar-w-rail);
        flex-basis: var(--sidebar-w-rail);
    }

    .nav-label,
    .brand-teks,
    .nav-grup {
        display: none;
    }

    .nav-item,
    .keluar {
        justify-content: center;
    }
}

/* Di bawah 1024px: sidebar menjadi drawer. */
@media (max-width: 1023px) {
    .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        transform: translateX(-100%);
        transition: transform var(--dur-slow) var(--ease);
    }

    .sidebar.is-open {
        transform: translateX(0);
    }

    .hanya-sempit {
        display: inline-flex;
    }
}
</style>
