/**
 * Laporan Laba Rugi — pendapatan, HPP, beban operasional, PPh final, dan
 * laba bersih per periode, dengan rasio kesehatan dan grafik laba harian.
 * Seluruh angka berasal dari core/analytics.js#profitAndLoss.
 */

import { initShell } from '../layout/shell.js';
import { getProduct, getReturns, getStockMoves, getTransactions } from '../core/db.js';
import { MDR_RATE, MONTHLY_EXPENSES } from '../data/master.js';
import { HISTORY_DAYS } from '../data/transactions.js';
import { getSettings } from '../core/settings.js';
import { dailySeries, percentChange, profitAndLoss, summarize } from '../core/analytics.js';
import { addDays, startOfDay, toDateKey } from '../core/dates.js';
import {
  formatChange, formatDateLong, formatDateShort, formatNumber, formatPercent, formatRupiah, rupiahHtml,
} from '../core/format.js';
import { downloadCsv } from '../core/csv.js';
import { badgeHtml } from '../components/badges.js';
import { createBarChart, updateChart } from '../components/charts.js';
import { createPeriodPicker, rangeDays, rangeEnd } from '../components/period-picker.js';
import { showToast } from '../components/toast.js';

const today = startOfDay(new Date());
const earliest = addDays(today, -(HISTORY_DAYS - 1));
const { incomeTaxRate } = getSettings();

let current = null;
let report = null;
let chart = null;

function computeReport(start, end) {
  return profitAndLoss({
    transactions: getTransactions(),
    returns: getReturns(),
    moves: getStockMoves(),
    costOf: (id) => getProduct(id)?.harga_beli ?? 0,
    start,
    end,
    expenses: MONTHLY_EXPENSES,
    mdrRate: MDR_RATE,
    incomeTaxRate,
  });
}

/* ---------- Tabel laporan ---------- */

function statementRows(r) {
  return [
    { type: 'section', label: '1. Pendapatan' },
    { label: 'Penjualan kotor kasir', value: r.penjualanKotor },
    { label: 'Diskon member', value: -r.diskon },
    { label: 'Retur penjualan', value: -r.returNet },
    { type: 'subtotal', label: 'Pendapatan bersih', value: r.pendapatanBersih },
    { type: 'section', label: '2. Harga Pokok Penjualan' },
    { label: 'HPP barang terjual', value: r.hppTerjual },
    { label: 'HPP retur yang kembali ke stok', value: -r.returHpp },
    { label: 'Susut & selisih persediaan (opname, rusak)', value: r.susut },
    { type: 'subtotal', label: 'Total HPP', value: r.hpp },
    { type: 'highlight', label: 'Laba kotor', value: r.labaKotor },
    { type: 'section', label: '3. Beban Operasional' },
    ...r.beban.map((item) => ({ label: item.nama, value: item.nilai })),
    { label: `Biaya MDR non-tunai (${formatPercent(MDR_RATE)} × ${formatRupiah(r.nonTunai)})`, value: r.mdr },
    { type: 'subtotal', label: 'Total beban operasional', value: r.totalBeban },
    { type: 'highlight', label: 'Laba operasional (EBIT)', value: r.labaOperasional },
    { label: `PPh Final UMKM ${formatPercent(incomeTaxRate)} × pendapatan bersih`, value: -r.pph },
    { type: 'total', label: r.labaBersih >= 0 ? 'Laba bersih setelah pajak' : 'Rugi bersih setelah pajak', value: r.labaBersih },
  ];
}

function renderStatement(r) {
  document.querySelector('[data-statement]').innerHTML = statementRows(r)
    .map((row) => {
      if (row.type === 'section') return `<tr class="statement__section"><th scope="rowgroup" colspan="3">${row.label}</th></tr>`;
      const value = row.value || 0; // -0 (mis. −retur nol) ditampilkan sebagai 0
      const negative = value < 0;
      return `
        <tr class="statement__${row.type ?? 'line'}">
          <th scope="row">${row.label}</th>
          <td class="col-num ${negative ? 'text-danger' : ''}">${negative ? '−' : ''}${formatNumber(Math.abs(value))}</td>
          <td class="col-num">${r.pendapatanBersih ? formatPercent(r.ratio(value)) : '–'}</td>
        </tr>`;
    })
    .join('');
}

/* ---------- Metrik & analisis ---------- */

const setMetric = (key, html) => {
  document.querySelector(`[data-metric="${key}"]`).innerHTML = html;
};

function changeBadge(ratio) {
  if (ratio === null) return '<span class="text-caption text-muted">Tidak ada data pembanding</span>';
  const up = ratio >= 0;
  return badgeHtml({ label: `${formatChange(ratio)} vs periode sebelumnya`, variant: up ? 'success' : 'danger', icon: up ? 'trending_up' : 'trending_down' });
}

function renderMetrics(r, previous) {
  setMetric('pendapatan', rupiahHtml(r.pendapatanBersih));
  setMetric('pendapatan-change', changeBadge(percentChange(r.pendapatanBersih, previous.pendapatanBersih)));
  setMetric('kotor', rupiahHtml(r.labaKotor));
  setMetric('kotor-meta', `Margin kotor ${formatPercent(r.marginKotor)}`);
  setMetric('beban', rupiahHtml(r.totalBeban));
  setMetric('beban-meta', `${formatPercent(r.rasioBeban)} dari pendapatan bersih`);
  setMetric('bersih', `<span class="${r.labaBersih < 0 ? 'text-danger' : ''}">${rupiahHtml(r.labaBersih)}</span>`);
  // Pembanding laba bisa negatif → hitung perubahan terhadap nilai absolut
  const labaChange = previous.labaBersih ? (r.labaBersih - previous.labaBersih) / Math.abs(previous.labaBersih) : null;
  setMetric('bersih-change', changeBadge(labaChange));
}

const HEALTH = [
  { label: 'Margin laba kotor', key: 'marginKotor', hint: 'Patokan ritel sembako 10–15%', grade: (v) => (v >= 0.13 ? 'good' : v >= 0.1 ? 'ok' : 'bad') },
  { label: 'Margin operasional', key: 'marginOperasional', hint: 'Laba sebelum pajak ÷ pendapatan', grade: (v) => (v >= 0.05 ? 'good' : v >= 0 ? 'ok' : 'bad') },
  { label: 'Margin laba bersih', key: 'marginBersih', hint: 'Laba yang benar-benar dibawa pulang', grade: (v) => (v >= 0.03 ? 'good' : v >= 0 ? 'ok' : 'bad') },
  { label: 'Rasio beban operasional', key: 'rasioBeban', hint: 'Makin kecil makin efisien', grade: (v) => (v <= 0.09 ? 'good' : v <= 0.13 ? 'ok' : 'bad') },
];

const GRADES = {
  good: { label: 'Sehat', variant: 'success', icon: 'check' },
  ok: { label: 'Perlu dijaga', variant: 'warning', icon: 'schedule' },
  bad: { label: 'Waspada', variant: 'danger', icon: 'warning' },
};

function renderHealth(r) {
  document.querySelector('[data-health]').innerHTML = HEALTH.map((item) => {
    const value = r[item.key];
    return `
      <li class="ratio-list__item">
        <div class="ratio-list__text">
          <span class="ratio-list__label">${item.label}</span>
          <span class="text-caption text-muted">${item.hint}</span>
        </div>
        <div class="ratio-list__value">
          <span class="num">${formatPercent(value)}</span>
          ${badgeHtml(GRADES[item.grade(value)])}
        </div>
      </li>`;
  }).join('');
}

function renderMix(r) {
  const parts = [
    { label: 'Harga pokok penjualan', value: r.hpp, color: 'var(--chart-4)' },
    { label: 'Beban operasional', value: r.totalBeban, color: 'var(--chart-3)' },
    { label: 'PPh final', value: r.pph, color: 'var(--chart-2)' },
    { label: r.labaBersih >= 0 ? 'Laba bersih' : 'Rugi bersih', value: Math.abs(r.labaBersih), color: 'var(--chart-1)' },
  ];
  const whole = Math.max(r.pendapatanBersih, parts.reduce((sum, part) => sum + part.value, 0)) || 1;
  const bar = document.querySelector('[data-mix-bar]');
  bar.innerHTML = parts
    .map((part) => `<span class="stack-bar__seg" style="--share: ${(part.value / whole).toFixed(4)}; --seg-color: ${part.color}"></span>`)
    .join('');
  bar.setAttribute('aria-label', parts.map((part) => `${part.label} ${formatPercent(part.value / whole)}`).join(', '));
  document.querySelector('[data-mix-legend]').innerHTML = parts
    .map((part) => `
      <li class="legend-list__item">
        <span class="legend-list__swatch" style="--seg-color: ${part.color}" aria-hidden="true"></span>
        <span class="legend-list__label">${part.label}</span>
        <span class="num">${formatRupiah(part.value)}</span>
        <span class="legend-list__share num">${formatPercent(part.value / whole)}</span>
      </li>`)
    .join('');
}

/** Laba kotor per hari (transaksi lunas, sebelum retur & beban) */
function renderChart() {
  const days = rangeDays(current);
  const transactions = getTransactions();
  const series = dailySeries(transactions, current.from, days).map((day) => {
    const summary = summarize(transactions.filter((trx) => {
      const time = new Date(trx.tanggal);
      return time >= day.date && time < addDays(day.date, 1);
    }));
    return { date: day.date, laba: summary.labaKotor };
  });
  const label = new Intl.DateTimeFormat('id-ID', days > 14 ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const data = { labels: series.map((day) => label.format(day.date)), values: series.map((day) => day.laba) };
  const best = series.reduce((top, day) => (day.laba > top.laba ? day : top), series[0]);

  document.querySelector('[data-best-day]').textContent = best?.laba ? `Tertinggi ${formatRupiah(best.laba)} · ${formatDateShort(best.date)}` : 'Belum ada penjualan';
  document.getElementById('profit-chart').setAttribute('aria-label', `Grafik laba kotor per hari selama ${days} hari`);
  if (chart) updateChart(chart, data);
  else chart = createBarChart(document.getElementById('profit-chart'), data);
}

function render() {
  const end = rangeEnd(current);
  const days = rangeDays(current);
  report = computeReport(current.from, end);
  const previous = computeReport(addDays(current.from, -days), current.from);

  document.querySelector('[data-range-label]').textContent =
    `${formatDateLong(current.from)} – ${formatDateLong(current.to)} · ${days} hari`;
  document.querySelector('[data-statement-period]').textContent =
    `Periode ${formatDateShort(current.from)} – ${formatDateShort(current.to)} · ${formatNumber(report.sales.jumlahTransaksi)} transaksi lunas`;

  renderMetrics(report, previous);
  renderStatement(report);
  renderHealth(report);
  renderMix(report);
  renderChart();
}

/* ---------- Aksi ---------- */

function exportCsv() {
  const rows = statementRows(report)
    .map((row) => (row.type === 'section' ? [row.label, '', ''] : [row.label, row.value, report.pendapatanBersih ? (report.ratio(row.value) * 100).toFixed(1) : '']));
  downloadCsv(`laba-rugi-${toDateKey(current.from)}-${toDateKey(current.to)}.csv`, [
    ['Pos', 'Jumlah (Rp)', '% Pendapatan'],
    ...rows,
  ]);
  showToast({ type: 'success', title: 'CSV diunduh', message: `Laporan laba rugi ${rangeDays(current)} hari berhasil diekspor.` });
}

function printReport() {
  document.body.dataset.print = 'laporan';
  window.addEventListener('afterprint', () => delete document.body.dataset.print, { once: true });
  window.print();
}

if (initShell()) {
  document.querySelector('[data-mdr-rate]').textContent = formatPercent(MDR_RATE);
  document.querySelector('[data-pph-rate]').textContent = formatPercent(incomeTaxRate);
  const picker = createPeriodPicker(document.querySelector('[data-range-form]'), {
    earliest,
    preset: 'month',
    onChange: (range) => {
      current = range;
      render();
    },
  });
  current = picker.get();
  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'export') exportCsv();
    if (action === 'print') printReport();
  });
  render();
}
