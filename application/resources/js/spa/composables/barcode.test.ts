import { describe, expect, it } from 'vite-plus/test';
import { barcodeInternal, digitCek, formatBarcode } from './barcode';

describe('barcode', () => {
    // Contoh yang SAMA dipakai BarcodeServiceTest di server.
    it.each([
        ['400638133393', 1], // contoh EAN-13 dari spesifikasi GS1
        ['899886620019', 6], // Indomie Goreng Rendang (data seeder)
        ['200014000010', 4],
        ['000000000000', 0],
    ])('digit cek EAN-13 untuk %s adalah %i', (dua_belas, cek) => {
        expect(digitCek(dua_belas)).toBe(cek);
    });

    it('digit cek EAN-8', () => {
        expect(digitCek('9638507')).toBe(4); // 96385074
    });

    it('memilih EAN-13 hanya bila digit ceknya sah', () => {
        expect(formatBarcode('4006381333931')).toBe('EAN13');
        expect(formatBarcode('8998866200196')).toBe('EAN13');
        // Data contoh prototipe dengan digit cek salah → tetap tercetak.
        expect(formatBarcode('2000140000105')).toBe('CODE128');
    });

    it('EAN-8, lalu Code 128 untuk kode lainnya', () => {
        expect(formatBarcode('96385074')).toBe('EAN8');
        expect(formatBarcode('ABC-123')).toBe('CODE128');
        expect(formatBarcode('12345')).toBe('CODE128');
    });

    it('mengenali barcode internal toko', () => {
        expect(barcodeInternal('2000140000104')).toBe(true);
        expect(barcodeInternal('8998866200196')).toBe(false);
        expect(barcodeInternal('2000140000105')).toBe(false); // digit cek salah
    });
});
