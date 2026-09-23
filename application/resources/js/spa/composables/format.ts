/**
 * Pemformatan angka dan tanggal.
 *
 * Aturan Rupiah mengikuti DESIGN.md Bagian 4.2: ada spasi setelah "Rp",
 * pemisah ribuan titik, tanpa desimal.
 */

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** "4317500" -> "4.317.500" (tanpa prefiks, supaya prefiks bisa diberi gaya sendiri). */
export function angka(n: number | null | undefined): string {
    return nf.format(Number(n ?? 0));
}

/** "4317500" -> "Rp 4.317.500" */
export function rupiah(n: number | null | undefined): string {
    return `Rp ${angka(n)}`;
}

/** Persen dengan dua desimal maksimal: 33.33 -> "33,33%" */
export function persen(n: number | null | undefined): string {
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(n ?? 0))}%`;
}

const tanggalPanjang = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});

const waktuPendek = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
});

export function tanggal(iso: string | null | undefined): string {
    if (!iso) return '-';
    return tanggalPanjang.format(new Date(iso));
}

export function jam(iso: string | null | undefined): string {
    if (!iso) return '-';
    return waktuPendek.format(new Date(iso));
}

export function tanggalJam(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${tanggalPanjang.format(d)} ${waktuPendek.format(d)}`;
}

/** Tanggal untuk <input type="date"> dan parameter query. */
export function kunciTanggal(d: Date = new Date()): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function hariLalu(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return kunciTanggal(d);
}

/** Label dan warna badge untuk status transaksi (DESIGN.md Bagian 3.6). */
export function statusTransaksi(status: string): {
    label: string;
    kelas: string;
} {
    switch (status) {
        case 'settlement':
            return { label: 'Lunas', kelas: 'badge-success' };
        case 'pending':
            return { label: 'Menunggu', kelas: 'badge-warning' };
        case 'expire':
            return { label: 'Kedaluwarsa', kelas: 'badge-danger' };
        case 'cancel':
            return { label: 'Dibatalkan', kelas: 'badge-danger' };
        case 'deny':
            return { label: 'Ditolak', kelas: 'badge-danger' };
        default:
            return { label: 'Draf', kelas: 'badge-info' };
    }
}

/** Gambar produk disajikan dari prototipe agar tidak perlu diunggah ulang. */
export function gambarProduk(path: string | null | undefined): string | null {
    if (!path) return null;
    return `/img-produk/${path}`;
}
