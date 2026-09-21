/**
 * Format angka, rupiah, dan tanggal untuk locale Indonesia.
 * Aturan DESIGN.md §4.2: "Rp 4.317.500" — spasi setelah Rp, titik ribuan, tanpa desimal.
 */

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

const longDateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatNumber(value) {
  return numberFormatter.format(Math.round(value));
}

export function formatRupiah(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}Rp ${formatNumber(Math.abs(value))}`;
}

/** Rupiah sebagai HTML: prefiks "Rp" diredam agar mata langsung ke angka. */
export function rupiahHtml(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}<span class="money__prefix">Rp</span>${formatNumber(Math.abs(value))}`;
}

/** "Rp 2.850" atau "2.850" → 2850. Mengembalikan NaN bila tidak ada digit. */
export function parseNumber(text) {
  const negative = String(text).trim().startsWith('-');
  const digits = String(text).replace(/\D/g, '');
  if (digits === '') return Number.NaN;
  return Number(digits) * (negative ? -1 : 1);
}

export function formatDateLong(date = new Date()) {
  return longDateFormatter.format(date);
}

/** Awalan nama Bali ("I", "Ni") dilewati: "I Wayan Surya Adnyana" → "WS". */
const NAME_PREFIXES = new Set(['i', 'ni']);

export function getInitials(name) {
  return name
    .split(/\s+/)
    .filter((word) => word && !NAME_PREFIXES.has(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
