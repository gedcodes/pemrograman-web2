import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vite-plus/test';
import { ref } from 'vue';
import KeypadAngka from './KeypadAngka.vue';

function pasang(awal: number | null) {
    const nilai = ref<number | null>(awal);
    render({
        components: { KeypadAngka },
        setup: () => ({ nilai }),
        template: '<KeypadAngka v-model="nilai" />',
    });
    const tekan = (label: string) =>
        userEvent.click(screen.getByRole('button', { name: label }));
    return { nilai, tekan };
}

describe('KeypadAngka', () => {
    it('ketukan pertama MENGGANTI nilai awal, bukan menempel di belakangnya', async () => {
        // Modal bayar mengisi uang diterima = total belanja (8.880).
        const { nilai, tekan } = pasang(8880);

        await tekan('5');
        await tekan('0');
        await tekan('000');

        expect(nilai.value).toBe(50_000);
    });

    it('tombol hapus menghapus satu angka terakhir', async () => {
        const { nilai, tekan } = pasang(null);

        await tekan('1');
        await tekan('2');
        await tekan('3');
        await tekan('Hapus satu angka');

        expect(nilai.value).toBe(12);
    });

    it('Kosongkan membuat nilainya null', async () => {
        const { nilai, tekan } = pasang(50_000);

        await tekan('Kosongkan');

        expect(nilai.value).toBeNull();
    });

    it('tidak menghasilkan nol di depan', async () => {
        const { nilai, tekan } = pasang(null);

        await tekan('0');
        await tekan('000');
        await tekan('7');

        expect(nilai.value).toBe(7);
    });
});
