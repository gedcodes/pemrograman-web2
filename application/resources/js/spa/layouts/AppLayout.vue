<script setup lang="ts">
import {
    Boxes,
    ChevronDown,
    ChevronRight,
    FileChartColumn,
    LayoutDashboard,
    LogOut,
    Menu,
    ReceiptText,
    Settings,
    ShoppingCart,
    Warehouse,
} from '@lucide/vue';
import { computed, ref, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { adalahAdmin, auth, keluar } from '../stores/auth';
import { toast } from '../stores/toast';
import { toko } from '../stores/toko';
import MerekToko from '../components/MerekToko.vue';
import ToastHost from '../components/ToastHost.vue';

const route = useRoute();
const router = useRouter();

/** Drawer di bawah 1024px; tertutup secara bawaan. */
const drawerTerbuka = ref(false);

interface Tautan {
    nama: string;
    label: string;
    admin?: boolean;
    /** Rute turunan yang ikut menandai tautan ini aktif (mis. form produk). */
    juga?: string[];
}

interface EntriTunggal extends Tautan {
    jenis: 'tunggal';
    ikon: Component;
}

interface EntriGrup {
    jenis: 'grup';
    kunci: string;
    label: string;
    ikon: Component;
    anak: Tautan[];
}

type Entri = EntriTunggal | EntriGrup;

/*
 * Menu dikelompokkan induk-anak agar sidebar ringkas: 18 tautan menjadi
 * 7 baris saat semua grup tertutup. Dashboard dan Kasir sengaja berdiri
 * sendiri. Keduanya halaman yang paling sering dibuka, jadi harus tetap
 * sekali klik, bukan tersembunyi di dalam grup.
 */
const menu: Entri[] = [
    {
        jenis: 'tunggal',
        nama: 'dashboard',
        label: 'Dashboard',
        ikon: LayoutDashboard,
    },
    { jenis: 'tunggal', nama: 'kasir', label: 'Kasir', ikon: ShoppingCart },
    {
        jenis: 'grup',
        kunci: 'transaksi',
        label: 'Transaksi',
        ikon: ReceiptText,
        anak: [
            { nama: 'riwayat-transaksi', label: 'Riwayat Transaksi' },
            { nama: 'retur-penjualan', label: 'Retur Penjualan' },
        ],
    },
    {
        jenis: 'grup',
        kunci: 'master',
        label: 'Master Data',
        ikon: Boxes,
        anak: [
            {
                nama: 'produk',
                label: 'Produk',
                juga: ['produk-baru', 'produk-ubah'],
            },
            { nama: 'kategori-produk', label: 'Kategori', admin: true },
            { nama: 'satuan', label: 'Satuan', admin: true },
            { nama: 'supplier', label: 'Supplier', admin: true },
            { nama: 'pelanggan', label: 'Pelanggan', admin: true },
        ],
    },
    {
        jenis: 'grup',
        kunci: 'inventori',
        label: 'Inventori',
        ikon: Warehouse,
        anak: [
            { nama: 'stok-barang', label: 'Stok Barang' },
            { nama: 'barang-masuk', label: 'Barang Masuk' },
            { nama: 'stok-opname', label: 'Stok Opname' },
        ],
    },
    {
        jenis: 'grup',
        kunci: 'laporan',
        label: 'Laporan',
        ikon: FileChartColumn,
        anak: [
            { nama: 'laporan-penjualan', label: 'Penjualan', admin: true },
            { nama: 'laporan-laba-rugi', label: 'Laba Rugi', admin: true },
            { nama: 'laporan-stok', label: 'Stok', admin: true },
        ],
    },
    {
        jenis: 'grup',
        kunci: 'pengaturan',
        label: 'Pengaturan',
        ikon: Settings,
        anak: [
            {
                nama: 'pengaturan-toko',
                label: 'Pengaturan Toko',
                admin: true,
            },
            { nama: 'pengguna-akses', label: 'Pengguna & Akses', admin: true },
            {
                nama: 'beban-operasional',
                label: 'Beban Operasional',
                admin: true,
            },
            {
                nama: 'metode-pembayaran',
                label: 'Metode Pembayaran',
                admin: true,
            },
        ],
    },
];

/** Menu disaring sesuai peran, sejalan dengan penjaga router dan middleware server. */
const menuTampil = computed<Entri[]>(() =>
    menu
        .map((e) =>
            e.jenis === 'grup'
                ? {
                      ...e,
                      anak: e.anak.filter((a) => !a.admin || adalahAdmin.value),
                  }
                : e,
        )
        .filter(
            (e) =>
                (e.jenis === 'grup' && e.anak.length > 0) ||
                (e.jenis === 'tunggal' && (!e.admin || adalahAdmin.value)),
        ),
);

function aktif(t: Tautan): boolean {
    const nama = String(route.name ?? '');
    return t.nama === nama || (t.juga?.includes(nama) ?? false);
}

/** Grup yang memuat halaman yang sedang dibuka. */
const grupAktif = computed(() => {
    for (const e of menuTampil.value) {
        if (e.jenis === 'grup' && e.anak.some(aktif)) return e.kunci;
    }
    return null;
});

/*
 * Akordeon: hanya satu grup terbuka pada satu waktu, supaya sidebar tidak
 * memanjang melebihi layar. Grup berisi halaman aktif terbuka dengan
 * sendirinya, termasuk saat halaman dibuka langsung lewat URL.
 */
const grupTerbuka = ref<string | null>(null);

watch(
    grupAktif,
    (g) => {
        if (g) grupTerbuka.value = g;
    },
    { immediate: true },
);

function alihGrup(kunci: string) {
    grupTerbuka.value = grupTerbuka.value === kunci ? null : kunci;
}

const judul = computed(() =>
    typeof route.meta.judul === 'string' ? route.meta.judul : '',
);
const grup = computed(() =>
    typeof route.meta.grup === 'string' ? route.meta.grup : '',
);
const lebarPenuh = computed(() => route.meta.lebar === true);

const inisial = computed(() =>
    (auth.user?.name ?? '?')
        .split(/\s+/)
        .filter((k) => k !== '')
        .slice(0, 2)
        .map((k) => k[0]?.toUpperCase())
        .join(''),
);

watch(
    () => route.fullPath,
    () => {
        drawerTerbuka.value = false;
    },
);

const keluarBerjalan = ref(false);

async function padaKeluar() {
    keluarBerjalan.value = true;
    try {
        await keluar();
        toast.info('Anda telah keluar.');
        await router.push({ name: 'login' });
    } finally {
        keluarBerjalan.value = false;
    }
}
</script>

<template>
    <div class="shell">
        <!-- Latar gelap drawer, hanya muncul di layar sempit. -->
        <Transition name="pudar">
            <div
                v-if="drawerTerbuka"
                class="latar-drawer no-print"
                @click="drawerTerbuka = false"
            />
        </Transition>

        <aside
            class="sidebar no-print"
            :class="{ 'is-open': drawerTerbuka }"
            aria-label="Navigasi utama"
        >
            <div class="brand">
                <MerekToko :ukuran="40" />
                <span class="brand-teks sembunyi-rail">
                    <strong :title="toko.publik.nama_toko">{{
                        toko.publik.nama_toko
                    }}</strong>
                    <small>Point of Sales</small>
                </span>
            </div>

            <nav class="nav">
                <ul class="nav-daftar">
                    <li
                        v-for="e in menuTampil"
                        :key="e.jenis === 'grup' ? e.kunci : e.nama"
                        class="nav-entri"
                        :class="
                            e.jenis === 'grup' && {
                                'is-terbuka': grupTerbuka === e.kunci,
                                'is-aktif': grupAktif === e.kunci,
                            }
                        "
                    >
                        <!-- Tautan tunggal -->
                        <RouterLink
                            v-if="e.jenis === 'tunggal'"
                            :to="{ name: e.nama }"
                            class="nav-item"
                            :class="{ 'is-active': aktif(e) }"
                            :aria-current="aktif(e) ? 'page' : undefined"
                        >
                            <span class="nav-ikon" aria-hidden="true">
                                <component
                                    :is="e.ikon"
                                    :size="20"
                                    :stroke-width="1.5"
                                />
                            </span>
                            <span class="nav-label sembunyi-rail">{{
                                e.label
                            }}</span>
                        </RouterLink>

                        <!-- Grup induk + anak -->
                        <template v-else>
                            <button
                                type="button"
                                class="nav-item nav-induk"
                                :aria-expanded="grupTerbuka === e.kunci"
                                :aria-controls="`nav-${e.kunci}`"
                                @click="alihGrup(e.kunci)"
                            >
                                <span class="nav-ikon" aria-hidden="true">
                                    <component
                                        :is="e.ikon"
                                        :size="20"
                                        :stroke-width="1.5"
                                    />
                                </span>
                                <span class="nav-label sembunyi-rail">{{
                                    e.label
                                }}</span>
                                <ChevronDown
                                    class="nav-panah sembunyi-rail"
                                    :size="16"
                                    :stroke-width="1.75"
                                    aria-hidden="true"
                                />
                            </button>

                            <div
                                :id="`nav-${e.kunci}`"
                                class="nav-anak"
                                :inert="grupTerbuka !== e.kunci"
                            >
                                <ul class="nav-anak-isi">
                                    <li v-for="a in e.anak" :key="a.nama">
                                        <RouterLink
                                            :to="{ name: a.nama }"
                                            class="nav-subitem"
                                            :class="{ 'is-active': aktif(a) }"
                                            :aria-current="
                                                aktif(a) ? 'page' : undefined
                                            "
                                        >
                                            {{ a.label }}
                                        </RouterLink>
                                    </li>
                                </ul>
                            </div>
                        </template>
                    </li>
                </ul>
            </nav>

            <div class="sidebar-kaki">
                <div class="pengguna">
                    <span class="avatar" aria-hidden="true">{{ inisial }}</span>
                    <span class="pengguna-teks sembunyi-rail">
                        <strong>{{ auth.user?.name }}</strong>
                        <small>{{
                            auth.user?.peran === 'admin'
                                ? 'Admin / Pemilik'
                                : 'Kasir'
                        }}</small>
                    </span>
                </div>
                <button
                    type="button"
                    class="nav-item keluar"
                    :disabled="keluarBerjalan"
                    @click="padaKeluar"
                >
                    <span class="nav-ikon" aria-hidden="true">
                        <LogOut :size="20" :stroke-width="1.5" />
                    </span>
                    <span class="nav-label sembunyi-rail">{{
                        keluarBerjalan ? 'Keluar…' : 'Keluar'
                    }}</span>
                </button>
            </div>
        </aside>

        <div class="utama">
            <header class="topbar no-print">
                <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-ikon hanya-sempit"
                    aria-label="Buka menu"
                    :aria-expanded="drawerTerbuka"
                    @click="drawerTerbuka = true"
                >
                    <Menu :size="20" :stroke-width="1.75" aria-hidden="true" />
                </button>
                <div class="topbar-teks">
                    <p v-if="grup && grup !== judul" class="remah">
                        <span>{{ grup }}</span>
                        <ChevronRight
                            :size="12"
                            :stroke-width="2"
                            aria-hidden="true"
                        />
                        <span>{{ judul }}</span>
                    </p>
                    <h1 class="topbar-judul">{{ judul }}</h1>
                </div>
            </header>

            <main class="konten" :class="{ 'konten-lebar': lebarPenuh }">
                <RouterView v-slot="{ Component, route: r }">
                    <Transition name="halaman" mode="out-in">
                        <div :key="r.path" class="halaman">
                            <component :is="Component" />
                        </div>
                    </Transition>
                </RouterView>
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
    overflow: hidden;
    background: var(--sidebar-bg);
    color: var(--sidebar-idle);
    box-shadow: var(--shadow-sidebar);
    transition:
        width var(--dur-base) var(--ease),
        box-shadow var(--dur-base) var(--ease);
}

.brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-4);
}

.brand-teks,
.pengguna-teks {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.2;
    white-space: nowrap;
}

.brand-teks strong,
.pengguna-teks strong {
    color: var(--sidebar-active);
    font: var(--text-body-strong);
    overflow: hidden;
    text-overflow: ellipsis;
}

.brand-teks small,
.pengguna-teks small {
    color: var(--sidebar-label);
    font: var(--text-caption);
}

.nav {
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    padding: var(--space-2) var(--space-3) var(--space-4);
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.nav-daftar,
.nav-anak-isi {
    list-style: none;
    padding: 0;
}

.nav-entri {
    margin-bottom: 2px;
}

.nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--sidebar-idle);
    font: var(--text-small);
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
    transition:
        background-color var(--dur-base) var(--ease),
        color var(--dur-base) var(--ease);
}

.nav-item:hover {
    background: var(--sidebar-hover-bg);
    color: var(--sidebar-active);
}

/* Penanda aktif: teks putih + batang indikator, bukan sekadar bayangan. */
.nav-item.is-active,
.nav-subitem.is-active {
    background: var(--sidebar-active-bg);
    color: var(--sidebar-active);
    font: var(--text-label);
}

.nav-item.is-active::before,
.nav-entri.is-aktif:not(.is-terbuka) > .nav-induk::before {
    content: '';
    position: absolute;
    left: -4px;
    top: 20%;
    height: 60%;
    width: 3px;
    border-radius: var(--radius-pill);
    background: var(--sidebar-indicator);
}

/* Induk dari halaman aktif tetap terang walau grupnya tertutup, supaya
   pengguna tahu sedang berada di bagian mana. */
.nav-entri.is-aktif > .nav-induk {
    color: var(--sidebar-active);
}

.nav-entri.is-aktif:not(.is-terbuka) > .nav-induk {
    background: var(--sidebar-active-bg);
}

.nav-ikon {
    display: grid;
    place-items: center;
    width: 24px;
    flex: 0 0 24px;
}

.nav-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}

.nav-panah {
    flex: 0 0 auto;
    opacity: 0.7;
    transition: transform var(--dur-base) var(--ease);
}

.nav-entri.is-terbuka .nav-panah {
    transform: rotate(180deg);
}

/* Anak grup dibuka-tutup dengan animasi tinggi lewat grid 0fr -> 1fr,
   tanpa perlu mengukur tinggi isinya dengan JavaScript. */
.nav-anak {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows var(--dur-base) var(--ease);
}

.nav-entri.is-terbuka > .nav-anak {
    grid-template-rows: 1fr;
}

.nav-anak-isi {
    overflow: hidden;
    min-height: 0;
    margin-left: calc(var(--space-3) + 11px);
    border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.nav-anak-isi li:first-child {
    margin-top: 2px;
}

.nav-subitem {
    position: relative;
    display: block;
    margin: 0 0 2px var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    color: var(--sidebar-idle);
    font: var(--text-small);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition:
        background-color var(--dur-base) var(--ease),
        color var(--dur-base) var(--ease);
}

.nav-subitem:hover {
    background: var(--sidebar-hover-bg);
    color: var(--sidebar-active);
}

/* Titik penanda anak aktif, duduk di atas garis pemandu. */
.nav-subitem.is-active::before {
    content: '';
    position: absolute;
    left: calc(-1 * var(--space-3) - 3px);
    top: 50%;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--sidebar-indicator);
    transform: translateY(-50%);
}

.sidebar-kaki {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-3) var(--space-4);
    background: var(--sidebar-footer-bg);
}

.pengguna {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-1);
    min-width: 0;
}

.avatar {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: 50%;
    background: rgba(69, 201, 184, 0.16);
    color: var(--teal-400);
    font: var(--text-label);
}

.keluar:hover {
    color: var(--sidebar-danger);
}

.keluar:disabled {
    opacity: 0.6;
    cursor: progress;
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

.topbar-teks {
    min-width: 0;
}

.remah {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font: var(--text-overline);
    letter-spacing: var(--tracking-overline);
    text-transform: uppercase;
    color: var(--text-muted);
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

.latar-drawer {
    position: fixed;
    inset: 0;
    z-index: var(--z-backdrop);
    background: rgba(11, 43, 39, 0.45);
}

/* Perpindahan halaman: halaman lama memudar cepat, yang baru naik lembut. */
.halaman-enter-active {
    transition:
        opacity var(--dur-base) var(--ease),
        transform var(--dur-base) var(--ease);
}

.halaman-leave-active {
    transition: opacity 90ms linear;
}

.halaman-enter-from {
    opacity: 0;
    transform: translateY(6px);
}

.halaman-leave-to {
    opacity: 0;
}

.pudar-enter-active,
.pudar-leave-active {
    transition: opacity var(--dur-base) var(--ease);
}

.pudar-enter-from,
.pudar-leave-to {
    opacity: 0;
}

/* ---------------------------------------------------------------- responsif */

/*
 * 1024-1279px: rail ikon 72px yang MELEBAR saat disorot atau difokus
 * keyboard. Rail melayang di atas konten (posisi fixed), jadi pelebaran
 * tidak mendorong tata letak halaman. Tanpa pelebaran ini, sub-menu di
 * dalam grup tidak dapat dijangkau sama sekali dari rail.
 */
@media (max-width: 1279px) and (min-width: 1024px) {
    .shell {
        padding-left: var(--sidebar-w-rail);
    }

    .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        width: var(--sidebar-w-rail);
    }

    .sidebar:hover,
    .sidebar:focus-within {
        width: var(--sidebar-w);
        box-shadow: 12px 0 40px rgba(6, 64, 59, 0.35);
    }

    .sidebar:not(:hover, :focus-within) .sembunyi-rail {
        opacity: 0;
    }

    .sidebar:not(:hover, :focus-within) .nav-anak {
        grid-template-rows: 0fr;
    }

    /* Dalam rail tertutup, penanda aktif pindah ke ikon grup induknya. */
    .sidebar:not(:hover, :focus-within) .nav-entri.is-aktif > .nav-induk {
        background: var(--sidebar-active-bg);
    }

    .sidebar:not(:hover, :focus-within)
        .nav-entri.is-aktif
        > .nav-induk::before {
        content: '';
        position: absolute;
        left: -4px;
        top: 20%;
        height: 60%;
        width: 3px;
        border-radius: var(--radius-pill);
        background: var(--sidebar-indicator);
    }

    .sembunyi-rail {
        transition: opacity var(--dur-fast) var(--ease);
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
