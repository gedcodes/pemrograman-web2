/**
 * Dialog konfirmasi berbasis <dialog> native: fokus terkunci di dalam modal,
 * Esc menutup, dan tombol Batal mendapat fokus awal (DESIGN.md §7.6).
 */

import { escapeHtml } from '../core/format.js';

const VARIANTS = {
  danger: { button: 'btn--danger', icon: 'modal__icon--danger' },
  primary: { button: 'btn--primary', icon: '' },
};

/**
 * @returns {Promise<boolean>} true bila pengguna menekan tombol konfirmasi
 */
export function confirmDialog({
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  variant = 'danger',
  icon = 'delete',
}) {
  const style = VARIANTS[variant] ?? VARIANTS.primary;
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  dialog.setAttribute('aria-describedby', 'confirm-message');
  dialog.innerHTML = `
    <form class="modal__form" method="dialog">
      <div class="modal__header">
        <span class="modal__icon ${style.icon}" aria-hidden="true"><span class="icon">${icon}</span></span>
        <div class="stack stack--xs">
          <h2 class="modal__title" id="confirm-title">${escapeHtml(title)}</h2>
          <p class="modal__body" id="confirm-message">${escapeHtml(message)}</p>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn" type="submit" value="cancel" autofocus>${escapeHtml(cancelLabel)}</button>
        <button class="btn ${style.button}" type="submit" value="confirm">${escapeHtml(confirmLabel)}</button>
      </div>
    </form>
  `;

  // Klik di area backdrop (di luar panel) menutup dialog
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close('cancel');
  });

  document.body.append(dialog);
  dialog.showModal();

  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => {
        resolve(dialog.returnValue === 'confirm');
        dialog.remove();
      },
      { once: true },
    );
  });
}
