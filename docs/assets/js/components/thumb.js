/**
 * Gambar produk: aset lokal (path relatif assets/img), data URL hasil
 * unggahan form, atau placeholder ikon bila produk belum bergambar.
 */

import { imageUrl } from '../layout/shell.js';

export function productImageSrc(item) {
  if (!item.gambar) return null;
  return item.gambar.startsWith('data:') ? item.gambar : imageUrl(item.gambar);
}

export function thumbHtml(item, className = 'thumb') {
  const src = productImageSrc(item);
  if (src) return `<img class="${className}" src="${src}" alt="" width="40" height="40" loading="lazy">`;
  return `<span class="${className} thumb--empty" aria-hidden="true"><span class="icon">inventory_2</span></span>`;
}
