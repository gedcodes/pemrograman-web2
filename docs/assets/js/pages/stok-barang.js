/**
 * Stok Barang — monitoring stok per produk, penyesuaian manual (rusak,
 * hilang, kedaluwarsa, koreksi), kartu stok per produk, dan riwayat mutasi.
 * Kasir hanya melihat (PERANCANGAN §2.2 "Inventori: lihat saja").
 */

import { initShell, pageUrl } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import {
  applyStockChanges, findCategory, findUnit, findUser, getCategories, getProducts, getStockMoves, getStockStatus,
} from '../core/db.js';
import { toDateKey } from '../core/dates.js';
import { escapeHtml, formatDateShort, formatDateTime, formatNumber, formatRupiah, formatTime, rupiahHtml } from '../core/format.js';
import { downloadCsv } from '../core/csv.js';
import { MOVE_TYPES, STOCK_STATUS, badgeHtml } from '../components/badges.js';
import { thumbHtml } from '../components/thumb.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { createFormDialog } from '../components/form-dialog.js';
import { showToast } from '../components/toast.js';

const user = getCurrentUser();
const canEdit = user.peran === 'admin';
const params = new URLSearchParams(window.location.search);

const ADJUST_REASONS = {
  kurang: ['Rusak / cacat', 'Kedaluwarsa', 'Hilang', 'Pemakaian internal toko', 'Koreksi hitung', 'Lainnya'],
  tambah: ['Barang ditemukan', 'Koreksi hitung', 'Bonus dari supplier', 'Lainnya'],
};

const els = {
  filters: document.querySelector('[data-filters]'),
  moveFilters: document.querySelector('[data-move-filters]'),
  cards: document.querySelector('[data-status-cards]'),
  adjustDialog: document.getElementById('adjust-dialog'),
  historyDialog: document.getElementById('history-dialog'),
};

const state = {
  q: params.get('q') ?? '',
  kategori: '',
  status: params.get('status') ?? '',
  moveQ: '',
  moveTipe: '',
};

/* ---------- Daftar stok ---------- */

function filteredProducts() {
  const query = state.q.trim().toLowerCase();
  const order = { habis: 0, menipis: 1, aman: 2 };
  return getProducts()
    .filter((item) =>
      (!query || item.nama.toLowerCase().includes(query) || item.barcode.includes(query))
      && (!state.kategori || item.kategori === state.kategori)
      && (!state.status || getStockStatus(item) === state.status))
    .sort((a, b) => order[getStockStatus(a)] - order[getStockStatus(b)] || a.nama.localeCompare(b.nama, 'id'));
}

/** Bar ketersediaan: stok dibanding 3× stok minimum (patokan stok ideal) */
function coverageHtml(item) {
  const ideal = Math.max(1, item.stok_minimum * 3);
  const ratio = Math.min(1, item.stok / ideal);
  const status = getStockStatus(item);
  return `
    <div class="meter meter--${STOCK_STATUS[status].variant}" role="img"
         aria-label="Stok ${item.stok} dari patokan ideal ${ideal}">
      <div class="meter__fill" style="--value: ${ratio.toFixed(3)}"></div>
    </div>`;
}

function stockRowHtml(item) {
  const status = getStockStatus(item);
  const unit = findUnit(item.satuan)?.singkatan ?? '';
  const name = escapeHtml(item.nama);
  const restock = canEdit && status !== 'aman'
    ? `<a class="icon-btn icon-btn--flat" href="${pageUrl('form-barang-masuk')}?produk=${item.id}" aria-label="Pesan ulang ${name}">
         <span class="icon" aria-hidden="true">add_shopping_cart</span></a>` : '';
  const adjust = canEdit
    ? `<button class="icon-btn icon-btn--flat" type="button" data-action="adjust" aria-label="Sesuaikan stok ${name}">
         <span class="icon" aria-hidden="true">tune</span></button>` : '';
  return `
    <tr data-id="${item.id}" class="${status === 'habis' ? 'is-danger' : status === 'menipis' ? 'is-warning' : ''}">
      <td>
        <div class="table__product">
          ${thumbHtml(item)}
          <div>
            <span class="table__name">${name}</span>
            <span class="table__sub">${item.id} · ${item.barcode}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(findCategory(item.kategori)?.nama ?? '-')}</td>
      <td class="col-num"><strong>${formatNumber(item.stok)}</strong> <span class="text-muted">${unit}</span></td>
      <td class="col-num">${formatNumber(item.stok_minimum)} <span class="text-muted">${unit}</span></td>
      <td class="col-meter">${coverageHtml(item)}</td>
      <td class="col-num">${rupiahHtml(item.stok * item.harga_beli)}</td>
      <td class="col-center">${badgeHtml(STOCK_STATUS[status])}</td>
      <td class="col-center">
        <div class="table__actions">
          ${restock}${adjust}
          <button class="icon-btn icon-btn--flat" type="button" data-action="history" aria-label="Kartu stok ${name}">
            <span class="icon" aria-hidden="true">history</span>
          </button>
        </div>
      </td>
    </tr>`;
}

const stockTable = createTableView({
  root: document.querySelector('[data-stock-table]'),
  columns: 8,
  noun: 'produk',
  getItems: filteredProducts,
  rowHtml: stockRowHtml,
  emptyHtml: () => emptyStateHtml({
    icon: 'search_off',
    title: `Tidak ada produk yang cocok${state.q ? ` dengan "${escapeHtml(state.q)}"` : ''}`,
    text: 'Coba kata kunci lain atau hapus filter kategori dan status.',
    action: '<button class="btn btn--primary" type="button" data-action="clear-filters">Hapus Filter</button>',
  }),
});

function renderCounts() {
  const products = getProducts();
  const counts = { aman: 0, menipis: 0, habis: 0 };
  products.forEach((item) => { counts[getStockStatus(item)] += 1; });
  const value = products.reduce((sum, item) => sum + item.stok * item.harga_beli, 0);
  const units = products.reduce((sum, item) => sum + item.stok, 0);

  Object.entries(counts).forEach(([key, count]) => {
    els.cards.querySelector(`[data-count="${key}"]`).textContent = formatNumber(count);
  });
  els.cards.querySelector('[data-count="nilai"]').textContent = formatRupiah(value);
  els.cards.querySelectorAll('[data-status]').forEach((card) => card.setAttribute('aria-pressed', String(card.dataset.status === state.status)));
  document.querySelector('[data-subtitle]').textContent =
    `${formatNumber(products.length)} SKU · ${formatNumber(units)} unit di rak & gudang, dinilai dengan harga beli`;
}

/* ---------- Riwayat mutasi ---------- */

const deltaHtml = (delta) =>
  `<span class="delta ${delta > 0 ? 'delta--up' : 'delta--down'}">${delta > 0 ? '+' : ''}${formatNumber(delta)}</span>`;

function referenceHtml(move) {
  if (!move.referensi) return escapeHtml(move.catatan || '–');
  const target = move.referensi.startsWith('TRX') ? `${pageUrl('riwayat-transaksi')}?trx=${move.referensi}&periode=all`
    : move.referensi.startsWith('BM') ? `${pageUrl('barang-masuk')}?id=${move.referensi}`
      : move.referensi.startsWith('SO') ? `${pageUrl('form-stok-opname')}?id=${move.referensi}`
        : `${pageUrl('retur-penjualan')}`;
  return `<a class="link num" href="${target}">${move.referensi}</a><span class="table__sub">${escapeHtml(move.catatan || '')}</span>`;
}

function filteredMoves() {
  const query = state.moveQ.trim().toLowerCase();
  return getStockMoves().filter((move) =>
    (!state.moveTipe || move.tipe === state.moveTipe)
    && (!query || move.nama.toLowerCase().includes(query) || (move.referensi ?? '').toLowerCase().includes(query)));
}

function moveRowHtml(move) {
  const date = new Date(move.tanggal);
  const stock = move.stok_sesudah === null ? '<span class="text-muted">–</span>' : `${formatNumber(move.stok_sebelum)} → ${formatNumber(move.stok_sesudah)}`;
  return `
    <tr>
      <td><span class="num">${formatDateShort(date)}</span><span class="table__sub">${formatTime(date)}</span></td>
      <td><span class="table__name">${escapeHtml(move.nama)}</span><span class="table__sub">${move.id_produk}</span></td>
      <td>${badgeHtml(MOVE_TYPES[move.tipe])}</td>
      <td class="col-num">${deltaHtml(move.delta)}</td>
      <td class="col-num">${stock}</td>
      <td class="table__clip">${referenceHtml(move)}</td>
      <td>${escapeHtml(findUser(move.oleh)?.nama ?? '-')}</td>
    </tr>`;
}

const moveTable = createTableView({
  root: document.querySelector('[data-move-table]'),
  columns: 7,
  noun: 'mutasi',
  pageSize: 12,
  getItems: filteredMoves,
  rowHtml: moveRowHtml,
  emptyHtml: () => emptyStateHtml({ icon: 'history', title: 'Belum ada mutasi yang cocok', text: 'Mutasi tercatat otomatis dari kasir, barang masuk, retur, opname, dan penyesuaian.' }),
});

/* ---------- Penyesuaian stok ---------- */

let adjusting = null;

function fillReasons(direction) {
  const select = els.adjustDialog.querySelector('[name="alasan"]');
  const current = select.value;
  select.innerHTML = '<option value="">Pilih alasan</option>'
    + ADJUST_REASONS[direction].map((reason) => `<option value="${reason}">${reason}</option>`).join('');
  if (ADJUST_REASONS[direction].includes(current)) select.value = current;
}

function readAdjust() {
  const form = els.adjustDialog.querySelector('form');
  return {
    arah: form.elements.arah.value,
    jumlah: form.elements.jumlah.value === '' ? Number.NaN : Number(form.elements.jumlah.value),
  };
}

function renderPreview() {
  if (!adjusting) return;
  const { arah, jumlah } = readAdjust();
  const unit = findUnit(adjusting.satuan)?.singkatan ?? '';
  const valid = Number.isInteger(jumlah) && jumlah > 0;
  const after = valid ? adjusting.stok + (arah === 'tambah' ? jumlah : -jumlah) : adjusting.stok;
  els.adjustDialog.querySelector('[data-preview]').innerHTML =
    `${formatNumber(adjusting.stok)} → <strong class="${after < 0 ? 'text-danger' : ''}">${formatNumber(after)}</strong> ${unit}`
    + (valid ? ` <span class="text-muted">(${arah === 'tambah' ? '+' : '−'}${formatRupiah(jumlah * adjusting.harga_beli)})</span>` : '');
}

const adjustEditor = createFormDialog(els.adjustDialog, {
  rules: {
    jumlah: ({ jumlah, arah }) => {
      if (Number.isNaN(jumlah)) return 'Jumlah wajib diisi.';
      if (!Number.isInteger(jumlah) || jumlah <= 0) return 'Jumlah harus bilangan bulat lebih dari 0.';
      if (arah === 'kurang' && jumlah > adjusting.stok) return `Tidak boleh melebihi stok saat ini (${adjusting.stok}).`;
      return '';
    },
    alasan: ({ alasan }) => (alasan ? '' : 'Pilih alasan penyesuaian.'),
    catatan: ({ alasan, catatan }) => (alasan === 'Lainnya' && catatan.length < 5 ? 'Jelaskan alasan minimal 5 karakter.' : ''),
  },
  onSubmit: (values) => {
    const delta = values.arah === 'tambah' ? values.jumlah : -values.jumlah;
    const note = values.catatan ? `${values.alasan}: ${values.catatan}` : values.alasan;
    if (!applyStockChanges([{ id: adjusting.id, delta }], { tipe: 'penyesuaian', catatan: note, oleh: user.id })) {
      showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
      return false;
    }
    showToast({
      type: 'success',
      title: 'Stok disesuaikan',
      message: `${adjusting.nama}: ${delta > 0 ? '+' : ''}${delta} (${values.alasan.toLowerCase()}).`,
    });
    renderAll();
    return true;
  },
});

function openAdjust(id) {
  adjusting = getProducts().find((item) => item.id === id);
  const unit = findUnit(adjusting.satuan)?.singkatan ?? '';
  adjustEditor.open({
    title: 'Penyesuaian Stok',
    subtitle: `${adjusting.nama} · stok sistem ${formatNumber(adjusting.stok)} ${unit}`,
    values: { arah: 'kurang', jumlah: '', alasan: '', catatan: '' },
  });
  fillReasons('kurang');
  els.adjustDialog.querySelector('[data-unit]').textContent = unit;
  renderPreview();
}

/* ---------- Kartu stok ---------- */

function openHistory(id) {
  const product = getProducts().find((item) => item.id === id);
  const moves = getStockMoves().filter((move) => move.id_produk === id).slice(0, 25);
  const unit = findUnit(product.satuan)?.singkatan ?? '';
  els.historyDialog.querySelector('[data-history-title]').textContent = `Kartu Stok · ${product.nama}`;
  els.historyDialog.querySelector('[data-history-meta]').textContent =
    `Stok saat ini ${formatNumber(product.stok)} ${unit} · ${moves.length} mutasi terakhir (penjualan riwayat lama tidak dicatat per item)`;
  els.historyDialog.querySelector('[data-history-list]').innerHTML = moves.length
    ? moves.map((move) => `
        <li class="timeline__item timeline__item--${MOVE_TYPES[move.tipe].variant}">
          <span class="timeline__title">${MOVE_TYPES[move.tipe].label} ${deltaHtml(move.delta)} ${unit}</span>
          <span class="timeline__meta">${formatDateTime(new Date(move.tanggal))} · ${escapeHtml(move.referensi ?? move.catatan ?? '')}${move.referensi && move.catatan ? ` · ${escapeHtml(move.catatan)}` : ''}</span>
        </li>`).join('')
    : '<li class="text-small text-secondary">Belum ada mutasi tercatat untuk produk ini.</li>';
  els.historyDialog.showModal();
}

/* ---------- Tab & export ---------- */

function selectTab(name, { focus = false } = {}) {
  document.querySelectorAll('[role="tab"]').forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  document.getElementById('panel-stok').hidden = name !== 'stok';
  document.getElementById('panel-mutasi').hidden = name !== 'mutasi';
  if (name === 'mutasi') moveTable.render();
}

function exportCsv() {
  const rows = filteredProducts().map((item) => [
    item.id, item.barcode, item.nama, findCategory(item.kategori)?.nama ?? '', item.stok, item.stok_minimum,
    findUnit(item.satuan)?.singkatan ?? '', item.harga_beli, item.stok * item.harga_beli, STOCK_STATUS[getStockStatus(item)].label,
  ]);
  downloadCsv(`stok-barang-${toDateKey(new Date())}.csv`, [
    ['ID', 'Barcode', 'Produk', 'Kategori', 'Stok', 'Minimum', 'Satuan', 'Harga Beli', 'Nilai Stok', 'Status'],
    ...rows,
  ]);
  showToast({ type: 'success', title: 'CSV diunduh', message: `${rows.length} produk diekspor.` });
}

function renderAll({ resetPage = false } = {}) {
  renderCounts();
  if (resetPage) stockTable.reset();
  else stockTable.render();
  if (!document.getElementById('panel-mutasi').hidden) moveTable.render();
}

function setFilter(patch) {
  Object.assign(state, patch);
  els.filters.elements.status.value = state.status;
  renderAll({ resetPage: true });
}

/* ---------- Event ---------- */

function bindEvents() {
  let timer;
  els.filters.elements.q.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => setFilter({ q: event.target.value }), 150);
  });
  els.filters.addEventListener('change', (event) => {
    if (event.target.name === 'kategori' || event.target.name === 'status') setFilter({ [event.target.name]: event.target.value });
  });
  els.filters.addEventListener('submit', (event) => event.preventDefault());

  els.moveFilters.elements.q.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.moveQ = event.target.value;
      moveTable.reset();
    }, 150);
  });
  els.moveFilters.elements.tipe.addEventListener('change', (event) => {
    state.moveTipe = event.target.value;
    moveTable.reset();
  });
  els.moveFilters.addEventListener('submit', (event) => event.preventDefault());

  els.cards.addEventListener('click', (event) => {
    const card = event.target.closest('[data-status]');
    if (card) setFilter({ status: card.dataset.status });
  });

  const tablist = document.querySelector('[role="tablist"]');
  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) selectTab(tab.dataset.tab);
  });
  tablist.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const current = tablist.querySelector('[aria-selected="true"]').dataset.tab;
    selectTab(current === 'stok' ? 'mutasi' : 'stok', { focus: true });
  });

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const id = event.target.closest('tr[data-id]')?.dataset.id;
    if (action === 'adjust') openAdjust(id);
    if (action === 'history') openHistory(id);
    if (action === 'export') exportCsv();
    if (action === 'clear-filters') {
      els.filters.reset();
      setFilter({ q: '', kategori: '', status: '' });
    }
  });

  const adjustForm = els.adjustDialog.querySelector('form');
  adjustForm.addEventListener('input', renderPreview);
  adjustForm.addEventListener('change', (event) => {
    if (event.target.name === 'arah') fillReasons(event.target.value);
    renderPreview();
  });
}

if (initShell()) {
  if (!canEdit) {
    document.querySelectorAll('[data-admin-only]').forEach((element) => element.remove());
    document.querySelector('[data-readonly-note]').hidden = false;
  }
  els.filters.elements.kategori.insertAdjacentHTML('beforeend', getCategories()
    .map((item) => `<option value="${item.id}">${escapeHtml(item.nama)}</option>`).join(''));
  els.moveFilters.elements.tipe.insertAdjacentHTML('beforeend', Object.entries(MOVE_TYPES)
    .map(([key, { label }]) => `<option value="${key}">${label}</option>`).join(''));
  els.filters.elements.q.value = state.q;
  els.filters.elements.status.value = state.status;

  bindEvents();
  renderAll();
  if (params.get('tab') === 'mutasi') selectTab('mutasi');
}
