/**
 * Form penerimaan barang (BARANG_MASUK + DETAIL_BARANG_MASUK, ER-D §3).
 * Baris barang dinamis, validasi per kolom dan per baris, ringkasan faktur
 * dihitung langsung, lalu stok bertambah saat dibukukan.
 *
 * ?produk=PRD-004,PRD-005  isi awal dari tombol restock (Stok Barang / Laporan Stok)
 * ?supplier=SUP-001        isi awal dari halaman Supplier
 */

import { initShell } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import {
  addPurchase, findSupplier, findUnit, getProduct, getProducts, getSuppliers, getUsers, isInvoiceTaken, nextPurchaseId,
} from '../core/db.js';
import { getSettings } from '../core/settings.js';
import { addDays, fromInputValue, startOfDay, toInputValue } from '../core/dates.js';
import { escapeHtml, formatDateLong, formatNumber, formatPercent, formatRupiah, parseNumber } from '../core/format.js';
import { setFlash } from '../core/flash.js';
import { bindLiveValidation, focusField, initHints, showFieldError, validateForm } from '../core/validation.js';
import { bindMoneyInput, setMoneyValue } from '../components/money-input.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const MAX_BACKDATE_DAYS = 30;

const user = getCurrentUser();
const { taxRate } = getSettings();
const params = new URLSearchParams(window.location.search);
const form = document.getElementById('purchase-form');
const linesBody = form.querySelector('[data-lines]');
const picker = form.querySelector('[data-picker]');
const today = startOfDay(new Date());

const state = {
  lines: [],
  submitted: false,
  leaving: false,
  initialSnapshot: '',
};

/* ---------- Nilai ---------- */

function readValues() {
  return {
    supplier: form.elements.supplier.value,
    no_faktur: form.elements.no_faktur.value.trim(),
    no_surat_jalan: form.elements.no_surat_jalan.value.trim(),
    tanggal: form.elements.tanggal.value,
    penerima: form.elements.penerima.value,
    diskon: form.elements.diskon.value.trim() === '' ? 0 : parseNumber(form.elements.diskon.value),
    ppn: form.elements.ppn.checked,
    termin_hari: Number(form.elements.termin_hari.value),
    update_cost: form.elements.update_cost.checked,
    catatan: form.elements.catatan.value.trim(),
  };
}

const lineValid = (line) => Number.isInteger(line.qty) && line.qty > 0 && Number.isFinite(line.harga_beli) && line.harga_beli > 0;

function totals(values = readValues()) {
  const subtotal = state.lines.filter(lineValid).reduce((sum, line) => sum + line.qty * line.harga_beli, 0);
  const diskon = Number.isFinite(values.diskon) ? Math.min(values.diskon, subtotal) : 0;
  const pajak = values.ppn ? Math.round((subtotal - diskon) * taxRate) : 0;
  return { subtotal, diskon, pajak, total: subtotal - diskon + pajak };
}

const snapshot = () => JSON.stringify({ ...readValues(), lines: state.lines });
const isDirty = () => !state.leaving && snapshot() !== state.initialSnapshot;

/* ---------- Validasi ---------- */

const RULES = {
  supplier: ({ supplier }) => (supplier ? '' : 'Pilih supplier pengirim.'),
  no_faktur: ({ no_faktur: faktur, supplier }) => {
    if (!faktur) return 'Nomor faktur wajib diisi.';
    if (!/^[A-Za-z0-9/.\-]{4,30}$/.test(faktur)) return 'Gunakan 4–30 karakter: huruf, angka, / . atau -.';
    if (supplier && isInvoiceTaken(faktur, supplier)) return 'Faktur ini sudah pernah dibukukan untuk supplier yang sama.';
    return '';
  },
  no_surat_jalan: ({ no_surat_jalan: sj }) => (!sj || /^[A-Za-z0-9/.\-]{3,30}$/.test(sj) ? '' : 'Format nomor surat jalan tidak valid.'),
  tanggal: ({ tanggal }) => {
    if (!tanggal) return 'Tanggal terima wajib diisi.';
    const date = fromInputValue(tanggal);
    if (date > today) return 'Tanggal terima tidak boleh di masa depan.';
    if (date < addDays(today, -MAX_BACKDATE_DAYS)) return `Maksimal ${MAX_BACKDATE_DAYS} hari ke belakang.`;
    return '';
  },
  penerima: ({ penerima }) => (penerima ? '' : 'Pilih penerima barang.'),
  items: () => {
    if (!state.lines.length) return 'Tambahkan minimal satu barang.';
    const invalid = state.lines.filter((line) => !lineValid(line)).length;
    return invalid ? `${invalid} baris belum lengkap: qty dan harga beli harus lebih dari 0.` : '';
  },
  diskon: ({ diskon }) => {
    if (!Number.isFinite(diskon) || diskon < 0) return 'Diskon tidak valid.';
    if (diskon > totals().subtotal) return 'Diskon tidak boleh melebihi subtotal.';
    return '';
  },
};

function lineError(line) {
  if (!state.submitted && !line.touched) return '';
  if (!Number.isInteger(line.qty) || line.qty <= 0) return 'Qty harus bilangan bulat > 0';
  if (!Number.isFinite(line.harga_beli) || line.harga_beli <= 0) return 'Harga beli wajib diisi';
  return '';
}

function lineWarning(line) {
  const product = getProduct(line.id_produk);
  if (!product || !Number.isFinite(line.harga_beli)) return '';
  if (line.harga_beli >= product.harga_jual) return `Di atas harga jual ${formatRupiah(product.harga_jual)} — sesuaikan harga jual`;
  const change = (line.harga_beli - product.harga_beli) / product.harga_beli;
  if (Math.abs(change) >= 0.1) return `Harga beli ${change > 0 ? 'naik' : 'turun'} ${formatPercent(Math.abs(change))} dari sebelumnya`;
  return '';
}

/* ---------- Baris barang ---------- */

function lineHtml(line, index) {
  const product = getProduct(line.id_produk);
  const unit = findUnit(product.satuan)?.singkatan ?? '';
  const name = escapeHtml(product.nama);
  return `
    <tr data-line="${index}">
      <td>
        <span class="table__name">${name}</span>
        <span class="table__sub">${product.id} · harga jual ${formatRupiah(product.harga_jual)}</span>
        <span class="line-note" data-line-note></span>
      </td>
      <td class="col-num">${formatNumber(product.stok)} <span class="text-muted">${unit}</span></td>
      <td>
        <div class="control control--cell">
          <input class="control__input control__input--num" type="number" min="1" step="1" inputmode="numeric"
                 value="${Number.isFinite(line.qty) ? line.qty : ''}" data-line-qty aria-label="Qty diterima ${name}">
          <span class="control__affix">${unit}</span>
        </div>
      </td>
      <td>
        <div class="control control--cell">
          <span class="control__affix">Rp</span>
          <input class="control__input control__input--num" type="text" inputmode="numeric" autocomplete="off"
                 data-money data-line-price aria-label="Harga beli ${name}">
        </div>
      </td>
      <td class="col-num" data-line-subtotal></td>
      <td class="col-center">
        <button class="icon-btn icon-btn--flat icon-btn--danger" type="button" data-action="remove-line" aria-label="Hapus baris ${name}">
          <span class="icon" aria-hidden="true">close</span>
        </button>
      </td>
    </tr>`;
}

function updateLineRow(index) {
  const line = state.lines[index];
  const row = linesBody.querySelector(`[data-line="${index}"]`);
  if (!row) return;
  const error = lineError(line);
  const warning = lineWarning(line);
  row.classList.toggle('is-invalid', Boolean(error));
  row.querySelector('[data-line-subtotal]').textContent = lineValid(line) ? formatRupiah(line.qty * line.harga_beli) : '–';
  const note = row.querySelector('[data-line-note]');
  note.className = `line-note ${error ? 'line-note--error' : warning ? 'line-note--warning' : ''}`;
  note.innerHTML = error || warning ? `<span class="icon icon--sm" aria-hidden="true">warning</span>${escapeHtml(error || warning)}` : '';
  row.querySelectorAll('input').forEach((input) => input.setAttribute('aria-invalid', String(Boolean(error))));
}

function renderLines() {
  linesBody.innerHTML = state.lines.length
    ? state.lines.map(lineHtml).join('')
    : `<tr><td colspan="6"><div class="empty-state empty-state--compact">
         <span class="empty-state__icon" aria-hidden="true"><span class="icon">inventory_2</span></span>
         <p class="empty-state__title">Belum ada barang</p>
         <p class="empty-state__text">Pilih produk di atas lalu tekan Tambah Baris.</p>
       </div></td></tr>`;
  linesBody.querySelectorAll('[data-line]').forEach((row) => {
    const index = Number(row.dataset.line);
    const price = row.querySelector('[data-line-price]');
    bindMoneyInput(price);
    setMoneyValue(price, state.lines[index].harga_beli);
    updateLineRow(index);
  });
  renderPicker();
  renderSummary();
}

function addLine(productId, qty = Number.NaN) {
  const product = getProduct(productId);
  if (!product) return;
  if (state.lines.some((line) => line.id_produk === productId)) {
    showToast({ type: 'info', title: 'Produk sudah ada', message: `${product.nama} sudah di daftar, ubah qty-nya saja.` });
    return;
  }
  state.lines.push({ id_produk: productId, qty, harga_beli: product.harga_beli, touched: false });
  renderLines();
  if (state.submitted) showFieldError(form, 'items', RULES.items());
}

function renderPicker() {
  const supplier = form.elements.supplier.value;
  const used = new Set(state.lines.map((line) => line.id_produk));
  const available = getProducts().filter((item) => !used.has(item.id));
  const option = (item) => `<option value="${item.id}">${escapeHtml(item.nama)} · stok ${item.stok}</option>`;
  const own = available.filter((item) => item.supplier === supplier);
  const others = available.filter((item) => item.supplier !== supplier);
  picker.innerHTML = '<option value="">Pilih produk…</option>'
    + (own.length ? `<optgroup label="Dipasok ${escapeHtml(findSupplier(supplier)?.nama ?? '')}">${own.map(option).join('')}</optgroup>` : '')
    + (others.length ? `<optgroup label="${supplier ? 'Produk lain' : 'Semua produk'}">${others.map(option).join('')}</optgroup>` : '');
}

/* ---------- Ringkasan ---------- */

function renderSummary() {
  const values = readValues();
  const result = totals(values);
  const set = (key, value) => { form.querySelector(`[data-sum="${key}"]`).textContent = value; };
  set('subtotal', formatRupiah(result.subtotal));
  set('pajak', formatRupiah(result.pajak));
  set('total', formatRupiah(result.total));

  const due = form.querySelector('[data-due-note]');
  if (values.tanggal && values.termin_hari) {
    due.textContent = `Jatuh tempo ${formatDateLong(addDays(fromInputValue(values.tanggal), values.termin_hari))}`;
  } else {
    due.textContent = values.termin_hari ? '' : 'Dibayar tunai saat barang diterima';
  }

  const units = state.lines.filter(lineValid).reduce((sum, line) => sum + line.qty, 0);
  form.querySelector('[data-line-count]').textContent = state.lines.length
    ? `${state.lines.length} SKU · ${formatNumber(units)} unit · ${formatRupiah(result.total)}`
    : '';
}

/* ---------- Simpan ---------- */

async function handleSubmit(event) {
  event.preventDefault();
  state.submitted = true;
  live.touchAll();
  const values = readValues();
  state.lines.forEach((_, index) => updateLineRow(index));
  const invalid = validateForm(form, RULES, values);
  if (invalid.length) {
    if (invalid[0] === 'items') {
      (linesBody.querySelector('tr.is-invalid input') ?? picker).focus();
    } else {
      focusField(form, invalid[0]);
    }
    showToast({ type: 'danger', title: 'Periksa kembali isian', message: `${invalid.length} bagian belum valid. Pesan ada di dekat kolomnya.` });
    return;
  }

  const result = totals(values);
  const units = state.lines.reduce((sum, line) => sum + line.qty, 0);
  const supplier = findSupplier(values.supplier);
  const confirmed = await confirmDialog({
    title: 'Bukukan penerimaan barang?',
    message: `${state.lines.length} SKU (${formatNumber(units)} unit) dari ${supplier.nama} senilai ${formatRupiah(result.total)}. Stok langsung bertambah dan dokumen tidak bisa diubah.`,
    confirmLabel: 'Bukukan',
    variant: 'primary',
    icon: 'inventory',
  });
  if (!confirmed) return;

  const received = fromInputValue(values.tanggal);
  const now = new Date();
  received.setHours(now.getHours(), now.getMinutes());
  const saved = addPurchase({
    tanggal: received.toISOString(),
    supplier: values.supplier,
    no_faktur: values.no_faktur,
    no_surat_jalan: values.no_surat_jalan,
    penerima: values.penerima,
    items: state.lines.map((line) => ({
      id_produk: line.id_produk, nama: getProduct(line.id_produk).nama, qty: line.qty, harga_beli: line.harga_beli,
    })),
    ...result,
    termin_hari: values.termin_hari,
    jatuh_tempo: addDays(received, values.termin_hari).toISOString(),
    status_bayar: values.termin_hari ? 'belum_lunas' : 'lunas',
    catatan: values.catatan,
    dibuat_oleh: user.id,
  }, { updateCost: values.update_cost });

  if (!saved) {
    showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
    return;
  }
  state.leaving = true;
  setFlash({ type: 'success', title: 'Barang masuk dibukukan', message: `${saved.id}: stok ${state.lines.length} produk bertambah ${formatNumber(units)} unit.` });
  window.location.href = `barang-masuk.html?id=${saved.id}`;
}

async function handleCancel(event) {
  if (!isDirty()) return;
  event.preventDefault();
  const discard = await confirmDialog({
    title: 'Buang isian penerimaan?',
    message: 'Data faktur dan rincian barang yang belum dibukukan akan hilang.',
    confirmLabel: 'Buang',
    cancelLabel: 'Lanjut Mengisi',
    icon: 'edit_off',
  });
  if (discard) {
    state.leaving = true;
    window.location.href = event.target.closest('a').href;
  }
}

/* ---------- Event ---------- */

const live = bindLiveValidation(form, RULES, readValues);

function bindEvents() {
  form.addEventListener('input', (event) => {
    const row = event.target.closest('[data-line]');
    if (row) {
      const line = state.lines[Number(row.dataset.line)];
      if (event.target.matches('[data-line-qty]')) line.qty = event.target.value === '' ? Number.NaN : Number(event.target.value);
      if (event.target.matches('[data-line-price]')) line.harga_beli = parseNumber(event.target.value);
      updateLineRow(Number(row.dataset.line));
      if (state.submitted) showFieldError(form, 'items', RULES.items());
    }
    renderSummary();
  });

  form.addEventListener('focusout', (event) => {
    const row = event.target.closest('[data-line]');
    if (!row || !event.target.value) return;
    state.lines[Number(row.dataset.line)].touched = true;
    updateLineRow(Number(row.dataset.line));
  });

  form.addEventListener('change', (event) => {
    if (event.target.name === 'supplier') {
      const supplier = findSupplier(event.target.value);
      if (supplier) applySupplierDefaults(supplier);
      renderPicker();
      if (form.elements.no_faktur.value) showFieldError(form, 'no_faktur', RULES.no_faktur(readValues()));
    }
    renderSummary();
  });

  form.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'add-line') {
      if (!picker.value) {
        showFieldError(form, 'picker', 'Pilih produk terlebih dahulu.');
        picker.focus();
        return;
      }
      showFieldError(form, 'picker', '');
      addLine(picker.value);
      linesBody.querySelector('tr:last-child [data-line-qty]')?.focus();
    }
    if (action === 'remove-line') {
      state.lines.splice(Number(event.target.closest('[data-line]').dataset.line), 1);
      renderLines();
      picker.focus();
    }
  });

  picker.addEventListener('change', () => showFieldError(form, 'picker', ''));
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

/** Termin & PPN mengikuti data supplier; tetap bisa diubah per faktur */
function applySupplierDefaults(supplier) {
  form.elements.termin_hari.value = String(supplier.termin_hari);
  form.elements.ppn.checked = supplier.pkp !== false;
}

/** Qty saran restock: sampai 3× stok minimum */
const suggestedQty = (product) => Math.max(1, product.stok_minimum * 3 - product.stok);

if (initShell()) {
  form.elements.supplier.insertAdjacentHTML('beforeend', getSuppliers()
    .filter((item) => item.aktif)
    .map((item) => `<option value="${item.id}">${escapeHtml(item.nama)}</option>`).join(''));
  form.elements.penerima.innerHTML = getUsers()
    .filter((item) => item.aktif)
    .map((item) => `<option value="${item.id}">${escapeHtml(item.nama)} · ${escapeHtml(item.keterangan)}</option>`).join('');
  form.elements.penerima.value = user.id;
  form.elements.tanggal.value = toInputValue(today);
  form.elements.tanggal.max = toInputValue(today);
  form.elements.tanggal.min = toInputValue(addDays(today, -MAX_BACKDATE_DAYS));
  form.querySelector('[data-tax-label]').textContent = `(${formatPercent(taxRate)})`;
  document.querySelector('[data-doc-number]').textContent = `Draf ${nextPurchaseId()}`;

  // Isi awal dari tombol restock / halaman supplier
  const prefill = (params.get('produk') ?? '').split(',').map(getProduct).filter(Boolean);
  const supplierId = params.get('supplier') ?? prefill[0]?.supplier ?? '';
  if (findSupplier(supplierId)?.aktif) {
    form.elements.supplier.value = supplierId;
    applySupplierDefaults(findSupplier(supplierId));
  }
  prefill.forEach((product) => state.lines.push({
    id_produk: product.id, qty: suggestedQty(product), harga_beli: product.harga_beli, touched: false,
  }));

  initHints(form);
  renderLines();
  bindEvents();
  state.initialSnapshot = snapshot();
  (prefill.length ? form.elements.no_faktur : form.elements.supplier).focus();
}
