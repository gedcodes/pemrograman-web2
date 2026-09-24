import { computed, reactive, readonly } from 'vue';
import axios from 'axios';
import { ambil, ApiError, resetCsrf, siapkanCsrf } from '../api/client';
import type { User } from '../api/types';

/**
 * Keadaan autentikasi.
 *
 * Sengaja tanpa Pinia: yang dibutuhkan hanya satu objek reaktif bersama,
 * sehingga menambah satu pustaka lagi tidak sepadan.
 *
 * Tidak ada apa pun yang disimpan di localStorage. Sesi hidup di cookie
 * httpOnly milik Sanctum, yang tidak dapat dibaca JavaScript -- itulah
 * gunanya. `user` di sini hanya salinan untuk menggambar antarmuka.
 */
const state = reactive<{
    user: User | null;
    memuat: boolean;
    siap: boolean;
}>({
    user: null,
    memuat: false,
    siap: false,
});

export const auth = readonly(state);

export const sudahMasuk = computed(() => state.user !== null);
export const adalahAdmin = computed(() => state.user?.peran === 'admin');

/**
 * Halaman pertama setelah masuk. Kasir langsung ke halaman Kasir, karena
 * itulah pekerjaannya; admin ke Dashboard.
 */
export function halamanAwal(): { name: 'dashboard' | 'kasir' } {
    return { name: state.user?.peran === 'admin' ? 'dashboard' : 'kasir' };
}

/**
 * Tanyakan ke server siapa yang sedang masuk.
 *
 * Dipanggil sekali saat aplikasi dinyalakan. Jawaban 401 bukan galat --
 * artinya memang belum ada yang masuk.
 */
export async function muatSesi(): Promise<void> {
    state.memuat = true;
    try {
        state.user = await ambil<User>('/user');
    } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
            state.user = null;
        } else {
            throw e;
        }
    } finally {
        state.memuat = false;
        state.siap = true;
    }
}

/**
 * Masuk lewat Fortify.
 *
 * Endpointnya berada di luar prefiks /api, sehingga axios dasar yang dipakai,
 * bukan klien ber-baseURL '/api'.
 */
export async function masuk(
    email: string,
    password: string,
    ingat = false,
): Promise<void> {
    await siapkanCsrf();

    try {
        await axios.post(
            '/login',
            { email, password, remember: ingat },
            {
                withCredentials: true,
                withXSRFToken: true,
                headers: { Accept: 'application/json' },
            },
        );
    } catch (e) {
        if (axios.isAxiosError(e)) {
            const data = e.response?.data as
                | { message?: string; errors?: Record<string, string[]> }
                | undefined;
            throw new ApiError(
                data?.message ?? 'Email atau kata sandi salah.',
                e.response?.status ?? 0,
                data?.errors ?? {},
            );
        }
        throw e;
    }

    await muatSesi();

    if (state.user !== null && !state.user.aktif) {
        await keluar();
        throw new ApiError('Akun Anda dinonaktifkan.', 403);
    }
}

export async function keluar(): Promise<void> {
    try {
        await axios.post(
            '/logout',
            {},
            {
                withCredentials: true,
                withXSRFToken: true,
                headers: { Accept: 'application/json' },
            },
        );
    } catch {
        // Sesi mungkin sudah kedaluwarsa di server; keadaan lokal tetap dibersihkan.
    }
    state.user = null;
    resetCsrf();
}
