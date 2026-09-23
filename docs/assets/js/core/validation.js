/**
 * Validasi form bersama. Setiap kolom dibungkus <div class="field" data-field="nama">
 * berisi .control dan <p class="field__message" data-hint="…">. Error ditandai
 * tiga cara sekaligus (DESIGN.md §7.2): ring merah, ikon, dan teks pesan.
 */

import { escapeHtml } from './format.js';

export const PHONE_PATTERN = /^(\+62|0)\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,5}$|^\(0\d{2,3}\)\s?\d{5,8}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export const isPhone = (value) => PHONE_PATTERN.test(value.trim());
export const isEmail = (value) => EMAIL_PATTERN.test(value.trim());

export function showFieldError(form, name, error) {
  const wrapper = form.querySelector(`[data-field="${name}"]`);
  if (!wrapper) return;
  const message = wrapper.querySelector('.field__message');
  wrapper.classList.toggle('is-invalid', Boolean(error));
  wrapper.querySelectorAll('input, select, textarea').forEach((element) => {
    element.setAttribute('aria-invalid', String(Boolean(error)));
  });
  if (message) {
    message.innerHTML = error
      ? `<span class="icon" aria-hidden="true">warning</span>${escapeHtml(error)}`
      : escapeHtml(message.dataset.hint ?? '');
  }
}

export function clearFieldErrors(form) {
  form.querySelectorAll('[data-field]').forEach((wrapper) => showFieldError(form, wrapper.dataset.field, ''));
}

/**
 * @param {Record<string, (values: object) => string>} rules pesan error, atau '' bila valid
 * @returns {string[]} nama kolom yang tidak valid, urut sesuai rules
 */
export function validateForm(form, rules, values) {
  return Object.entries(rules)
    .filter(([name, rule]) => {
      const error = rule(values) || '';
      showFieldError(form, name, error);
      return error;
    })
    .map(([name]) => name);
}

export function focusField(form, name) {
  const element = form.elements.namedItem(name) ?? form.querySelector(`[data-field="${name}"] input, [data-field="${name}"] select`);
  const target = element instanceof RadioNodeList ? element[0] : element;
  target?.focus();
  target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

/**
 * Validasi ulang kolom saat diketik, tetapi baru setelah kolom itu pernah
 * disentuh (blur) atau form pernah dikirim — pesan error tidak muncul
 * sebelum pengguna selesai mengetik.
 */
export function bindLiveValidation(form, rules, readValues) {
  const touched = new Set();
  const check = (name) => {
    if (rules[name]) showFieldError(form, name, rules[name](readValues()) || '');
  };

  form.addEventListener('input', (event) => {
    if (touched.has(event.target.name)) check(event.target.name);
  });
  form.addEventListener('change', (event) => {
    if (!rules[event.target.name]) return;
    touched.add(event.target.name);
    check(event.target.name);
  });
  form.addEventListener('focusout', (event) => {
    const { name, value } = event.target;
    if (!rules[name] || !value) return;
    touched.add(name);
    check(name);
  });

  return {
    touchAll: () => Object.keys(rules).forEach((name) => touched.add(name)),
    reset: () => touched.clear(),
  };
}

/** Isi pesan bantuan awal dari data-hint */
export function initHints(form) {
  form.querySelectorAll('.field__message').forEach((message) => {
    message.textContent = message.dataset.hint ?? '';
  });
}
