import { ambil, ApiError, simpan } from './client';
import type { MidtransConfig, Payment, StatusTransaksi } from './types';

/**
 * Pembayaran non-tunai lewat popup Midtrans Snap.
 *
 * Dipakai bersama oleh halaman Kasir (membayar pertama kali) dan Riwayat
 * Transaksi (MELANJUTKAN tagihan yang popup-nya sempat ditutup).
 *
 * Status lunas tidak pernah ditentukan di sini. Callback popup hanya menjadi
 * aba-aba untuk bertanya ke server, dan server yang mencocokkannya ke
 * Midtrans sebelum menandai transaksi lunas.
 */

export interface TokenSnap {
    snap_token: string;
    order_id: string | null;
    berlaku_sampai: string | null;
    /** true bila tagihan yang sama dibuka kembali, bukan tagihan baru. */
    dipakai_ulang: boolean;
}

export interface StatusPembayaran {
    status: StatusTransaksi;
    dicek_ke_midtrans: boolean;
    payment: Payment | null;
}

export interface PenanganSnap {
    sukses: () => void;
    menunggu: () => void;
    galat: () => void;
    tutup: () => void;
}

interface SnapGlobal {
    pay(token: string, opsi: Record<string, () => void>): void;
}

let konfig: MidtransConfig | null = null;

/* Snap menolak `pay()` kedua selagi popup pertama masih terbuka. */
let popupTerbuka = false;

/** Muat snap.js sekali, memakai Client Key dari server. */
async function siapkanSnap(): Promise<boolean> {
    konfig ??= await ambil<MidtransConfig>('/midtrans/config');
    if (!konfig.siap) return false;

    if (document.getElementById('midtrans-snap')) return true;

    const cfg = konfig;
    return new Promise((selesai) => {
        const s = document.createElement('script');
        s.id = 'midtrans-snap';
        s.src = cfg.snap_url;
        s.setAttribute('data-client-key', cfg.client_key);
        s.onload = () => selesai(true);
        s.onerror = () => {
            s.remove();
            selesai(false);
        };
        document.head.appendChild(s);
    });
}

/** Apakah pembayaran non-tunai sudah dapat dipakai. */
export async function snapSiap(): Promise<boolean> {
    try {
        return await siapkanSnap();
    } catch {
        return false;
    }
}

/**
 * Buka popup pembayaran sebuah transaksi.
 *
 * Bila tagihannya masih berlaku, server menyerahkan token yang SAMA, sehingga
 * pelanggan melihat QRIS / nomor VA yang tadi. Melempar ApiError bila
 * transaksi tidak dapat ditagih: 409 (sudah lunas atau kedaluwarsa),
 * 503 (Midtrans belum dikonfigurasi).
 */
export async function bayarDenganSnap(
    transaksiId: number,
    penangan: PenanganSnap,
): Promise<TokenSnap> {
    if (popupTerbuka) {
        throw new ApiError('Popup pembayaran masih terbuka.', 0);
    }

    if (!(await snapSiap())) {
        throw new ApiError(
            'Pembayaran non-tunai belum aktif atau skrip Midtrans gagal dimuat.',
            503,
        );
    }

    const token = (
        await simpan<TokenSnap>(`/transactions/${transaksiId}/snap-token`)
    ).data;

    const snap = (window as unknown as { snap?: SnapGlobal }).snap;
    if (!snap) {
        throw new ApiError('Skrip Midtrans belum siap. Coba lagi.', 0);
    }

    const lalu = (f: () => void) => () => {
        popupTerbuka = false;
        f();
    };

    popupTerbuka = true;
    snap.pay(token.snap_token, {
        onSuccess: lalu(penangan.sukses),
        onPending: lalu(penangan.menunggu),
        onError: lalu(penangan.galat),
        onClose: lalu(penangan.tutup),
    });

    return token;
}

/**
 * Status terkini. Untuk transaksi pending, server lebih dulu bertanya ke
 * Midtrans, jadi pembayaran yang sudah masuk langsung tercatat walau
 * webhook belum (atau tidak dapat) tiba.
 */
export function periksaStatus(transaksiId: number): Promise<StatusPembayaran> {
    return ambil<StatusPembayaran>(`/transactions/${transaksiId}/status`);
}
