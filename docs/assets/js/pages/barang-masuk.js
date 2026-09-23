/**
 * Barang Masuk — daftar dokumen BARANG_MASUK (ER-D §3) dengan filter,
 * detail faktur, dan pelunasan hutang tempo. Input baru ada di
 * form-barang-masuk.html (khusus admin; kasir hanya melihat).
 */

import { initShell } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import { findSupplier, findUnit, findUser, getProduct, getPurchases, getSuppliers, markPurchasePaid } from '../core/db.js';
import { startOfDay, startOfMonth, toDateKey } from '../core/dates.js';
import { escapeHtml, formatDateLong, formatDateShort, formatNumber, formatRupiah, formatTime, rupiahHtml } from '../core/format.js';
import { downloadCsv } from '../core/csv.js';
import { PURCHASE_PAY_STATUS, badgeHtml } from '../components/badges.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const user = getCurrentUser();
const canEdit = user.peran === 'admin';
const params = new URLSearchParams(window.location.search);
const filters = document.querySelector('[data-filters]');
const dialog = document.getElementById('detail-dialog');

const state = { q: '', supplier: params.get('supplier') ?? '', bayar: params.get('bayar') ?? '' };
let openId = null;

/** Status tampilan: tempo yang lewat jatuh tempo ditandai merah */
function payStatus(purchase) {
  if (purchase.status_bayar === 'lunas') return 'lunas';
  return new Date(purchase.jatuh_tempo) < startOfDay(new Date()) ? 'jatuh_tempo' : 'belum_lunas';
}

const unitCount = (purchase) => purchase.items.reduce((sum, item) => sum + item.qty, 0);

function filtered() {
  const query = state.q.trim().toLowerCase();
  return getPurchases().filter((item) =>
    (!state.supplier || item.supplier === state.supplier)
    && (!state.bayar || item.status_bayar === state.bayar)
    && (!query || item.id.toLowerCase().includes(query) || item.no_faktur.toLowerCase().includes(query)
      || item.items.some((line) => line.nama.toLowerCase().includes(query))));
}

/* ---------- Tabel ---------- */

function rowHtml(item) {
  const date = new Date(item.tanggal);
  const status = payStatus(item);
  const supplier = findSupplier(item.supplier);
  return `
    <tr data-id="${item.id}" class="${status === 'jatuh_tempo' ? 'is-danger' : ''}">
      <td class="num">${item.id}</td>
      <td><span class="num">${formatDateShort(date)}</span><span class="table__sub">${formatTime(date)} · ${escapeHtml(findUser(item.penerima)?.nama ?? '-')}</span></td>
      <td class="table__wide"><span class="table__name">${escapeHtml(supplier?.nama ?? item.supplier)}</span></td>
      <td class="num">${escapeHtml(item.no_faktur)}</td>
      <td class="col-num">${item.items.length} SKU<span class="table__sub">${formatNumber(unitCount(item))} unit</span></td>
      <td class="col-num">${rupiahHtml(item.total)}</td>
      <td>${item.termin_hari ? `<span class="num">${formatDateShort(new Date(item.jatuh_tempo))}</span><span class="table__sub">Tempo ${item.termin_hari} hari</span>` : '<span class="text-muted">Tunai</span>'}</td>
      <td class="col-center">${badgeHtml(PURCHASE_PAY_STATUS[status])}</td>
      <td class="col-center">
        <div class="table__actions">
          <button class="icon-btn icon-btn--flat" type="button" data-action="detail" aria-label="Detail ${item.id}">
            <span class="icon" aria-hidden="true">visibility</span>
          </button>
        </div>
      </td>
    </tr>`;
}

const table = createTableView({
  root: document.querySelector('[data-table]'),
  columns: 9,
  noun: 'dokumen',
  getItems: filtered,
  rowHtml,
  emptyHtml: () => emptyStateHtml({
    icon: 'move_to_inbox',
    title: state.q || state.supplier || state.bayar ? 'Tidak ada dokumen yang cocok' : 'Belum ada barang masuk',
    text: 'Catat penerimaan barang agar stok bertambah dan hutang supplier terpantau.',
    action: canEdit ? '<a class="btn btn--primary" href="form-barang-masuk.html">Input Penerimaan</a>' : '',
  }),
});

const setMetric = (key, html) => {
  document.querySelector(`[data-metric="${key}"]`).innerHTML = html;
};

function renderMetrics() {
  const purchases = getPurchases();
  const month = purchases.filter((item) => new Date(item.tanggal) >= startOfMonth(new Date()));
  const tempo = purchases.filter((item) => item.status_bayar === 'belum_lunas');
  const overdue = tempo.filter((item) => payStatus(item) === 'jatuh_tempo');

  setMetric('total', rupiahHtml(month.reduce((sum, item) => sum + item.total, 0)));
  setMetric('total-meta', `${month.length} faktur dari ${new Set(month.map((item) => item.supplier)).size} supplier`);
  setMetric('unit', formatNumber(month.reduce((sum, item) => sum + unitCount(item), 0)));
  setMetric('unit-meta', `${new Set(month.flatMap((item) => item.items.map((line) => line.id_produk))).size} SKU berbeda`);
  setMetric('hutang', rupiahHtml(tempo.reduce((sum, item) => sum + item.total, 0)));
  setMetric('hutang-meta', overdue.length ? `${overdue.length} faktur lewat jatuh tempo` : `${tempo.length} faktur belum jatuh tempo`);
  setMetric('ppn', rupiahHtml(month.reduce((sum, item) => sum + item.pajak, 0)));
}

/* ---------- Detail ---------- */

const fact = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

function openDetail(id) {
  const purchase = getPurchases().find((item) => item.id === id);
  if (!purchase) {
    showToast({ type: 'warning', title: 'Dokumen tidak ditemukan', message: `${id} tidak ada di daftar barang masuk.` });
    return;
  }
  openId = id;
  const supplier = findSupplier(purchase.supplier);
  const status = payStatus(purchase);
  const date = new Date(purchase.tanggal);

  dialog.querySelector('[data-detail-title]').textContent = purchase.id;
  dialog.querySelector('[data-detail-meta]').innerHTML =
    `${formatDateLong(date)} · ${formatTime(date)} · ${badgeHtml(PURCHASE_PAY_STATUS[status])}`;
  dialog.querySelector('[data-detail-facts]').innerHTML = [
    fact('Supplier', escapeHtml(supplier?.nama ?? purchase.supplier)),
    fact('No. faktur', `<span class="num">${escapeHtml(purchase.no_faktur)}</span>`),
    fact('No. surat jalan', `<span class="num">${escapeHtml(purchase.no_surat_jalan || '–')}</span>`),
    fact('Penerima', escapeHtml(findUser(purchase.penerima)?.nama ?? '-')),
    fact('Termin', purchase.termin_hari ? `Tempo ${purchase.termin_hari} hari · jatuh tempo ${formatDateShort(new Date(purchase.jatuh_tempo))}` : 'Tunai saat barang datang'),
    fact('Catatan', escapeHtml(purchase.catatan || '–')),
  ].join('');
  dialog.querySelector('[data-detail-items]').innerHTML = purchase.items.map((item) => {
    const unit = findUnit(getProduct(item.id_produk)?.satuan)?.singkatan ?? '';
    return `
      <tr>
        <td><span class="table__name">${escapeHtml(item.nama)}</span><span class="table__sub">${item.id_produk}</span></td>
        <td class="col-num">${formatNumber(item.qty)} <span class="text-muted">${unit}</span></td>
        <td class="col-num">${rupiahHtml(item.harga_beli)}</td>
        <td class="col-num">${rupiahHtml(item.harga_beli * item.qty)}</td>
      </tr>`;
  }).join('');
  dialog.querySelector('[data-detail-totals]').innerHTML = [
    ['Subtotal', formatRupiah(purchase.subtotal)],
    ['Diskon supplier', `-${formatRupiah(purchase.diskon)}`],
    ['PPN masukan', formatRupiah(purchase.pajak)],
    ['Total faktur', formatRupiah(purchase.total), true],
  ].map(([label, value, strong]) => `<div class="summary-list__row ${strong ? 'summary-list__row--strong' : ''}"><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  dialog.querySelector('[data-detail-actions]').innerHTML = canEdit && purchase.status_bayar === 'belum_lunas'
    ? '<button class="btn btn--success" type="button" data-action="mark-paid"><span class="icon" aria-hidden="true">payments</span>Tandai Sudah Dibayar</button>'
    : '<button class="btn" type="button" data-action="close-detail">Tutup</button>';

  if (!dialog.open) dialog.showModal();
}

async function markPaid(id) {
  const purchase = getPurchases().find((item) => item.id === id);
  const confirmed = await confirmDialog({
    title: 'Tandai faktur lunas?',
    message: `Pembayaran ${formatRupiah(purchase.total)} ke ${findSupplier(purchase.supplier)?.nama ?? purchase.supplier} untuk faktur ${purchase.no_faktur}.`,
    confirmLabel: 'Sudah Dibayar',
    variant: 'primary',
    icon: 'payments',
  });
  if (!confirmed || !markPurchasePaid(id)) return;
  showToast({ type: 'success', title: 'Faktur lunas', message: `${purchase.no_faktur} tidak lagi dihitung sebagai hutang.` });
  renderMetrics();
  table.render();
  openDetail(id);
}

function exportCsv() {
  const rows = filtered().map((item) => [
    item.id, item.tanggal.slice(0, 10), findSupplier(item.supplier)?.nama ?? item.supplier, item.no_faktur, item.no_surat_jalan,
    item.items.length, unitCount(item), item.subtotal, item.diskon, item.pajak, item.total, item.jatuh_tempo.slice(0, 10),
    PURCHASE_PAY_STATUS[payStatus(item)].label,
  ]);
  downloadCsv(`barang-masuk-${toDateKey(new Date())}.csv`, [
    ['No. Dokumen', 'Tanggal', 'Supplier', 'No. Faktur', 'No. Surat Jalan', 'SKU', 'Unit', 'Subtotal', 'Diskon', 'PPN', 'Total', 'Jatuh Tempo', 'Status'],
    ...rows,
  ]);
  showToast({ type: 'success', title: 'CSV diunduh', message: `${rows.length} dokumen diekspor.` });
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
    if (event.target.name === 'supplier' || event.target.name === 'bayar') {
      state[event.target.name] = event.target.value;
      table.reset();
    }
  });
  filters.addEventListener('submit', (event) => event.preventDefault());

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'detail') openDetail(event.target.closest('tr[data-id]').dataset.id);
    if (action === 'export') exportCsv();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close-detail') dialog.close();
    if (action === 'mark-paid') markPaid(openId);
  });
}

if (initShell()) {
  if (!canEdit) document.querySelectorAll('[data-admin-only]').forEach((element) => element.remove());
  filters.elements.supplier.insertAdjacentHTML('beforeend', getSuppliers()
    .map((item) => `<option value="${item.id}">${escapeHtml(item.nama)}</option>`).join(''));
  filters.elements.supplier.value = state.supplier;
  filters.elements.bayar.value = state.bayar;
  bindEvents();
  renderMetrics();
  table.render();
  if (params.get('id')) openDetail(params.get('id'));
}
