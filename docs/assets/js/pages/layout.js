/**
 * layout.html — template master + katalog komponen.
 * Menghidupkan rangka aplikasi dan contoh interaksi komponen.
 */

import { initShell, renderShell } from '../layout/shell.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import { getCurrentUser, signInAs } from '../core/session.js';
import { ROLE_LABELS } from '../data/users.js';
import { findUser } from '../core/db.js';
import { formatDateLong } from '../core/format.js';

initShell();

const today = document.querySelector('[data-today]');
today.dateTime = new Date().toISOString().slice(0, 10);
today.textContent = formatDateLong();

/* ---------- Toast: bergiliran menampilkan tiap varian ---------- */

const TOAST_SAMPLES = [
  { type: 'success', title: 'Produk tersimpan', message: 'Indomie Goreng Rendang 85g ditambahkan ke katalog.' },
  { type: 'warning', title: 'Stok menipis', message: 'Beras Pandan Wangi 5kg tersisa 3 karung.' },
  { type: 'danger', title: 'Nominal kurang', message: 'Uang diterima lebih kecil dari total tagihan.' },
  { type: 'info', title: 'Transaksi ditahan', message: '#TRX-20260916-0048 bisa dilanjutkan dari Riwayat.' },
];
let toastIndex = 0;

document.querySelector('[data-demo="toast"]').addEventListener('click', () => {
  showToast(TOAST_SAMPLES[toastIndex % TOAST_SAMPLES.length]);
  toastIndex += 1;
});

/* ---------- Modal konfirmasi hapus ---------- */

document.querySelector('[data-demo="modal"]').addEventListener('click', async () => {
  const confirmed = await confirmDialog({
    title: 'Hapus produk?',
    message: 'Contoh dialog konfirmasi. Tombol Batal mendapat fokus awal, Esc menutup dialog.',
    confirmLabel: 'Ya, Hapus',
  });
  showToast(confirmed
    ? { type: 'success', title: 'Dikonfirmasi', message: 'Aksi hapus dijalankan.' }
    : { type: 'info', title: 'Dibatalkan', message: 'Tidak ada data yang berubah.' });
});

const rowsBody = document.querySelector('[data-demo="product-rows"]');
const rowCount = document.querySelector('[data-demo="row-count"]');

rowsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="delete-row"]');
  if (!button) return;

  const row = button.closest('tr');
  const name = row.querySelector('.table__name').textContent;
  const confirmed = await confirmDialog({
    title: 'Hapus produk?',
    message: `"${name}" akan dihapus dari katalog. Tindakan ini tidak dapat dibatalkan.`,
    confirmLabel: 'Ya, Hapus',
  });
  if (!confirmed) return;

  row.remove();
  const remaining = rowsBody.rows.length;
  rowCount.textContent = remaining > 0 ? `1–${remaining}` : '0';
  showToast({ type: 'success', title: 'Produk dihapus', message: `${name} telah dihapus.` });
});

/* ---------- Tombol loading ---------- */

document.querySelector('[data-demo="loading"]').addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.setAttribute('aria-busy', 'true');
  setTimeout(() => {
    button.removeAttribute('aria-busy');
    showToast({ type: 'success', title: 'Tersimpan', message: 'Perubahan berhasil disimpan.' });
  }, 1400);
});

/* ---------- Chip & segmented: pilihan tunggal ---------- */

function singleSelect(group, selector) {
  group.addEventListener('click', (event) => {
    const option = event.target.closest(selector);
    if (!option) return;
    group.querySelectorAll(selector).forEach((item) => item.setAttribute('aria-pressed', String(item === option)));
  });
}

singleSelect(document.querySelector('[data-demo="chips"]'), '.chip');
singleSelect(document.querySelector('[data-demo="segmented"]'), '.segmented__option');

/* ---------- Simulasi peran ---------- */

const roleGroup = document.querySelector('[data-demo="role"]');

function syncRoleButtons() {
  const current = getCurrentUser();
  roleGroup.querySelectorAll('[data-user]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.user === current.id));
  });
}

roleGroup.addEventListener('click', (event) => {
  const button = event.target.closest('[data-user]');
  if (!button) return;

  signInAs(button.dataset.user);
  renderShell();
  syncRoleButtons();

  const user = findUser(button.dataset.user);
  showToast({
    type: 'info',
    title: `Masuk sebagai ${ROLE_LABELS[user.peran]}`,
    message: user.peran === 'kasir'
      ? 'Menu Master Data, Laporan, dan Pengaturan disembunyikan.'
      : 'Semua menu tersedia.',
  });
});

syncRoleButtons();
