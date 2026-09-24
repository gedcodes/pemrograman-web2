import { describe, expect, it } from 'vite-plus/test';
import { nomorHalaman } from './halaman';

describe('nomorHalaman', () => {
    it('menampilkan semua nomor bila halamannya sedikit', () => {
        expect(nomorHalaman(1, 1)).toEqual([1]);
        expect(nomorHalaman(2, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    it('meringkas celah panjang menjadi elipsis', () => {
        expect(nomorHalaman(6, 20)).toEqual([1, '…', 5, 6, 7, '…', 20]);
    });

    it('selalu menampilkan halaman pertama dan terakhir di tepi', () => {
        expect(nomorHalaman(1, 20)).toEqual([1, 2, '…', 20]);
        expect(nomorHalaman(20, 20)).toEqual([1, '…', 19, 20]);
    });

    it('menulis nomornya bila celahnya hanya satu halaman', () => {
        // Antara 1 dan 3 hanya ada 2: elipsis selebar satu tombol tidak berguna.
        expect(nomorHalaman(4, 20)).toEqual([1, 2, 3, 4, 5, '…', 20]);
    });
});
