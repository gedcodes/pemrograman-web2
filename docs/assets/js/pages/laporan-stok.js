/**
 * Laporan Stok & Mutasi — stok awal, masuk, keluar, penyesuaian, dan stok
 * akhir per produk untuk satu periode, ditambah valuasi, perputaran stok,
 * produk laris / tidak terjual, dan rekomendasi restock.
 */

import { initShell, pageUrl } from '../layout/shell.js';
import { findCategory, findUnit, getCategories, getProducts, getStockMoves, getTransactions } from '../core/db.js';
import { HISTORY_DAYS } from '../data/transactions.js';
import { dailyUnits, stockMovement } from '../core/analytics.js';
import { addDays, startOfDay, toDateKey } from '../core/dates.js';
import { escapeHtml, formatDateLong, formatNumber, formatPercent, formatRupiah, rupiahHtml } from '../core/format.js';
import { downloadCsv } from '../core/csv.js';
import { STOCK_STATUS, badgeHtml } from '../components/badges.js';
import { createGroupedBarChart, updateChart } from '../components/charts.js';
import { createPeriodPicker, rangeDays, rangeEnd } from '../components/period-picker.js';
import { thumbHtml } from '../components/thumb.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { showToast } from '../components/toast.js';

const FAST_MOVING_COUNT = 8;
const today = startOfDay(new Date());
const earliest = addDays(today, -(HISTORY_DAYS - 1));
const filters = document.querySelector('[data-filters]');
const views = document.querySelector('[data-views]');

const state = { q: '', kategori: '', sort: 'nilai', view: '' };
let current = null;
let rows = [];
let chart = null;

/* ---------- Data ---------- */

function statusOf(row) {
  if (row.akhir <= 0) return 'habis';
  if (row.akhir <= row.product.stok_minimum) return 'menipis';
  return 'aman';
}

/** Perkiraan hari stok tersisa dengan laju jual periode ini */
function coverDays(row, days) {
  const perDay = row.keluar / days;
  return perDay > 0 ? row.akhir / perDay : Number.POSITIVE_INFINITY;
}

function buildRows() {
  const days = rangeDays(current);
  const result = stockMovement({
    products: getProducts(),
    transactions: getTransactions(),
    moves: getStockMoves(),
    start: current.from,
    end: rangeEnd(current),
  }).map((row) => ({ ...row, status: statusOf(row), cover: coverDays(row, days) }));

  const fastIds = new Set([...result].filter((row) => row.keluar > 0).sort((a, b) => b.keluar - a.keluar).slice(0, FAST_MOVING_COUNT).map((row) => row.product.id));
  return result.map((row) => ({ ...row, fast: fastIds.has(row.product.id) }));
}

const VIEWS = {
  kritis: (row) => row.status !== 'aman',
  laris: (row) => row.fast,
  mati: (row) => row.keluar === 0,
};

const SORTERS = {
  nilai: (a, b) => b.nilaiAkhir - a.nilaiAkhir,
  keluar: (a, b) => b.keluar - a.keluar,
  cover: (a, b) => a.cover - b.cover,
  nama: (a, b) => a.product.nama.localeCompare(b.product.nama, 'id'),
};

function filtered() {
  const query = state.q.trim().toLowerCase();
  return rows
    .filter((row) => (!state.view || VIEWS[state.view](row))
      && (!state.kategori || row.product.kategori === state.kategori)
      && (!query || row.product.nama.toLowerCase().includes(query) || row.product.barcode.includes(query)))
    .sort(SORTERS[state.sort]);
}

/* ---------- Tabel ---------- */

const signed = (value) => (value ? `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value))}` : '0');

function coverHtml(row) {
  if (!Number.isFinite(row.cover)) return '<span class="text-muted">Tidak terjual</span>';
  const daysLeft = Math.floor(row.cover);
  const cls = daysLeft < 7 ? 'text-danger' : daysLeft < 14 ? 'text-warning' : '';
  return `<span class="${cls}">${formatNumber(daysLeft)} hari</span>`;
}

function rowHtml(row) {
  const unit = findUnit(row.product.satuan)?.singkatan ?? '';
  return `
    <tr class="${row.status === 'habis' ? 'is-danger' : row.status === 'menipis' ? 'is-warning' : ''}">
      <td>
        <div class="table__product">
          ${thumbHtml(row.product)}
          <div>
            <span class="table__name">${escapeHtml(row.product.nama)}${row.fast ? ' <span class="badge badge--info badge--tiny">Laris</span>' : ''}</span>
            <span class="table__sub">${row.product.id} · ${escapeHtml(findCategory(row.product.kategori)?.nama ?? '-')}</span>
          </div>
        </div>
      </td>
      <td class="col-num">${formatNumber(row.awal)}</td>
      <td class="col-num"><span class="delta ${row.masuk ? 'delta--up' : ''}">${signed(row.masuk)}</span></td>
      <td class="col-num"><span class="delta ${row.keluar ? 'delta--down' : ''}">${row.keluar ? `−${formatNumber(row.keluar)}` : '0'}</span></td>
      <td class="col-num">${signed(row.penyesuaian)}</td>
      <td class="col-num"><strong>${formatNumber(row.akhir)}</strong> <span class="text-muted">${unit}</span></td>
      <td class="col-num">${rupiahHtml(row.product.harga_beli)}</td>
      <td class="col-num">${rupiahHtml(row.nilaiAkhir)}</td>
      <td class="col-num">${coverHtml(row)}</td>
      <td class="col-center">${badgeHtml(STOCK_STATUS[row.status])}</td>
    </tr>`;
}

const table = createTableView({
  root: document.querySelector('[data-table]'),
  columns: 10,
  noun: 'produk',
  pageSize: 12,
  getItems: filtered,
  rowHtml,
  emptyHtml: () => emptyStateHtml({ icon: 'search_off', title: 'Tidak ada produk untuk filter ini', text: 'Ganti tampilan atau hapus kata kunci.' }),
  onRender: (visible, all) => {
    const sum = (key) => all.reduce((total, row) => total + row[key], 0);
    document.querySelector('[data-totals]').innerHTML = all.length ? `
      <tr>
        <th scope="row">Total ${formatNumber(all.length)} produk</th>
        <td class="col-num">${formatNumber(sum('awal'))}</td>
        <td class="col-num">${signed(sum('masuk'))}</td>
        <td class="col-num">−${formatNumber(sum('keluar'))}</td>
        <td class="col-num">${signed(sum('penyesuaian'))}</td>
        <td class="col-num">${formatNumber(sum('akhir'))}</td>
        <td></td>
        <td class="col-num">${rupiahHtml(sum('nilaiAkhir'))}</td>
        <td colspan="2"></td>
      </tr>` : '';
  },
});

/* ---------- Ringkasan ---------- */

const setMetric = (key, html) => {
  document.querySelector(`[data-metric="${key}"]`).innerHTML = html;
};

function renderMetrics() {
  const days = rangeDays(current);
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  const turnover = sum('rataNilai') ? sum('hppKeluar') / sum('rataNilai') : 0;
  const counts = { habis: 0, menipis: 0 };
  rows.forEach((row) => { if (row.status !== 'aman') counts[row.status] += 1; });
  const dead = rows.filter(VIEWS.mati).length;

  setMetric('nilai', rupiahHtml(sum('nilaiAkhir')));
  setMetric('nilai-meta', `${formatNumber(sum('akhir'))} unit · ${rows.length} SKU dengan harga beli`);
  setMetric('arus', `<span class="delta delta--up">+${formatNumber(sum('masuk'))}</span> / <span class="delta delta--down">−${formatNumber(sum('keluar'))}</span>`);
  setMetric('arus-meta', `Penyesuaian ${signed(sum('penyesuaian'))} unit · ${days} hari`);
  setMetric('turnover', `${turnover.toLocaleString('id-ID', { maximumFractionDigits: 1 })}×`);
  setMetric('turnover-meta', turnover ? `Rata-rata stok habis terjual tiap ${formatNumber(days / turnover)} hari` : 'Belum ada penjualan');
  setMetric('risiko', `${counts.habis + counts.menipis} SKU`);
  setMetric('risiko-meta', `${counts.habis} habis · ${counts.menipis} menipis · ${dead} tidak terjual`);

  views.querySelectorAll('[data-view]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.view === state.view));
    chip.querySelector('[data-view-count]').textContent = formatNumber(chip.dataset.view ? rows.filter(VIEWS[chip.dataset.view]).length : rows.length);
  });
}

function renderCategories() {
  const total = rows.reduce((sum, row) => sum + row.nilaiAkhir, 0);
  const byCategory = getCategories().map((category) => ({
    category,
    value: rows.filter((row) => row.product.kategori === category.id).reduce((sum, row) => sum + row.nilaiAkhir, 0),
  })).sort((a, b) => b.value - a.value);

  document.querySelector('[data-category-values]').innerHTML = byCategory.map(({ category, value }) => {
    const share = total ? value / total : 0;
    return `
      <li class="bar-list__item">
        <div class="bar-list__head">
          <span>${escapeHtml(category.nama)}</span>
          <span class="num">${formatRupiah(value)}</span>
        </div>
        <div class="meter" aria-hidden="true"><div class="meter__fill" style="--value: ${share.toFixed(4)}"></div></div>
        <span class="text-caption text-muted">${formatPercent(share)} dari nilai persediaan</span>
      </li>`;
  }).join('');
}

function renderRestock() {
  const critical = rows.filter(VIEWS.kritis).sort((a, b) => a.cover - b.cover);
  const notice = document.querySelector('[data-restock-notice]');
  notice.hidden = critical.length === 0;
  if (!critical.length) return;
  const names = critical.slice(0, 3).map((row) => row.product.nama).join(', ');
  document.querySelector('[data-restock-text]').textContent =
    `${critical.length} produk di bawah stok minimum (${names}${critical.length > 3 ? ', …' : ''}). Buat draf penerimaan dengan qty saran sampai 3× stok minimum.`;
  document.querySelector('[data-restock-link]').href =
    `${pageUrl('form-barang-masuk')}?produk=${critical.map((row) => row.product.id).join(',')}`;
}

function renderChart() {
  const days = rangeDays(current);
  const series = dailyUnits({ transactions: getTransactions(), moves: getStockMoves(), start: current.from, days });
  const label = new Intl.DateTimeFormat('id-ID', days > 14 ? { day: 'numeric' } : { weekday: 'short' });
  const data = {
    labels: series.map((day) => label.format(day.date)),
    series: [
      { label: 'Barang masuk', values: series.map((day) => day.masuk) },
      { label: 'Terjual', values: series.map((day) => day.keluar) },
    ],
    unit: 'unit',
  };
  if (chart) updateChart(chart, data);
  else chart = createGroupedBarChart(document.getElementById('flow-chart'), data);
}

function render({ resetPage = false } = {}) {
  rows = buildRows();
  document.querySelector('[data-range-label]').textContent =
    `${formatDateLong(current.from)} – ${formatDateLong(current.to)} · ${rangeDays(current)} hari · stok akhir per ${formatDateLong(current.to)}`;
  renderMetrics();
  renderCategories();
  renderRestock();
  renderChart();
  if (resetPage) table.reset();
  else table.render();
}

/* ---------- Aksi ---------- */

function exportCsv() {
  const data = filtered().map((row) => [
    row.product.id, row.product.nama, findCategory(row.product.kategori)?.nama ?? '', row.awal, row.masuk, row.keluar,
    row.penyesuaian, row.akhir, row.product.harga_beli, row.nilaiAkhir,
    Number.isFinite(row.cover) ? Math.floor(row.cover) : '', STOCK_STATUS[row.status].label,
  ]);
  downloadCsv(`laporan-stok-${toDateKey(current.from)}-${toDateKey(current.to)}.csv`, [
    ['ID', 'Produk', 'Kategori', 'Stok Awal', 'Masuk', 'Keluar', 'Penyesuaian', 'Stok Akhir', 'HPP Satuan', 'Nilai Akhir', 'Sisa Hari', 'Status'],
    ...data,
  ]);
  showToast({ type: 'success', title: 'CSV diunduh', message: `${data.length} produk diekspor.` });
}

function printReport() {
  document.body.dataset.print = 'laporan';
  window.addEventListener('afterprint', () => delete document.body.dataset.print, { once: true });
  window.print();
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
    if (event.target.name === 'kategori' || event.target.name === 'sort') {
      state[event.target.name] = event.target.value;
      table.reset();
    }
  });
  filters.addEventListener('submit', (event) => event.preventDefault());

  views.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-view]');
    if (!chip) return;
    state.view = chip.dataset.view;
    if (state.view === 'laris') {
      state.sort = 'keluar';
      filters.elements.sort.value = 'keluar';
    }
    renderMetrics();
    table.reset();
  });

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'export') exportCsv();
    if (action === 'print') printReport();
  });
}

if (initShell()) {
  filters.elements.kategori.insertAdjacentHTML('beforeend', getCategories()
    .map((item) => `<option value="${item.id}">${escapeHtml(item.nama)}</option>`).join(''));
  const picker = createPeriodPicker(document.querySelector('[data-range-form]'), {
    earliest,
    preset: '30d',
    onChange: (range) => {
      current = range;
      render({ resetPage: true });
    },
  });
  current = picker.get();
  bindEvents();
  render();
}
