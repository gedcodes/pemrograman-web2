/**
 * Toast notifikasi: muncul di kanan-atas, bertahan 3,5 detik (DESIGN.md §6.2),
 * diumumkan ke pembaca layar lewat region aria-live.
 */

import { escapeHtml } from '../core/format.js';

const DEFAULT_DURATION = 3500;
const MAX_VISIBLE = 3;

/** Fungsi penutup tiap toast, agar toast terlama bisa ditutup saat penuh */
const dismissers = new WeakMap();

const ICONS = {
  success: 'check_circle',
  info: 'info',
  warning: 'schedule',
  danger: 'error',
};

function getRegion() {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  return region;
}

/**
 * @param {{type?: 'success'|'info'|'warning'|'danger', title: string, message?: string, duration?: number}} options
 * @returns {() => void} fungsi untuk menutup toast lebih awal
 */
export function showToast({ type = 'info', title, message = '', duration = DEFAULT_DURATION }) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.style.setProperty('--toast-duration', `${duration}ms`);
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true"><span class="icon">${ICONS[type]}</span></span>
    <div class="toast__text">
      <p class="toast__title">${escapeHtml(title)}</p>
      ${message ? `<p class="toast__message">${escapeHtml(message)}</p>` : ''}
    </div>
    <button class="toast__close" type="button" aria-label="Tutup notifikasi">
      <span class="icon icon--sm" aria-hidden="true">close</span>
    </button>
    <span class="toast__progress" aria-hidden="true"></span>
  `;

  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast__close').addEventListener('click', dismiss);
  dismissers.set(toast, dismiss);

  const region = getRegion();
  region.append(toast);
  timer = setTimeout(dismiss, duration);

  // Maksimal tiga toast terlihat; yang terlama ditutup lebih dulu
  const visible = region.querySelectorAll('.toast:not(.is-leaving)');
  if (visible.length > MAX_VISIBLE) dismissers.get(visible[0])();
  return dismiss;
}
