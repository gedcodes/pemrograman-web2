/**
 * Pembungkus Chart.js (dimuat global lewat <script> CDN sebelum modul halaman).
 * Warna & font dibaca dari token CSS agar grafik mengikuti design system:
 * grid horizontal saja, label sumbu memakai warna teks, maksimal dua deret.
 */

import { formatCompactRupiah, formatRupiah } from '../core/format.js';

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Radius titik scriptable: titik terakhir (data terbaru) ditonjolkan */
const lastPointRadius = (last, others) => (context) =>
  context.dataIndex === context.dataset.data.length - 1 ? last : others;

function applyDefaults() {
  const { Chart } = window;
  Chart.defaults.font.family = token('--font-body');
  Chart.defaults.font.size = 12;
  Chart.defaults.color = token('--text-secondary');
  Chart.defaults.animation.duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600;
}

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: token('--teal-950'),
        titleFont: { family: token('--font-body'), weight: '600' },
        bodyFont: { family: token('--font-mono') },
        padding: 12,
        cornerRadius: 12,
        displayColors: false,
        callbacks: { label: (context) => formatRupiah(context.parsed.y) },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: { color: token('--chart-grid') },
        border: { display: false },
        ticks: {
          maxTicksLimit: 5,
          font: { family: token('--font-mono'), size: 11 },
          callback: (value) => formatCompactRupiah(value),
        },
      },
    },
  };
}

/** Grafik garis + area tipis (tren penjualan) */
export function createLineChart(canvas, { labels, values }) {
  applyDefaults();
  const lineColor = token('--chart-1');
  return new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: lineColor,
          backgroundColor: token('--chart-area'),
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: lastPointRadius(5, 3),
          pointBackgroundColor: token('--surface-crisp'),
          pointBorderColor: lineColor,
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
      ],
    },
    options: baseOptions(),
  });
}

/** Sparkline tanpa sumbu untuk kartu ringkasan */
export function createSparkline(canvas, { labels, values }) {
  applyDefaults();
  const options = baseOptions();
  options.scales.x.display = false;
  options.scales.y.display = false;
  options.layout = { padding: { top: 6, bottom: 2, left: 4, right: 6 } };

  return new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: token('--chart-1'),
          backgroundColor: token('--chart-area'),
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: lastPointRadius(4, 0),
          pointBackgroundColor: token('--chart-1'),
          pointHoverRadius: 4,
        },
      ],
    },
    options,
  });
}

/** Warna batang scriptable: batang tertinggi diberi warna lebih pekat */
const peakColor = (context) => {
  const peak = Math.max(...context.dataset.data);
  return context.raw === peak && peak > 0 ? token('--teal-900') : token('--chart-1');
};

/** Grafik batang (penjualan per hari) */
export function createBarChart(canvas, { labels, values }) {
  applyDefaults();
  return new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: peakColor,
          borderRadius: 6,
          maxBarThickness: 28,
        },
      ],
    },
    options: baseOptions(),
  });
}

/**
 * Grafik batang berkelompok, maksimal dua deret (mis. barang masuk vs keluar).
 * Legenda tampil karena warna membedakan deret.
 * @param {{ labels: string[], series: Array<{ label: string, values: number[], color?: string }>, unit?: string }} data
 */
export function createGroupedBarChart(canvas, { labels, series, unit = '' }) {
  applyDefaults();
  const colors = [token('--chart-1'), token('--chart-3')];
  const options = baseOptions();
  options.plugins.legend = {
    display: true,
    position: 'top',
    align: 'end',
    labels: { boxWidth: 10, boxHeight: 10, borderRadius: 3, useBorderRadius: true, padding: 16 },
  };
  options.plugins.tooltip.displayColors = true;
  options.plugins.tooltip.callbacks.label = (context) =>
    `${context.dataset.label}: ${context.parsed.y.toLocaleString('id-ID')}${unit ? ` ${unit}` : ''}`;
  options.scales.y.ticks.callback = (value) => value.toLocaleString('id-ID');

  return new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: series.map((item, index) => ({
        label: item.label,
        data: item.values,
        backgroundColor: item.color ?? colors[index],
        borderRadius: 5,
        maxBarThickness: 18,
        categoryPercentage: 0.7,
      })),
    },
    options,
  });
}

/** Perbarui data grafik yang sudah ada tanpa membuat ulang */
export function updateChart(chart, { labels, values, series }) {
  chart.data.labels = labels;
  if (series) series.forEach((item, index) => { chart.data.datasets[index].data = item.values; });
  else chart.data.datasets[0].data = values;
  chart.update();
}
