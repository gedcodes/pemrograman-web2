/**
 * Satuan — CRUD master SATUAN (ER-D §3). Satuan yang dipakai produk tidak
 * bisa dihapus agar keranjang dan struk tidak kehilangan satuannya.
 */

import { initShell } from '../layout/shell.js';
import { deleteUnit, getProducts, getUnits, saveUnit } from '../core/db.js';
import { escapeHtml, formatNumber, formatPercent } from '../core/format.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { createFormDialog } from '../components/form-dialog.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const filters = document.querySelector('[data-filters]');
const state = { q: '' };

/** Produk per satuan: Map id_satuan → produk[] */
function productsByUnit() {
  const result = new Map(getUnits().map((unit) => [unit.id, []]));
  for (const item of getProducts()) result.get(item.satuan)?.push(item);
  return result;
}

let usage = new Map();

function filtered() {
  const query = state.q.trim().toLowerCase();
  return getUnits().filter((unit) => !query || `${unit.id} ${unit.nama} ${unit.singkatan}`.toLowerCase().includes(query));
}

function rowHtml(unit) {
  const products = usage.get(unit.id) ?? [];
  const name = escapeHtml(unit.nama);
  const examples = products.slice(0, 2).map((item) => escapeHtml(item.nama)).join(', ');
  return `
    <tr data-id="${unit.id}">
      <td class="num">${unit.id}</td>
      <td><span class="table__name">${name}</span></td>
      <td><span class="badge badge--neutral">${escapeHtml(unit.singkatan)}</span></td>
      <td class="col-num">${formatNumber(products.length)}</td>
      <td class="table__clip text-secondary" title="${examples}">${examples || '<span class="text-muted">Belum dipakai</span>'}${products.length > 2 ? ` +${products.length - 2}` : ''}</td>
      <td class="col-center">
        <div class="table__actions">
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
  columns: 6,
  noun: 'satuan',
  getItems: filtered,
  rowHtml,
  emptyHtml: () => (state.q
    ? emptyStateHtml({ icon: 'search_off', title: `Tidak ada satuan yang cocok dengan "${escapeHtml(state.q)}"` })
    : emptyStateHtml({
      icon: 'straighten',
      title: 'Belum ada satuan',
      action: '<button class="btn btn--primary" type="button" data-action="add">Tambah Satuan</button>',
    })),
});

function renderUsage() {
  const units = getUnits();
  const total = getProducts().length;
  const used = units.filter((unit) => usage.get(unit.id)?.length);
  document.querySelector('[data-subtitle]').textContent = `${units.length} satuan · ${used.length} dipakai produk`;
  document.querySelector('[data-usage-badge]').textContent = `${total} SKU`;
  document.querySelector('[data-usage]').innerHTML = [...units]
    .sort((a, b) => (usage.get(b.id)?.length ?? 0) - (usage.get(a.id)?.length ?? 0))
    .map((unit) => {
      const count = usage.get(unit.id)?.length ?? 0;
      const share = total ? count / total : 0;
      return `
        <li class="bar-list__item">
          <div class="bar-list__head">
            <span>${escapeHtml(unit.nama)} <span class="text-muted">(${escapeHtml(unit.singkatan)})</span></span>
            <span class="num">${count} · ${formatPercent(share)}</span>
          </div>
          <div class="meter" aria-hidden="true"><div class="meter__fill" style="--value: ${share.toFixed(4)}"></div></div>
        </li>`;
    })
    .join('');
}

function render() {
  usage = productsByUnit();
  renderUsage();
  table.render();
}

/* ---------- Form ---------- */

const taken = (field, value, exceptId) =>
  getUnits().some((unit) => unit[field].toLowerCase() === value.toLowerCase() && unit.id !== exceptId);

const editor = createFormDialog(document.getElementById('unit-dialog'), {
  rules: {
    nama: ({ nama }, { id }) => {
      if (!nama) return 'Nama satuan wajib diisi.';
      if (nama.length < 2) return 'Nama satuan minimal 2 karakter.';
      if (taken('nama', nama, id)) return `Satuan "${nama}" sudah ada.`;
      return '';
    },
    singkatan: ({ singkatan }, { id }) => {
      if (!singkatan) return 'Singkatan wajib diisi.';
      if (!/^[A-Za-z0-9]{1,6}$/.test(singkatan)) return 'Singkatan 1–6 huruf atau angka tanpa spasi.';
      if (taken('singkatan', singkatan, id)) return `Singkatan "${singkatan}" sudah dipakai satuan lain.`;
      return '';
    },
  },
  onSubmit: (values, { id }) => {
    const saved = saveUnit({ ...values, id });
    if (!saved) {
      showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
      return false;
    }
    showToast({ type: 'success', title: id ? 'Satuan diperbarui' : 'Satuan ditambahkan', message: `${saved.nama} (${saved.singkatan}) tersimpan.` });
    render();
    return true;
  },
});

function openEditor(id = null) {
  const unit = id ? getUnits().find((item) => item.id === id) : null;
  editor.open({
    title: unit ? `Ubah ${unit.nama}` : 'Tambah Satuan',
    subtitle: unit ? `${unit.id} · dipakai ${usage.get(id)?.length ?? 0} produk` : 'Kode satuan dibuat otomatis.',
    values: unit ?? { nama: '', singkatan: '' },
    context: { id },
  });
}

async function remove(id) {
  const unit = getUnits().find((item) => item.id === id);
  const used = usage.get(id)?.length ?? 0;
  if (used) {
    showToast({ type: 'warning', title: 'Satuan masih dipakai', message: `${used} produk memakai satuan ${unit.nama}.`, duration: 5000 });
    return;
  }
  const confirmed = await confirmDialog({
    title: 'Hapus satuan?',
    message: `"${unit.nama} (${unit.singkatan})" akan dihapus permanen.`,
    confirmLabel: 'Ya, Hapus',
  });
  if (confirmed && deleteUnit(id)) {
    showToast({ type: 'success', title: 'Satuan dihapus', message: `${unit.nama} telah dihapus.` });
    render();
  }
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
  filters.addEventListener('submit', (event) => event.preventDefault());

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const id = event.target.closest('tr[data-id]')?.dataset.id;
    if (action === 'add') openEditor();
    if (action === 'edit') openEditor(id);
    if (action === 'delete') remove(id);
  });
}

if (initShell()) {
  bindEvents();
  render();
}
