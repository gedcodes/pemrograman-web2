import { watchDebounced } from '@vueuse/core';
import { ref, watch, type Ref } from 'vue';
import { ambilPenuh, ApiError, type PaginationMeta } from '../api/client';

export interface OpsiDaftarServer {
    /** Jeda sebelum penyaring yang berubah memicu pemuatan ulang (ms). */
    tunda?: number;
    /** Parameter tetap yang selalu ikut dikirim. */
    tetap?: Record<string, unknown>;
    /** Urutan awal; kosong berarti urutan bawaan server. */
    urut?: { kolom: string; arah: 'asc' | 'desc' };
    /** Jumlah baris per halaman bawaan (20). */
    perHalaman?: number;
}

const KUNCI_UKURAN = 'pos:baris-per-halaman:';

function ukuranTersimpan(url: string): number | null {
    try {
        const n = Number(localStorage.getItem(KUNCI_UKURAN + url));
        return Number.isInteger(n) && n > 0 ? n : null;
    } catch {
        return null;
    }
}

/**
 * Daftar berpaginasi dari server, dipakai seluruh halaman bertabel.
 *
 * Yang ditangani di sini supaya tidak ditulis ulang di setiap halaman:
 *
 * 1. Penyaring (kotak cari, pilihan status) ditunda sebentar, sehingga
 *    mengetik "indomie" tidak menembakkan tujuh permintaan.
 * 2. Respons usang dibuang. Bila permintaan lama tiba SETELAH yang baru,
 *    hasilnya diabaikan, jadi tabel tidak pernah menampilkan hasil
 *    penyaring sebelumnya.
 * 3. Halaman yang kosong setelah penghapusan baris terakhir mundur ke
 *    halaman terakhir yang masih ada.
 * 4. Urutan per kolom (`urutkan`) dan jumlah baris per halaman. Pilihan
 *    jumlah baris diingat per tabel di perangkat ini.
 *
 * Komposabel ini tidak memunculkan toast; galatnya diekspos lewat `galat`
 * dan tampilannya menjadi urusan komponen.
 */
export function useDaftarServer<T>(
    url: string,
    penyaring: () => Record<string, unknown> = () => ({}),
    opsi: OpsiDaftarServer = {},
) {
    const daftar = ref([]) as Ref<T[]>;
    const meta = ref<PaginationMeta | null>(null);
    const halaman = ref(1);
    const memuat = ref(true);
    const galat = ref<string | null>(null);

    const urut = ref<string | null>(opsi.urut?.kolom ?? null);
    const arah = ref<'asc' | 'desc'>(opsi.urut?.arah ?? 'asc');
    // Ukuran yang ditetapkan halaman (mis. Beban memuat semua baris untuk
    // menghitung total) menang atas pilihan tersimpan.
    const perHalaman = ref(opsi.perHalaman ?? ukuranTersimpan(url) ?? 20);

    let urutan = 0;

    async function muat(): Promise<void> {
        const ke = ++urutan;
        memuat.value = true;
        galat.value = null;

        try {
            const r = await ambilPenuh<T[]>(url, {
                ...opsi.tetap,
                ...penyaring(),
                urut: urut.value ?? undefined,
                arah: urut.value ? arah.value : undefined,
                per_page: perHalaman.value,
                page: halaman.value,
            });
            if (ke !== urutan) return;

            const terakhir = r.meta?.last_page ?? 1;
            if (r.data.length === 0 && halaman.value > terakhir) {
                halaman.value = terakhir;
                return muat();
            }

            daftar.value = r.data;
            meta.value = r.meta ?? null;
        } catch (e) {
            if (ke !== urutan) return;
            galat.value =
                e instanceof ApiError ? e.message : 'Gagal memuat data.';
        } finally {
            if (ke === urutan) memuat.value = false;
        }
    }

    function pindahHalaman(h: number): void {
        halaman.value = h;
        void muat();
    }

    /** Urutkan menurut kolom; dipanggil KepalaUrut. Kembali ke halaman 1. */
    function urutkan(kolom: string, arahBaru: 'asc' | 'desc'): void {
        urut.value = kolom;
        arah.value = arahBaru;
        halaman.value = 1;
        void muat();
    }

    watch(perHalaman, (n) => {
        try {
            localStorage.setItem(KUNCI_UKURAN + url, String(n));
        } catch {
            // Penyimpanan diblokir: pilihan berlaku selama halaman terbuka.
        }
        halaman.value = 1;
        void muat();
    });

    watchDebounced(
        penyaring,
        () => {
            halaman.value = 1;
            void muat();
        },
        { debounce: opsi.tunda ?? 300, deep: true },
    );

    void muat();

    return {
        daftar,
        meta,
        halaman,
        memuat,
        galat,
        urut,
        arah,
        perHalaman,
        muat,
        pindahHalaman,
        urutkan,
    };
}
