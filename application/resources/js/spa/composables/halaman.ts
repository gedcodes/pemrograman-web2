/**
 * Nomor halaman yang ditampilkan paginasi, dengan elipsis untuk celah.
 *
 *   nomorHalaman(1, 3)   → [1, 2, 3]
 *   nomorHalaman(6, 20)  → [1, '…', 5, 6, 7, '…', 20]
 *
 * Halaman pertama, terakhir, dan tetangga halaman aktif selalu tampil.
 * Celah yang hanya satu nomor ditulis nomornya, bukan elipsis, karena
 * elipsis selebar satu tombol tidak menghemat apa pun.
 */
export function nomorHalaman(
    sekarang: number,
    terakhir: number,
): Array<number | '…'> {
    if (terakhir <= 7) {
        return Array.from({ length: terakhir }, (_, i) => i + 1);
    }

    const tampil = new Set([1, terakhir, sekarang - 1, sekarang, sekarang + 1]);
    const urut = [...tampil]
        .filter((n) => n >= 1 && n <= terakhir)
        .sort((a, b) => a - b);

    const hasil: Array<number | '…'> = [];
    for (const n of urut) {
        const sebelum = hasil[hasil.length - 1];
        if (typeof sebelum === 'number') {
            if (n - sebelum === 2) hasil.push(sebelum + 1);
            else if (n - sebelum > 2) hasil.push('…');
        }
        hasil.push(n);
    }
    return hasil;
}
