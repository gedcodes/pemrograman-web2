import { computed, reactive, readonly } from 'vue';

/**
 * Penanda "sedang bekerja" tingkat aplikasi, untuk batang progres di atas layar.
 *
 * Dua sumbernya dipisah dengan sengaja:
 * - `permintaan` adalah PENGHITUNG, karena beberapa panggilan API bisa
 *   berjalan bersamaan dan batang baru boleh hilang setelah semuanya selesai.
 * - `navigasi` cukup boolean. Navigasi yang dialihkan penjaga router tidak
 *   selalu memanggil afterEach untuk rute asalnya, sehingga penghitung di
 *   sini akan bocor dan batangnya tidak pernah hilang.
 */
const state = reactive({
    permintaan: 0,
    navigasi: false,
});

export const progres = readonly(state);

export const sedangBekerja = computed(
    () => state.permintaan > 0 || state.navigasi,
);

export function permintaanMulai(): void {
    state.permintaan++;
}

export function permintaanSelesai(): void {
    state.permintaan = Math.max(0, state.permintaan - 1);
}

export function aturNavigasi(aktif: boolean): void {
    state.navigasi = aktif;
}
