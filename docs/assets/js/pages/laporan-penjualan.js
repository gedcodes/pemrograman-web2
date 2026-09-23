/**
 * Laporan Penjualan — rekap per periode (preset / tanggal bebas), grafik
 * per hari, ringkasan keuangan, metode pembayaran, produk terlaris, dan
 * pratinjau struk. Cetak memakai @media print (lihat css/print.css).
 */

import { initShell } from '../layout/shell.js';
import { getTransactions } from '../core/db.js';
import { HISTORY_DAYS } from '../data/transactions.js';
import {
  dailySeries, inRange, paymentBreakdown, percentChange, summarize, topProducts,
} from '../core/analytics.js';
import { addDays, startOfDay, toDateKey, toInputValue } from '../core/dates.js';
import {
  escapeHtml, formatChange, formatDateLong, formatDateShort, formatNumber, formatPercent, formatRupiah, formatTime, rupiahHtml,
} from '../core/format.js';
import { downloadCsv } from '../core/csv.js';
import { PAYMENT_TYPES, TRANSACTION_STATUS, badgeHtml } from '../components/badges.js';
import { createBarChart, updateChart } from '../components/charts.js';
import { printReceipt, receiptHtml } from '../components/receipt.js';
import { showToast } from '../components/toast.js';
import { createPeriodPicker, rangeDays, rangeEnd } from '../components/period-picker.js';

const today = startOfDay(new Date());
const earliest = addDays(today, -(HISTORY_DAYS - 1));

const els = {
  form: document.querySelector('[data-range-form]'),
  receiptSelect: document.querySelector('[data-receipt-select]'),
  receipt: document.querySelector('[data-receipt]'),
};

let chart = null;
let current = null;

/* ---------- Render ---------- */

const setMetric = (key, html) => {
  document.querySelector(`[data-metric="${key}"]`).innerHTML = html;
};

function changeBadge(ratio) {
  if (ratio === null) return '<span class="text-caption text-muted">Tidak ada data pembanding</span>';
  const up = ratio >= 0;
  return badgeHtml({
    label: `${formatChange(ratio)} vs periode sebelumnya`,
    variant: up ? 'success' : 'danger',
    icon: up ? 'trending_up' : 'trending_down',
  });
}

function renderMetrics(summary, previous) {
  setMetric('omzet', rupiahHtml(summary.omzet));
  setMetric('omzet-change', changeBadge(percentChange(summary.omzet, previous.omzet)));
  setMetric('trx', formatNumber(summary.jumlahTransaksi));
  setMetric('trx-change', changeBadge(percentChange(summary.jumlahTransaksi, previous.jumlahTransaksi)));
  setMetric('avg', rupiahHtml(Math.round(summary.rataRata)));
  setMetric('items', `${formatNumber(summary.itemTerjual)} item terjual`);
  setMetric('laba', rupiahHtml(summary.labaKotor));
  setMetric('margin', `Margin kotor ${formatPercent(summary.margin)} dari penjualan bersih`);
}

function renderChart(transactions, days) {
  const series = dailySeries(transactions, current.from, days);
  const labelFormat = new Intl.DateTimeFormat('id-ID', days > 14 ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const data = {
    labels: series.map((day) => labelFormat.format(day.date)),
    values: series.map((day) => day.omzet),
  };
  const peak = series.reduce((best, day) => (day.omzet > best.omzet ? day : best), series[0]);

  document.querySelector('[data-peak]').textContent = peak.omzet
    ? `Puncak ${formatRupiah(peak.omzet)} · ${formatDateShort(peak.date)}`
    : 'Belum ada penjualan';
  document.getElementById('daily-chart').setAttribute('aria-label',
    `Grafik penjualan per hari, ${days} hari. Puncak ${formatRupiah(peak.omzet)} pada ${formatDateLong(peak.date)}.`);

  if (chart) updateChart(chart, data);
  else chart = createBarChart(document.getElementById('daily-chart'), data);
}

function renderFinance(summary) {
  const rows = [
    ['Penjualan kotor', formatRupiah(summary.penjualanKotor)],
    ['Diskon member', `-${formatRupiah(summary.diskon)}`],
    ['Penjualan bersih', formatRupiah(summary.penjualanBersih)],
    ['PPN keluaran', formatRupiah(summary.pajak)],
    ['Total diterima', formatRupiah(summary.omzet), true],
    ['Harga pokok penjualan', `-${formatRupiah(summary.hpp)}`],
    ['Laba kotor', formatRupiah(summary.labaKotor), true],
  ];
  document.querySelector('[data-finance]').innerHTML = rows
    .map(([label, value, strong]) => `
      <div class="summary-list__row ${strong ? 'summary-list__row--strong' : ''}">
        <dt>${label}</dt><dd>${value}</dd>
      </div>`)
    .join('');
}

function renderPayments(transactions) {
  const breakdown = paymentBreakdown(transactions);
  const grandTotal = Object.values(breakdown).reduce((sum, item) => sum + item.total, 0);
  document.querySelector('[data-payments]').innerHTML = Object.entries(PAYMENT_TYPES)
    .map(([key, { label, icon }]) => {
      const item = breakdown[key] ?? { jumlah: 0, total: 0 };
      const share = grandTotal ? item.total / grandTotal : 0;
      return `
        <li class="payment-list__item">
          <div class="payment-list__head">
            <span class="payment-type"><span class="icon icon--sm" aria-hidden="true">${icon}</span>${label}</span>
            <span class="num">${formatRupiah(item.total)}</span>
          </div>
          <div class="meter" role="img" aria-label="${label} ${formatPercent(share)} dari total">
            <div class="meter__fill" style="--value: ${share.toFixed(4)}"></div>
          </div>
          <span class="text-caption text-muted">${formatNumber(item.jumlah)} transaksi · ${formatPercent(share)}</span>
        </li>`;
    })
    .join('');
}

function renderTopProducts(transactions) {
  const rows = topProducts(transactions, 10);
  document.querySelector('[data-top-products]').innerHTML = rows.length
    ? rows
      .map((row, index) => `
        <tr>
          <td class="col-center"><span class="rank ${index < 3 ? 'rank--top' : ''}">${index + 1}</span></td>
          <td><span class="table__name">${escapeHtml(row.nama)}</span><span class="table__sub">${row.id}</span></td>
          <td class="col-num">${formatNumber(row.qty)}</td>
          <td class="col-num">${rupiahHtml(row.penjualan)}</td>
          <td class="col-num">${rupiahHtml(row.laba)}</td>
          <td class="col-num">${formatPercent(row.margin)}</td>
        </tr>`)
      .join('')
    : '<tr><td colspan="6"><div class="empty-state"><p class="empty-state__title">Belum ada penjualan pada periode ini</p></div></td></tr>';
}

function renderReceiptOptions(transactions) {
  const options = transactions.slice(0, 100);
  els.receiptSelect.innerHTML = options.length
    ? options
      .map((trx) => {
        const date = new Date(trx.tanggal);
        const status = trx.status === 'settlement' ? '' : ` · ${TRANSACTION_STATUS[trx.status].label}`;
        return `<option value="${trx.id}">${trx.id} · ${formatDateShort(date)} ${formatTime(date)} · ${formatRupiah(trx.total)}${status}</option>`;
      })
      .join('')
    : '<option value="">Tidak ada transaksi</option>';
  els.receiptSelect.disabled = options.length === 0;
  renderReceipt(transactions);
}

function renderReceipt(transactions) {
  const trx = transactions.find((item) => item.id === els.receiptSelect.value);
  els.receipt.innerHTML = trx
    ? receiptHtml(trx)
    : '<div class="empty-state"><p class="empty-state__text">Pilih periode yang memiliki transaksi.</p></div>';
}

let rangeTransactions = [];

function render() {
  const end = rangeEnd(current);
  const days = rangeDays(current);
  const all = getTransactions();
  rangeTransactions = inRange(all, current.from, end);
  const summary = summarize(rangeTransactions);
  const previous = summarize(inRange(all, addDays(current.from, -days), current.from));

  document.querySelector('[data-range-label]').textContent =
    `${formatDateLong(current.from)} – ${formatDateLong(current.to)} · ${days} hari`;

  renderMetrics(summary, previous);
  renderChart(rangeTransactions, days);
  renderFinance(summary);
  renderPayments(rangeTransactions);
  renderTopProducts(rangeTransactions);
  renderReceiptOptions(rangeTransactions);
}

/* ---------- Aksi ---------- */

function exportCsv() {
  const days = rangeDays(current);
  const rows = dailySeries(rangeTransactions, current.from, days).map((day) => [
    toInputValue(day.date),
    day.transaksi,
    day.omzet,
  ]);
  const summary = summarize(rangeTransactions);
  downloadCsv(`laporan-penjualan-${toDateKey(current.from)}-${toDateKey(current.to)}.csv`, [
    ['Tanggal', 'Jumlah Transaksi', 'Omzet (Rp)'],
    ...rows,
    [],
    ['Total', summary.jumlahTransaksi, summary.omzet],
    ['Laba kotor', '', summary.labaKotor],
  ]);
  showToast({ type: 'success', title: 'CSV diunduh', message: `Rekap ${days} hari berhasil diekspor.` });
}

function printReport() {
  document.body.dataset.print = 'laporan';
  window.addEventListener('afterprint', () => delete document.body.dataset.print, { once: true });
  window.print();
}

function printSelectedReceipt() {
  const trx = rangeTransactions.find((item) => item.id === els.receiptSelect.value);
  if (trx) printReceipt(trx);
}

function bindEvents() {
  els.receiptSelect.addEventListener('change', () => renderReceipt(rangeTransactions));

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'export') exportCsv();
    if (action === 'print-report') printReport();
    if (action === 'print-receipt') printSelectedReceipt();
  });
}

if (initShell()) {
  const picker = createPeriodPicker(els.form, {
    earliest,
    preset: 'month',
    onChange: (range) => {
      current = range;
      render();
    },
  });
  current = picker.get();
  bindEvents();
  render();
}
