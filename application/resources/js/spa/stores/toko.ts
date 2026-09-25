import { computed, reactive, readonly } from 'vue';
import { ambil } from '../api/client';
import type { Pengaturan, TokoPublik } from '../api/types';

/**
 * Pengaturan toko yang dipakai di seluruh SPA: identitas (sidebar, halaman
 * masuk, struk, kop laporan) dan tarif (pratinjau keranjang Kasir).
 *
 * Dua tahap:
 * 1. `publik` langsung terisi dari `window.__TOKO__` yang disisipkan server,
 *    sehingga halaman masuk sudah menampilkan nama dan logo yang benar.
 * 2. `lengkap` dimuat dari GET /api/pengaturan setelah pengguna masuk,
 *    karena berisi tarif dan data yang tidak perlu dilihat tamu.
 */

/** Dipakai bila spa.blade.php tidak menyisipkan apa pun (mis. saat diuji). */
const PUBLIK_BAWAAN: TokoPublik = {
    nama_toko: 'Toko Sari Amerta',
    slogan: null,
    logo_url: null,
    inisial: 'SA',
};

/**
 * Tarif bawaan selama pengaturan lengkap belum termuat. Sama dengan
 * config/pos.php; server tetap menghitung ulang semuanya.
 */
const TARIF_BAWAAN = {
    pkp: true,
    tarif_pajak: 0.11,
    tarif_diskon_member: 0.05,
};

function bacaPublik(): TokoPublik {
    const w = globalThis as { __TOKO__?: Partial<TokoPublik> };
    return { ...PUBLIK_BAWAAN, ...w.__TOKO__ };
}

const state = reactive<{ publik: TokoPublik; lengkap: Pengaturan | null }>({
    publik: bacaPublik(),
    lengkap: null,
});

export const toko = readonly(state);

/** PPN yang benar-benar dikenakan: nol bila toko bukan PKP. */
export const tarifPajakBerlaku = computed(() => {
    const p = state.lengkap ?? TARIF_BAWAAN;
    return p.pkp ? p.tarif_pajak : 0;
});

export const tarifDiskonMember = computed(
    () => (state.lengkap ?? TARIF_BAWAAN).tarif_diskon_member,
);

export async function muatPengaturan(): Promise<void> {
    terapkanPengaturan(await ambil<Pengaturan>('/pengaturan'));
}

/**
 * Dipanggil juga setelah halaman Pengaturan Toko menyimpan, supaya sidebar,
 * judul tab, dan tarif kasir langsung ikut berubah tanpa memuat ulang.
 */
export function terapkanPengaturan(p: Pengaturan): void {
    state.lengkap = p;
    state.publik = {
        nama_toko: p.nama_toko,
        slogan: p.slogan,
        logo_url: p.logo_url,
        inisial: p.inisial,
    };
}

/** Setelah keluar: tarif dan data internal dibuang, identitas publik tetap. */
export function lupakanPengaturan(): void {
    state.lengkap = null;
}
