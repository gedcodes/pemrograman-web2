import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { defineComponent, h } from 'vue';
import { ambil, simpan } from '../api/client';
import type { Pengaturan, Product, Shift } from '../api/types';
import { lupakanPengaturan, terapkanPengaturan } from '../stores/toko';
import { useKasir, type Kasir, type Pemberitahu } from './useKasir';

vi.mock('../api/client', async (asli) => ({
    ...(await asli<typeof import('../api/client')>()),
    ambil: vi.fn(),
    ambilPenuh: vi.fn(),
    simpan: vi.fn(),
}));
vi.mock('../api/snap', () => ({
    bayarDenganSnap: vi.fn(),
    periksaStatus: vi.fn(),
    snapSiap: vi.fn(async () => true),
}));

const ambilTiruan = vi.mocked(ambil);
const simpanTiruan = vi.mocked(simpan);

function produk(id: number, harga: number, stok: number): Product {
    return {
        id,
        barcode: `89900000${id}`,
        nama_produk: `Produk ${id}`,
        category_id: 1,
        unit_id: 1,
        harga_beli: Math.round(harga * 0.8),
        harga_jual: harga,
        margin: 20,
        stok,
        stok_minimum: 5,
        stok_menipis: false,
        gambar_url: null,
        aktif: true,
    };
}

/** Pengaturan lengkap dengan tarif bawaan, sebagian dapat ditimpa. */
function pengaturan(timpa: Partial<Pengaturan> = {}): Pengaturan {
    return {
        nama_toko: 'Toko Uji',
        slogan: null,
        logo_url: null,
        inisial: 'TU',
        alamat: 'Jl. Uji 1',
        telepon: '0361 000000',
        email: null,
        npwp: null,
        nib: null,
        jam_buka: '07:00',
        jam_tutup: '21:00',
        struk_footer_1: null,
        struk_footer_2: null,
        struk_tampilkan_logo: true,
        pkp: true,
        tarif_pajak: 0.11,
        tarif_diskon_member: 0.05,
        tarif_mdr: 0.007,
        batas_bayar_menit: 30,
        ...timpa,
    };
}

function pasang() {
    const beritahu = {
        sukses: vi.fn(),
        galat: vi.fn(),
        info: vi.fn(),
        peringatan: vi.fn(),
    } satisfies Pemberitahu;
    let kasir!: Kasir;
    render(
        defineComponent({
            setup() {
                kasir = useKasir(beritahu);
                return () => h('div');
            },
        }),
    );
    return { kasir, beritahu };
}

describe('useKasir — keranjang', () => {
    it('menolak menambah melebihi stok dan memberi tahu kasir', () => {
        const { kasir, beritahu } = pasang();
        const gula = produk(1, 16_000, 2);

        expect(kasir.tambah(gula)).toBe(true);
        expect(kasir.tambah(gula)).toBe(true);
        expect(kasir.tambah(gula)).toBe(false);

        expect(kasir.qtyDiKeranjang(1)).toBe(2);
        expect(beritahu.peringatan).toHaveBeenCalledWith(
            'Stok Produk 1 hanya 2.',
        );
    });

    it('menghitung diskon member 5% lalu PPN 11% dari harga setelah diskon', () => {
        const { kasir } = pasang();
        kasir.tambah(produk(1, 10_000, 10));
        kasir.tambah(produk(1, 10_000, 10));
        kasir.tambah(produk(2, 5_000, 10));

        expect(kasir.subtotal).toBe(25_000);
        expect(kasir.diskon).toBe(0);
        expect(kasir.pajak).toBe(2_750);
        expect(kasir.total).toBe(27_750);

        kasir.pelangganId = 7;

        expect(kasir.diskon).toBe(1_250);
        expect(kasir.pajak).toBe(2_613); // round(23.750 × 0,11) = round(2.612,5)
        expect(kasir.total).toBe(26_363);
    });

    it('memakai tarif dari Pengaturan Toko, dan tanpa PPN bila toko bukan PKP', () => {
        const { kasir } = pasang();
        kasir.tambah(produk(1, 10_000, 10));
        kasir.pelangganId = 7;

        try {
            terapkanPengaturan(
                pengaturan({ tarif_diskon_member: 0.1, tarif_pajak: 0.12 }),
            );
            expect(kasir.diskon).toBe(1_000);
            expect(kasir.pajak).toBe(1_080); // (10.000 − 1.000) × 12%
            expect(kasir.labelDiskon).toBe('Diskon member 10%');
            expect(kasir.labelPajak).toBe('PPN 12%');
            expect(kasir.adaPajak).toBe(true);

            terapkanPengaturan(pengaturan({ pkp: false }));
            expect(kasir.pajak).toBe(0);
            expect(kasir.adaPajak).toBe(false);
            expect(kasir.total).toBe(9_500); // diskon bawaan 5%, tanpa PPN
        } finally {
            // Store bersifat global; tes lain mengandalkan tarif bawaan.
            lupakanPengaturan();
        }
    });

    it('qty yang diketik melebihi stok dibatasi ke sisa stok', () => {
        const { kasir, beritahu } = pasang();
        kasir.tambah(produk(1, 3_500, 12));

        kasir.ubahQty(kasir.keranjang[0], 40);

        expect(kasir.keranjang[0].qty).toBe(12);
        expect(beritahu.peringatan).toHaveBeenCalledOnce();
    });

    it('qty 0 atau bukan angka menghapus baris; pecahan dibulatkan ke bawah', () => {
        const { kasir } = pasang();
        kasir.tambah(produk(1, 3_500, 12));
        kasir.tambah(produk(2, 4_000, 12));

        kasir.ubahQty(kasir.keranjang[0], 3.7);
        expect(kasir.keranjang[0].qty).toBe(3);

        kasir.ubahQty(kasir.keranjang[0], 0);
        kasir.ubahQty(kasir.keranjang[0], Number.NaN);
        expect(kasir.keranjang).toHaveLength(0);
    });
});

describe('useKasir — pembayaran tunai', () => {
    it('kembalian dan kecukupan uang mengikuti total', () => {
        const { kasir } = pasang();
        kasir.tambah(produk(1, 8_000, 5)); // total 8.880

        kasir.uangDiterima = 5_000;
        expect(kasir.cukup).toBe(false);
        expect(kasir.kembalian).toBe(0);

        kasir.uangDiterima = 10_000;
        expect(kasir.cukup).toBe(true);
        expect(kasir.kembalian).toBe(1_120);

        kasir.metode = 'non_tunai';
        kasir.uangDiterima = null;
        expect(kasir.cukup).toBe(true);
    });
});

describe('useKasir — tutup shift', () => {
    const shiftAktif: Shift = {
        id: 3,
        waktu_buka: '2026-09-24T08:00:00+08:00',
        waktu_tutup: null,
        terbuka: true,
        modal_awal: 300_000,
        kas_akhir: null,
        catatan: null,
        ringkasan: {
            jumlah_transaksi: 4,
            penjualan_tunai: 120_000,
            penjualan_non_tunai: 50_000,
            tagihan_menunggu: 0,
            kas_seharusnya: 420_000,
            selisih: null,
        },
    };

    beforeEach(() => {
        ambilTiruan.mockReset();
        simpanTiruan.mockReset();
        ambilTiruan.mockResolvedValue(shiftAktif);
    });

    it('mengambil ulang ringkasan dan menghitung selisih selagi diketik', async () => {
        const { kasir } = pasang();

        await kasir.bukaTutupShift();

        expect(ambilTiruan).toHaveBeenCalledWith('/shifts/aktif');
        expect(kasir.memuatRingkasan).toBe(false);
        expect(kasir.selisihKas).toBeNull();

        kasir.kasAkhir = 415_000;
        expect(kasir.selisihKas).toBe(-5_000);

        kasir.kasAkhir = 420_000;
        expect(kasir.selisihKas).toBe(0);
    });

    it('menolak menutup tanpa kas akhir, tanpa menghubungi server', async () => {
        const { kasir, beritahu } = pasang();
        await kasir.bukaTutupShift();

        await kasir.tutupShift();

        expect(simpanTiruan).not.toHaveBeenCalled();
        expect(beritahu.peringatan).toHaveBeenCalledWith(
            'Isi jumlah uang yang ada di laci, boleh 0.',
        );
    });

    it('menolak menutup selagi keranjang masih berisi', async () => {
        const { kasir, beritahu } = pasang();
        await kasir.bukaTutupShift();
        kasir.tambah(produk(1, 5_000, 3));
        kasir.kasAkhir = 420_000;

        await kasir.tutupShift();

        expect(simpanTiruan).not.toHaveBeenCalled();
        expect(beritahu.peringatan).toHaveBeenCalledWith(
            expect.stringContaining('Keranjang masih berisi'),
        );
    });

    it('menutup shift, menampilkan rekap, lalu kembali ke gerbang buka shift', async () => {
        const tertutup: Shift = { ...shiftAktif, terbuka: false, kas_akhir: 0 };
        simpanTiruan.mockResolvedValueOnce({
            data: tertutup,
            message: 'Kas cocok.',
        });
        const { kasir, beritahu } = pasang();
        await kasir.bukaTutupShift();

        kasir.kasAkhir = 0; // 0 sah: laci memang kosong
        kasir.catatanTutup = '  setor ke bank  ';
        await kasir.tutupShift();
        await flushPromises();

        expect(simpanTiruan).toHaveBeenCalledWith('/shifts/close', {
            kas_akhir: 0,
            catatan: 'setor ke bank',
        });
        expect(kasir.rekapTutup).toEqual(tertutup);
        expect(beritahu.sukses).toHaveBeenCalledWith('Kas cocok.');

        kasir.selesaiTutupShift();
        expect(kasir.shift).toBeNull();
        expect(kasir.modalTutupShift).toBe(false);
    });
});
