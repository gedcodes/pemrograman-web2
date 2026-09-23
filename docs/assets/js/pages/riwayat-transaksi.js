/**
 * Riwayat Transaksi — daftar struk dengan filter periode, kasir, metode,
 * dan status; detail struk; konfirmasi manual pembayaran non-tunai yang
 * pending (PERANCANGAN §4.3 & §5.5). Kasir hanya melihat transaksinya sendiri.
 */

import { initShell, pageUrl } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import {
  cancelTransaction, confirmTransaction, findCustomer, findUser, getReturns, getTransactions, getUsers, recordReprint,
} from '../core/db.js';
import { inRange, summarize } from '../core/analytics.js';
import { toDateKey } from '../core/dates.js';
import {
  escapeHtml, formatDateLong, formatDateShort, formatDateTime, formatNumber, formatRupiah, formatTime, rupiahHtml,
} from '../core/format.js';
import { downloadCsv } from '../core/csv.js';
import { PAYMENT_TYPES, RETURN_STATUS, TRANSACTION_STATUS, badgeHtml, paymentHtml } from '../components/badges.js';
import { presetRange, rangeEnd } from '../components/period-picker.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { printReceipt, receiptHtml } from '../components/receipt.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const user = getCurrentUser();
const isAdmin = user.peran === 'admin';
const params = new URLSearchParams(window.location.search);

const state = {
  q: params.get('q') ?? '',
  periode: params.get('periode') ?? 'month',
  kasir: '',
  metode: '',
  status: params.get('status') ?? '',
};

const els = {
  filters: document.querySelector('[data-filters]'),
  chips: document.querySelector('[data-status-chips]'),
  clearFilters: document.querySelector('[data-action="clear-filters"]'),
  pendingNotice: document.querySelector('[data-pending-notice]'),
  dialog: document.getElementById('detail-dialog'),
};

const STATUS_GROUPS = {
  settlement: (trx) => trx.status === 'settlement',
  pending: (trx) => trx.status === 'pending',
  batal: (trx) => trx.status === 'cancel' || trx.status === 'expire',
};

let openId = null;

/* ---------- Data ---------- */

/** Transaksi yang boleh dilihat pengguna ini (PERANCANGAN §2.2) */
function visibleTransactions() {
  const all = getTransactions();
  return isAdmin ? all : all.filter((trx) => trx.kasir === user.id);
}

/** Semua filter kecuali status — dipakai juga untuk angka pada chip */
function baseFiltered() {
  let list = visibleTransactions();
  if (state.periode !== 'all') {
    const range = presetRange(state.periode);
    list = inRange(list, range.from, rangeEnd(range));
  }
  const query = state.q.trim().toLowerCase();
  return list.filter((trx) => {
    if (state.kasir && trx.kasir !== state.kasir) return false;
    if (state.metode && trx.pembayaran.tipe !== state.metode) return false;
    if (!query) return true;
    const customer = trx.pelanggan ? findCustomer(trx.pelanggan)?.nama.toLowerCase() ?? '' : 'umum';
    return trx.id.toLowerCase().includes(query.replace(/^#/, '')) || customer.includes(query);
  });
}

const filtered = () => {
  const list = baseFiltered();
  return state.status ? list.filter(STATUS_GROUPS[state.status]) : list;
};

const hasFilters = () => Boolean(state.q || state.kasir || state.metode || state.status || state.periode !== 'month');

/* ---------- Template ---------- */

function customerHtml(trx) {
  if (!trx.pelanggan) return '<span class="text-muted">Umum</span>';
  const customer = findCustomer(trx.pelanggan);
  return `${escapeHtml(customer?.nama ?? trx.pelanggan)} <span class="badge badge--info badge--tiny">Member</span>`;
}

function rowHtml(trx) {
  const date = new Date(trx.tanggal);
  const voided = trx.status === 'cancel' || trx.status === 'expire';
  const pending = trx.status === 'pending';
  return `
    <tr data-id="${trx.id}" class="${pending ? 'is-warning' : ''}">
      <td class="num ${voided ? 'is-void' : ''}">${trx.id}</td>
      <td><span class="num">${formatTime(date)}</span><span class="table__sub">${formatDateShort(date)}</span></td>
      ${isAdmin ? `<td>${escapeHtml(findUser(trx.kasir)?.nama ?? '-')}</td>` : ''}
      <td>${customerHtml(trx)}</td>
      <td>${paymentHtml(trx.pembayaran.tipe)}</td>
      <td class="col-num ${voided ? 'is-void' : ''}">${rupiahHtml(trx.total)}</td>
      <td class="col-center">${badgeHtml(TRANSACTION_STATUS[trx.status])}</td>
      <td class="col-center">
        <div class="table__actions">
          <button class="icon-btn icon-btn--flat" type="button" data-action="detail" aria-label="Lihat detail ${trx.id}">
            <span class="icon" aria-hidden="true">visibility</span>
          </button>
          ${pending ? `
            <button class="btn btn--primary btn--sm" type="button" data-action="confirm">
              <span class="icon icon--sm" aria-hidden="true">verified</span>Verifikasi
            </button>` : ''}
        </div>
      </td>
    </tr>`;
}

function emptyHtml() {
  return hasFilters()
    ? emptyStateHtml({
      icon: 'search_off',
      title: `Tidak ada transaksi yang cocok${state.q ? ` dengan "${escapeHtml(state.q)}"` : ''}`,
      text: 'Coba periode yang lebih panjang atau hapus filter status dan metode.',
      action: '<button class="btn btn--primary" type="button" data-action="clear-filters">Hapus Filter</button>',
    })
    : emptyStateHtml({
      icon: 'receipt_long',
      title: 'Belum ada transaksi',
      text: 'Transaksi dari halaman Kasir akan muncul di sini.',
      action: `<a class="btn btn--primary" href="${pageUrl('kasir')}">Buka Kasir</a>`,
    });
}

/* ---------- Render ---------- */

const table = createTableView({
  root: document.querySelector('[data-table]'),
  columns: isAdmin ? 8 : 7,
  noun: 'transaksi',
  getItems: filtered,
  rowHtml,
  emptyHtml,
});

const setMetric = (key, html) => {
  document.querySelector(`[data-metric="${key}"]`).innerHTML = html;
};

function render({ resetPage = false } = {}) {
  const base = baseFiltered();
  const counts = Object.fromEntries(Object.entries(STATUS_GROUPS).map(([key, test]) => [key, base.filter(test).length]));
  const summary = summarize(base);

  setMetric('omzet', rupiahHtml(summary.omzet));
  setMetric('avg', summary.jumlahTransaksi ? `Rata-rata ${formatRupiah(Math.round(summary.rataRata))} per struk` : 'Belum ada transaksi lunas');
  setMetric('settlement', formatNumber(counts.settlement));
  setMetric('pending', formatNumber(counts.pending));
  setMetric('batal', formatNumber(counts.batal));

  els.chips.querySelectorAll('[data-status]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.status === state.status));
    chip.querySelector('[data-count]').textContent = formatNumber(chip.dataset.status ? counts[chip.dataset.status] : base.length);
  });

  const periodLabel = els.filters.elements.periode.selectedOptions[0].textContent.toLowerCase();
  document.querySelector('[data-subtitle]').textContent = isAdmin
    ? `${formatNumber(base.length)} transaksi tercatat · ${periodLabel}`
    : `${formatNumber(base.length)} transaksi Anda · ${periodLabel}`;

  els.pendingNotice.hidden = !counts.pending || state.status === 'pending';
  document.querySelector('[data-pending-text]').textContent =
    `${counts.pending} transaksi non-tunai (Midtrans) masih berstatus Pending dan menunggu verifikasi kasir.`;
  els.clearFilters.hidden = !hasFilters();

  if (resetPage) table.reset();
  else table.render();
}

function setFilter(patch) {
  Object.assign(state, patch);
  render({ resetPage: true });
}

function clearFilters() {
  els.filters.reset();
  els.filters.elements.periode.value = 'month';
  setFilter({ q: '', kasir: '', metode: '', status: '', periode: 'month' });
}

/* ---------- Detail ---------- */

const infoRow = (label, value) => `<div class="summary-list__row"><dt>${label}</dt><dd>${value}</dd></div>`;

function logHtml(trx) {
  const entries = [{ status_baru: 'created', waktu: trx.tanggal, oleh: trx.kasir }, ...(trx.log ?? []).filter((entry) => entry.status_lama)];
  if (trx.status === 'settlement' && !(trx.log ?? []).some((entry) => entry.status_lama)) {
    entries.push({ status_baru: 'settlement', waktu: trx.pembayaran.waktu_settlement ?? trx.tanggal, oleh: trx.kasir });
  }
  if (!['settlement', 'pending'].includes(trx.status) && !(trx.log ?? []).some((entry) => entry.status_baru === trx.status)) {
    entries.push({ status_baru: trx.status, waktu: trx.tanggal, oleh: null });
  }

  return entries.map((entry) => {
    const status = entry.status_baru === 'created'
      ? { label: 'Struk dibuat', variant: 'neutral', icon: 'receipt' }
      : TRANSACTION_STATUS[entry.status_baru];
    const by = entry.oleh ? ` · ${escapeHtml(findUser(entry.oleh)?.nama ?? entry.oleh)}` : '';
    return `
      <li class="timeline__item timeline__item--${status.variant}">
        <span class="timeline__title">${status.label}</span>
        <span class="timeline__meta">${formatDateTime(new Date(entry.waktu))}${by}</span>
      </li>`;
  }).join('');
}

function openDetail(id) {
  const trx = visibleTransactions().find((item) => item.id === id);
  if (!trx) {
    showToast({ type: 'warning', title: 'Transaksi tidak ditemukan', message: `${id} tidak ada di riwayat Anda.` });
    return;
  }
  openId = id;
  const payment = PAYMENT_TYPES[trx.pembayaran.tipe];
  const customer = trx.pelanggan ? findCustomer(trx.pelanggan) : null;
  const itemCount = trx.items.reduce((sum, item) => sum + item.qty, 0);
  const returns = getReturns().filter((item) => item.id_transaksi === id);

  els.dialog.querySelector('[data-detail-title]').textContent = trx.id;
  els.dialog.querySelector('[data-detail-meta]').innerHTML =
    `${formatDateLong(new Date(trx.tanggal))} · ${formatTime(new Date(trx.tanggal))} · ${badgeHtml(TRANSACTION_STATUS[trx.status])}`;
  els.dialog.querySelector('[data-detail-receipt]').innerHTML = receiptHtml(trx);
  els.dialog.querySelector('[data-detail-pending]').hidden = trx.status !== 'pending';
  els.dialog.querySelector('[data-detail-order]').textContent = trx.pembayaran.order_id ?? '-';

  els.dialog.querySelector('[data-detail-info]').innerHTML = [
    infoRow('Kasir', escapeHtml(findUser(trx.kasir)?.nama ?? '-')),
    infoRow('Pelanggan', customer ? `${escapeHtml(customer.nama)} · ${customer.tingkat}` : 'Umum (bukan member)'),
    infoRow('Jumlah item', `${formatNumber(itemCount)} item · ${trx.items.length} produk`),
    infoRow('Metode', `${payment.label}${trx.pembayaran.metode === 'non_tunai' ? ' (Midtrans)' : ''}`),
    trx.pembayaran.order_id ? infoRow('Order ID', `<span class="num">${trx.pembayaran.order_id}</span>`) : '',
    trx.pembayaran.metode === 'tunai' && trx.status === 'settlement'
      ? infoRow('Tunai / kembali', `${formatRupiah(trx.pembayaran.bayar)} / ${formatRupiah(trx.pembayaran.kembalian)}`) : '',
    ...returns.map((item) => infoRow(`Retur ${item.id}`, `${formatRupiah(item.jumlah_refund)} · ${RETURN_STATUS[item.status].label}`)),
    `<div class="summary-list__row summary-list__row--strong"><dt>Total</dt><dd>${formatRupiah(trx.total)}</dd></div>`,
  ].join('');
  els.dialog.querySelector('[data-detail-log]').innerHTML = logHtml(trx);

  const actions = [];
  if (trx.status === 'pending') {
    actions.push('<button class="btn btn--danger-soft" type="button" data-action="cancel"><span class="icon" aria-hidden="true">cancel</span>Batalkan</button>');
    actions.push('<button class="btn btn--success" type="button" data-action="confirm"><span class="icon" aria-hidden="true">verified</span>Konfirmasi Lunas</button>');
  } else {
    if (trx.status === 'settlement') {
      actions.push(`<a class="btn btn--ghost" href="${pageUrl('retur-penjualan')}?trx=${trx.id}"><span class="icon" aria-hidden="true">assignment_return</span>Ajukan Retur</a>`);
    }
    actions.push('<button class="btn btn--neutral" type="button" data-action="print"><span class="icon" aria-hidden="true">print</span>Cetak Ulang</button>');
  }
  els.dialog.querySelector('[data-detail-actions]').innerHTML = actions.join('');

  if (!els.dialog.open) els.dialog.showModal();
}

/* ---------- Aksi ---------- */

async function confirmPaid(id) {
  const trx = visibleTransactions().find((item) => item.id === id);
  const confirmed = await confirmDialog({
    title: 'Konfirmasi pembayaran lunas?',
    message: `Pastikan layar Midtrans menampilkan status sukses untuk ${trx.pembayaran.order_id} senilai ${formatRupiah(trx.total)}. Stok produk akan dikurangi.`,
    confirmLabel: 'Ya, Lunas',
    variant: 'primary',
    icon: 'verified',
  });
  if (!confirmed) return;
  if (!confirmTransaction(id, user.id)) {
    showToast({ type: 'danger', title: 'Gagal mengonfirmasi', message: 'Transaksi sudah tidak pending atau penyimpanan diblokir.' });
    return;
  }
  showToast({ type: 'success', title: 'Pembayaran dikonfirmasi', message: `${id} kini berstatus Lunas.` });
  render();
  if (els.dialog.open) openDetail(id);
}

async function cancelPending(id) {
  const confirmed = await confirmDialog({
    title: 'Batalkan transaksi?',
    message: `${id} akan ditandai Dibatalkan. Stok tidak berubah karena pembayaran belum diterima.`,
    confirmLabel: 'Ya, Batalkan',
    cancelLabel: 'Kembali',
    icon: 'cancel',
  });
  if (!confirmed) return;
  if (cancelTransaction(id, user.id)) {
    showToast({ type: 'info', title: 'Transaksi dibatalkan', message: `${id} tidak dihitung ke omzet.` });
    render();
    if (els.dialog.open) openDetail(id);
  }
}

function reprint(id) {
  const trx = visibleTransactions().find((item) => item.id === id);
  recordReprint(id, user.id);
  printReceipt(trx, { reprint: true });
}

function exportCsv() {
  const rows = filtered().map((trx) => [
    trx.id,
    formatDateTime(new Date(trx.tanggal)),
    findUser(trx.kasir)?.nama ?? '',
    trx.pelanggan ? findCustomer(trx.pelanggan)?.nama ?? trx.pelanggan : 'Umum',
    PAYMENT_TYPES[trx.pembayaran.tipe].label,
    trx.subtotal,
    trx.diskon,
    trx.pajak,
    trx.total,
    TRANSACTION_STATUS[trx.status].label,
  ]);
  downloadCsv(`riwayat-transaksi-${toDateKey(new Date())}.csv`, [
    ['No. Struk', 'Waktu', 'Kasir', 'Pelanggan', 'Metode', 'Subtotal', 'Diskon', 'PPN', 'Total', 'Status'],
    ...rows,
  ]);
  showToast({ type: 'success', title: 'CSV diunduh', message: `${formatNumber(rows.length)} transaksi diekspor.` });
}

/* ---------- Event ---------- */

function bindEvents() {
  let searchTimer;
  els.filters.elements.q.addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setFilter({ q: event.target.value }), 150);
  });
  els.filters.addEventListener('change', (event) => {
    if (['periode', 'kasir', 'metode'].includes(event.target.name)) setFilter({ [event.target.name]: event.target.value });
  });
  els.filters.addEventListener('submit', (event) => event.preventDefault());

  els.chips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-status]');
    if (chip) setFilter({ status: chip.dataset.status });
  });

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const id = event.target.closest('tr[data-id]')?.dataset.id;
    if (action === 'detail') openDetail(id);
    if (action === 'confirm' && id) confirmPaid(id);
    if (action === 'export') exportCsv();
    if (action === 'show-pending') setFilter({ status: 'pending' });
    if (action === 'clear-filters') {
      event.preventDefault();
      clearFilters();
    }
  });

  els.dialog.addEventListener('click', (event) => {
    if (event.target === els.dialog) els.dialog.close();
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close-detail') els.dialog.close();
    if (action === 'confirm') confirmPaid(openId);
    if (action === 'cancel') cancelPending(openId);
    if (action === 'print') reprint(openId);
  });
}

if (initShell()) {
  if (isAdmin) {
    els.filters.elements.kasir.insertAdjacentHTML('beforeend', getUsers()
      .map((item) => `<option value="${item.id}">${escapeHtml(item.nama)}</option>`).join(''));
  } else {
    document.querySelectorAll('[data-admin-only]').forEach((element) => element.remove());
  }
  els.filters.elements.q.value = state.q;
  if (els.filters.elements.periode.querySelector(`[value="${state.periode}"]`)) els.filters.elements.periode.value = state.periode;
  // Status dari notifikasi harus terlihat walau di luar periode default
  if (state.status === 'pending' && !params.get('periode')) {
    state.periode = 'all';
    els.filters.elements.periode.value = 'all';
  }

  bindEvents();
  render();
  if (params.get('trx')) openDetail(params.get('trx'));
}
