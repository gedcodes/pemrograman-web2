import axios, { AxiosError, type AxiosInstance } from 'axios';

/**
 * Klien HTTP tunggal untuk seluruh SPA.
 *
 * Autentikasinya memakai cookie sesi Sanctum, bukan token yang disimpan
 * sendiri di browser: SPA ini disajikan dari origin yang sama dengan API,
 * sehingga cookie httpOnly lebih aman daripada menaruh token di localStorage.
 *
 * CATATAN PENTING: Sanctum hanya memakai sesi bila origin permintaan tercantum
 * pada `SANCTUM_STATEFUL_DOMAINS`. Saat menjalankan dev server Vite di port
 * berbeda, port itu WAJIB ditambahkan ke daftar tersebut atau seluruh
 * permintaan akan dijawab 401 meskipun login berhasil.
 */
export const http: AxiosInstance = axios.create({
    baseURL: '/api',
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

/** Bentuk response sukses yang dipakai seluruh endpoint. */
export interface ApiEnvelope<T> {
    data: T;
    message: string | null;
    meta?: PaginationMeta;
}

export interface PaginationMeta {
    current_page: number;
    per_page: number;
    last_page: number;
    total: number;
}

/** Galat yang sudah dinormalkan supaya komponen tidak perlu tahu bentuk axios. */
export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly errors: Record<string, string[]> = {},
    ) {
        super(message);
        this.name = 'ApiError';
    }

    /** Pesan galat pertama untuk sebuah field, bila ada. */
    field(name: string): string | undefined {
        return this.errors[name]?.[0];
    }
}

let csrfSiap = false;

/**
 * Ambil cookie CSRF sekali saja sebelum permintaan yang mengubah data.
 * Laravel menolak POST/PUT/DELETE tanpa cookie ini.
 */
export async function siapkanCsrf(): Promise<void> {
    if (csrfSiap) return;
    await axios.get('/sanctum/csrf-cookie', { withCredentials: true });
    csrfSiap = true;
}

/** Dipanggil saat keluar, supaya sesi berikutnya mengambil cookie baru. */
export function resetCsrf(): void {
    csrfSiap = false;
}

function normalkan(e: unknown): ApiError {
    if (e instanceof AxiosError) {
        const status = e.response?.status ?? 0;
        const data = e.response?.data as
            | { message?: string; errors?: Record<string, string[]> }
            | undefined;

        if (status === 0) {
            return new ApiError('Tidak dapat menghubungi server.', 0);
        }

        return new ApiError(
            data?.message ?? 'Terjadi kesalahan pada server.',
            status,
            data?.errors ?? {},
        );
    }

    return new ApiError('Terjadi kesalahan tak terduga.', 0);
}

/** GET yang mengembalikan seluruh amplop, termasuk `meta` paginasi. */
export async function ambilPenuh<T>(
    url: string,
    params?: Record<string, unknown>,
): Promise<ApiEnvelope<T>> {
    try {
        const r = await http.get<ApiEnvelope<T>>(url, { params });
        return r.data;
    } catch (e) {
        throw normalkan(e);
    }
}

/** GET yang hanya mengembalikan `data`. */
export async function ambil<T>(
    url: string,
    params?: Record<string, unknown>,
): Promise<T> {
    return (await ambilPenuh<T>(url, params)).data;
}

async function kirim<T>(
    metode: 'post' | 'put' | 'delete',
    url: string,
    body?: unknown,
): Promise<ApiEnvelope<T>> {
    await siapkanCsrf();
    try {
        const r =
            metode === 'delete'
                ? await http.delete<ApiEnvelope<T>>(url)
                : await http[metode]<ApiEnvelope<T>>(url, body);
        return r.data;
    } catch (e) {
        throw normalkan(e);
    }
}

export const simpan = <T>(url: string, body?: unknown) =>
    kirim<T>('post', url, body);
export const perbarui = <T>(url: string, body?: unknown) =>
    kirim<T>('put', url, body);
export const hapus = <T>(url: string) => kirim<T>('delete', url);
