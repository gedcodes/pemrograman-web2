/**
 * Lembar hitung stok opname (?id=SO-…). Draf milik admin bisa diisi:
 * input fisik per baris, selisih & nilai dihitung langsung, simpan otomatis,
 * scan barcode untuk lompat ke baris, lalu finalisasi (rekonsiliasi stok).
 * Sesi final dan akses kasir ditampilkan sebagai laporan hasil (lihat saja).
 */

import { initShell } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import { findCategory, findOpname, findUnit, findUser, finalizeOpname, getProduct, saveOpname } from '../core/db.js';
import { summarizeOpname } from '../core/analytics.js';
import { escapeHtml, formatDateLong, formatDateTime, formatNumber, formatPercent, formatRupiah, formatTime, rupiahHtml } from '../core/format.js';
import { setFlash } from '../core/flash.js';
import { OPNAME_STATUS, badgeHtml } from '../components/badges.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const SAVE_DELAY = 500;

const user = getCurrentUser();
const id = new URLSearchParams(window.location.search).get('id');
const session = id ? findOpname(id) : null;
const editable = session?.status === 'draft' && user.peran === 'admin';

const rowsBody = document.querySelector('[data-rows]');
const state = {
  filter: '',
  reveal: !session?.blind || session?.status === 'final',
  invalid: new Set(),
};

/* ---------- Penyimpanan ---------- */

let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ok = saveOpname(session);
    document.querySelector('[data-saved-note]').textContent = ok
      ? `Tersimpan otomatis ${formatTime(new Date())}`
      : 'Gagal menyimpan: penyimpanan browser diblokir';
  }, SAVE_DELAY);
}

/* ---------- Baris ---------- */

const unitOf = (item) => findUnit(getProduct(item.id_produk)?.satuan)?.singkatan ?? '';

function diffCells(item) {
  if (item.fisik === null) return ['<span class="text-muted">–</span>', '<span class="text-muted">–</span>'];
  if (!state.reveal) return ['<span class="text-muted" title="Disembunyikan saat blind count">•••</span>', '<span class="text-muted">•••</span>'];
  const diff = item.fisik - item.stok_sistem;
  if (!diff) return ['<span class="delta">0</span>', '<span class="text-muted">Cocok</span>'];
  const cls = diff > 0 ? 'delta--up' : 'delta--down';
  return [
    `<span class="delta ${cls}">${diff > 0 ? '+' : ''}${formatNumber(diff)} ${unitOf(item)}</span>`,
    `<span class="delta ${cls}">${rupiahHtml(diff * item.harga_beli)}</span>`,
  ];
}

function matchesFilter(item) {
  if (state.filter === 'belum') return item.fisik === null;
  if (state.filter === 'selisih') return item.fisik !== null && item.fisik !== item.stok_sistem;
  return true;
}

function rowHtml(item, index) {
  const product = getProduct(item.id_produk);
  const name = escapeHtml(item.nama);
  const [diff, value] = diffCells(item);
  const book = state.reveal ? `${formatNumber(item.stok_sistem)} <span class="text-muted">${unitOf(item)}</span>` : '<span class="text-muted">•••</span>';
  const input = editable
    ? `<div class="control control--cell">
         <input class="control__input control__input--num" type="number" min="0" step="1" inputmode="numeric"
                value="${item.fisik ?? ''}" data-count aria-label="Hitung fisik ${name}" placeholder="—">
         <span class="control__affix">${unitOf(item)}</span>
       </div>`
    : `<span class="num">${item.fisik === null ? '–' : `${formatNumber(item.fisik)} ${unitOf(item)}`}</span>`;
  const status = item.fisik === null ? '' : item.fisik === item.stok_sistem || !state.reveal ? 'is-done' : 'is-warning';

  return `
    <tr data-index="${index}" class="${status} ${state.invalid.has(index) ? 'is-invalid' : ''}">
      <td>
        <span class="table__name">${name}</span>
        <span class="table__sub">${item.id_produk}${product ? ` · ${product.barcode}` : ''}</span>
        <span class="line-note" data-note-line></span>
      </td>
      <td class="col-num">${book}</td>
      <td>${input}</td>
      <td class="col-num" data-diff>${diff}</td>
      <td class="col-num" data-value>${value}</td>
    </tr>`;
}

function renderRows() {
  const visible = session.items.map((item, index) => [item, index]).filter(([item]) => matchesFilter(item));
  rowsBody.innerHTML = visible.length
    ? visible.map(([item, index]) => rowHtml(item, index)).join('')
    : `<tr><td colspan="5"><div class="empty-state empty-state--compact">
         <p class="empty-state__title">${state.filter === 'belum' ? 'Semua item sudah dihitung' : 'Tidak ada item selisih'}</p>
       </div></td></tr>`;
}

function updateRow(index) {
  const row = rowsBody.querySelector(`[data-index="${index}"]`);
  if (!row) return;
  const item = session.items[index];
  const [diff, value] = diffCells(item);
  row.querySelector('[data-diff]').innerHTML = diff;
  row.querySelector('[data-value]').innerHTML = value;
  const invalid = state.invalid.has(index);
  row.classList.toggle('is-invalid', invalid);
  row.classList.toggle('is-done', !invalid && item.fisik !== null && (item.fisik === item.stok_sistem || !state.reveal));
  row.classList.toggle('is-warning', !invalid && item.fisik !== null && item.fisik !== item.stok_sistem && state.reveal);
  row.querySelector('[data-note-line]').innerHTML = invalid
    ? '<span class="icon icon--sm" aria-hidden="true">warning</span>Isi bilangan bulat 0 atau lebih'
    : '';
  row.querySelector('[data-count]')?.setAttribute('aria-invalid', String(invalid));
}

/* ---------- Ringkasan ---------- */

function renderProgress() {
  const summary = summarizeOpname(session);
  const ratio = summary.total ? summary.counted / summary.total : 0;
  const progress = document.querySelector('[data-progress]');
  progress.setAttribute('aria-valuemax', String(summary.total));
  progress.setAttribute('aria-valuenow', String(summary.counted));
  document.querySelector('[data-progress-fill]').style.setProperty('--value', ratio.toFixed(3));
  document.querySelector('[data-progress-badge]').textContent = `${formatPercent(ratio)} selesai`;

  const hidden = '<span class="text-muted">tersembunyi</span>';
  const rows = [
    ['SKU dihitung', `${summary.counted} / ${summary.total}`],
    ['Tingkat cocok', state.reveal && summary.akurasi !== null ? formatPercent(summary.akurasi) : summary.akurasi === null ? '–' : hidden],
    ['Item selisih', state.reveal ? `${summary.selisihItem} (${summary.kurang} kurang · ${summary.lebih} lebih)` : hidden],
    ['Selisih bersih', state.reveal ? formatRupiah(summary.selisihNilai) : hidden, true],
  ];
  document.querySelector('[data-progress-list]').innerHTML = rows
    .map(([label, value, strong]) => `<div class="summary-list__row ${strong ? 'summary-list__row--strong' : ''}"><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');
}

function renderHeader() {
  const category = session.kategori ? findCategory(session.kategori)?.nama : 'Seluruh toko';
  const started = new Date(session.tanggal_mulai);
  document.title = `${session.id} · Stok Opname · Toko Sari Amerta`;
  document.querySelector('[data-crumb]').textContent = session.id;
  document.querySelector('[data-title]').textContent = session.status === 'final' ? 'Hasil Stok Opname' : 'Lembar Hitung Fisik';
  document.querySelector('[data-subtitle]').textContent = session.status === 'final'
    ? `Difinalisasi ${formatDateLong(new Date(session.tanggal_selesai))} oleh ${findUser(session.difinalisasi_oleh)?.nama ?? '-'}. Stok sudah disesuaikan.`
    : editable
      ? 'Ketik hasil hitung per rak. Isian tersimpan otomatis di perangkat ini.'
      : 'Sesi masih dihitung. Anda melihat dalam mode baca saja.';
  document.querySelector('[data-status-badge]').innerHTML = badgeHtml(OPNAME_STATUS[session.status]);
  document.querySelector('[data-mode-label]').textContent = session.blind ? 'Blind count' : 'Stok buku terlihat';
  document.querySelector('[data-sheet-hint]').textContent = session.blind && session.status === 'draft'
    ? 'Stok buku disembunyikan agar hitungan tidak terpengaruh angka sistem.'
    : 'Baris kuning menandai selisih antara fisik dan stok buku.';

  const fact = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  document.querySelector('[data-facts]').innerHTML = [
    fact('Kode sesi', `<span class="num">${session.id}</span>`),
    fact('Dimulai', formatDateTime(started)),
    fact('Cakupan', escapeHtml(category ?? '-')),
    fact('Petugas', escapeHtml(findUser(session.petugas)?.nama ?? '-')),
    fact('Dibuat oleh', escapeHtml(findUser(session.dibuat_oleh)?.nama ?? '-')),
    fact('Jumlah SKU', formatNumber(session.items.length)),
  ].join('');

  const note = document.querySelector('[data-note]');
  note.value = session.catatan ?? '';
  note.readOnly = !editable;

  const reveal = document.querySelector('[data-reveal]');
  reveal.hidden = !(session.blind && session.status === 'draft' && editable);
}

/* ---------- Aksi ---------- */

function handleCountInput(input) {
  const index = Number(input.closest('[data-index]').dataset.index);
  const raw = input.value.trim();
  const value = raw === '' ? null : Number(raw);
  const valid = value === null || (Number.isInteger(value) && value >= 0);
  if (valid) {
    state.invalid.delete(index);
    session.items[index].fisik = value;
    scheduleSave();
  } else {
    state.invalid.add(index);
  }
  updateRow(index);
  renderProgress();
}

function jumpTo(query) {
  const q = query.trim().toLowerCase();
  if (!q) return;
  const matches = session.items
    .map((item, index) => ({ item, index, product: getProduct(item.id_produk) }))
    .filter(({ item, product }) => product?.barcode === q || item.nama.toLowerCase().includes(q) || item.id_produk.toLowerCase() === q);

  if (!matches.length) {
    showToast({ type: 'danger', title: 'Produk tidak ada di lembar ini', message: `"${query}" tidak termasuk cakupan sesi ${session.id}.` });
    return;
  }
  if (matches.length > 1) showToast({ type: 'info', title: `${matches.length} produk cocok`, message: 'Menuju yang pertama. Ketik lebih spesifik atau scan barcode.' });

  if (!rowsBody.querySelector(`[data-index="${matches[0].index}"]`)) {
    state.filter = '';
    syncFilter();
    renderRows();
  }
  const row = rowsBody.querySelector(`[data-index="${matches[0].index}"]`);
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('is-flash');
  void row.offsetWidth;
  row.classList.add('is-flash');
  row.querySelector('[data-count]')?.focus();
  row.querySelector('[data-count]')?.select();
}

function syncFilter() {
  document.querySelectorAll('[data-row-filter] [data-filter]').forEach((option) => {
    option.setAttribute('aria-pressed', String(option.dataset.filter === state.filter));
  });
}

async function fillRest() {
  const rest = session.items.filter((item) => item.fisik === null);
  if (!rest.length) {
    showToast({ type: 'info', title: 'Semua sudah dihitung', message: 'Tidak ada item yang perlu ditandai.' });
    return;
  }
  const confirmed = await confirmDialog({
    title: `Tandai ${rest.length} item sesuai stok buku?`,
    message: 'Pakai hanya bila rak tersebut sudah diperiksa dan jumlahnya cocok. Item ini akan dihitung sebagai tanpa selisih.',
    confirmLabel: 'Tandai Sesuai',
    variant: 'primary',
    icon: 'done_all',
  });
  if (!confirmed) return;
  rest.forEach((item) => { item.fisik = item.stok_sistem; });
  scheduleSave();
  state.filter = '';
  syncFilter();
  renderRows();
  renderProgress();
}

async function finalize() {
  if (state.invalid.size) {
    showToast({ type: 'danger', title: 'Masih ada isian tidak valid', message: `${state.invalid.size} baris berisi angka yang salah.` });
    rowsBody.querySelector('tr.is-invalid [data-count]')?.focus();
    return;
  }
  const summary = summarizeOpname(session);
  if (summary.counted < summary.total) {
    state.filter = 'belum';
    syncFilter();
    renderRows();
    showToast({
      type: 'danger',
      title: `${summary.total - summary.counted} item belum dihitung`,
      message: 'Isi hitung fisik semua item, atau gunakan "Tandai sisa sesuai stok buku".',
      duration: 5000,
    });
    rowsBody.querySelector('[data-count]')?.focus();
    return;
  }

  const confirmed = await confirmDialog({
    title: 'Finalisasi stok opname?',
    message: summary.selisihItem
      ? `${summary.selisihItem} item selisih (${summary.kurang} kurang, ${summary.lebih} lebih) senilai ${formatRupiah(summary.selisihNilai)} akan diterapkan ke stok. Sesi final tidak bisa diubah.`
      : 'Semua item cocok dengan stok buku. Sesi akan ditutup tanpa perubahan stok.',
    confirmLabel: 'Finalisasi',
    variant: 'primary',
    icon: 'verified',
  });
  if (!confirmed) return;

  clearTimeout(saveTimer);
  saveOpname(session);
  if (!finalizeOpname(session.id, user.id)) {
    showToast({ type: 'danger', title: 'Gagal finalisasi', message: 'Sesi sudah final atau penyimpanan diblokir.' });
    return;
  }
  setFlash({
    type: 'success',
    title: 'Stok opname final',
    message: summary.selisihItem ? `${summary.selisihItem} selisih direkonsiliasi ke stok.` : 'Semua stok cocok, tidak ada penyesuaian.',
  });
  window.location.href = `form-stok-opname.html?id=${session.id}`;
}

function printSheet() {
  document.body.dataset.print = 'laporan';
  window.addEventListener('afterprint', () => delete document.body.dataset.print, { once: true });
  window.print();
}

/* ---------- Event ---------- */

function bindEvents() {
  rowsBody.addEventListener('input', (event) => {
    if (event.target.matches('[data-count]')) handleCountInput(event.target);
  });
  rowsBody.addEventListener('keydown', (event) => {
    // Enter di kolom hitung → lanjut ke baris berikutnya, seperti lembar kertas
    if (event.key !== 'Enter' || !event.target.matches('[data-count]')) return;
    event.preventDefault();
    const inputs = [...rowsBody.querySelectorAll('[data-count]')];
    const next = inputs[inputs.indexOf(event.target) + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      document.getElementById('scan')?.focus();
    }
  });

  document.querySelector('[data-scan-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    jumpTo(document.getElementById('scan').value);
    document.getElementById('scan').value = '';
  });

  document.querySelector('[data-row-filter]').addEventListener('click', (event) => {
    const option = event.target.closest('[data-filter]');
    if (!option) return;
    state.filter = option.dataset.filter;
    syncFilter();
    renderRows();
  });

  document.querySelector('[data-reveal-toggle]').addEventListener('change', (event) => {
    state.reveal = event.target.checked;
    renderRows();
    renderProgress();
  });

  document.querySelector('[data-note]').addEventListener('input', (event) => {
    if (!editable) return;
    session.catatan = event.target.value.trim();
    scheduleSave();
  });

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'fill-rest') fillRest();
    if (action === 'finalize') finalize();
    if (action === 'print') printSheet();
  });

  document.addEventListener('keydown', (event) => {
    const typing = event.target.closest('input, textarea, select');
    if (event.key === '/' && !typing && editable) {
      event.preventDefault();
      document.getElementById('scan').focus();
    }
  });
}

if (initShell()) {
  if (!session) {
    document.querySelector('[data-not-found]').hidden = false;
    document.querySelector('[data-sheet]').remove();
    document.querySelector('[data-action-bar]').remove();
  } else {
    if (!editable) document.querySelectorAll('[data-editable]').forEach((element) => element.remove());
    renderHeader();
    renderRows();
    renderProgress();
    bindEvents();
    if (editable) document.getElementById('scan').focus();
  }
}
