/**
 * Rangka aplikasi: merender sidebar + topbar dari MENU, lalu mengatur
 * mode sidebar (penuh / rail / drawer) sesuai lebar layar.
 *
 * Halaman cukup menyediakan kerangka landmark berikut, lalu memanggil initShell():
 *   <body data-page="<id menu aktif>">
 *     <div class="app">
 *       <aside class="sidebar" id="app-sidebar"></aside>
 *       <div class="app__backdrop" data-action="close-drawer"></div>
 *       <div class="app__main">
 *         <header class="topbar" id="app-topbar"></header>
 *         <main class="content" id="main">…</main>
 */

import { getMenuForRole } from './menu.js';
import { getCurrentUser } from '../core/session.js';
import { ROLE_LABELS } from '../data/users.js';
import { readJSON, writeJSON } from '../core/storage.js';
import { escapeHtml, getInitials } from '../core/format.js';
import { showToast } from '../components/toast.js';

const APP_ROOT = new URL('../../../', import.meta.url);
const DESKTOP = window.matchMedia('(min-width: 1024px)');
const WIDE = window.matchMedia('(min-width: 1280px)');
const SIDEBAR_PREF_KEY = 'sidebar-mode';

export const pageUrl = (id) => new URL(`pages/${id}.html`, APP_ROOT).href;
export const imageUrl = (path) => new URL(`assets/img/${path}`, APP_ROOT).href;

let els = null;

export function initShell() {
  const app = document.querySelector('.app');
  els = {
    app,
    sidebar: app.querySelector('.sidebar'),
    topbar: app.querySelector('.topbar'),
    main: app.querySelector('.app__main'),
  };

  renderShell();
  applySidebarMode();
  bindEvents();
}

/** Render ulang isi sidebar & topbar, mis. setelah peran pengguna berubah. */
export function renderShell() {
  const user = getCurrentUser();
  els.sidebar.innerHTML = sidebarTemplate(user, document.body.dataset.page);
  els.topbar.innerHTML = topbarTemplate(user);
  syncToggleState();
}

/* ---------- Template ---------- */

function avatarTemplate(user, modifier = '') {
  if (user.avatar) {
    return `<img class="avatar ${modifier}" src="${imageUrl(user.avatar)}" alt="" width="36" height="36">`;
  }
  return `<span class="avatar ${modifier}" aria-hidden="true">${getInitials(user.nama)}</span>`;
}

function sidebarTemplate(user, activeId) {
  const groups = getMenuForRole(user.peran)
    .map((group, index) => {
      const items = group.items
        .map(
          (item) => `
          <li>
            <a class="sidebar__link" href="${pageUrl(item.id)}" data-ready="${item.ready}"
               ${item.id === activeId ? 'aria-current="page"' : ''}>
              <span class="icon" aria-hidden="true">${item.icon}</span>
              <span class="sidebar__label">${item.label}</span>
            </a>
          </li>`,
        )
        .join('');

      return `
        <div class="sidebar__group">
          <span class="sidebar__group-label" id="nav-group-${index}">${group.label}</span>
          <ul class="sidebar__list" aria-labelledby="nav-group-${index}">${items}</ul>
        </div>`;
    })
    .join('');

  return `
    <div class="sidebar__brand">
      <span class="brand-mark" aria-hidden="true">SA</span>
      <span class="sidebar__brand-text">
        <span class="sidebar__brand-name">Toko Sari Amerta</span>
        <span class="sidebar__brand-sub">Admin Panel</span>
      </span>
    </div>
    <nav class="sidebar__nav" aria-label="Menu utama">${groups}</nav>
    <div class="sidebar__footer">
      ${avatarTemplate(user, 'avatar--sidebar')}
      <div class="sidebar__user">
        <span class="sidebar__user-name">${escapeHtml(user.nama)}</span>
        <span class="sidebar__user-role">${escapeHtml(user.keterangan)}</span>
      </div>
      <button class="sidebar__logout" type="button" data-action="logout" aria-label="Keluar">
        <span class="icon" aria-hidden="true">logout</span>
      </button>
    </div>`;
}

function topbarTemplate(user) {
  return `
    <button class="icon-btn" type="button" data-action="toggle-sidebar"
            aria-controls="app-sidebar" aria-expanded="true" aria-label="Tampilkan atau sembunyikan menu">
      <span class="icon" aria-hidden="true">menu</span>
    </button>
    <form class="topbar__search" role="search" data-action="global-search">
      <label class="sr-only" for="global-search">Cari di seluruh aplikasi</label>
      <div class="control control--sm">
        <span class="icon" aria-hidden="true">search</span>
        <input class="control__input" id="global-search" type="search"
               placeholder="Cari produk, struk, pelanggan…" autocomplete="off">
        <kbd class="kbd">Ctrl K</kbd>
      </div>
    </form>
    <div class="topbar__end">
      <span class="status-pill"><span class="status-pill__dot" aria-hidden="true"></span>Shift Pagi · Aktif</span>
      <button class="icon-btn" type="button" data-action="notifications" aria-label="Notifikasi, 3 belum dibaca">
        <span class="icon" aria-hidden="true">notifications</span>
        <span class="icon-btn__dot" aria-hidden="true"></span>
      </button>
      <div class="user-chip">
        ${avatarTemplate(user)}
        <div class="user-chip__text">
          <span class="user-chip__name">${escapeHtml(user.nama)}</span>
          <span class="user-chip__role">${ROLE_LABELS[user.peran]}</span>
        </div>
      </div>
    </div>`;
}

/* ---------- Mode sidebar ---------- */

function applySidebarMode() {
  if (DESKTOP.matches) {
    els.app.dataset.sidebar = readJSON(SIDEBAR_PREF_KEY, null) ?? (WIDE.matches ? 'expanded' : 'collapsed');
    closeDrawer({ restoreFocus: false });
  } else {
    els.app.dataset.sidebar = 'expanded';
  }
  syncToggleState();
}

function syncToggleState() {
  const toggle = els.topbar.querySelector('[data-action="toggle-sidebar"]');
  const isRail = DESKTOP.matches && els.app.dataset.sidebar === 'collapsed';
  const isOpen = DESKTOP.matches ? !isRail : els.app.dataset.drawer === 'open';

  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.querySelector('.icon').textContent = DESKTOP.matches && isOpen ? 'menu_open' : 'menu';

  // Mode rail hanya menampilkan ikon → nama menu muncul sebagai tooltip
  els.sidebar.querySelectorAll('.sidebar__link').forEach((link) => {
    if (isRail) link.title = link.querySelector('.sidebar__label').textContent;
    else link.removeAttribute('title');
  });
}

function toggleSidebar() {
  if (!DESKTOP.matches) {
    openDrawer();
    return;
  }
  const next = els.app.dataset.sidebar === 'collapsed' ? 'expanded' : 'collapsed';
  els.app.dataset.sidebar = next;
  writeJSON(SIDEBAR_PREF_KEY, next);
  syncToggleState();
}

function openDrawer() {
  els.app.dataset.drawer = 'open';
  els.main.inert = true;
  syncToggleState();
  els.sidebar.querySelector('.sidebar__link')?.focus();
}

function closeDrawer({ restoreFocus = true } = {}) {
  if (els.app.dataset.drawer !== 'open') return;
  delete els.app.dataset.drawer;
  els.main.inert = false;
  syncToggleState();
  if (restoreFocus) els.topbar.querySelector('[data-action="toggle-sidebar"]').focus();
}

/* ---------- Event ---------- */

function comingSoon(what) {
  showToast({ type: 'info', title: 'Segera hadir', message: `${what} sedang dibangun.` });
}

function bindEvents() {
  els.app.addEventListener('click', (event) => {
    const link = event.target.closest('.sidebar__link');
    if (link?.dataset.ready === 'false') {
      event.preventDefault();
      comingSoon(`Halaman ${link.querySelector('.sidebar__label').textContent}`);
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle-sidebar') toggleSidebar();
    if (action === 'close-drawer') closeDrawer();
    if (action === 'logout') comingSoon('Halaman login');
    if (action === 'notifications') comingSoon('Panel notifikasi');
  });

  els.app.addEventListener('submit', (event) => {
    if (!event.target.matches('[data-action="global-search"]')) return;
    event.preventDefault();
    comingSoon('Pencarian global');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && els.app.dataset.drawer === 'open') closeDrawer();

    // Ctrl/⌘ + K → fokus ke pencarian. F2 sengaja tidak dipakai: dicadangkan untuk BAYAR di Kasir.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById('global-search')?.focus();
    }
  });

  DESKTOP.addEventListener('change', applySidebarMode);
  WIDE.addEventListener('change', applySidebarMode);
}
