/**
 * Halaman masuk (index.html). Validasi kolom, pesan kesalahan spesifik,
 * penguncian sementara setelah 5 kali gagal, lalu arahkan sesuai peran:
 * admin → Dashboard, kasir → Kasir, atau ke halaman asal (?next=).
 */

import { hasSession, getCurrentUser, signIn } from '../core/session.js';
import { getUsers } from '../core/db.js';
import { ROLE_LABELS } from '../data/users.js';
import { isStorageAvailable } from '../core/storage.js';
import { escapeHtml, getInitials } from '../core/format.js';
import { initHints, showFieldError } from '../core/validation.js';
import { showToast } from '../components/toast.js';

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;
const APP_ROOT = new URL('../../../', import.meta.url);

const form = document.getElementById('login-form');
const errorBox = document.querySelector('[data-login-error]');
const submit = form.querySelector('[data-submit]');
let attempts = 0;
let lockTimer = null;

/** Hanya izinkan tujuan internal agar ?next= tidak bisa dipakai untuk open redirect */
function destination(user) {
  const next = new URLSearchParams(window.location.search).get('next') ?? '';
  if (/^(pages\/[a-z-]+\.html|layout\.html)(\?[\w=&%.,-]*)?$/.test(next)) return new URL(next, APP_ROOT).href;
  return new URL(`pages/${user.peran === 'admin' ? 'dashboard' : 'kasir'}.html`, APP_ROOT).href;
}

function showError(message) {
  errorBox.hidden = !message;
  errorBox.querySelector('[data-login-error-text]').textContent = message;
}

function validate(values) {
  const errors = {
    username: values.username ? '' : 'Username wajib diisi.',
    pin: !values.pin ? 'PIN wajib diisi.' : /^\d{6}$/.test(values.pin) ? '' : 'PIN harus 6 digit angka.',
  };
  Object.entries(errors).forEach(([name, error]) => showFieldError(form, name, error));
  return Object.keys(errors).filter((name) => errors[name]);
}

function lock() {
  let remaining = LOCK_SECONDS;
  submit.disabled = true;
  const tick = () => {
    showError(`Terlalu banyak percobaan gagal. Coba lagi dalam ${remaining} detik.`);
    remaining -= 1;
    if (remaining < 0) {
      clearInterval(lockTimer);
      attempts = 0;
      submit.disabled = false;
      showError('');
    }
  };
  tick();
  lockTimer = setInterval(tick, 1000);
}

function handleSubmit(event) {
  event.preventDefault();
  if (submit.disabled) return;
  const values = { username: form.elements.username.value.trim(), pin: form.elements.pin.value.trim() };
  showError('');
  const invalid = validate(values);
  if (invalid.length) {
    form.elements[invalid[0]].focus();
    return;
  }

  const result = signIn(values.username, values.pin);
  if (result.error) {
    attempts += 1;
    if (result.field) showFieldError(form, result.field, result.error);
    else showError(result.error);
    if (attempts >= MAX_ATTEMPTS) lock();
    else if (result.field === 'pin') showError(`${result.error} Sisa ${MAX_ATTEMPTS - attempts} percobaan.`);
    form.elements[result.field ?? 'username'].select();
    return;
  }

  submit.setAttribute('aria-busy', 'true');
  window.location.href = destination(result.user);
}

function renderDemoAccounts() {
  document.querySelector('[data-demo-accounts]').innerHTML = getUsers()
    .map((user) => `
      <li>
        <button class="demo-account" type="button" data-username="${escapeHtml(user.username)}" data-pin="${escapeHtml(user.pin)}"
                ${user.aktif ? '' : 'data-inactive'}>
          <span class="avatar" aria-hidden="true">${getInitials(user.nama)}</span>
          <span class="demo-account__text">
            <span class="demo-account__name">${escapeHtml(user.nama)}</span>
            <span class="demo-account__meta">${ROLE_LABELS[user.peran]} · @${escapeHtml(user.username)} · PIN ${escapeHtml(user.pin)}</span>
          </span>
          ${user.aktif ? '' : '<span class="badge badge--neutral">Nonaktif</span>'}
        </button>
      </li>`)
    .join('');
}

function bindEvents() {
  form.addEventListener('submit', handleSubmit);
  form.addEventListener('input', (event) => {
    if (event.target.name === 'pin') event.target.value = event.target.value.replace(/\D/g, '');
    showFieldError(form, event.target.name, '');
  });

  form.querySelector('[data-action="toggle-pin"]').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const visible = form.elements.pin.type === 'password';
    form.elements.pin.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? 'Sembunyikan PIN' : 'Tampilkan PIN');
    button.querySelector('.icon').textContent = visible ? 'visibility_off' : 'visibility';
  });

  document.querySelector('[data-demo-accounts]').addEventListener('click', (event) => {
    const account = event.target.closest('[data-username]');
    if (!account) return;
    form.elements.username.value = account.dataset.username;
    form.elements.pin.value = account.dataset.pin;
    ['username', 'pin'].forEach((name) => showFieldError(form, name, ''));
    showError('');
    if (account.hasAttribute('data-inactive')) {
      showToast({ type: 'info', title: 'Akun nonaktif', message: 'Contoh penolakan login. Aktifkan dari menu Pengguna & Hak Akses.' });
    }
    submit.focus();
  });
}

if (isStorageAvailable() && hasSession()) {
  // Sudah masuk → langsung ke halaman kerja
  window.location.replace(destination(getCurrentUser()));
} else {
  initHints(form);
  renderDemoAccounts();
  bindEvents();
  if (!isStorageAvailable()) showError('Browser memblokir penyimpanan lokal (mode privat?). Aplikasi tetap bisa dibuka sebagai admin demo.');
  if (new URLSearchParams(window.location.search).has('next')) {
    document.querySelector('[data-greeting]').textContent = 'Sesi berakhir atau belum masuk. Masuk dulu untuk melanjutkan.';
  }
  form.elements.username.focus();
}
