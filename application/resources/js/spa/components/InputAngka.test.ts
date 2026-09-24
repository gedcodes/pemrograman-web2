import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vite-plus/test';
import { ref } from 'vue';
import InputAngka from './InputAngka.vue';

/** Pasang InputAngka dengan v-model sungguhan, seperti di halaman. */
function pasang(awal: number | null, langkah?: number) {
    const nilai = ref<number | null>(awal);
    render({
        components: { InputAngka },
        setup: () => ({ nilai, langkah }),
        template:
            '<label for="x">Harga</label><InputAngka id="x" v-model="nilai" awalan="Rp" :langkah="langkah" />',
    });
    return { nilai, isian: screen.getByLabelText('Harga') as HTMLInputElement };
}

describe('InputAngka', () => {
    it('membentuk pemisah ribuan selagi diketik dan mengirim angka murni', async () => {
        const { nilai, isian } = pasang(null);

        await userEvent.type(isian, '1250000');

        expect(isian.value).toBe('1.250.000');
        expect(nilai.value).toBe(1_250_000);
    });

    it('menampilkan nilai awal dengan format ribuan', () => {
        const { isian } = pasang(2850);
        expect(isian.value).toBe('2.850');
    });

    it('mengosongkan isian menjadi null, bukan 0', async () => {
        const { nilai, isian } = pasang(5000);

        await userEvent.clear(isian);

        expect(nilai.value).toBeNull();
    });

    it('mengabaikan huruf yang terketik', async () => {
        const { nilai, isian } = pasang(null);

        await userEvent.type(isian, '12a3');

        expect(nilai.value).toBe(123);
    });

    it('panah atas/bawah menambah dan mengurangi sebesar langkah', async () => {
        const { nilai, isian } = pasang(1000, 500);

        await userEvent.click(isian);
        await userEvent.keyboard('{ArrowUp}{ArrowUp}');
        expect(nilai.value).toBe(2000);

        await userEvent.keyboard('{ArrowDown}');
        expect(nilai.value).toBe(1500);
    });

    it('tidak pernah turun di bawah nol', async () => {
        const { nilai, isian } = pasang(0, 500);

        await userEvent.click(isian);
        await userEvent.keyboard('{ArrowDown}');

        expect(nilai.value).toBe(0);
    });
});
