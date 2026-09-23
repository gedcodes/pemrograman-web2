/**
 * Pajak & Diskon — tarif PPN, diskon member, dan PPh final UMKM.
 * Form menyimpan persen (11), pengaturan menyimpan rasio (0,11).
 * Simulasi memakai core/pricing.js yang sama dengan Kasir.
 */

import { initShell } from '../layout/shell.js';
import { getProduct, getProducts } from '../core/db.js';
import { getDefaultSettings, getSettings, resetSettings, saveSettings } from '../core/settings.js';
import { calculateTotals, marginOnPrice } from '../core/pricing.js';
import { escapeHtml, formatNumber, formatPercent, formatRupiah } from '../core/format.js';
import { bindLiveValidation, focusField, initHints, validateForm } from '../core/validation.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const form = document.getElementById('tax-form');

/** Keranjang contoh: [id produk, qty] */
const SAMPLE_CART = [['PRD-001', 5], ['PRD-002', 2], ['PRD-004', 1], ['PRD-008', 1]];

const toPercent = (ratio) => Math.round(ratio * 10000) / 100;

function readValues() {
  const read = (name) => (form.elements[name].value.trim() === '' ? Number.NaN : Number(form.elements[name].value));
  return {
    ppnAktif: form.elements.ppnAktif.checked,
    taxRate: read('taxRate'),
    memberDiscountRate: read('memberDiscountRate'),
    incomeTaxRate: read('incomeTaxRate'),
  };
}

function rateRule(label, max, { required = true } = {}) {
  return (value) => {
    if (Number.isNaN(value)) return required ? `${label} wajib diisi.` : '';
    if (value < 0 || value > max) return `${label} harus antara 0 dan ${max}%.`;
    if (Math.abs(Math.round(value * 100) - value * 100) > 1e-6) return `${label} maksimal dua angka desimal.`;
    return '';
  };
}

/** Margin rata-rata tertimbang katalog, untuk peringatan diskon */
const averageMargin = (() => {
  const products = getProducts();
  const revenue = products.reduce((sum, item) => sum + item.harga_jual, 0);
  return revenue ? products.reduce((sum, item) => sum + marginOnPrice(item.harga_beli, item.harga_jual) * item.harga_jual, 0) / revenue : 0;
})();

const RULES = {
  taxRate: ({ ppnAktif, taxRate }) => (ppnAktif ? rateRule('Tarif PPN', 20)(taxRate) : ''),
  memberDiscountRate: ({ memberDiscountRate: rate }) => {
    const error = rateRule('Diskon member', 30)(rate);
    if (error) return error;
    return rate / 100 >= averageMargin ? `Diskon ≥ margin rata-rata katalog (${formatPercent(averageMargin)}): toko rugi di setiap transaksi member.` : '';
  },
  incomeTaxRate: ({ incomeTaxRate: rate }) => rateRule('Tarif PPh final', 5)(rate),
};

const live = bindLiveValidation(form, RULES, readValues);
let savedSnapshot = '';
const snapshot = () => JSON.stringify(readValues());

/* ---------- Simulasi ---------- */

function renderSimulation() {
  const values = readValues();
  const member = document.querySelector('[data-sim-member]').checked;
  const lines = SAMPLE_CART.map(([id, qty]) => ({ product: getProduct(id), qty })).filter((line) => line.product);
  const taxRate = values.ppnAktif && Number.isFinite(values.taxRate) ? values.taxRate / 100 : 0;
  const discountRate = member && Number.isFinite(values.memberDiscountRate) ? values.memberDiscountRate / 100 : 0;
  const totals = calculateTotals(lines.map((line) => ({ harga_satuan: line.product.harga_jual, qty: line.qty })), { discountRate, taxRate });
  const cost = lines.reduce((sum, line) => sum + line.product.harga_beli * line.qty, 0);
  const profit = totals.subtotal - totals.diskon - cost;

  document.querySelector('[data-sim-items]').innerHTML = lines.map((line) => `
    <li class="sim-list__item">
      <span>${escapeHtml(line.product.nama)} <span class="text-muted">× ${line.qty}</span></span>
      <span class="num">${formatRupiah(line.product.harga_jual * line.qty)}</span>
    </li>`).join('');

  const rows = [
    ['Subtotal', formatRupiah(totals.subtotal)],
    [`Diskon member (${formatPercent(discountRate)})`, `-${formatRupiah(totals.diskon)}`],
    [`PPN (${formatPercent(taxRate)})`, formatRupiah(totals.pajak)],
    ['Total dibayar', formatRupiah(totals.total), true],
    ['Laba kotor toko', formatRupiah(profit)],
  ];
  document.querySelector('[data-sim-totals]').innerHTML = rows
    .map(([label, value, strong]) => `<div class="summary-list__row ${strong ? 'summary-list__row--strong' : ''}"><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');
  document.querySelector('[data-sim-note]').textContent =
    `${formatNumber(lines.reduce((sum, line) => sum + line.qty, 0))} item · PPN ${formatRupiah(totals.pajak)} disetor ke negara, bukan pendapatan toko.`;
}

function syncTaxField() {
  const on = form.elements.ppnAktif.checked;
  form.elements.taxRate.disabled = !on;
}

function renderDirty() {
  form.querySelector('[data-dirty-note]').hidden = snapshot() === savedSnapshot;
}

function fill(settings) {
  form.elements.ppnAktif.checked = settings.taxRate > 0;
  form.elements.taxRate.value = toPercent(settings.taxRate || getDefaultSettings().taxRate);
  form.elements.memberDiscountRate.value = toPercent(settings.memberDiscountRate);
  form.elements.incomeTaxRate.value = toPercent(settings.incomeTaxRate);
  initHints(form);
  live.reset();
  syncTaxField();
  renderSimulation();
}

/* ---------- Simpan ---------- */

function handleSubmit(event) {
  event.preventDefault();
  live.touchAll();
  const values = readValues();
  const invalid = validateForm(form, RULES, values);
  if (invalid.length) {
    focusField(form, invalid[0]);
    showToast({ type: 'danger', title: 'Periksa kembali tarif', message: `${invalid.length} kolom belum valid.` });
    return;
  }
  const patch = {
    taxRate: values.ppnAktif ? values.taxRate / 100 : 0,
    memberDiscountRate: values.memberDiscountRate / 100,
    incomeTaxRate: values.incomeTaxRate / 100,
  };
  if (!saveSettings(patch)) {
    showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
    return;
  }
  savedSnapshot = snapshot();
  renderDirty();
  showToast({
    type: 'success',
    title: 'Tarif disimpan',
    message: `PPN ${formatPercent(patch.taxRate)} · diskon member ${formatPercent(patch.memberDiscountRate)} berlaku untuk transaksi berikutnya.`,
  });
}

async function handleReset() {
  const confirmed = await confirmDialog({
    title: 'Kembalikan tarif default?',
    message: 'PPN 11%, diskon member 5%, dan PPh final 0,5%.',
    confirmLabel: 'Kembalikan',
    variant: 'primary',
    icon: 'restart_alt',
  });
  if (!confirmed) return;
  resetSettings(['taxRate', 'memberDiscountRate', 'incomeTaxRate']);
  fill(getDefaultSettings());
  savedSnapshot = snapshot();
  renderDirty();
  showToast({ type: 'success', title: 'Tarif default dipulihkan', message: 'Transaksi berikutnya memakai tarif awal.' });
}

function bindEvents() {
  form.addEventListener('input', () => {
    renderSimulation();
    renderDirty();
  });
  form.addEventListener('change', (event) => {
    if (event.target.name === 'ppnAktif') {
      syncTaxField();
      validateForm(form, { taxRate: RULES.taxRate }, readValues());
    }
    renderSimulation();
    renderDirty();
  });
  form.addEventListener('submit', handleSubmit);
  form.querySelector('[data-action="reset"]').addEventListener('click', handleReset);
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      form.requestSubmit();
    }
  });
}

if (initShell()) {
  fill(getSettings());
  savedSnapshot = snapshot();
  bindEvents();
}
