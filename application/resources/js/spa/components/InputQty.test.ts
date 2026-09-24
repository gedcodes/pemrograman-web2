import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vite-plus/test';
import InputQty from './InputQty.vue';

function pasang(nilai = 2) {
    const hasil = render(InputQty, {
        props: { nilai, label: 'Jumlah Indomie' },
    });
    const isian = screen.getByLabelText('Jumlah Indomie') as HTMLInputElement;
    /** Semua jumlah yang dikirim lewat event `ubah`. */
    const dikirim = () => hasil.emitted<[number]>().ubah;
    return { isian, dikirim };
}

describe('InputQty', () => {
    it('mengirim jumlah baru saat Enter ditekan', async () => {
        const { isian, dikirim } = pasang(2);

        await userEvent.click(isian);
        await userEvent.keyboard('20{Enter}');

        expect(dikirim()).toEqual([[20]]);
    });

    it('Esc membatalkan ketikan dan mengembalikan angka semula', async () => {
        const { isian, dikirim } = pasang(2);

        await userEvent.click(isian);
        await userEvent.keyboard('99{Escape}');

        expect(isian.value).toBe('2');
        expect(dikirim()).toBeUndefined();
    });

    it('isian dikosongkan tidak mengirim apa pun', async () => {
        const { isian, dikirim } = pasang(3);

        await userEvent.clear(isian);
        await userEvent.tab();

        expect(isian.value).toBe('3');
        expect(dikirim()).toBeUndefined();
    });

    it('mengirim 0 bila kasir mengetik 0 (baris dihapus pemanggil)', async () => {
        const { isian, dikirim } = pasang(3);

        await userEvent.click(isian);
        await userEvent.keyboard('0');
        await userEvent.tab();

        expect(dikirim()).toEqual([[0]]);
    });
});
