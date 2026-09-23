/**
 * Data Produk — tabel master dengan pencarian, filter, paginasi,
 * pilih banyak, hapus (dengan konfirmasi), dan export CSV.
 */

import { initShell } from '../layout/shell.js';
import {
  deleteProducts, findCategory, findUnit, getCategories, getProducts, getStockStatus, resetDemoData,
} from '../core/db.js';
import { marginOnPrice } from '../core/pricing.js';
import { escapeHtml, formatNumber, formatPercent, rupiahHtml } from '../core/format.js';
import { toDateKey } from '../core/dates.js';
import { downloadCsv } from '../core/csv.js';
import { STOCK_STATUS, badgeHtml } from '../components/badges.js';
import { thumbHtml } from '../components/thumb.js';
import { pageItemsHtml } from '../components/pagination.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const PAGE_SIZE = 8;
const SEARCH_DELAY = 150;

const params = new URLSearchParams(window.location.search);

const state = {
  q: params.get('q') ?? '',
  kategori: params.get('kategori') ?? '',
  status: params.get('status') ?? '',
  page: 1,
  selected: new Set(),
  visibleIds: [],
};

const els = {
  filters: document.querySelector('[data-filters]'),
  search: document.getElementById('filter-q'),
  kategori: document.getElementById('filter-kategori'),
  status: document.getElementById('filter-status'),
  clearFilters: document.querySelector('[data-action="clear-filters"]'),
  statusCards: document.querySelector('[data-status-cards]'),
  rows: document.querySelector('[data-rows]'),
  selectAll: document.querySelector('[data-select-all]'),
  bulkBar: document.querySelector('[data-bulk-bar]'),
  selectedCount: document.querySelector('[data-selected-count]'),
  pageInfo: document.querySelector('[data-page-info]'),
  pages: document.querySelector('[data-pages]'),
  totalCount: document.querySelector('[data-total-count]'),
};

const hasFilters = () => Boolean(state.q || state.kategori || state.status);

function filterProducts(products) {
  const query = state.q.trim().toLowerCase();
  return products.filter((item) =>
    (!query || item.nama.toLowerCase().includes(query) || item.barcode.includes(query))
    && (!state.kategori || item.kategori === state.kategori)
    && (!state.status || getStockStatus(item) === state.status));
}

/* ---------- Template ---------- */

function rowHtml(item) {
  const name = escapeHtml(item.nama);
  const selected = state.selected.has(item.id);
  const unit = findUnit(item.satuan)?.singkatan ?? '';
  const inactive = item.aktif ? '' : ' <span class="badge badge--neutral">Nonaktif</span>';

  return `
    <tr data-id="${item.id}" class="${selected ? 'is-selected' : ''}">
      <td class="col-check"><input type="checkbox" data-select ${selected ? 'checked' : ''} aria-label="Pilih ${name}"></td>
      <td>
        <div class="table__product">
          ${thumbHtml(item)}
          <div>
            <span class="table__name">${name}${inactive}</span>
            <span class="table__sub">${item.barcode}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(findCategory(item.kategori)?.nama ?? '-')}</td>
      <td class="col-num">${rupiahHtml(item.harga_beli)}</td>
      <td class="col-num">${rupiahHtml(item.harga_jual)}</td>
      <td class="col-num">${formatPercent(marginOnPrice(item.harga_beli, item.harga_jual))}</td>
      <td class="col-num">${formatNumber(item.stok)} <span class="text-muted">${unit}</span></td>
      <td class="col-center">${badgeHtml(STOCK_STATUS[getStockStatus(item)])}</td>
      <td class="col-center">
        <div class="table__actions">
          <a class="icon-btn icon-btn--flat" href="form-produk.html?id=${item.id}" aria-label="Ubah ${name}">
            <span class="icon" aria-hidden="true">edit</span>
          </a>
          <button class="icon-btn icon-btn--flat icon-btn--danger" type="button" data-action="delete" aria-label="Hapus ${name}">
            <span class="icon" aria-hidden="true">delete</span>
          </button>
        </div>
      </td>
    </tr>`;
}

function emptyRowHtml() {
  const content = hasFilters()
    ? `<span class="empty-state__icon" aria-hidden="true"><span class="icon">search_off</span></span>
       <p class="empty-state__title">Tidak ada produk yang cocok${state.q ? ` dengan "${escapeHtml(state.q)}"` : ''}</p>
       <p class="empty-state__text">Coba kata kunci lain atau hapus filter kategori dan status.</p>
       <button class="btn btn--primary" type="button" data-action="clear-filters">Hapus Filter</button>`
    : `<span class="empty-state__icon" aria-hidden="true"><span class="icon">inventory_2</span></span>
       <p class="empty-state__title">Belum ada produk</p>
       <p class="empty-state__text">Tambahkan produk pertama agar bisa dijual di halaman Kasir.</p>
       <a class="btn btn--primary" href="form-produk.html">Tambah Produk</a>`;
  return `<tr><td colspan="9"><div class="empty-state">${content}</div></td></tr>`;
}

/* ---------- Render ---------- */

function renderCounts(products) {
  const counts = { semua: products.length, aman: 0, menipis: 0, habis: 0 };
  products.forEach((item) => { counts[getStockStatus(item)] += 1; });
  Object.entries(counts).forEach(([key, value]) => {
    document.querySelector(`[data-count="${key}"]`).textContent = formatNumber(value);
  });
  els.totalCount.textContent = formatNumber(products.length);
  els.statusCards.querySelectorAll('[data-status]').forEach((card) => {
    card.setAttribute('aria-pressed', String(card.dataset.status === state.status));
  });
}

function renderSelection() {
  const visibleSelected = state.visibleIds.filter((id) => state.selected.has(id)).length;
  els.selectAll.checked = visibleSelected > 0 && visibleSelected === state.visibleIds.length;
  els.selectAll.indeterminate = visibleSelected > 0 && visibleSelected < state.visibleIds.length;
  els.bulkBar.hidden = state.selected.size === 0;
  els.selectedCount.textContent = formatNumber(state.selected.size);
}

function render() {
  const products = getProducts();
  const existing = new Set(products.map((item) => item.id));
  state.selected.forEach((id) => { if (!existing.has(id)) state.selected.delete(id); });

  renderCounts(products);

  const filtered = filterProducts(products);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  state.visibleIds = visible.map((item) => item.id);

  els.rows.innerHTML = visible.length ? visible.map(rowHtml).join('') : emptyRowHtml();
  els.pageInfo.innerHTML = filtered.length
    ? `Menampilkan <strong>${start + 1}–${start + visible.length}</strong> dari <strong>${filtered.length}</strong> produk`
    : 'Tidak ada produk untuk ditampilkan';
  els.pages.innerHTML = pageItemsHtml(state.page, totalPages);
  els.clearFilters.hidden = !hasFilters();
  renderSelection();
}

/* ---------- Aksi ---------- */

function setFilter(patch) {
  Object.assign(state, patch, { page: 1 });
  render();
}

function clearFilters() {
  els.filters.reset();
  setFilter({ q: '', kategori: '', status: '' });
}

async function removeProducts(ids) {
  const products = getProducts().filter((item) => ids.includes(item.id));
  const single = products.length === 1;
  const confirmed = await confirmDialog({
    title: single ? 'Hapus produk?' : `Hapus ${products.length} produk?`,
    message: single
      ? `"${products[0].nama}" akan dihapus dari katalog dan tidak muncul lagi di Kasir. Riwayat transaksi tetap tersimpan.`
      : 'Produk terpilih akan dihapus dari katalog dan tidak muncul lagi di Kasir. Riwayat transaksi tetap tersimpan.',
    confirmLabel: 'Ya, Hapus',
  });
  if (!confirmed) return;

  if (!deleteProducts(ids)) {
    showToast({ type: 'danger', title: 'Gagal menghapus', message: 'Penyimpanan browser tidak tersedia.' });
    return;
  }
  ids.forEach((id) => state.selected.delete(id));
  render();
  showToast({
    type: 'success',
    title: 'Produk dihapus',
    message: single ? `${products[0].nama} telah dihapus.` : `${products.length} produk telah dihapus.`,
  });
}

function exportCsv() {
  const rows = filterProducts(getProducts()).map((item) => [
    item.id,
    item.barcode,
    item.nama,
    findCategory(item.kategori)?.nama ?? '',
    findUnit(item.satuan)?.singkatan ?? '',
    item.harga_beli,
    item.harga_jual,
    item.stok,
    item.stok_minimum,
    STOCK_STATUS[getStockStatus(item)].label,
  ]);
  downloadCsv(`data-produk-${toDateKey(new Date())}.csv`, [
    ['ID', 'Barcode', 'Nama Produk', 'Kategori', 'Satuan', 'Harga Beli', 'Harga Jual', 'Stok', 'Stok Minimum', 'Status'],
    ...rows,
  ]);
  showToast({ type: 'success', title: 'CSV diunduh', message: `${rows.length} produk diekspor.` });
}

async function resetData() {
  const confirmed = await confirmDialog({
    title: 'Kembalikan data contoh?',
    message: 'Semua perubahan produk, stok, dan transaksi kasir akan dihapus dan diganti data awal.',
    confirmLabel: 'Kembalikan',
    icon: 'restart_alt',
  });
  if (!confirmed) return;
  resetDemoData();
  state.selected.clear();
  render();
  showToast({ type: 'success', title: 'Data dikembalikan', message: 'Katalog kembali ke data contoh awal.' });
}

/* ---------- Event ---------- */

function bindEvents() {
  let searchTimer;
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setFilter({ q: els.search.value }), SEARCH_DELAY);
  });
  els.kategori.addEventListener('change', () => setFilter({ kategori: els.kategori.value }));
  els.status.addEventListener('change', () => setFilter({ status: els.status.value }));
  els.filters.addEventListener('submit', (event) => event.preventDefault());

  els.statusCards.addEventListener('click', (event) => {
    const card = event.target.closest('[data-status]');
    if (!card) return;
    els.status.value = card.dataset.status;
    setFilter({ status: card.dataset.status });
  });

  els.rows.addEventListener('change', (event) => {
    if (!event.target.matches('[data-select]')) return;
    const row = event.target.closest('tr');
    if (event.target.checked) state.selected.add(row.dataset.id);
    else state.selected.delete(row.dataset.id);
    row.classList.toggle('is-selected', event.target.checked);
    renderSelection();
  });

  els.selectAll.addEventListener('change', () => {
    state.visibleIds.forEach((id) => {
      if (els.selectAll.checked) state.selected.add(id);
      else state.selected.delete(id);
    });
    render();
  });

  els.pages.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    render();
  });

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'delete') removeProducts([event.target.closest('tr').dataset.id]);
    if (action === 'bulk-delete') removeProducts([...state.selected]);
    if (action === 'clear-filters') {
      event.preventDefault();
      clearFilters();
    }
    if (action === 'export') exportCsv();
    if (action === 'reset-data') resetData();
  });
}

if (initShell()) {
  els.kategori.insertAdjacentHTML('beforeend', getCategories()
    .map((item) => `<option value="${item.id}">${escapeHtml(item.nama)}</option>`).join(''));
  // Filter awal dari URL (pencarian global, tautan dari Kategori / Stok)
  els.search.value = state.q;
  els.kategori.value = state.kategori;
  els.status.value = state.status;
  bindEvents();
  render();
}
