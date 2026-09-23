/**
 * Form tambah / ubah produk (?id=PRD-xxx untuk mode ubah).
 * Validasi JavaScript per kolom (saat blur & saat submit), ringkasan margin
 * langsung, unggah gambar, dan peringatan perubahan belum disimpan.
 */

import { initShell } from '../layout/shell.js';
import {
  findUnit, getCategories, getProduct, getSuppliers, getUnits, isBarcodeTaken, saveProduct,
} from '../core/db.js';
import { marginOnPrice, markupOnCost } from '../core/pricing.js';
import { escapeHtml, formatPercent, formatRupiah, parseNumber } from '../core/format.js';
import { setFlash } from '../core/flash.js';
import { badgeHtml } from '../components/badges.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { productImageSrc } from '../components/thumb.js';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, resizeImageFile } from '../components/image.js';
import { bindMoneyInput, setMoneyValue } from '../components/money-input.js';

const form = document.getElementById('product-form');
const editingId = new URLSearchParams(window.location.search).get('id');
const editing = editingId ? getProduct(editingId) : null;

const state = {
  image: editing?.gambar ?? null,
  touched: new Set(),
  submitting: false,
  initialSnapshot: '',
};

const field = (name) => form.querySelector(`[data-field="${name}"]`);
const input = (name) => form.elements.namedItem(name);

/* ---------- Nilai form ---------- */

function readInteger(name) {
  const raw = input(name).value.trim();
  return raw === '' ? Number.NaN : Number(raw);
}

function readValues() {
  return {
    nama: input('nama').value.trim(),
    barcode: input('barcode').value.trim(),
    kategori: input('kategori').value,
    satuan: input('satuan').value,
    supplier: input('supplier').value,
    harga_beli: parseNumber(input('harga_beli').value),
    harga_jual: parseNumber(input('harga_jual').value),
    stok: readInteger('stok'),
    stok_minimum: readInteger('stok_minimum'),
    aktif: input('aktif').checked,
    backorder: input('backorder').checked,
  };
}

const snapshot = () => JSON.stringify({ ...readValues(), image: state.image });
const isDirty = () => !state.submitting && snapshot() !== state.initialSnapshot;

/* ---------- Validasi ---------- */

function validateCount(value, label) {
  if (Number.isNaN(value)) return `${label} wajib diisi.`;
  if (!Number.isInteger(value)) return `${label} harus bilangan bulat.`;
  if (value < 0) return `${label} tidak boleh negatif.`;
  return '';
}

const RULES = {
  nama: ({ nama }) => {
    if (!nama) return 'Nama produk wajib diisi.';
    if (nama.length < 3) return 'Nama produk minimal 3 karakter.';
    return '';
  },
  barcode: ({ barcode }) => {
    if (!barcode) return 'Barcode wajib diisi.';
    if (!/^\d{8,13}$/.test(barcode)) return 'Barcode harus berupa 8–13 digit angka.';
    if (isBarcodeTaken(barcode, editing?.id)) return 'Barcode sudah dipakai produk lain.';
    return '';
  },
  kategori: ({ kategori }) => (kategori ? '' : 'Pilih kategori produk.'),
  satuan: ({ satuan }) => (satuan ? '' : 'Pilih satuan jual.'),
  harga_beli: ({ harga_beli: beli }) => {
    if (Number.isNaN(beli)) return 'Harga beli wajib diisi.';
    if (beli <= 0) return 'Harga beli harus lebih dari Rp 0.';
    return '';
  },
  harga_jual: ({ harga_beli: beli, harga_jual: jual }) => {
    if (Number.isNaN(jual)) return 'Harga jual wajib diisi.';
    if (!Number.isNaN(beli) && jual <= beli) return `Harga jual harus lebih besar dari harga beli (${formatRupiah(beli)}).`;
    return '';
  },
  stok: ({ stok }) => validateCount(stok, 'Stok'),
  stok_minimum: ({ stok_minimum: minimum }) => validateCount(minimum, 'Stok minimum'),
};

function showFieldMessage(name, error) {
  const wrapper = field(name);
  const message = wrapper.querySelector('.field__message');
  wrapper.classList.toggle('is-invalid', Boolean(error));
  input(name)?.setAttribute('aria-invalid', String(Boolean(error)));
  message.innerHTML = error
    ? `<span class="icon" aria-hidden="true">warning</span>${escapeHtml(error)}`
    : escapeHtml(message.dataset.hint ?? '');
}

function validateField(name, values = readValues()) {
  const error = RULES[name](values);
  showFieldMessage(name, error);
  return error;
}

/** Validasi semua kolom; kembalikan nama kolom pertama yang salah */
function validateAll() {
  const values = readValues();
  const invalid = Object.keys(RULES).filter((name) => {
    state.touched.add(name);
    return validateField(name, values);
  });
  return invalid;
}

/* ---------- Tampilan turunan ---------- */

function renderSummary() {
  const { harga_beli: beli, harga_jual: jual, stok } = readValues();
  const summary = (key, value) => {
    form.querySelector(`[data-summary="${key}"]`).textContent = value;
  };
  const badge = form.querySelector('[data-margin-badge]');

  if (Number.isNaN(beli) || Number.isNaN(jual) || beli <= 0 || jual <= 0) {
    ['laba', 'margin', 'markup', 'potensi'].forEach((key) => summary(key, '–'));
    badge.innerHTML = '';
    return;
  }

  const margin = marginOnPrice(beli, jual);
  summary('laba', formatRupiah(jual - beli));
  summary('margin', formatPercent(margin));
  summary('markup', formatPercent(markupOnCost(beli, jual)));
  summary('potensi', Number.isNaN(stok) ? '–' : formatRupiah(Math.max(0, stok) * jual));

  let status = { label: 'Sehat', variant: 'success', icon: 'check' };
  if (margin <= 0) status = { label: 'Rugi', variant: 'danger', icon: 'trending_down' };
  else if (margin < 0.1) status = { label: 'Tipis', variant: 'warning', icon: 'warning' };
  badge.innerHTML = badgeHtml(status);
}

function renderUnitSuffix() {
  const unit = findUnit(input('satuan').value)?.singkatan ?? '';
  form.querySelectorAll('[data-unit-suffix]').forEach((suffix) => {
    suffix.textContent = unit;
  });
}

function renderCharCount() {
  form.querySelector('[data-char-count]').textContent = `${input('nama').value.length}/120`;
}

function renderPreview() {
  const preview = form.querySelector('[data-preview]');
  const src = state.image ? productImageSrc({ gambar: state.image }) : null;
  preview.hidden = !src;
  if (src) preview.querySelector('[data-preview-img]').src = src;
}

function renderDirty() {
  form.querySelector('[data-dirty-note]').hidden = !isDirty();
}

/* ---------- Gambar ---------- */

async function handleImage(file) {
  if (!file) return;
  if (!IMAGE_TYPES.includes(file.type)) {
    showFieldMessage('gambar', 'Format gambar harus PNG, JPG, atau WebP.');
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    showFieldMessage('gambar', `Ukuran gambar ${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB melebihi batas 2 MB.`);
    return;
  }
  try {
    state.image = await resizeImageFile(file);
    showFieldMessage('gambar', '');
    renderPreview();
    renderDirty();
  } catch (error) {
    showFieldMessage('gambar', error.message);
  }
}

function bindImage() {
  const fileInput = document.getElementById('gambar');
  const dropzone = form.querySelector('[data-dropzone]');

  fileInput.addEventListener('change', () => {
    handleImage(fileInput.files[0]);
    fileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, () => dropzone.classList.add('is-dragover')));
  ['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, () => dropzone.classList.remove('is-dragover')));

  form.querySelector('[data-action="remove-image"]').addEventListener('click', () => {
    state.image = null;
    renderPreview();
    renderDirty();
    fileInput.focus();
  });
}

/* ---------- Simpan & batal ---------- */

function handleSubmit(event) {
  event.preventDefault();
  const invalid = validateAll();
  if (invalid.length) {
    const first = input(invalid[0]);
    first.focus();
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    showToast({
      type: 'danger',
      title: 'Periksa kembali isian',
      message: `${invalid.length} kolom belum valid. Pesan kesalahan ada di bawah tiap kolom.`,
    });
    return;
  }

  const values = readValues();
  const saved = saveProduct({
    ...editing,
    ...values,
    supplier: values.supplier || null,
    gambar: state.image,
  });

  if (!saved) {
    showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
    return;
  }

  state.submitting = true;
  setFlash({
    type: 'success',
    title: editing ? 'Perubahan disimpan' : 'Produk ditambahkan',
    message: `${saved.nama} (${saved.id}) tersimpan di katalog.`,
  });
  window.location.href = 'produk.html';
}

async function handleCancel(event) {
  if (!isDirty()) return;
  event.preventDefault();
  const discard = await confirmDialog({
    title: 'Buang perubahan?',
    message: 'Isian yang belum disimpan akan hilang.',
    confirmLabel: 'Buang Perubahan',
    cancelLabel: 'Lanjut Mengisi',
    icon: 'edit_off',
  });
  if (discard) {
    state.submitting = true;
    window.location.href = event.target.closest('a').href;
  }
}

/* ---------- Inisialisasi ---------- */

function fillSelect(name, items, label) {
  input(name).insertAdjacentHTML('beforeend', items.map((item) => `<option value="${item.id}">${escapeHtml(label(item))}</option>`).join(''));
}

function fillForm(product) {
  ['nama', 'barcode', 'kategori', 'satuan', 'stok', 'stok_minimum'].forEach((name) => {
    input(name).value = product[name];
  });
  input('supplier').value = product.supplier ?? '';
  setMoneyValue(input('harga_beli'), product.harga_beli);
  setMoneyValue(input('harga_jual'), product.harga_jual);
  input('aktif').checked = product.aktif;
  input('backorder').checked = product.backorder;
}

function applyMode() {
  const title = editing ? 'Ubah Produk' : 'Tambah Produk';
  document.title = `${title} · Toko Sari Amerta`;
  form.closest('main').querySelector('[data-mode-title]').textContent = title;
  form.closest('main').querySelector('[data-mode-crumb]').textContent = title;
  if (editing) {
    form.closest('main').querySelector('[data-mode-badge]').innerHTML = `<span class="icon" aria-hidden="true">edit</span>Mengubah ${editing.id}`;
    form.querySelector('[data-stock-label]').innerHTML = 'Stok Saat Ini <span class="field__required" aria-hidden="true">*</span>';
    form.querySelector('#stok-msg').dataset.hint = 'Koreksi selisih fisik sebaiknya lewat menu Stok Barang';
  }
}

function bindEvents() {
  form.addEventListener('input', (event) => {
    const { name } = event.target;
    if (state.touched.has(name) && RULES[name]) validateField(name);
    if (name === 'harga_beli' && state.touched.has('harga_jual')) validateField('harga_jual');
    if (name === 'nama') renderCharCount();
    renderSummary();
    renderDirty();
  });
  form.addEventListener('change', (event) => {
    if (event.target.name === 'satuan') renderUnitSuffix();
    if (RULES[event.target.name]) {
      state.touched.add(event.target.name);
      validateField(event.target.name);
    }
    renderDirty();
  });
  form.addEventListener('focusout', (event) => {
    const { name } = event.target;
    if (!RULES[name] || !event.target.value) return;
    state.touched.add(name);
    validateField(name);
  });
  form.addEventListener('submit', handleSubmit);
  form.querySelector('[data-action="cancel"]').addEventListener('click', handleCancel);

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
  if (editingId && !editing) {
    form.hidden = true;
    document.querySelector('[data-not-found]').hidden = false;
  } else {
    // Kategori/supplier nonaktif tetap ditampilkan bila sedang dipakai produk ini
    const usable = (item, current) => item.aktif !== false || item.id === current;
    fillSelect('kategori', getCategories().filter((item) => usable(item, editing?.kategori)), (item) => item.nama);
    fillSelect('satuan', getUnits(), (item) => `${item.nama} (${item.singkatan})`);
    fillSelect('supplier', getSuppliers().filter((item) => usable(item, editing?.supplier)), (item) => item.nama);
    if (editing) fillForm(editing);

    applyMode();
    form.querySelectorAll('.field__message').forEach((message) => {
      message.textContent = message.dataset.hint ?? '';
    });
    renderCharCount();
    renderUnitSuffix();
    renderSummary();
    renderPreview();
    form.querySelectorAll('[data-money]').forEach(bindMoneyInput);
    bindImage();
    bindEvents();
    state.initialSnapshot = snapshot();
  }
}
