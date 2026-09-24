/** Satu opsi untuk BaseSelect. */
export interface OpsiPilihan<V extends string | number = string | number> {
    nilai: V;
    label: string;
    /** Teks kecil di bawah label, ikut dicari (mis. barcode, tanggal). */
    keterangan?: string;
    nonaktif?: boolean;
}

/** Bentuk daftar data dari API menjadi opsi BaseSelect. */
export function keOpsi<D, V extends string | number>(
    daftar: readonly D[],
    nilai: (d: D) => V,
    label: (d: D) => string,
    keterangan?: (d: D) => string | undefined,
): OpsiPilihan<V>[] {
    return daftar.map((d) => ({
        nilai: nilai(d),
        label: label(d),
        keterangan: keterangan?.(d),
    }));
}
