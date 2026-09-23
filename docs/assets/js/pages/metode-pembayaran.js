/**
 * Metode Pembayaran — aktif/nonaktif kanal non-tunai dan URL Midtrans
 * Payment Link. Validasi menolak URL selain sandbox midtrans.com sesuai
 * aturan keamanan PERANCANGAN §5.4.
 */

import { initShell } from '../layout/shell.js';
import { getTransactions } from '../core/db.js';
import { inRange, paymentBreakdown } from '../core/analytics.js';
import { addDays, startOfDay } from '../core/dates.js';
import { NON_CASH_CHANNELS, PLACEHOLDER_PAYMENT_LINK, getDefaultSettings, getSettings, resetSettings, saveSettings } from '../core/settings.js';
import { formatNumber, formatPercent, formatRupiah } from '../core/format.js';
import { bindLiveValidation, focusField, initHints, showFieldError, validateForm } from '../core/validation.js';
import { PAYMENT_TYPES } from '../components/badges.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const form = document.getElementById('payment-form');

const DESCRIPTIONS = {
  tunai: 'Uang diterima di laci kas, kembalian dihitung otomatis. Selalu aktif.',
  qris: 'Semua e-wallet & m-banking lewat satu kode QR Midtrans.',
  gopay: 'Pembayaran GoPay lewat halaman Payment Link.',
  bank_transfer: 'Virtual Account BCA, BNI, BRI, Mandiri, dan Permata.',
};

function readValues() {
  return {
    paymentLinkUrl: form.elements.paymentLinkUrl.value.trim(),
    channels: Object.fromEntries(NON_CASH_CHANNELS.map((key) => [key, form.elements[`channel-${key}`].checked])),
  };
}

function linkError(url) {
  if (!url) return 'URL Payment Link wajib diisi.';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'URL tidak valid. Salin lengkap dari dashboard Midtrans.';
  }
  if (parsed.protocol !== 'https:') return 'URL harus diawali https://';
  if (!/(^|\.)midtrans\.com$/.test(parsed.hostname)) return 'Domain harus midtrans.com agar pelanggan tidak diarahkan ke situs lain.';
  if (!parsed.hostname.includes('sandbox')) return 'Hanya link Sandbox yang diizinkan (PERANCANGAN §5.4). Gunakan app.sandbox.midtrans.com.';
  return '';
}

const RULES = {
  paymentLinkUrl: ({ paymentLinkUrl, channels }) => (Object.values(channels).some(Boolean) ? linkError(paymentLinkUrl) : ''),
};

const live = bindLiveValidation(form, RULES, readValues);
let savedSnapshot = '';
const snapshot = () => JSON.stringify(readValues());

/* ---------- Tampilan ---------- */

function renderMethods(settings) {
  const today = startOfDay(new Date());
  const breakdown = paymentBreakdown(inRange(getTransactions(), addDays(today, -29), addDays(today, 1)));
  const total = Object.values(breakdown).reduce((sum, item) => sum + item.total, 0);

  document.querySelector('[data-methods]').innerHTML = Object.entries(PAYMENT_TYPES).map(([key, { label, icon }]) => {
    const usage = breakdown[key] ?? { jumlah: 0, total: 0 };
    const share = total ? usage.total / total : 0;
    const cash = key === 'tunai';
    return `
      <li class="setting-list__item">
        <span class="setting-list__icon" aria-hidden="true"><span class="icon">${icon}</span></span>
        <div class="setting-list__text">
          <span class="setting-list__title">${label}${cash ? '' : ' <span class="text-caption text-muted">via Midtrans</span>'}</span>
          <span class="text-small text-secondary">${DESCRIPTIONS[key]}</span>
          <span class="text-caption text-muted num">${formatNumber(usage.jumlah)} transaksi · ${formatRupiah(usage.total)} · ${formatPercent(share)}</span>
        </div>
        <label class="switch">
          <input class="switch__input" type="checkbox" role="switch" name="channel-${key}"
                 ${cash || settings.channels[key] ? 'checked' : ''} ${cash ? 'disabled' : ''}
                 aria-label="${cash ? 'Tunai selalu aktif' : `Aktifkan ${label}`}">
          <span class="switch__track" aria-hidden="true"></span>
        </label>
      </li>`;
  }).join('');
}

function renderLink() {
  const url = form.elements.paymentLinkUrl.value.trim();
  const valid = !linkError(url);
  document.querySelector('[data-placeholder-warning]').hidden = url !== PLACEHOLDER_PAYMENT_LINK;
  const test = document.querySelector('[data-test-link]');
  if (valid) {
    test.href = url;
    test.removeAttribute('aria-disabled');
  } else {
    test.removeAttribute('href');
    test.setAttribute('aria-disabled', 'true');
  }

  const box = document.querySelector('[data-qr]');
  if (!valid) {
    box.innerHTML = '<p class="text-caption text-muted">QR tampil setelah URL valid.</p>';
  } else if (window.qrcode) {
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createSvgTag(4, 0);
  } else {
    box.innerHTML = '<p class="text-caption text-muted">Pustaka QR gagal dimuat.</p>';
  }
}

function renderDirty() {
  form.querySelector('[data-dirty-note]').hidden = snapshot() === savedSnapshot;
}

function fill(settings) {
  renderMethods(settings);
  form.elements.paymentLinkUrl.value = settings.paymentLinkUrl;
  initHints(form);
  showFieldError(form, 'paymentLinkUrl', '');
  live.reset();
  renderLink();
}

/* ---------- Simpan ---------- */

function handleSubmit(event) {
  event.preventDefault();
  live.touchAll();
  const values = readValues();
  const invalid = validateForm(form, RULES, values);
  if (invalid.length) {
    focusField(form, invalid[0]);
    showToast({ type: 'danger', title: 'URL belum valid', message: 'Periksa pesan di bawah kolom URL Payment Link.' });
    return;
  }
  if (!saveSettings(values)) {
    showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
    return;
  }
  savedSnapshot = snapshot();
  renderDirty();
  const active = NON_CASH_CHANNELS.filter((key) => values.channels[key]).map((key) => PAYMENT_TYPES[key].label);
  showToast({
    type: 'success',
    title: 'Metode pembayaran disimpan',
    message: active.length ? `Kasir menerima Tunai, ${active.join(', ')}.` : 'Kasir hanya menerima Tunai; tab Non-Tunai disembunyikan.',
  });
}

async function handleReset() {
  const confirmed = await confirmDialog({
    title: 'Kembalikan pengaturan default?',
    message: 'Semua kanal non-tunai diaktifkan dan URL Payment Link kembali ke contoh bawaan.',
    confirmLabel: 'Kembalikan',
    variant: 'primary',
    icon: 'restart_alt',
  });
  if (!confirmed) return;
  resetSettings(['paymentLinkUrl', 'channels']);
  fill(getDefaultSettings());
  savedSnapshot = snapshot();
  renderDirty();
  showToast({ type: 'success', title: 'Default dipulihkan', message: 'Metode pembayaran kembali ke pengaturan awal.' });
}

function bindEvents() {
  form.addEventListener('input', () => {
    renderLink();
    renderDirty();
  });
  form.addEventListener('change', (event) => {
    if (event.target.name?.startsWith('channel-')) showFieldError(form, 'paymentLinkUrl', RULES.paymentLinkUrl(readValues()));
    renderDirty();
  });
  form.addEventListener('submit', handleSubmit);
  form.querySelector('[data-action="reset"]').addEventListener('click', handleReset);
  document.querySelector('[data-test-link]').addEventListener('click', (event) => {
    if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault();
  });
}

if (initShell()) {
  fill(getSettings());
  savedSnapshot = snapshot();
  bindEvents();
  // Pustaka QR dimuat defer; gambar ulang setelah tersedia
  window.addEventListener('load', renderLink, { once: true });
}
