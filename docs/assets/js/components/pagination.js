/**
 * Tombol paginasi: halaman pertama, terakhir, dan tetangga halaman aktif;
 * sisanya diringkas menjadi "…". Tombol memakai data-page untuk delegasi event.
 */

export function pageNumbers(current, total) {
  const pages = [...new Set([1, current - 1, current, current + 1, total])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result = [];
  let previous = 0;
  for (const page of pages) {
    if (page - previous > 1) result.push('…');
    result.push(page);
    previous = page;
  }
  return result;
}

const arrowButton = (page, icon, label, disabled) => `
  <li>
    <button class="page-btn" type="button" data-page="${page}" aria-label="${label}" ${disabled ? 'disabled' : ''}>
      <span class="icon icon--sm" aria-hidden="true">${icon}</span>
    </button>
  </li>`;

export function pageItemsHtml(current, total) {
  const numbers = pageNumbers(current, total)
    .map((page) => (page === '…'
      ? '<li class="pagination__gap" aria-hidden="true">…</li>'
      : `<li><button class="page-btn" type="button" data-page="${page}" aria-label="Halaman ${page}"
            ${page === current ? 'aria-current="page"' : ''}>${page}</button></li>`))
    .join('');

  return arrowButton(current - 1, 'chevron_left', 'Halaman sebelumnya', current <= 1)
    + numbers
    + arrowButton(current + 1, 'chevron_right', 'Halaman berikutnya', current >= total);
}
