import { ref, watch } from 'vue';

/**
 * Bunyi "bip" untuk pemindaian barcode, dibangkitkan Web Audio sehingga
 * tidak perlu berkas suara.
 *
 * Kasir sering memindai tanpa melihat layar. Bip pendek bernada tinggi
 * berarti barang masuk keranjang; nada rendah yang lebih panjang berarti
 * barcode tidak dikenal. Bunyi dapat dimatikan, dan pilihannya diingat per
 * perangkat.
 */

const KUNCI = 'pos:bunyi-pindai';

function bacaPilihan(): boolean {
    try {
        return localStorage.getItem(KUNCI) !== 'mati';
    } catch {
        return true;
    }
}

/** Bunyi pemindaian aktif; bersama untuk seluruh aplikasi. */
export const bunyiAktif = ref(bacaPilihan());

watch(bunyiAktif, (aktif) => {
    try {
        localStorage.setItem(KUNCI, aktif ? 'hidup' : 'mati');
    } catch {
        // Penyimpanan diblokir (mode privat): pilihan berlaku sesi ini saja.
    }
});

let konteks: AudioContext | null = null;

function nada(frekuensi: number, durasiMs: number, volume = 0.15): void {
    if (!bunyiAktif.value || typeof AudioContext === 'undefined') return;

    try {
        konteks ??= new AudioContext();
        // Peramban menahan audio sampai ada interaksi pengguna; ketukan atau
        // pindaian pertama sudah cukup untuk membukanya.
        if (konteks.state === 'suspended') void konteks.resume();

        const osc = konteks.createOscillator();
        const penguat = konteks.createGain();
        const mulai = konteks.currentTime;
        const selesai = mulai + durasiMs / 1000;

        osc.type = 'square';
        osc.frequency.setValueAtTime(frekuensi, mulai);
        penguat.gain.setValueAtTime(volume, mulai);
        // Diredam menjelang akhir supaya tidak berbunyi "klik".
        penguat.gain.exponentialRampToValueAtTime(0.0001, selesai);

        osc.connect(penguat).connect(konteks.destination);
        osc.start(mulai);
        osc.stop(selesai);
    } catch {
        // Audio tidak tersedia; umpan balik visual tetap berjalan.
    }
}

export function bunyiBerhasil(): void {
    nada(1320, 90);
}

export function bunyiGagal(): void {
    nada(220, 260, 0.2);
}
