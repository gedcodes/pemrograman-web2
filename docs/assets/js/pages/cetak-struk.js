/**
 * Cetak Ulang Struk — cari transaksi, pratinjau struk bertanda SALINAN,
 * cetak 80mm (@media print), kirim ringkasan ke WhatsApp pelanggan, dan
 * catat setiap cetak ulang untuk audit.
 */

import { initShell } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import { findCustomer, findUser, getReprintInfo, getTransactions, recordReprint } from '../core/db.js';
import { getSettings } from '../core/settings.js';
import { inRange } from '../core/analytics.js';
import { escapeHtml, formatDateShort, formatDateTime, formatNumber, formatRupiah, formatTime, rupiahHtml } from '../core/format.js';
import { PAYMENT_TYPES, TRANSACTION_STATUS, badgeHtml, paymentHtml } from '../components/badges.js';
import { presetRange, rangeEnd } from '../components/period-picker.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { printReceipt, receiptHtml } from '../components/receipt.js';
import { showToast } from '../components/toast.js';

const user = getCurrentUser();
const params = new URLSearchParams(window.location.search);
const filters = document.querySelector('[data-filters]');
const rowsBody = document.querySelector('[data-rows]');

const state = {
  q: (params.get('q') ?? '').replace(/^#/, ''),
  periode: params.get('q') ? 'all' : 'today',
  metode: '',
  selected: null,
};

function filtered() {
  let list = getTransactions();
  if (state.periode !== 'all') {
    const range = presetRange(state.periode);
    list = inRange(list, range.from, rangeEnd(range));
  }
  const query = state.q.trim().toLowerCase();
  return list.filter((trx) => (!state.metode || trx.pembayaran.tipe === state.metode)
    && (!query || trx.id.toLowerCase().includes(query)
      || (trx.pelanggan && findCustomer(trx.pelanggan)?.nama.toLowerCase().includes(query))));
}

/* ---------- Tabel ---------- */

function rowHtml(trx) {
  const date = new Date(trx.tanggal);
  const customer = trx.pelanggan ? findCustomer(trx.pelanggan) : null;
  const reprint = getReprintInfo(trx.id);
  const selected = trx.id === state.selected;
  return `
    <tr data-id="${trx.id}" class="${selected ? 'is-selected' : ''}" aria-selected="${selected}">
      <td><button class="link-btn num" type="button" data-action="select">${trx.id}</button></td>
      <td><span class="num">${formatTime(date)}</span><span class="table__sub">${formatDateShort(date)}</span></td>
      <td>${customer ? `${escapeHtml(customer.nama)}<span class="table__sub">${customer.tingkat}</span>` : '<span class="text-muted">Umum</span>'}</td>
      <td>${paymentHtml(trx.pembayaran.tipe)}</td>
      <td class="col-num">${rupiahHtml(trx.total)}</td>
      <td class="col-center">${badgeHtml(TRANSACTION_STATUS[trx.status])}</td>
      <td class="col-num">${reprint.jumlah ? `${reprint.jumlah}×` : '<span class="text-muted">–</span>'}</td>
    </tr>`;
}

const table = createTableView({
  root: document.querySelector('[data-table]'),
  columns: 7,
  noun: 'transaksi',
  pageSize: 8,
  getItems: filtered,
  rowHtml,
  emptyHtml: () => emptyStateHtml({
    icon: 'search_off',
    title: `Tidak ada transaksi${state.q ? ` untuk "${escapeHtml(state.q)}"` : ''}`,
    text: 'Coba periode yang lebih panjang atau periksa nomor struk.',
  }),
  onRender: (visible) => {
    // Pilih otomatis baris pertama agar pratinjau tidak kosong
    if (!visible.some((trx) => trx.id === state.selected) && visible[0]) select(visible[0].id, { focus: false });
    if (!visible.length) select(null);
  },
});

/* ---------- Pratinjau ---------- */

const current = () => (state.selected ? getTransactions().find((trx) => trx.id === state.selected) : null);

/** 0812-3456-7890 → 6281234567890 untuk tautan wa.me */
const waNumber = (phone) => phone.replace(/\D/g, '').replace(/^0/, '62');

function summaryText(trx) {
  const { store } = getSettings();
  const lines = trx.items.map((item) => `${item.nama} ${item.qty} x ${formatNumber(item.harga_satuan)}`);
  return [
    `*${store.nama}* — salinan struk`,
    `${trx.id} · ${formatDateTime(new Date(trx.tanggal))}`,
    ...lines,
    `Total: ${formatRupiah(trx.total)} (${PAYMENT_TYPES[trx.pembayaran.tipe].label})`,
    store.footer1,
  ].filter(Boolean).join('\n');
}

function renderPreview() {
  const trx = current();
  const preview = document.querySelector('[data-preview]');
  const printButton = document.querySelector('[data-action="print"]');
  const copyButton = document.querySelector('[data-action="copy"]');
  const whatsapp = document.querySelector('[data-whatsapp]');

  if (!trx) {
    preview.innerHTML = emptyStateHtml({ icon: 'receipt_long', title: 'Belum ada struk dipilih', text: 'Pilih transaksi di daftar.' });
    document.querySelector('[data-reprint-info]').textContent = '';
    printButton.disabled = true;
    copyButton.disabled = true;
    whatsapp.removeAttribute('href');
    whatsapp.setAttribute('aria-disabled', 'true');
    return;
  }

  preview.innerHTML = receiptHtml(trx, { reprint: true });
  const info = getReprintInfo(trx.id);
  document.querySelector('[data-reprint-info]').textContent = info.jumlah
    ? `Sudah dicetak ulang ${info.jumlah}× · terakhir ${formatDateTime(new Date(info.terakhir))} oleh ${findUser(info.oleh)?.nama ?? '-'}`
    : 'Belum pernah dicetak ulang.';
  printButton.disabled = false;
  copyButton.disabled = false;

  const customer = trx.pelanggan ? findCustomer(trx.pelanggan) : null;
  if (customer?.no_hp) {
    whatsapp.href = `https://wa.me/${waNumber(customer.no_hp)}?text=${encodeURIComponent(summaryText(trx))}`;
    whatsapp.removeAttribute('aria-disabled');
    whatsapp.title = `Kirim ke ${customer.nama} (${customer.no_hp})`;
  } else {
    whatsapp.removeAttribute('href');
    whatsapp.setAttribute('aria-disabled', 'true');
    whatsapp.title = 'Hanya untuk member yang punya nomor HP';
  }
}

function select(id, { focus = true } = {}) {
  state.selected = id;
  rowsBody.querySelectorAll('tr[data-id]').forEach((row) => {
    const active = row.dataset.id === id;
    row.classList.toggle('is-selected', active);
    row.setAttribute('aria-selected', String(active));
    if (active && focus) row.querySelector('[data-action="select"]').focus();
  });
  renderPreview();
}

/* ---------- Aksi ---------- */

function printCopy() {
  const trx = current();
  if (!trx) return;
  const info = recordReprint(trx.id, user.id);
  printReceipt(trx, { reprint: true });
  showToast({ type: 'success', title: 'Salinan dikirim ke printer', message: `${trx.id} · cetak ulang ke-${info.jumlah}.` });
  table.render();
}

async function copySummary() {
  const trx = current();
  try {
    await navigator.clipboard.writeText(summaryText(trx));
    showToast({ type: 'success', title: 'Ringkasan disalin', message: 'Tempel ke chat pelanggan.' });
  } catch {
    showToast({ type: 'warning', title: 'Tidak bisa menyalin', message: 'Browser menolak akses clipboard.' });
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
  filters.addEventListener('change', (event) => {
    if (event.target.name === 'periode' || event.target.name === 'metode') {
      state[event.target.name] = event.target.value;
      table.reset();
    }
  });
  filters.addEventListener('submit', (event) => event.preventDefault());

  rowsBody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-id]');
    if (row) select(row.dataset.id, { focus: event.target.closest('[data-action="select"]') !== null });
  });
  rowsBody.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const rows = [...rowsBody.querySelectorAll('tr[data-id]')];
    const index = rows.findIndex((row) => row.dataset.id === state.selected);
    const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    select(next.dataset.id);
  });

  document.querySelector('[data-action="print"]').addEventListener('click', printCopy);
  document.querySelector('[data-action="copy"]').addEventListener('click', copySummary);
  document.querySelector('[data-whatsapp]').addEventListener('click', (event) => {
    if (event.currentTarget.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      showToast({ type: 'info', title: 'Pelanggan umum', message: 'Kirim WhatsApp hanya tersedia untuk member yang punya nomor HP.' });
    }
  });
}

if (initShell()) {
  filters.elements.q.value = state.q;
  filters.elements.periode.value = state.periode;
  bindEvents();
  table.render();
}
