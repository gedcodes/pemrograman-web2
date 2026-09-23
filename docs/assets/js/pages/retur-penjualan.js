/**
 * Retur Penjualan (entitas RETUR, ER-D §3). Alur: cari struk → pilih barang
 * dan jumlah → alasan → refund dihitung proporsional → simpan.
 * Admin langsung menyetujui; pengajuan kasir menunggu approval (§2.2).
 */

import { initShell, pageUrl } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import {
  addReturn, findCustomer, findTransaction, findUser, getReturns, processReturn, refundFor, returnedQuantities,
} from '../core/db.js';
import { startOfDay, startOfMonth, toDateKey } from '../core/dates.js';
import {
  escapeHtml, formatDateShort, formatNumber, formatRupiah, formatTime, rupiahHtml,
} from '../core/format.js';
import { clearFieldErrors, initHints, showFieldError } from '../core/validation.js';
import { PAYMENT_TYPES, RETURN_REASONS, RETURN_STATUS, badgeHtml } from '../components/badges.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { createFormDialog } from '../components/form-dialog.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const RETURN_WINDOW_DAYS = 7;

const user = getCurrentUser();
const isAdmin = user.peran === 'admin';
const params = new URLSearchParams(window.location.search);

const lookupForm = document.querySelector('[data-lookup-form]');
const returnForm = document.querySelector('[data-return-form]');

const state = {
  trx: null,
  remaining: {},
  qty: {},
  status: params.get('status') ?? '',
};

/* ---------- Cari struk ---------- */

function lookupError(trx, query) {
  if (!query) return 'Nomor struk wajib diisi.';
  if (!trx) return `Struk "${query}" tidak ditemukan.`;
  if (trx.status !== 'settlement') return 'Hanya transaksi lunas yang bisa diretur.';
  const age = (startOfDay(new Date()) - startOfDay(new Date(trx.tanggal))) / 86_400_000;
  if (age > RETURN_WINDOW_DAYS) return `Struk berumur ${Math.round(age)} hari, melewati batas retur ${RETURN_WINDOW_DAYS} hari.`;
  const remaining = remainingFor(trx);
  if (!Object.values(remaining).some((qty) => qty > 0)) return 'Semua barang pada struk ini sudah diretur.';
  return '';
}

function remainingFor(trx) {
  const returned = returnedQuantities(trx.id);
  return Object.fromEntries(trx.items.map((item) => [item.id_produk, item.qty - (returned[item.id_produk] ?? 0)]));
}

function handleLookup(event) {
  event?.preventDefault();
  const query = lookupForm.elements.struk.value.trim().toUpperCase().replace(/^#/, '');
  const trx = query ? findTransaction(query) : null;
  const error = lookupError(trx, query);
  showFieldError(lookupForm, 'struk', error);
  if (error) {
    returnForm.hidden = true;
    lookupForm.elements.struk.focus();
    return;
  }
  lookupForm.elements.struk.value = trx.id;
  openReturn(trx);
}

/* ---------- Form retur ---------- */

function openReturn(trx) {
  state.trx = trx;
  state.remaining = remainingFor(trx);
  state.qty = Object.fromEntries(trx.items.map((item) => [item.id_produk, 0]));
  returnForm.reset();
  clearFieldErrors(returnForm);
  initHints(returnForm);

  const customer = trx.pelanggan ? findCustomer(trx.pelanggan) : null;
  const date = new Date(trx.tanggal);
  returnForm.querySelector('[data-trx-summary]').innerHTML = `
    <div class="trx-summary__main">
      <span class="num trx-summary__id">${trx.id}</span>
      <span class="text-small text-secondary">${formatDateShort(date)} ${formatTime(date)} · ${escapeHtml(findUser(trx.kasir)?.nama ?? '-')}</span>
    </div>
    <dl class="trx-summary__facts">
      <div><dt>Pelanggan</dt><dd>${customer ? escapeHtml(customer.nama) : 'Umum'}</dd></div>
      <div><dt>Metode</dt><dd>${PAYMENT_TYPES[trx.pembayaran.tipe].label}</dd></div>
      <div><dt>Total struk</dt><dd class="num">${formatRupiah(trx.total)}</dd></div>
    </dl>`;

  renderLines();
  renderRefund();
  returnForm.hidden = false;
  returnForm.querySelector('.stepper__input:not(:disabled)')?.focus();
}

function renderLines() {
  returnForm.querySelector('[data-lines]').innerHTML = state.trx.items
    .map((item) => {
      const max = state.remaining[item.id_produk];
      const qty = state.qty[item.id_produk];
      const name = escapeHtml(item.nama);
      return `
        <tr data-line="${item.id_produk}" class="${qty > 0 ? 'is-selected' : ''}">
          <td><span class="table__name">${name}</span><span class="table__sub">${formatRupiah(item.harga_satuan)} / unit</span></td>
          <td class="col-num">${formatNumber(item.qty)}</td>
          <td class="col-num">${formatNumber(max)}</td>
          <td class="col-center">
            <div class="stepper stepper--sm">
              <button class="stepper__btn" type="button" data-step="-1" aria-label="Kurangi retur ${name}" ${qty <= 0 ? 'disabled' : ''}>
                <span class="icon icon--sm" aria-hidden="true">remove</span>
              </button>
              <input class="stepper__input" type="number" min="0" max="${max}" step="1" value="${qty}" inputmode="numeric"
                     aria-label="Jumlah retur ${name}" ${max <= 0 ? 'disabled' : ''}>
              <button class="stepper__btn" type="button" data-step="1" aria-label="Tambah retur ${name}" ${qty >= max ? 'disabled' : ''}>
                <span class="icon icon--sm" aria-hidden="true">add</span>
              </button>
            </div>
          </td>
          <td class="col-num">${rupiahHtml(item.harga_satuan * qty)}</td>
        </tr>`;
    })
    .join('');
}

function selectedLines() {
  return state.trx.items
    .filter((item) => state.qty[item.id_produk] > 0)
    .map((item) => ({ id_produk: item.id_produk, nama: item.nama, qty: state.qty[item.id_produk], harga_satuan: item.harga_satuan }));
}

function renderRefund() {
  const lines = selectedLines();
  const barang = lines.reduce((sum, line) => sum + line.harga_satuan * line.qty, 0);
  const refund = refundFor(state.trx, lines);
  const set = (key, value) => { returnForm.querySelector(`[data-sum="${key}"]`).textContent = value; };
  set('barang', formatRupiah(barang));
  set('penyesuaian', `${refund - barang >= 0 ? '+' : ''}${formatRupiah(refund - barang)}`);
  set('refund', formatRupiah(refund));
  set('metode', state.trx.pembayaran.metode === 'tunai' ? 'Tunai dari laci kas' : `Transfer balik (${PAYMENT_TYPES[state.trx.pembayaran.tipe].label})`);
}

function setQty(id, value) {
  const max = state.remaining[id];
  state.qty[id] = Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));
  renderLines();
  renderRefund();
  if (selectedLines().length) showFieldError(returnForm, 'items', '');
}

const RULES = {
  items: () => (selectedLines().length ? '' : 'Pilih minimal satu barang dengan jumlah retur lebih dari 0.'),
  alasan: (values) => (values.alasan ? '' : 'Pilih alasan retur.'),
  catatan: (values) => {
    if (values.alasan === 'lainnya' && values.catatan.length < 5) return 'Jelaskan alasan retur minimal 5 karakter.';
    return '';
  },
};

function handleSubmit(event) {
  event.preventDefault();
  const values = {
    alasan: returnForm.elements.alasan.value,
    catatan: returnForm.elements.catatan.value.trim(),
    kembali_ke_stok: returnForm.elements.kembali_ke_stok.checked,
  };
  const invalid = Object.entries(RULES).filter(([name, rule]) => {
    const error = rule(values);
    showFieldError(returnForm, name, error);
    return error;
  });
  if (invalid.length) {
    showToast({ type: 'danger', title: 'Periksa kembali isian', message: `${invalid.length} bagian belum valid.` });
    return;
  }

  const lines = selectedLines();
  const saved = addReturn({
    id_transaksi: state.trx.id,
    pelanggan: state.trx.pelanggan,
    items: lines,
    jumlah_refund: refundFor(state.trx, lines),
    ...values,
  }, user);
  if (!saved) {
    showToast({ type: 'danger', title: 'Gagal menyimpan retur', message: 'Penyimpanan browser penuh atau diblokir.' });
    return;
  }

  showToast(saved.status === 'disetujui'
    ? { type: 'success', title: 'Retur diproses', message: `${saved.id} disetujui. Serahkan refund ${formatRupiah(saved.jumlah_refund)}.` }
    : { type: 'info', title: 'Retur diajukan', message: `${saved.id} menunggu approval admin sebelum refund diserahkan.` });
  resetForm();
  state.status = '';
  syncStatusFilter();
  table.reset();
  renderStats();
}

function resetForm() {
  state.trx = null;
  returnForm.hidden = true;
  lookupForm.reset();
  showFieldError(lookupForm, 'struk', '');
  lookupForm.elements.struk.focus();
}

/* ---------- Daftar retur ---------- */

const visibleReturns = () => {
  const all = getReturns();
  return isAdmin ? all : all.filter((item) => item.dibuat_oleh === user.id);
};

function rowHtml(ret) {
  const date = new Date(ret.tanggal);
  const items = ret.items.map((line) => `${escapeHtml(line.nama)} × ${line.qty}`).join(', ');
  const submitter = findUser(ret.dibuat_oleh)?.nama ?? '-';
  const actions = isAdmin && ret.status === 'menunggu'
    ? `
      <button class="icon-btn icon-btn--flat icon-btn--danger" type="button" data-action="reject" aria-label="Tolak ${ret.id}">
        <span class="icon" aria-hidden="true">close</span>
      </button>
      <button class="btn btn--sm btn--success" type="button" data-action="approve">Setujui</button>`
    : `<a class="icon-btn icon-btn--flat" href="${pageUrl('riwayat-transaksi')}?trx=${ret.id_transaksi}&periode=all"
          aria-label="Lihat struk ${ret.id_transaksi}"><span class="icon" aria-hidden="true">receipt_long</span></a>`;
  const processed = ret.diproses_oleh
    ? `<span class="table__desc">oleh ${escapeHtml(findUser(ret.diproses_oleh)?.nama ?? '-')}</span>` : '';
  return `
    <tr data-id="${ret.id}" class="${ret.status === 'menunggu' ? 'is-warning' : ''}">
      <td><span class="num">${ret.id}</span><span class="table__sub">${formatDateShort(date)} ${formatTime(date)}</span></td>
      <td><span class="num">${ret.id_transaksi}</span><span class="table__desc">Diajukan ${escapeHtml(submitter)}</span></td>
      <td class="table__clip" title="${items}">${items}</td>
      <td class="nowrap">${RETURN_REASONS[ret.alasan]}${ret.kembali_ke_stok ? '<span class="table__desc">Kembali ke stok</span>' : ''}</td>
      <td class="col-num">${rupiahHtml(ret.jumlah_refund)}</td>
      <td class="col-center">${badgeHtml(RETURN_STATUS[ret.status])}${processed}</td>
      <td class="col-center"><div class="table__actions">${actions}</div></td>
    </tr>`;
}

const table = createTableView({
  root: document.querySelector('[data-table]'),
  columns: 7,
  noun: 'retur',
  pageSize: 8,
  getItems: () => visibleReturns().filter((item) => !state.status || item.status === state.status),
  rowHtml,
  emptyHtml: () => emptyStateHtml({
    icon: 'assignment_return',
    title: state.status ? `Tidak ada retur berstatus ${RETURN_STATUS[state.status].label.toLowerCase()}` : 'Belum ada retur',
    text: 'Retur yang diajukan akan tercatat di sini beserta status approval-nya.',
  }),
  onRender: (visible, all) => {
    document.querySelector('[data-list-subtitle]').textContent = isAdmin
      ? `${formatNumber(all.length)} retur · semua kasir`
      : `${formatNumber(all.length)} retur yang Anda ajukan`;
  },
});

function syncStatusFilter() {
  document.querySelectorAll('[data-status-filter] [data-status]').forEach((option) => {
    option.setAttribute('aria-pressed', String(option.dataset.status === state.status));
  });
}

function renderStats() {
  const monthStart = startOfMonth(new Date());
  const thisMonth = visibleReturns().filter((item) => new Date(item.tanggal) >= monthStart);
  const approved = thisMonth.filter((item) => item.status === 'disetujui');
  const waiting = visibleReturns().filter((item) => item.status === 'menunggu');
  const rows = [
    ['Retur diajukan', `${formatNumber(thisMonth.length)} retur`],
    ['Refund disetujui', formatRupiah(approved.reduce((sum, item) => sum + item.jumlah_refund, 0))],
    ['Barang kembali ke stok', `${formatNumber(approved.filter((item) => item.kembali_ke_stok).reduce((sum, item) => sum + item.items.reduce((s, l) => s + l.qty, 0), 0))} unit`],
    ['Menunggu approval', `${formatNumber(waiting.length)} retur`, waiting.length > 0],
  ];
  document.querySelector('[data-stats]').innerHTML = rows
    .map(([label, value, strong]) => `<div class="summary-list__row ${strong ? 'summary-list__row--strong' : ''}"><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');
}

/* ---------- Approval ---------- */

async function approve(id) {
  const ret = getReturns().find((item) => item.id === id);
  const confirmed = await confirmDialog({
    title: 'Setujui retur?',
    message: `Refund ${formatRupiah(ret.jumlah_refund)} untuk struk ${ret.id_transaksi}${ret.kembali_ke_stok ? ' dan stok barang dikembalikan ke rak' : ''}.`,
    confirmLabel: 'Setujui',
    variant: 'primary',
    icon: 'check_circle',
  });
  if (!confirmed) return;
  if (processReturn(id, { approve: true, userId: user.id })) {
    showToast({ type: 'success', title: 'Retur disetujui', message: `${id} siap diserahkan ke pelanggan.` });
    table.render();
    renderStats();
  }
}

const rejectDialog = createFormDialog(document.getElementById('reject-dialog'), {
  rules: {
    catatan_proses: (values) => (values.catatan_proses.length >= 5 ? '' : 'Tulis alasan penolakan minimal 5 karakter.'),
  },
  onSubmit: (values, context) => {
    if (!processReturn(context.id, { approve: false, userId: user.id, note: values.catatan_proses })) return false;
    showToast({ type: 'info', title: 'Retur ditolak', message: `${context.id} ditolak dan tidak ada refund.` });
    table.render();
    renderStats();
    return true;
  },
});

/* ---------- Event ---------- */

function bindEvents() {
  lookupForm.addEventListener('submit', handleLookup);
  returnForm.addEventListener('submit', handleSubmit);

  returnForm.addEventListener('click', (event) => {
    const step = event.target.closest('[data-step]');
    if (step) {
      const id = step.closest('[data-line]').dataset.line;
      setQty(id, state.qty[id] + Number(step.dataset.step));
      // Baris dirender ulang → kembalikan fokus ke tombol yang sama (atau input bila tombol nonaktif)
      const row = returnForm.querySelector(`[data-line="${id}"]`);
      const again = row.querySelector(`[data-step="${step.dataset.step}"]`);
      (again.disabled ? row.querySelector('.stepper__input') : again).focus();
    }
    if (event.target.closest('[data-action="reset-form"]')) resetForm();
  });
  returnForm.addEventListener('change', (event) => {
    if (event.target.matches('.stepper__input')) setQty(event.target.closest('[data-line]').dataset.line, event.target.value);
    if (event.target.name === 'alasan') {
      showFieldError(returnForm, 'alasan', RULES.alasan({ alasan: event.target.value }));
      // Barang salah varian biasanya masih tersegel → default kembali ke stok
      returnForm.elements.kembali_ke_stok.checked = event.target.value === 'salah_barang';
    }
  });
  returnForm.elements.catatan.addEventListener('input', (event) => {
    returnForm.querySelector('[data-char-count]').textContent = `${event.target.value.length}/200`;
  });

  document.querySelector('[data-status-filter]').addEventListener('click', (event) => {
    const option = event.target.closest('[data-status]');
    if (!option) return;
    state.status = option.dataset.status;
    syncStatusFilter();
    table.reset();
  });

  document.querySelector('[data-table]').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const id = event.target.closest('tr[data-id]')?.dataset.id;
    if (action === 'approve') approve(id);
    if (action === 'reject') {
      const ret = getReturns().find((item) => item.id === id);
      rejectDialog.open({
        title: `Tolak retur ${id}?`,
        subtitle: `Refund ${formatRupiah(ret.jumlah_refund)} untuk struk ${ret.id_transaksi} tidak akan diberikan.`,
        context: { id },
      });
    }
  });
}

if (initShell()) {
  document.querySelector('[data-role-note]').textContent = isAdmin
    ? 'Sebagai admin, retur yang Anda proses langsung disetujui.'
    : 'Retur yang Anda ajukan menunggu approval Admin / Pemilik sebelum refund diserahkan.';
  document.querySelector('[data-submit-label]').textContent = isAdmin ? 'Proses Retur' : 'Ajukan Retur';
  returnForm.elements.alasan.insertAdjacentHTML('beforeend', Object.entries(RETURN_REASONS)
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join(''));
  // Contoh nomor struk kemarin agar placeholder selalu realistis
  lookupForm.elements.struk.placeholder = `TRX-${toDateKey(new Date(Date.now() - 86_400_000))}-0012`;
  initHints(lookupForm);

  bindEvents();
  syncStatusFilter();
  table.render();
  renderStats();

  // Datang dari Riwayat Transaksi → "Ajukan Retur"
  if (params.get('trx')) {
    lookupForm.elements.struk.value = params.get('trx');
    handleLookup();
  }
}
