import { reactive, readonly } from 'vue';

export type JenisToast = 'sukses' | 'galat' | 'info' | 'peringatan';

export interface Toast {
    id: number;
    jenis: JenisToast;
    pesan: string;
}

const daftar = reactive<Toast[]>([]);
let urut = 0;

export const toasts = readonly(daftar);

/** Tahan 3,5 detik lalu keluar dengan fade (DESIGN.md Bagian 6.2). */
const DURASI = 3500;

function tambah(jenis: JenisToast, pesan: string): void {
    const id = ++urut;
    daftar.push({ id, jenis, pesan });

    window.setTimeout(() => {
        const i = daftar.findIndex((t) => t.id === id);
        if (i !== -1) daftar.splice(i, 1);
    }, DURASI);
}

export const toast = {
    sukses: (pesan: string) => tambah('sukses', pesan),
    galat: (pesan: string) => tambah('galat', pesan),
    info: (pesan: string) => tambah('info', pesan),
    peringatan: (pesan: string) => tambah('peringatan', pesan),
};

export function tutupToast(id: number): void {
    const i = daftar.findIndex((t) => t.id === id);
    if (i !== -1) daftar.splice(i, 1);
}
