import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vite-plus/test';
import type { TitikTren } from '../api/types';
import GrafikTren from './GrafikTren.vue';

/** Intl id-ID memakai spasi tak-terputus ("1 jt", "Rp 0"); samakan dulu. */
const rapikan = (t: string | null | undefined) =>
    (t ?? '').replace(/\s+/gu, ' ').trim();

const titik = (total: number[], mulai = 17): TitikTren[] =>
    total.map((t, i) => ({
        kunci: `2026-09-${String(mulai + i).padStart(2, '0')}`,
        mulai: `2026-09-${String(mulai + i).padStart(2, '0')}`,
        jumlah_transaksi: t === 0 ? 0 : Math.round(t / 50_000),
        total: t,
    }));

function pasang(total: number[]) {
    const hasil = render(GrafikTren, {
        props: { titik: titik(total), satuan: 'hari' },
    });
    const svg = hasil.container.querySelector('svg') as SVGSVGElement;
    return { ...hasil, svg };
}

describe('GrafikTren', () => {
    it('sumbu Y memakai angka bulat, bukan nilai data mentah', () => {
        const { svg } = pasang([1_986_240, 2_211_225, 3_278_941, 0]);
        const label = [
            ...svg.querySelectorAll('.sumbu text[text-anchor="end"]'),
        ].map((t) => rapikan(t.textContent));
        // Langkah 1 jt: 0, 1 jt, 2 jt, 3 jt, 4 jt.
        expect(label).toEqual(['0', '1 jt', '2 jt', '3 jt', '4 jt']);
    });

    it('hanya titik tertinggi yang diberi label langsung', () => {
        const { svg } = pasang([100_000, 350_000, 200_000]);
        const puncak = svg.querySelectorAll('.puncak text');
        expect(puncak).toHaveLength(1);
        expect(puncak[0].textContent).toContain('350.000');
    });

    it('panah kanan menjelajahi titik dan menampilkan nilainya', async () => {
        const { svg } = pasang([100_000, 350_000, 0]);
        svg.focus();

        await userEvent.keyboard('{ArrowRight}');
        expect(rapikan(screen.getByRole('status').textContent)).toContain(
            '100.000',
        );

        await userEvent.keyboard('{ArrowRight}{ArrowRight}');
        // Hari tanpa penjualan tetap dapat dibaca: Rp0, bukan dilompati.
        const tooltip = screen.getByRole('status');
        expect(rapikan(tooltip.querySelector('strong')?.textContent)).toBe(
            'Rp 0',
        );
        expect(screen.getByRole('status').textContent).toContain(
            '19 September',
        );
    });

    it('periode tanpa penjualan menampilkan pesan, bukan garis datar tanpa keterangan', () => {
        const { svg } = pasang([0, 0, 0]);
        expect(svg.querySelector('.deret-garis')).toBeNull();
        expect(
            screen.getByText('Tidak ada penjualan pada periode ini.'),
        ).toBeTruthy();
    });
});
