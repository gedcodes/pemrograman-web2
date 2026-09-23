/**
 * Dialog form tambah/ubah untuk halaman master (kategori, satuan, supplier,
 * pelanggan, pengguna). Markup dialog ditulis di HTML halaman; modul ini
 * mengisi nilai, membaca nilai, memvalidasi, dan menutup dialog.
 *
 *   <dialog class="modal modal--lg" id="…">
 *     <form class="modal__form" novalidate>
 *       … <h2 data-dialog-title> … <p data-dialog-subtitle> …
 *       … kolom .field[data-field] …
 *       <button type="button" data-dialog-cancel>Batal</button>
 *       <button type="submit">Simpan</button>
 */

import { parseNumber } from '../core/format.js';
import {
  bindLiveValidation, clearFieldErrors, focusField, initHints, validateForm,
} from '../core/validation.js';
import { bindMoneyInput, setMoneyValue } from './money-input.js';
import { showToast } from './toast.js';

function namedElements(form) {
  return [...form.elements].filter((element) => element.name && element.type !== 'submit' && element.type !== 'button');
}

export function readFormValues(form) {
  const values = {};
  for (const element of namedElements(form)) {
    if (element.type === 'checkbox') values[element.name] = element.checked;
    else if (element.type === 'radio') {
      if (element.checked) values[element.name] = element.value;
    } else if (element.hasAttribute('data-money')) values[element.name] = parseNumber(element.value);
    else if (element.type === 'number') values[element.name] = element.value.trim() === '' ? Number.NaN : Number(element.value);
    else values[element.name] = element.value.trim();
  }
  return values;
}

export function fillFormValues(form, values) {
  for (const element of namedElements(form)) {
    const value = values[element.name];
    if (element.type === 'checkbox') element.checked = Boolean(value);
    else if (element.type === 'radio') element.checked = element.value === String(value);
    else if (element.hasAttribute('data-money')) setMoneyValue(element, value);
    else element.value = value ?? '';
  }
}

/**
 * @param {HTMLDialogElement} dialog
 * @param {{
 *   rules: Record<string, (values: object, context: object) => string>,
 *   onSubmit: (values: object, context: object) => boolean,
 *   onOpen?: (context: object) => void,
 * }} options onSubmit mengembalikan true bila tersimpan (dialog lalu ditutup)
 */
export function createFormDialog(dialog, { rules, onSubmit, onOpen }) {
  const form = dialog.querySelector('form');
  let context = {};

  // Aturan menerima konteks (mis. id yang sedang diubah) untuk cek duplikat
  const boundRules = Object.fromEntries(Object.entries(rules).map(([name, rule]) => [name, (values) => rule(values, context)]));
  const live = bindLiveValidation(form, boundRules, () => readFormValues(form));

  form.querySelectorAll('[data-money]').forEach(bindMoneyInput);
  form.querySelector('[data-dialog-cancel]')?.addEventListener('click', () => dialog.close());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readFormValues(form);
    live.touchAll();
    const invalid = validateForm(form, boundRules, values);
    if (invalid.length) {
      focusField(form, invalid[0]);
      showToast({ type: 'danger', title: 'Periksa kembali isian', message: `${invalid.length} kolom belum valid.` });
      return;
    }
    if (onSubmit(values, context)) dialog.close();
  });

  return {
    form,
    /**
     * @param {{ title: string, subtitle?: string, values?: object, context?: object, submitLabel?: string }} options
     */
    open({ title, subtitle = '', values = {}, context: nextContext = {}, submitLabel }) {
      context = nextContext;
      form.reset();
      fillFormValues(form, values);
      live.reset();
      clearFieldErrors(form);
      initHints(form);
      dialog.querySelector('[data-dialog-title]').textContent = title;
      const subtitleElement = dialog.querySelector('[data-dialog-subtitle]');
      if (subtitleElement) subtitleElement.textContent = subtitle;
      const submit = form.querySelector('[type="submit"] [data-submit-label]');
      if (submit && submitLabel) submit.textContent = submitLabel;
      onOpen?.(context);
      dialog.showModal();
      form.querySelector('input:not([type="hidden"]):not([disabled]), select, textarea')?.focus();
    },
    close: () => dialog.close(),
  };
}
