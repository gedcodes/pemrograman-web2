/**
 * Pengaturan toko (menu Pengaturan). Nilai default di bawah; perubahan
 * dari halaman pengaturan disimpan di localStorage dan menimpa default.
 *
 * Payment Link Midtrans bukan rahasia (URL publik untuk pelanggan), jadi
 * aman berada di sini. Server Key TIDAK PERNAH dipakai di proyek ini.
 */

import { readJSON, writeJSON, removeItem } from './storage.js';

const SETTINGS_KEY = 'settings';

export const PLACEHOLDER_PAYMENT_LINK = 'https://app.sandbox.midtrans.com/payment-links/ganti-dengan-id-link';

/** Kanal non-tunai yang bisa diaktifkan di menu Metode Pembayaran */
export const NON_CASH_CHANNELS = ['qris', 'gopay', 'bank_transfer'];

const DEFAULTS = {
  taxRate: 0.11,
  memberDiscountRate: 0.05,
  /** PPh Final UMKM (PP 55/2022) atas peredaran bruto — dipakai Laporan Laba Rugi */
  incomeTaxRate: 0.005,
  paymentLinkUrl: PLACEHOLDER_PAYMENT_LINK,
  channels: { qris: true, gopay: true, bank_transfer: true },
  store: {
    nama: 'Toko Sari Amerta',
    tagline: 'Sembako & Kebutuhan Harian',
    alamat: 'Jl. Raya Puputan No. 41, Renon, Denpasar',
    telepon: '(0361) 284910',
    email: 'halo@tokosariamerta.id',
    npwp: '08.214.590.2-905.000',
    nib: '9120008310921',
    jamBuka: '07:00',
    jamTutup: '21:30',
    footer1: 'Terima kasih telah berbelanja',
    footer2: 'Barang yang sudah dibeli tidak dapat ditukar',
  },
};

export function getDefaultSettings() {
  return structuredClone(DEFAULTS);
}

export function getSettings() {
  const saved = readJSON(SETTINGS_KEY, {});
  return {
    ...DEFAULTS,
    ...saved,
    channels: { ...DEFAULTS.channels, ...saved.channels },
    store: { ...DEFAULTS.store, ...saved.store },
  };
}

export function saveSettings(patch) {
  return writeJSON(SETTINGS_KEY, { ...readJSON(SETTINGS_KEY, {}), ...patch });
}

/** Hapus satu kelompok pengaturan tersimpan sehingga kembali ke default */
export function resetSettings(keys) {
  const saved = readJSON(SETTINGS_KEY, {});
  keys.forEach((key) => delete saved[key]);
  if (Object.keys(saved).length) return writeJSON(SETTINGS_KEY, saved);
  removeItem(SETTINGS_KEY);
  return true;
}

/** Kanal non-tunai yang sedang aktif */
export function enabledChannels(settings = getSettings()) {
  return NON_CASH_CHANNELS.filter((key) => settings.channels[key]);
}
