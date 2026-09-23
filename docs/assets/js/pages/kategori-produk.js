/**
 * Kategori Produk — CRUD master KATEGORI (ER-D §3) lewat dialog form.
 * Jumlah produk, stok, nilai stok, dan penjualan dihitung dari data produk
 * dan transaksi, tidak disimpan di kategori.
 */

import { initShell, pageUrl } from '../layout/shell.js';
import { deleteCategory, getCategories, getProducts, getTransactions, saveCategory } from '../core/db.js';
import { inRange, soldByProduct } from '../core/analytics.js';
import { addDays, startOfDay, startOfMonth } from '../core/dates.js';
import { escapeHtml, formatNumber, formatRupiah, rupiahHtml } from '../core/format.js';
import { ACTIVE_STATUS, badgeHtml } from '../components/badges.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { createFormDialog } from '../components/form-dialog.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const filters = document.querySelector('[data-filters]');
const state = { q: '', status: '' };

/* ---------- Data turunan ---------- */

function categoryStats() {
  const products = getProducts();
  const today = startOfDay(new Date());
  const sold = soldByProduct(inRange(getTransactions(), addDays(today, -29), addDays(today, 1)));
  const soldMonth = soldByProduct(inRange(getTransactions(), startOfMonth(today), addDays(today, 1)));
  const stats = new Map();

  for (const category of getCategories()) {
    stats.set(category.id, { produk: 0, stok: 0, nilai: 0, terjual: 0, terjualBulanIni: 0 });
  }
  for (const item of products) {
    const row = stats.get(item.kategori);
    if (!row) continue;
    row.produk += 1;
    row.stok += item.stok;
    row.nilai += item.stok * item.harga_beli;
    row.terjual += sold.get(item.id) ?? 0;
    row.terjualBulanIni += soldMonth.get(item.id) ?? 0;
  }
  return stats;
}

let stats = new Map();

function filtered() {
  const query = state.q.trim().toLowerCase();
  return getCategories().filter((item) =>
    (!query || `${item.id} ${item.nama} ${item.deskripsi}`.toLowerCase().includes(query))
    && (!state.status || (state.status === 'aktif') === item.aktif));
}

/* ---------- Template ---------- */

function rowHtml(item) {
  const row = stats.get(item.id);
  const name = escapeHtml(item.nama);
  return `
    <tr data-id="${item.id}">
      <td class="num">${item.id}</td>
      <td>
        <span class="table__name">${name}</span>
        <span class="table__desc">${escapeHtml(item.deskripsi || '—')}</span>
      </td>
      <td class="col-num">${formatNumber(row.produk)}</td>
      <td class="col-num">${formatNumber(row.stok)}</td>
      <td class="col-num">${rupiahHtml(row.nilai)}</td>
      <td class="col-num">${formatNumber(row.terjual)}</td>
      <td class="col-center">${badgeHtml(ACTIVE_STATUS[item.aktif])}</td>
      <td class="col-center">
        <div class="table__actions">
          <a class="icon-btn icon-btn--flat" href="${pageUrl('produk')}?kategori=${item.id}" aria-label="Lihat produk ${name}">
            <span class="icon" aria-hidden="true">inventory_2</span>
          </a>
          <button class="icon-btn icon-btn--flat" type="button" data-action="edit" aria-label="Ubah ${name}">
            <span class="icon" aria-hidden="true">edit</span>
          </button>
          <button class="icon-btn icon-btn--flat icon-btn--danger" type="button" data-action="delete" aria-label="Hapus ${name}">
            <span class="icon" aria-hidden="true">delete</span>
          </button>
        </div>
      </td>
    </tr>`;
}

const table = createTableView({
  root: document.querySelector('[data-table]'),
  columns: 8,
  noun: 'kategori',
  getItems: filtered,
  rowHtml,
  emptyHtml: () => (state.q || state.status
    ? emptyStateHtml({
      icon: 'search_off',
      title: `Tidak ada kategori yang cocok${state.q ? ` dengan "${escapeHtml(state.q)}"` : ''}`,
      action: '<button class="btn btn--primary" type="button" data-action="clear-filters">Hapus Filter</button>',
    })
    : emptyStateHtml({
      icon: 'sell',
      title: 'Belum ada kategori',
      text: 'Buat kategori pertama agar produk bisa dikelompokkan di Kasir.',
      action: '<button class="btn btn--primary" type="button" data-action="add">Tambah Kategori</button>',
    })),
});

const setMetric = (key, value) => {
  document.querySelector(`[data-metric="${key}"]`).textContent = value;
};

function renderMetrics() {
  const categories = getCategories();
  const active = categories.filter((item) => item.aktif);
  const entries = categories.map((item) => ({ ...item, ...stats.get(item.id) }));
  const totalSku = entries.reduce((sum, item) => sum + item.produk, 0);
  const biggest = [...entries].sort((a, b) => b.nilai - a.nilai)[0];
  const best = [...entries].sort((a, b) => b.terjualBulanIni - a.terjualBulanIni)[0];

  setMetric('aktif', formatNumber(active.length));
  setMetric('aktif-meta', `${categories.length - active.length} nonaktif dari ${categories.length} kategori`);
  setMetric('sku', `${formatNumber(totalSku)} SKU`);
  setMetric('sku-meta', categories.length ? `Rata-rata ${formatNumber(totalSku / categories.length)} produk per kategori` : '–');
  setMetric('nilai', biggest?.nilai ? biggest.nama : '–');
  setMetric('nilai-meta', biggest?.nilai ? `${formatRupiah(biggest.nilai)} dengan harga beli` : 'Belum ada stok');
  setMetric('laris', best?.terjualBulanIni ? best.nama : '–');
  setMetric('laris-meta', best?.terjualBulanIni ? `${formatNumber(best.terjualBulanIni)} item terjual sejak awal bulan` : 'Belum ada penjualan');
}

function render({ resetPage = false } = {}) {
  stats = categoryStats();
  renderMetrics();
  if (resetPage) table.reset();
  else table.render();
}

/* ---------- Form ---------- */

const isNameTaken = (nama, exceptId) =>
  getCategories().some((item) => item.nama.toLowerCase() === nama.toLowerCase() && item.id !== exceptId);

const editor = createFormDialog(document.getElementById('category-dialog'), {
  rules: {
    nama: ({ nama }, { id }) => {
      if (!nama) return 'Nama kategori wajib diisi.';
      if (nama.length < 3) return 'Nama kategori minimal 3 karakter.';
      if (isNameTaken(nama, id)) return `Kategori "${nama}" sudah ada.`;
      return '';
    },
    deskripsi: ({ deskripsi }) => (deskripsi.length > 120 ? 'Deskripsi maksimal 120 karakter.' : ''),
  },
  onSubmit: (values, { id }) => {
    const saved = saveCategory({ ...(id ? getCategories().find((item) => item.id === id) : {}), ...values, id });
    if (!saved) {
      showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
      return false;
    }
    showToast({ type: 'success', title: id ? 'Kategori diperbarui' : 'Kategori ditambahkan', message: `${saved.nama} (${saved.id}) tersimpan.` });
    render();
    return true;
  },
});

function openEditor(id = null) {
  const category = id ? getCategories().find((item) => item.id === id) : null;
  editor.open({
    title: category ? `Ubah ${category.nama}` : 'Tambah Kategori',
    subtitle: category ? `${category.id} · ${stats.get(id).produk} produk terkait` : 'Kode kategori dibuat otomatis.',
    values: category ?? { nama: '', deskripsi: '', aktif: true },
    context: { id },
  });
}

async function remove(id) {
  const category = getCategories().find((item) => item.id === id);
  const used = stats.get(id).produk;
  if (used) {
    showToast({
      type: 'warning',
      title: 'Kategori masih dipakai',
      message: `${used} produk berada di ${category.nama}. Pindahkan produknya atau nonaktifkan kategori ini.`,
      duration: 5000,
    });
    return;
  }
  const confirmed = await confirmDialog({
    title: 'Hapus kategori?',
    message: `"${category.nama}" akan dihapus permanen. Tidak ada produk yang terpengaruh.`,
    confirmLabel: 'Ya, Hapus',
  });
  if (!confirmed) return;
  if (deleteCategory(id)) {
    showToast({ type: 'success', title: 'Kategori dihapus', message: `${category.nama} telah dihapus.` });
    render();
  }
}

/* ---------- Event ---------- */

function bindEvents() {
  let timer;
  filters.elements.q.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = event.target.value;
      table.reset();
    }, 150);
  });
  filters.elements.status.addEventListener('change', (event) => {
    state.status = event.target.value;
    table.reset();
  });
  filters.addEventListener('submit', (event) => event.preventDefault());

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const id = event.target.closest('tr[data-id]')?.dataset.id;
    if (action === 'add') openEditor();
    if (action === 'edit') openEditor(id);
    if (action === 'delete') remove(id);
    if (action === 'clear-filters') {
      filters.reset();
      Object.assign(state, { q: '', status: '' });
      table.reset();
    }
  });
}

if (initShell()) {
  bindEvents();
  render();
}
