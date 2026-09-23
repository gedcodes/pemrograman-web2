/**
 * Isian rupiah dengan pemisah ribuan yang muncul langsung saat mengetik.
 * Posisi kursor dihitung dari kanan agar tidak melompat ketika titik bertambah.
 * Baca nilainya dengan parseNumber() dari core/format.js.
 */

import { formatNumber } from '../core/format.js';

function reformat(element) {
  const caretFromEnd = element.value.length - element.selectionEnd;
  const digits = element.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  element.value = digits ? formatNumber(Number(digits)) : '';
  const caret = Math.max(0, element.value.length - caretFromEnd);
  element.setSelectionRange(caret, caret);
}

export function bindMoneyInput(element) {
  element.addEventListener('input', () => reformat(element));
}

export function setMoneyValue(element, value) {
  element.value = Number.isFinite(value) ? formatNumber(value) : '';
}
