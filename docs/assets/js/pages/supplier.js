/**
 * Supplier — CRUD master SUPPLIER (ER-D §3). Pembelian dan hutang tempo
 * dihitung dari dokumen Barang Masuk; supplier yang punya riwayat tidak
 * bisa dihapus (cukup dinonaktifkan) agar faktur lama tetap terbaca.
 */

import { initShell, pageUrl } from '../layout/shell.js';
import { deleteSupplier, getProducts, getPurchases, getSuppliers, saveSupplier } from '../core/db.js';
import { addDays, startOfDay, toDateKey } from '../core/dates.js';
import { escapeHtml, formatNumber, formatRupiah, rupiahHtml } from '../core/format.js';
import { downloadCsv } from '../core/csv.js';
import { isEmail, isPhone } from '../core/validation.js';
import { ACTIVE_STATUS, badgeHtml } from '../components/badges.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { createFormDialog } from '../components/form-dialog.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const filters = document.querySelector('[data-filters]');
const params = new URLSearchParams(window.location.search);
const state = { q: params.get('q') ?? '', termin: '', status: '' };

const terminLabel = (days) => (days ? `Tempo ${days} hari` : 'Tunai (COD)');

/* ---------- Data turunan ---------- */

function supplierStats() {
  const since = addDays(startOfDay(new Date()), -29);
  const stats = new Map(getSuppliers().map((item) => [item.id, { produk: 0, beli: 0, faktur: 0, hutang: 0, riwayat: 0 }]));
  for (const product of getProducts()) {
    const row = stats.get(product.supplier);
    if (row) row.produk += 1;
  }
  for (const purchase of getPurchases()) {
    const row = stats.get(purchase.supplier);
    if (!row) continue;
    row.riwayat += 1;
    if (new Date(purchase.tanggal) >= since) {
      row.beli += purchase.total;
      row.faktur += 1;
    }
    if (purchase.status_bayar === 'belum_lunas') row.hutang += purchase.total;
  }
  return stats;
}

let stats = new Map();

function filtered() {
  const query = state.q.trim().toLowerCase();
  return getSuppliers().filter((item) =>
    (!query || `${item.id} ${item.nama} ${item.kontak_person} ${item.telepon} ${item.email}`.toLowerCase().includes(query))
    && (!state.termin || (state.termin === 'tempo' ? item.termin_hari > 0 : item.termin_hari === 0))
    && (!state.status || (state.status === 'aktif') === item.aktif));
}

/* ---------- Template ---------- */

function rowHtml(item) {
  const row = stats.get(item.id);
  const name = escapeHtml(item.nama);
  return `
    <tr data-id="${item.id}">
      <td class="num">${item.id}</td>
      <td class="table__wide">
        <span class="table__name">${name}</span>
        <span class="table__desc">${escapeHtml(item.alamat || '—')}</span>
      </td>
      <td>
        <span class="table__name table__name--light">${escapeHtml(item.kontak_person)}</span>
        <span class="table__sub">${escapeHtml(item.telepon)}${item.email ? ` · ${escapeHtml(item.email)}` : ''}</span>
      </td>
      <td>${terminLabel(item.termin_hari)}<span class="table__desc">${item.pkp === false ? 'Non-PKP' : 'PKP · faktur ber-PPN'}</span></td>
      <td class="col-num">${formatNumber(row.produk)}</td>
      <td class="col-num">${rupiahHtml(row.beli)}<span class="table__sub">${row.faktur} faktur</span></td>
      <td class="col-num ${row.hutang ? 'text-warning' : 'text-muted'}">${row.hutang ? rupiahHtml(row.hutang) : '–'}</td>
      <td class="col-center">${badgeHtml(ACTIVE_STATUS[item.aktif])}</td>
      <td class="col-center">
        <div class="table__actions">
          <a class="icon-btn icon-btn--flat" href="${pageUrl('form-barang-masuk')}?supplier=${item.id}" aria-label="Catat barang masuk dari ${name}">
            <span class="icon" aria-hidden="true">move_to_inbox</span>
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
  columns: 9,
  noun: 'supplier',
  pageSize: 8,
  getItems: filtered,
  rowHtml,
  emptyHtml: () => (state.q || state.termin || state.status
    ? emptyStateHtml({
      icon: 'search_off',
      title: `Tidak ada supplier yang cocok${state.q ? ` dengan "${escapeHtml(state.q)}"` : ''}`,
      action: '<button class="btn btn--primary" type="button" data-action="clear-filters">Hapus Filter</button>',
    })
    : emptyStateHtml({
      icon: 'local_shipping',
      title: 'Belum ada supplier',
      text: 'Tambahkan pemasok agar barang masuk bisa dicatat.',
      action: '<button class="btn btn--primary" type="button" data-action="add">Tambah Supplier</button>',
    })),
});

const setMetric = (key, html) => {
  document.querySelector(`[data-metric="${key}"]`).innerHTML = html;
};

function renderMetrics() {
  const suppliers = getSuppliers();
  const entries = suppliers.map((item) => ({ ...item, ...stats.get(item.id) }));
  const totalBeli = entries.reduce((sum, item) => sum + item.beli, 0);
  const totalHutang = entries.reduce((sum, item) => sum + item.hutang, 0);
  const tempo = getPurchases().filter((item) => item.status_bayar === 'belum_lunas');
  const nearest = tempo.sort((a, b) => a.jatuh_tempo.localeCompare(b.jatuh_tempo))[0];
  const top = [...entries].sort((a, b) => b.beli - a.beli)[0];

  setMetric('aktif', formatNumber(suppliers.filter((item) => item.aktif).length));
  setMetric('aktif-meta', `${suppliers.filter((item) => item.termin_hari > 0).length} dengan termin tempo`);
  setMetric('beli', rupiahHtml(totalBeli));
  setMetric('beli-meta', `${entries.reduce((sum, item) => sum + item.faktur, 0)} faktur barang masuk`);
  setMetric('hutang', rupiahHtml(totalHutang));
  setMetric('hutang-meta', nearest
    ? `Terdekat jatuh tempo ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(nearest.jatuh_tempo))}`
    : 'Tidak ada faktur tempo');
  setMetric('utama', top?.beli ? escapeHtml(top.nama.replace(/^(PT|CV)\s+/, '').split(' (')[0]) : '–');
  setMetric('utama-meta', top?.beli ? `${formatRupiah(top.beli)} dalam 30 hari` : 'Belum ada pembelian');
}

function render() {
  stats = supplierStats();
  renderMetrics();
  table.render();
}

/* ---------- Form ---------- */

const editor = createFormDialog(document.getElementById('supplier-dialog'), {
  rules: {
    nama: ({ nama }, { id }) => {
      if (!nama) return 'Nama perusahaan wajib diisi.';
      if (nama.length < 4) return 'Nama perusahaan minimal 4 karakter.';
      if (getSuppliers().some((item) => item.nama.toLowerCase() === nama.toLowerCase() && item.id !== id)) return 'Supplier dengan nama ini sudah terdaftar.';
      return '';
    },
    kontak_person: ({ kontak_person: kontak }) => (kontak.length >= 3 ? '' : 'Nama kontak wajib diisi, minimal 3 karakter.'),
    telepon: ({ telepon }) => {
      if (!telepon) return 'Nomor telepon wajib diisi.';
      if (!isPhone(telepon)) return 'Format telepon tidak valid. Contoh: 0812-3456-7890.';
      return '';
    },
    email: ({ email }) => (!email || isEmail(email) ? '' : 'Format email tidak valid.'),
  },
  onSubmit: (values, { id }) => {
    const saved = saveSupplier({ ...values, termin_hari: Number(values.termin_hari), id });
    if (!saved) {
      showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
      return false;
    }
    showToast({ type: 'success', title: id ? 'Supplier diperbarui' : 'Supplier ditambahkan', message: `${saved.nama} (${saved.id}) tersimpan.` });
    render();
    return true;
  },
});

function openEditor(id = null) {
  const supplier = id ? getSuppliers().find((item) => item.id === id) : null;
  editor.open({
    title: supplier ? 'Ubah Supplier' : 'Tambah Supplier',
    subtitle: supplier ? `${supplier.id} · ${supplier.nama}` : 'Kode supplier dibuat otomatis.',
    values: supplier ?? { nama: '', kontak_person: '', telepon: '', email: '', alamat: '', termin_hari: 14, pkp: true, aktif: true },
    context: { id },
  });
}

async function remove(id) {
  const supplier = getSuppliers().find((item) => item.id === id);
  const row = stats.get(id);
  if (row.produk || row.riwayat) {
    showToast({
      type: 'warning',
      title: 'Supplier punya riwayat',
      message: `${row.produk} produk dan ${row.riwayat} faktur terhubung. Nonaktifkan saja agar data lama tetap utuh.`,
      duration: 5000,
    });
    return;
  }
  const confirmed = await confirmDialog({
    title: 'Hapus supplier?',
    message: `"${supplier.nama}" akan dihapus permanen dari daftar pemasok.`,
    confirmLabel: 'Ya, Hapus',
  });
  if (confirmed && deleteSupplier(id)) {
    showToast({ type: 'success', title: 'Supplier dihapus', message: `${supplier.nama} telah dihapus.` });
    render();
  }
}

function exportCsv() {
  const rows = filtered().map((item) => {
    const row = stats.get(item.id);
    return [item.id, item.nama, item.kontak_person, item.telepon, item.email, item.alamat, item.termin_hari, item.pkp === false ? 'Tidak' : 'Ya', row.produk, row.beli, row.hutang, item.aktif ? 'Aktif' : 'Nonaktif'];
  });
  downloadCsv(`supplier-${toDateKey(new Date())}.csv`, [
    ['Kode', 'Nama', 'Kontak', 'Telepon', 'Email', 'Alamat', 'Termin (hari)', 'PKP', 'Produk', 'Pembelian 30 Hari', 'Hutang', 'Status'],
    ...rows,
  ]);
  showToast({ type: 'success', title: 'CSV diunduh', message: `${rows.length} supplier diekspor.` });
}

function bindEvents() {
  let timer;
  filters.elements.q.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = event.target.value;
      table.reset();
    }, 150);
  });
  filters.addEventListener('change', (event) => {
    if (event.target.name === 'termin' || event.target.name === 'status') {
      state[event.target.name] = event.target.value;
      table.reset();
    }
  });
  filters.addEventListener('submit', (event) => event.preventDefault());

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const id = event.target.closest('tr[data-id]')?.dataset.id;
    if (action === 'add') openEditor();
    if (action === 'edit') openEditor(id);
    if (action === 'delete') remove(id);
    if (action === 'export') exportCsv();
    if (action === 'clear-filters') {
      filters.reset();
      Object.assign(state, { q: '', termin: '', status: '' });
      table.reset();
    }
  });
}

if (initShell()) {
  filters.elements.q.value = state.q;
  bindEvents();
  render();
}
