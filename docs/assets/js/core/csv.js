/**
 * Unduh data sebagai CSV. Pemisah titik koma + BOM UTF-8 agar langsung
 * terbaca rapi di Excel berbahasa Indonesia.
 */

function escapeCell(value) {
  const text = String(value ?? '');
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** @param {Array<Array<string|number>>} rows baris pertama = judul kolom */
export function downloadCsv(filename, rows) {
  const content = `﻿${rows.map((row) => row.map(escapeCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
