/**
 * Label, warna, dan ikon status. Badge selalu pil + ikon + teks
 * (DESIGN.md §3.6), tidak pernah warna saja.
 */

export const STOCK_STATUS = {
  aman: { label: 'Aman', variant: 'success', icon: 'check_circle' },
  menipis: { label: 'Menipis', variant: 'warning', icon: 'schedule' },
  habis: { label: 'Habis', variant: 'danger', icon: 'cancel' },
};

export const TRANSACTION_STATUS = {
  settlement: { label: 'Lunas', variant: 'success', icon: 'check' },
  pending: { label: 'Pending', variant: 'warning', icon: 'schedule' },
  cancel: { label: 'Dibatalkan', variant: 'danger', icon: 'cancel' },
  expire: { label: 'Kedaluwarsa', variant: 'danger', icon: 'timer_off' },
  draft: { label: 'Ditahan', variant: 'info', icon: 'pause_circle' },
};

export const PAYMENT_TYPES = {
  tunai: { label: 'Tunai', icon: 'payments' },
  qris: { label: 'QRIS', icon: 'qr_code_2' },
  gopay: { label: 'GoPay', icon: 'account_balance_wallet' },
  bank_transfer: { label: 'Transfer VA', icon: 'account_balance' },
};

export const RETURN_STATUS = {
  menunggu: { label: 'Menunggu Approval', variant: 'warning', icon: 'schedule' },
  disetujui: { label: 'Disetujui', variant: 'success', icon: 'check' },
  ditolak: { label: 'Ditolak', variant: 'danger', icon: 'block' },
};

export const RETURN_REASONS = {
  rusak: 'Barang rusak / cacat',
  kedaluwarsa: 'Kedaluwarsa',
  salah_barang: 'Salah barang / varian',
  lainnya: 'Alasan lain',
};

/** Jenis mutasi stok; `sign` menentukan warna angka delta */
export const MOVE_TYPES = {
  masuk: { label: 'Barang Masuk', variant: 'success', icon: 'move_to_inbox' },
  penjualan: { label: 'Penjualan', variant: 'info', icon: 'point_of_sale' },
  retur: { label: 'Retur', variant: 'info', icon: 'assignment_return' },
  penyesuaian: { label: 'Penyesuaian', variant: 'warning', icon: 'tune' },
  opname: { label: 'Stok Opname', variant: 'neutral', icon: 'fact_check' },
};

export const OPNAME_STATUS = {
  draft: { label: 'Sedang Dihitung', variant: 'warning', icon: 'pending' },
  final: { label: 'Final', variant: 'success', icon: 'verified' },
};

export const PURCHASE_PAY_STATUS = {
  lunas: { label: 'Lunas', variant: 'success', icon: 'check' },
  belum_lunas: { label: 'Tempo', variant: 'warning', icon: 'schedule' },
  jatuh_tempo: { label: 'Lewat Jatuh Tempo', variant: 'danger', icon: 'error' },
};

export const ACTIVE_STATUS = {
  true: { label: 'Aktif', variant: 'success', icon: 'check_circle' },
  false: { label: 'Nonaktif', variant: 'neutral', icon: 'block' },
};

export const TIER_BADGES = {
  Gold: { label: 'Gold', variant: 'warning', icon: 'workspace_premium' },
  Silver: { label: 'Silver', variant: 'info', icon: 'military_tech' },
  Reguler: { label: 'Reguler', variant: 'neutral', icon: 'person' },
};

export function badgeHtml({ label, variant, icon }) {
  return `<span class="badge badge--${variant}"><span class="icon" aria-hidden="true">${icon}</span>${label}</span>`;
}

export function paymentHtml(tipe) {
  const { label, icon } = PAYMENT_TYPES[tipe];
  return `<span class="payment-type"><span class="icon icon--sm" aria-hidden="true">${icon}</span>${label}</span>`;
}
