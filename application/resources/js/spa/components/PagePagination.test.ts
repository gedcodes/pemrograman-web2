import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vite-plus/test';
import PagePagination from './PagePagination.vue';

const META = { current_page: 2, per_page: 20, last_page: 18, total: 346 };

describe('PagePagination', () => {
    it('menampilkan rentang baris yang sedang terlihat', () => {
        render(PagePagination, { props: { meta: META } });
        expect(screen.getByText(/21–40 dari 346/)).toBeTruthy();
    });

    it('menandai halaman aktif dengan aria-current', () => {
        render(PagePagination, { props: { meta: META } });
        expect(
            screen
                .getByRole('button', { name: 'Halaman 2' })
                .getAttribute('aria-current'),
        ).toBe('page');
    });

    it('mengklik nomor halaman mengirim halaman tujuan', async () => {
        const hasil = render(PagePagination, { props: { meta: META } });

        await userEvent.click(
            screen.getByRole('button', { name: 'Halaman 18' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Halaman berikutnya' }),
        );

        expect(hasil.emitted<[number]>().pindah).toEqual([[18], [3]]);
    });

    it('tombol sebelumnya nonaktif di halaman pertama', () => {
        render(PagePagination, {
            props: { meta: { ...META, current_page: 1 } },
        });
        expect(
            (
                screen.getByRole('button', {
                    name: 'Halaman sebelumnya',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('tidak tampil bila semua data muat di satu halaman', () => {
        render(PagePagination, {
            props: {
                meta: { current_page: 1, per_page: 20, last_page: 1, total: 5 },
            },
        });
        expect(screen.queryByRole('navigation')).toBeNull();
    });
});
