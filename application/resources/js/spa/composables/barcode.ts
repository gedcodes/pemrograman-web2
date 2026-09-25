/**
 * Aturan barcode di sisi klien, dipakai saat MENGGAMBAR label.
 *
 * Pembuatan barcode internal ada di server (`App\Services\BarcodeService`);
 * rumus digit cek di sini sama persis dengannya, dan keduanya diuji dengan
 * contoh yang sama.
 */

export type FormatBarcode = 'EAN13' | 'EAN8' | 'CODE128';

/**
 * Digit cek EAN: bobot 3 dan 1 berselang-seling dari digit paling KANAN,
 * lalu digit yang menggenapkan jumlahnya ke kelipatan 10. Untuk EAN-13 ini
 * setara dengan bobot 1-3-1-3 dari kiri seperti di server.
 */
export function digitCek(tanpaCek: string): number {
    let jumlah = 0;
    for (let i = 0; i < tanpaCek.length; i++) {
        const dariKanan = tanpaCek.length - 1 - i;
        jumlah += Number(tanpaCek[i]) * (dariKanan % 2 === 0 ? 3 : 1);
    }
    return (10 - (jumlah % 10)) % 10;
}

function eanSah(kode: string, panjang: 8 | 13): boolean {
    if (!new RegExp(`^\\d{${panjang}}$`).test(kode)) return false;
    return digitCek(kode.slice(0, -1)) === Number(kode.at(-1));
}

/**
 * Simbologi untuk menggambar sebuah kode.
 *
 * EAN hanya dipakai bila digit ceknya sah. Kode lain -- termasuk 13 digit
 * yang digit ceknya salah, seperti sebagian data contoh prototipe -- digambar
 * sebagai Code 128. Pemindai mengirim ulang isi Code 128 apa adanya, sehingga
 * pencarian barcode di Kasir tetap cocok.
 */
export function formatBarcode(kode: string): FormatBarcode {
    if (eanSah(kode, 13)) return 'EAN13';
    if (eanSah(kode, 8)) return 'EAN8';
    return 'CODE128';
}

/** Barcode internal toko (awalan 20–29 dicadangkan GS1 untuk kode internal). */
export function barcodeInternal(kode: string): boolean {
    return eanSah(kode, 13) && /^2\d/.test(kode);
}
