import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vite-plus/test';
import KepalaUrut from './KepalaUrut.vue';

function pasang(props: {
    urut: string | null;
    arah: 'asc' | 'desc';
    arahAwal?: 'asc' | 'desc';
}) {
    const hasil = render(
        {
            components: { KepalaUrut },
            props: ['urut', 'arah', 'arahAwal'],
            emits: ['urutkan'],
            template: `<table><thead><tr>
                <KepalaUrut label="Harga" kolom="harga_jual" :urut="urut" :arah="arah"
                    :arah-awal="arahAwal" @urutkan="(...a) => $emit('urutkan', ...a)" />
            </tr></thead></table>`,
        },
        { props },
    );
    return {
        kepala: screen.getByRole('columnheader'),
        urutan: () => hasil.emitted().urutkan,
    };
}

describe('KepalaUrut', () => {
    it('kolom yang belum dipakai mengurutkan ditandai aria-sort="none"', () => {
        const { kepala } = pasang({ urut: 'nama', arah: 'asc' });
        expect(kepala.getAttribute('aria-sort')).toBe('none');
    });

    it('klik pertama mengurutkan sesuai arah awal kolom', async () => {
        const { urutan } = pasang({
            urut: null,
            arah: 'asc',
            arahAwal: 'desc',
        });

        await userEvent.click(screen.getByRole('button', { name: /Harga/ }));

        expect(urutan()).toEqual([['harga_jual', 'desc']]);
    });

    it('klik pada kolom aktif membalik arahnya', async () => {
        const { kepala, urutan } = pasang({ urut: 'harga_jual', arah: 'asc' });

        expect(kepala.getAttribute('aria-sort')).toBe('ascending');
        await userEvent.click(screen.getByRole('button', { name: /Harga/ }));

        expect(urutan()).toEqual([['harga_jual', 'desc']]);
    });
});
