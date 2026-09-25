import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vite-plus/test';
import { defineComponent, h, ref } from 'vue';
import InputPersen from './InputPersen.vue';

function pasang(awal: number | null, desimal?: number) {
    const nilai = ref<number | null>(awal);
    render(
        defineComponent({
            setup: () => () =>
                h(InputPersen, {
                    modelValue: nilai.value,
                    'onUpdate:modelValue': (n: number | null) =>
                        (nilai.value = n),
                    desimal,
                    'aria-label': 'Tarif',
                }),
        }),
    );
    return { nilai, isian: screen.getByLabelText('Tarif') as HTMLInputElement };
}

describe('InputPersen', () => {
    it('menampilkan desimal dengan koma', () => {
        const { isian } = pasang(0.7);
        expect(isian.value).toBe('0,7');
    });

    it('menerima koma maupun titik sebagai pemisah desimal', async () => {
        const { nilai, isian } = pasang(null);
        await userEvent.type(isian, '12,5');
        expect(nilai.value).toBe(12.5);

        await userEvent.clear(isian);
        await userEvent.type(isian, '0.75');
        expect(nilai.value).toBe(0.75);
        expect(isian.value).toBe('0,75');
    });

    it('membuang huruf, pemisah kedua, dan desimal berlebih', async () => {
        const { nilai, isian } = pasang(null, 2);
        await userEvent.type(isian, '1a1,2,34');
        expect(isian.value).toBe('11,23');
        expect(nilai.value).toBe(11.23);
    });

    it('isian kosong bernilai null, bukan nol', async () => {
        const { nilai, isian } = pasang(11);
        await userEvent.clear(isian);
        expect(nilai.value).toBeNull();
    });
});
