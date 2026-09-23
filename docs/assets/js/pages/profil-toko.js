/**
 * Profil Toko — identitas, kontak, jam buka, dan teks footer struk.
 * Pratinjau struk memakai nilai form yang belum disimpan, sehingga
 * pengguna melihat hasil cetak sebelum menyimpan.
 */

import { initShell } from '../layout/shell.js';
import { getTransactions } from '../core/db.js';
import { getDefaultSettings, getSettings, resetSettings, saveSettings } from '../core/settings.js';
import { formatDateTime } from '../core/format.js';
import {
  bindLiveValidation, clearFieldErrors, focusField, initHints, isEmail, isPhone, validateForm,
} from '../core/validation.js';
import { fillFormValues, readFormValues } from '../components/form-dialog.js';
import { receiptHtml } from '../components/receipt.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const form = document.getElementById('store-form');
const digits = (value) => value.replace(/\D/g, '');

/** 15 digit → 08.214.590.2-905.000; NPWP 16 digit (NIK) dibiarkan apa adanya */
function formatNpwp(value) {
  const d = digits(value);
  if (d.length !== 15) return value.trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}.${d.slice(8, 9)}-${d.slice(9, 12)}.${d.slice(12)}`;
}

const RULES = {
  nama: ({ nama }) => (nama.length >= 3 ? '' : 'Nama toko wajib diisi, minimal 3 karakter.'),
  npwp: ({ npwp }) => {
    if (!npwp) return 'NPWP wajib diisi untuk struk pajak.';
    const count = digits(npwp).length;
    return count === 15 || count === 16 ? '' : `NPWP harus 15 atau 16 digit, sekarang ${count} digit.`;
  },
  nib: ({ nib }) => (!nib || /^\d{13}$/.test(nib) ? '' : 'NIB harus tepat 13 digit angka.'),
  alamat: ({ alamat }) => (alamat.length >= 10 ? '' : 'Alamat wajib diisi, minimal 10 karakter.'),
  telepon: ({ telepon }) => {
    if (!telepon) return 'Nomor telepon wajib diisi.';
    return isPhone(telepon) ? '' : 'Format telepon tidak valid. Contoh: (0361) 284910.';
  },
  email: ({ email }) => (!email || isEmail(email) ? '' : 'Format email tidak valid.'),
  jamBuka: ({ jamBuka }) => (jamBuka ? '' : 'Isi jam buka.'),
  jamTutup: ({ jamBuka, jamTutup }) => {
    if (!jamTutup) return 'Isi jam tutup.';
    return jamBuka && jamTutup <= jamBuka ? 'Jam tutup harus setelah jam buka.' : '';
  },
};

const live = bindLiveValidation(form, RULES, () => readFormValues(form));
let savedSnapshot = '';

const snapshot = () => JSON.stringify(readFormValues(form));
const isDirty = () => snapshot() !== savedSnapshot;

/* ---------- Tampilan ---------- */

/** Contoh transaksi member terbaru agar baris diskon ikut terlihat */
const sampleTransaction = getTransactions().find((trx) => trx.status === 'settlement' && trx.pelanggan)
  ?? getTransactions().find((trx) => trx.status === 'settlement');

function renderPreview() {
  const values = readFormValues(form);
  const preview = document.querySelector('[data-preview]');
  if (!sampleTransaction) {
    preview.innerHTML = '<p class="text-small text-secondary">Belum ada transaksi untuk dijadikan contoh.</p>';
    return;
  }
  preview.innerHTML = receiptHtml(sampleTransaction, { store: { ...values, nama: values.nama || 'Nama Toko' } });
  document.querySelector('[data-preview-note]').textContent =
    `Contoh memakai struk ${sampleTransaction.id} (${formatDateTime(new Date(sampleTransaction.tanggal))}).`;
}

function renderCounts() {
  form.querySelectorAll('[data-count]').forEach((counter) => {
    const input = form.elements.namedItem(counter.dataset.count);
    counter.textContent = `${input.value.length}/${input.maxLength}`;
  });
}

function renderDirty() {
  form.querySelector('[data-dirty-note]').hidden = !isDirty();
}

function fill(store) {
  fillFormValues(form, store);
  clearFieldErrors(form);
  initHints(form);
  live.reset();
  renderCounts();
  renderPreview();
}

/* ---------- Simpan ---------- */

function handleSubmit(event) {
  event.preventDefault();
  form.elements.npwp.value = formatNpwp(form.elements.npwp.value);
  live.touchAll();
  const values = readFormValues(form);
  const invalid = validateForm(form, RULES, values);
  if (invalid.length) {
    focusField(form, invalid[0]);
    showToast({ type: 'danger', title: 'Periksa kembali isian', message: `${invalid.length} kolom belum valid.` });
    return;
  }
  if (!saveSettings({ store: values })) {
    showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
    return;
  }
  savedSnapshot = snapshot();
  renderDirty();
  showToast({ type: 'success', title: 'Profil toko disimpan', message: 'Struk berikutnya memakai identitas baru.' });
}

async function handleReset() {
  const confirmed = await confirmDialog({
    title: 'Kembalikan profil default?',
    message: 'Identitas, kontak, dan teks struk kembali ke data awal Toko Sari Amerta.',
    confirmLabel: 'Kembalikan',
    variant: 'primary',
    icon: 'restart_alt',
  });
  if (!confirmed) return;
  resetSettings(['store']);
  fill(getDefaultSettings().store);
  savedSnapshot = snapshot();
  renderDirty();
  showToast({ type: 'success', title: 'Profil dikembalikan', message: 'Data awal toko dipulihkan.' });
}

function bindEvents() {
  form.addEventListener('input', () => {
    renderCounts();
    renderPreview();
    renderDirty();
  });
  form.elements.npwp.addEventListener('blur', (event) => {
    event.target.value = formatNpwp(event.target.value);
    renderPreview();
  });
  form.elements.nib.addEventListener('input', (event) => {
    event.target.value = digits(event.target.value);
  });
  form.addEventListener('submit', handleSubmit);
  form.querySelector('[data-action="reset"]').addEventListener('click', handleReset);

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (isDirty()) event.preventDefault();
  });
}

if (initShell()) {
  fill(getSettings().store);
  savedSnapshot = snapshot();
  bindEvents();
}
