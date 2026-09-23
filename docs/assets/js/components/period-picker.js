/**
 * Pemilih periode laporan: tombol preset + dua tanggal bebas dengan validasi
 * rentang. Dipakai Laporan Penjualan, Laba Rugi, Laporan Stok, dan Riwayat.
 *
 *   <form class="card range-form" data-range-form novalidate>
 *     <div class="segmented" data-presets><button data-preset="7d">…</button>…</div>
 *     <div data-field="from"><input name="from" type="date"></div>
 *     <div data-field="to"><input name="to" type="date"></div>
 *     <p class="field__message" data-range-msg></p>
 *   </form>
 */

import { addDays, fromInputValue, startOfDay, startOfMonth, toInputValue } from '../core/dates.js';
import { formatDateShort } from '../core/format.js';

export function presetRange(key, today = startOfDay(new Date())) {
  switch (key) {
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: addDays(today, -1), to: addDays(today, -1) };
    case '7d': return { from: addDays(today, -6), to: today };
    case '30d': return { from: addDays(today, -29), to: today };
    case 'last-month': return {
      from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      to: new Date(today.getFullYear(), today.getMonth(), 0),
    };
    default: return { from: startOfMonth(today), to: today };
  }
}

/** Jumlah hari dalam rentang (inklusif) */
export const rangeDays = ({ from, to }) => Math.round((addDays(to, 1) - from) / 86_400_000);

/** Batas atas eksklusif untuk inRange(): awal hari setelah `to` */
export const rangeEnd = ({ to }) => addDays(to, 1);

/**
 * @param {HTMLFormElement} form
 * @param {{ earliest: Date, preset?: string, onChange: (range: {from: Date, to: Date}) => void }} options
 */
export function createPeriodPicker(form, { earliest, preset = 'month', onChange }) {
  const today = startOfDay(new Date());
  const presets = form.querySelector('[data-presets]');
  const fromInput = form.elements.namedItem('from');
  const toInput = form.elements.namedItem('to');
  const message = form.querySelector('[data-range-msg]');
  let current = presetRange(preset, today);

  [fromInput, toInput].forEach((input) => {
    input.min = toInputValue(earliest);
    input.max = toInputValue(today);
  });

  function sync() {
    fromInput.value = toInputValue(current.from);
    toInput.value = toInputValue(current.to);
  }

  function markPreset(key) {
    presets?.querySelectorAll('[data-preset]').forEach((option) => {
      option.setAttribute('aria-pressed', String(option.dataset.preset === key));
    });
  }

  function showError(text) {
    ['from', 'to'].forEach((name) => {
      form.querySelector(`[data-field="${name}"]`)?.classList.toggle('is-invalid', Boolean(text));
      form.elements.namedItem(name).setAttribute('aria-invalid', String(Boolean(text)));
    });
    form.classList.toggle('is-invalid', Boolean(text));
    message.innerHTML = text ? `<span class="icon" aria-hidden="true">warning</span>${text}` : '';
  }

  function rangeError(from, to) {
    if (!from || !to) return 'Isi tanggal awal dan akhir.';
    if (from > to) return 'Tanggal awal tidak boleh setelah tanggal akhir.';
    if (from < earliest || to > today) return `Data tersedia untuk ${formatDateShort(earliest)} – ${formatDateShort(today)}.`;
    return '';
  }

  presets?.addEventListener('click', (event) => {
    const option = event.target.closest('[data-preset]');
    if (!option) return;
    markPreset(option.dataset.preset);
    current = presetRange(option.dataset.preset, today);
    showError('');
    sync();
    onChange(current);
  });

  form.addEventListener('change', (event) => {
    if (!['from', 'to'].includes(event.target.name)) return;
    const from = fromInput.value ? fromInputValue(fromInput.value) : null;
    const to = toInput.value ? fromInputValue(toInput.value) : null;
    const error = rangeError(from, to);
    showError(error);
    if (error) return;
    markPreset('');
    current = { from, to };
    onChange(current);
  });
  form.addEventListener('submit', (event) => event.preventDefault());

  markPreset(preset);
  sync();

  return { get: () => current };
}
