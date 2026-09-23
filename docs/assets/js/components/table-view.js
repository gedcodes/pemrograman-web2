/**
 * Tabel berpaginasi yang dipakai halaman daftar. Halaman menyediakan data
 * yang sudah disaring dan template baris; modul ini memotong halaman,
 * menulis info "Menampilkan 1–10 dari 42 …", dan menangani tombol halaman.
 *
 *   <tbody data-rows></tbody>
 *   <nav class="pagination"><p data-page-info></p><ul data-pages></ul></nav>
 */

import { formatNumber } from '../core/format.js';
import { pageItemsHtml } from './pagination.js';

/**
 * @param {{
 *   root: Element,
 *   columns: number,
 *   noun: string,
 *   pageSize?: number,
 *   getItems: () => Array,
 *   rowHtml: (item: any, index: number) => string,
 *   emptyHtml: () => string,
 *   onRender?: (visible: Array, all: Array) => void,
 * }} options
 */
export function createTableView({ root, columns, noun, pageSize = 10, getItems, rowHtml, emptyHtml, onRender }) {
  const rows = root.querySelector('[data-rows]');
  const info = root.querySelector('[data-page-info]');
  const pages = root.querySelector('[data-pages]');
  let page = 1;

  function render() {
    const items = getItems();
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    page = Math.min(page, totalPages);
    const start = (page - 1) * pageSize;
    const visible = items.slice(start, start + pageSize);

    rows.innerHTML = visible.length
      ? visible.map((item, index) => rowHtml(item, start + index)).join('')
      : `<tr><td colspan="${columns}">${emptyHtml()}</td></tr>`;

    if (info) {
      info.innerHTML = items.length
        ? `Menampilkan <strong>${start + 1}–${start + visible.length}</strong> dari <strong>${formatNumber(items.length)}</strong> ${noun}`
        : `Tidak ada ${noun} untuk ditampilkan`;
    }
    if (pages) pages.innerHTML = totalPages > 1 ? pageItemsHtml(page, totalPages) : '';
    onRender?.(visible, items);
    return { items, visible };
  }

  pages?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    page = Number(button.dataset.page);
    render();
    root.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  return {
    render,
    /** Kembali ke halaman pertama (dipanggil saat filter berubah) */
    reset() {
      page = 1;
      return render();
    },
  };
}

/** Isi empty state standar: ikon, judul, teks, dan satu tombol opsional */
export function emptyStateHtml({ icon = 'inbox', title, text = '', action = '' }) {
  return `
    <div class="empty-state">
      <span class="empty-state__icon" aria-hidden="true"><span class="icon">${icon}</span></span>
      <p class="empty-state__title">${title}</p>
      ${text ? `<p class="empty-state__text">${text}</p>` : ''}
      ${action}
    </div>`;
}
