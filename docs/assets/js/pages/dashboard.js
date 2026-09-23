/**
 * Dashboard — ringkasan penjualan per periode, grafik 7 hari,
 * stok menipis, dan transaksi terakhir. Semua angka dihitung dari core/db.js.
 */

import { initShell } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import { findUser, getProducts, getStockStatus, getTransactions } from '../core/db.js';
import { inRange, summarize, percentChange, dailySeries, topProducts } from '../core/analytics.js';
import { addDays, startOfDay, startOfMonth } from '../core/dates.js';
import {
  escapeHtml, formatChange, formatDateLong, formatNumber, formatPercent, formatRupiah, formatTime, rupiahHtml,
} from '../core/format.js';
import { STOCK_STATUS, TRANSACTION_STATUS, badgeHtml, paymentHtml } from '../components/badges.js';
import { createLineChart, createSparkline, updateChart } from '../components/charts.js';
import { thumbHtml } from '../components/thumb.js';

/** Margin kotor ritel sembako umumnya 10–15%; di bawah 10% dianggap tipis */
const HEALTHY_MARGIN = 0.1;

/** Periode ringkasan + periode pembanding dengan panjang yang sama */
function getPeriod(key, now = new Date()) {
  const end = new Date(now.getTime() + 1);
  if (key === 'week') {
    const start = addDays(startOfDay(now), -6);
    return {
      label: '7 Hari',
      compareLabel: '7 Hari Sebelumnya',
      current: [start, end],
      previous: [addDays(start, -7), addDays(end, -7)],
    };
  }
  if (key === 'month') {
    const start = startOfMonth(now);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const prevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth(), Math.min(now.getDate(), prevLastDay),
      now.getHours(), now.getMinutes() + 1);
    return {
      label: 'Bulan Ini',
      compareLabel: 'Bulan Lalu (Periode Sama)',
      current: [start, end],
      previous: [prevStart, prevEnd],
    };
  }
  const start = startOfDay(now);
  return {
    label: 'Hari Ini',
    compareLabel: 'Kemarin s.d. Jam Ini',
    current: [start, end],
    previous: [addDays(start, -1), addDays(end, -1)],
  };
}

/** Deret untuk sparkline: per jam (hari ini) atau per hari (7 hari / bulan ini) */
function periodSeries(periodKey, transactions, [start, end]) {
  if (periodKey === 'today') {
    const hours = Array.from({ length: Math.max(1, new Date().getHours() - 6) }, (_, index) => index + 7);
    const totals = hours.map(() => 0);
    for (const trx of transactions) {
      if (trx.status !== 'settlement') continue;
      const slot = new Date(trx.tanggal).getHours() - 7;
      if (slot >= 0 && slot < totals.length) totals[slot] += trx.total;
    }
    return { labels: hours.map((hour) => `${String(hour).padStart(2, '0')}:00`), values: totals };
  }
  const days = Math.round((startOfDay(end) - startOfDay(start)) / 86_400_000) + 1;
  const series = dailySeries(transactions, start, days);
  const label = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
  return { labels: series.map((day) => label.format(day.date)), values: series.map((day) => day.omzet) };
}

let sparkline = null;

function changeBadge(ratio, { suffix = 'vs periode lalu' } = {}) {
  if (ratio === null) return badgeHtml({ label: 'Belum ada pembanding', variant: 'neutral', icon: 'remove' });
  const up = ratio >= 0;
  return badgeHtml({
    label: `${formatChange(ratio)} ${suffix}`,
    variant: up ? 'success' : 'danger',
    icon: up ? 'trending_up' : 'trending_down',
  });
}

const setText = (key, value) => {
  document.querySelector(`[data-stat="${key}"]`).textContent = value;
};
const setHtml = (key, value) => {
  document.querySelector(`[data-stat="${key}"]`).innerHTML = value;
};

function renderSummary(periodKey) {
  const transactions = getTransactions();
  const period = getPeriod(periodKey);
  const currentList = inRange(transactions, ...period.current);
  const current = summarize(currentList);
  const previous = summarize(inRange(transactions, ...period.previous));

  document.querySelector('[data-period-label]').textContent = period.label;
  document.querySelector('[data-compare-label]').textContent = period.compareLabel;

  setHtml('omzet', rupiahHtml(current.omzet));
  const spark = periodSeries(periodKey, currentList, period.current);
  if (sparkline) updateChart(sparkline, spark);
  else sparkline = createSparkline(document.getElementById('omzet-spark'), spark);
  setHtml('omzet-change', changeBadge(percentChange(current.omzet, previous.omzet)));
  setText('omzet-prev', formatRupiah(previous.omzet));
  setText('avg', formatRupiah(current.rataRata));

  const trxDiff = current.jumlahTransaksi - previous.jumlahTransaksi;
  setText('trx', formatNumber(current.jumlahTransaksi));
  setHtml('trx-change', badgeHtml({
    label: `${trxDiff >= 0 ? '+' : ''}${formatNumber(trxDiff)} transaksi`,
    variant: trxDiff >= 0 ? 'success' : 'danger',
    icon: trxDiff >= 0 ? 'arrow_upward' : 'arrow_downward',
  }));
  const pending = currentList.filter((trx) => trx.status === 'pending').length;
  setText('trx-meta', pending ? `${pending} transaksi non-tunai masih pending` : 'Tidak ada transaksi pending');
  setText('pending', formatNumber(pending));

  setText('items', formatNumber(current.itemTerjual));
  setHtml('items-change', changeBadge(percentChange(current.itemTerjual, previous.itemTerjual), { suffix: '' }));
  const [best] = topProducts(currentList, 1);
  setText('items-meta', best ? `Terlaris: ${best.nama}` : 'Belum ada penjualan');

  setText('margin', current.penjualanBersih ? formatPercent(current.margin) : '–');
  setHtml('margin-badge', current.margin >= HEALTHY_MARGIN
    ? badgeHtml({ label: 'Sehat', variant: 'success', icon: 'check' })
    : badgeHtml({ label: 'Tipis', variant: 'warning', icon: 'warning' }));
  setText('margin-meta', `Laba kotor ${formatRupiah(current.labaKotor)}`);
}

function renderLowStock() {
  const lowStock = getProducts()
    .filter((item) => getStockStatus(item) !== 'aman')
    .sort((a, b) => a.stok / a.stok_minimum - b.stok / b.stok_minimum);
  const outOfStock = lowStock.filter((item) => getStockStatus(item) === 'habis').length;

  setText('low', formatNumber(lowStock.length));
  setHtml('low-meta', `<span class="icon icon--sm" aria-hidden="true">warning</span>${outOfStock} habis · ${lowStock.length - outOfStock} menipis`);
  document.querySelector('[data-low-count]').textContent = `${lowStock.length} SKU`;

  document.querySelector('[data-low-stock]').innerHTML = lowStock
    .slice(0, 5)
    .map((item) => {
      const status = STOCK_STATUS[getStockStatus(item)];
      return `
        <li class="item-list__row">
          ${thumbHtml(item)}
          <div class="item-list__text">
            <span class="item-list__title">${escapeHtml(item.nama)}</span>
            <span class="item-list__sub">${item.id} · min. ${item.stok_minimum}</span>
          </div>
          <span class="badge badge--${status.variant}">Sisa ${item.stok}</span>
        </li>`;
    })
    .join('');
}

function renderChart() {
  const today = startOfDay(new Date());
  const series = dailySeries(getTransactions(), addDays(today, -6), 7);
  const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'short' });
  const labels = series.map((day, index) => (index === series.length - 1 ? 'Hari ini' : dayName.format(day.date)));
  const values = series.map((day) => day.omzet);
  const total = values.reduce((sum, value) => sum + value, 0);

  document.querySelector('[data-week-total]').textContent = `Total ${formatRupiah(total)}`;
  const canvas = document.getElementById('sales-chart');
  canvas.setAttribute('aria-label', `Grafik omzet 7 hari terakhir, total ${formatRupiah(total)}`);
  createLineChart(canvas, { labels, values });
}

function renderRecent() {
  document.querySelector('[data-recent]').innerHTML = getTransactions()
    .slice(0, 6)
    .map((trx) => {
      const cancelled = trx.status === 'cancel' || trx.status === 'expire';
      return `
        <tr>
          <td class="num">${trx.id}</td>
          <td class="num text-secondary">${formatTime(new Date(trx.tanggal))}</td>
          <td>${escapeHtml(findUser(trx.kasir)?.nama ?? '-')}</td>
          <td>${paymentHtml(trx.pembayaran.tipe)}</td>
          <td class="col-num ${cancelled ? 'is-void' : ''}">${rupiahHtml(trx.total)}</td>
          <td class="col-center">${badgeHtml(TRANSACTION_STATUS[trx.status])}</td>
        </tr>`;
    })
    .join('');
}

function applyRole() {
  const role = getCurrentUser().peran;
  document.querySelectorAll('[data-role-only]').forEach((element) => {
    element.hidden = element.dataset.roleOnly !== role;
  });
}

if (initShell()) {
  const today = document.querySelector('[data-today]');
  today.dateTime = new Date().toISOString().slice(0, 10);
  today.textContent = formatDateLong();

  applyRole();
  renderSummary('today');
  renderLowStock();
  renderChart();
  renderRecent();

  const periodGroup = document.querySelector('[data-period-group]');
  periodGroup.addEventListener('click', (event) => {
    const option = event.target.closest('[data-period]');
    if (!option) return;
    periodGroup.querySelectorAll('[data-period]').forEach((item) => item.setAttribute('aria-pressed', String(item === option)));
    renderSummary(option.dataset.period);
  });
}
