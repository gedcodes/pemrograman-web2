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

/** 4.317.500 → "Rp 4,3 jt" (sumbu grafik & ringkasan) */
const compactFormatter = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

export function formatCompactRupiah(value) {
  return `Rp ${compactFormatter.format(value)}`;
}

const percentFormatter = new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 });
const changeFormatter = new Intl.NumberFormat('id-ID', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/** 0.238 → "23,8%" */
export function formatPercent(ratio) {
  return percentFormatter.format(ratio);
}

/** 0.124 → "+12,4%" */
export function formatChange(ratio) {
  return changeFormatter.format(ratio);
}

export function formatDateLong(date = new Date()) {
  return longDateFormatter.format(date);
}

const shortDateFormatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/** "21 Sep 2026" */
export function formatDateShort(date) {
  return shortDateFormatter.format(date);
}

/** "10:32" — titik dua agar sama dengan tampilan struk */
export function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDateTime(date) {
  return `${formatDateShort(date)}, ${formatTime(date)}`;
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
