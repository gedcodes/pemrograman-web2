import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { defineComponent, h } from 'vue';
import { ambilPenuh, ApiError, type ApiEnvelope } from '../api/client';
import { useDaftarServer, type OpsiDaftarServer } from './useDaftarServer';

vi.mock('../api/client', async (asli) => ({
    ...(await asli<typeof import('../api/client')>()),
    ambilPenuh: vi.fn(),
}));

const ambilPenuhTiruan = vi.mocked(ambilPenuh);

type Baris = { id: number; nama: string };

function amplop(data: Baris[]): ApiEnvelope<Baris[]> {
    return {
        data,
        message: null,
        meta: { current_page: 1, per_page: 20, last_page: 3, total: 50 },
    };
}

/** Janji yang baru diselesaikan ketika tes memutuskannya. */
function tertunda<T>() {
    let selesaikan!: (v: T) => void;
    const janji = new Promise<T>((r) => (selesaikan = r));
    return { janji, selesaikan };
}

type Daftar = ReturnType<typeof useDaftarServer<Baris>>;

/** Komposabel dipasang di komponen sungguhan supaya watcher-nya hidup. */
function pasang(
    url: string,
    penyaring?: () => Record<string, unknown>,
    opsi?: OpsiDaftarServer,
): Daftar {
    let hasil!: Daftar;
    render(
        defineComponent({
            setup() {
                hasil = useDaftarServer<Baris>(url, penyaring, opsi);
                return () => h('div');
            },
        }),
    );
    return hasil;
}

/** Parameter permintaan terakhir yang dikirim ke server. */
function parameterTerakhir(): Record<string, unknown> {
    return (ambilPenuhTiruan.mock.lastCall?.[1] ?? {}) as Record<
        string,
        unknown
    >;
}

describe('useDaftarServer', () => {
    beforeEach(() => {
        ambilPenuhTiruan.mockReset();
        ambilPenuhTiruan.mockResolvedValue(amplop([]));
    });

    it('memuat halaman pertama dengan 20 baris secara bawaan', async () => {
        ambilPenuhTiruan.mockResolvedValueOnce(
            amplop([{ id: 1, nama: 'Gula' }]),
        );

        const d = pasang('/products');
        expect(d.memuat.value).toBe(true);
        await flushPromises();

        expect(d.memuat.value).toBe(false);
        expect(d.daftar.value).toEqual([{ id: 1, nama: 'Gula' }]);
        expect(parameterTerakhir()).toMatchObject({ page: 1, per_page: 20 });
        expect(parameterTerakhir().urut).toBeUndefined();
    });

    it('membuang jawaban lama yang tiba setelah jawaban baru', async () => {
        const lama = tertunda<ApiEnvelope<Baris[]>>();
        ambilPenuhTiruan.mockReturnValueOnce(lama.janji);
        ambilPenuhTiruan.mockResolvedValueOnce(
            amplop([{ id: 2, nama: 'Baru' }]),
        );

        const d = pasang('/products');
        d.urutkan('nama_produk', 'asc');
        await flushPromises();
        expect(d.daftar.value).toEqual([{ id: 2, nama: 'Baru' }]);

        lama.selesaikan(amplop([{ id: 1, nama: 'Usang' }]));
        await flushPromises();

        expect(d.daftar.value).toEqual([{ id: 2, nama: 'Baru' }]);
        expect(d.memuat.value).toBe(false);
    });

    it('urutkan mengirim kolom & arah lalu kembali ke halaman 1', async () => {
        const d = pasang('/products');
        await flushPromises();
        d.pindahHalaman(3);
        await flushPromises();

        d.urutkan('harga_jual', 'desc');
        await flushPromises();

        expect(d.halaman.value).toBe(1);
        expect(parameterTerakhir()).toMatchObject({
            urut: 'harga_jual',
            arah: 'desc',
            page: 1,
        });
    });

    it('mengingat jumlah baris per halaman untuk tabel yang sama', async () => {
        const d = pasang('/products');
        await flushPromises();

        d.perHalaman.value = 50;
        await flushPromises();
        expect(parameterTerakhir()).toMatchObject({ per_page: 50, page: 1 });

        expect(pasang('/products').perHalaman.value).toBe(50);
        // Tabel lain tidak ikut terpengaruh.
        expect(pasang('/suppliers').perHalaman.value).toBe(20);
    });

    it('ukuran yang ditetapkan halaman menang atas pilihan tersimpan', async () => {
        localStorage.setItem('pos:baris-per-halaman:/expenses', '10');

        const d = pasang('/expenses', undefined, { perHalaman: 100 });
        await flushPromises();

        expect(d.perHalaman.value).toBe(100);
        expect(parameterTerakhir()).toMatchObject({ per_page: 100 });
    });

    it('galat server diekspos lewat `galat`, bukan dilempar', async () => {
        ambilPenuhTiruan.mockRejectedValueOnce(
            new ApiError('Tidak diizinkan.', 403),
        );

        const d = pasang('/users');
        await flushPromises();

        expect(d.galat.value).toBe('Tidak diizinkan.');
        expect(d.memuat.value).toBe(false);
    });
});
