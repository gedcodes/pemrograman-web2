/**
 * Rangka aplikasi: merender sidebar + topbar dari MENU, lalu mengatur
 * mode sidebar (penuh / rail / drawer) sesuai lebar layar.
 *
 * Halaman cukup menyediakan kerangka landmark berikut, lalu memanggil initShell():
 *   <body data-page="<id menu aktif>" [data-roles="admin"]>
 *     <div class="app">
 *       <aside class="sidebar" id="app-sidebar"></aside>
 *       <div class="app__backdrop" data-action="close-drawer"></div>
 *       <div class="app__main">
 *         <header class="topbar" id="app-topbar"></header>
 *         <main class="content" id="main">…</main>
 *
 * data-roles membatasi halaman turunan (mis. form) lebih ketat dari menunya.
 */

import { findMenuItem, getMenuForRole } from './menu.js';
import { getCurrentUser, hasSession, signOut } from '../core/session.js';
import { getOpenShift } from '../core/shift.js';
import { ROLE_LABELS } from '../data/users.js';
import {
  getCustomers, getProducts, getPurchases, getReturns, getStockStatus, getSuppliers, getTransactions,
} from '../core/db.js';
import { readJSON, writeJSON } from '../core/storage.js';
import { escapeHtml, formatTime, getInitials } from '../core/format.js';
import { addDays, startOfDay } from '../core/dates.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import { consumeFlash } from '../core/flash.js';

const APP_ROOT = new URL('../../../', import.meta.url);
const DESKTOP = window.matchMedia('(min-width: 1024px)');
const WIDE = window.matchMedia('(min-width: 1280px)');
const SIDEBAR_PREF_KEY = 'sidebar-mode';

export const pageUrl = (id) => new URL(`pages/${id}.html`, APP_ROOT).href;
export const imageUrl = (path) => new URL(`assets/img/${path}`, APP_ROOT).href;
export const loginUrl = (next) => {
  const url = new URL('index.html', APP_ROOT);
  if (next) url.searchParams.set('next', next);
  return url.href;
};

let els = null;

/**
 * @returns {boolean} false bila belum login (dialihkan ke halaman login) atau
 * peran pengguna tidak boleh membuka halaman ini (PERANCANGAN §2.2);
 * halaman sebaiknya tidak melanjutkan inisialisasi.
 */
export function initShell() {
  if (!hasSession()) {
    window.location.replace(loginUrl(window.location.href.replace(APP_ROOT.href, '')));
    return false;
  }

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
  resolvePageLinks();

  const flash = consumeFlash();
  if (flash) showToast(flash);

  const allowed = canAccess(document.body.dataset.page);
  if (!allowed) renderAccessDenied();
  return allowed;
}

/** Peran boleh membuka menu ini? Dipakai juga untuk menyembunyikan tautan. */
export function canAccess(pageId, role = getCurrentUser().peran) {
  const item = findMenuItem(pageId);
  const pageRoles = pageId === document.body.dataset.page ? document.body.dataset.roles?.split(',') : null;
  return (!item || item.roles.includes(role)) && (!pageRoles || pageRoles.includes(role));
}

function renderAccessDenied() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card card--crisp empty-state">
      <span class="empty-state__icon" aria-hidden="true"><span class="icon">lock</span></span>
      <h1 class="empty-state__title">Akses dibatasi</h1>
      <p class="empty-state__text">Halaman ini hanya untuk Admin / Pemilik. Masuk dengan akun admin untuk membukanya.</p>
      <a class="btn btn--primary" href="${pageUrl('dashboard')}">Kembali ke Dashboard</a>
    </div>`;
}

/**
 * Tautan antarhalaman ditulis <a data-page-link="id-menu">; href dan status
 * "sudah dibangun" diisi dari MENU agar tidak pernah mengarah ke 404.
 */
function resolvePageLinks() {
  document.querySelectorAll('[data-page-link]').forEach((link) => {
    const item = findMenuItem(link.dataset.pageLink);
    link.href = pageUrl(link.dataset.pageLink);
    link.dataset.ready = String(item?.ready ?? true);
  });
}

/** Render ulang isi sidebar & topbar, mis. setelah peran pengguna berubah. */
export function renderShell() {
  const user = getCurrentUser();
  els.sidebar.innerHTML = sidebarTemplate(user, document.body.dataset.page);
  els.topbar.innerHTML = topbarTemplate(user);
  syncToggleState();
}

/* ---------- Notifikasi ---------- */

/** Hal yang perlu ditindaklanjuti, dihitung langsung dari data */
function getNotifications(user) {
  const items = [];
  const products = getProducts();
  const habis = products.filter((item) => getStockStatus(item) === 'habis').length;
  const menipis = products.filter((item) => getStockStatus(item) === 'menipis').length;
  if (habis || menipis) {
    items.push({
      icon: 'inventory', variant: 'warning', href: `${pageUrl('stok-barang')}?status=${habis ? 'habis' : 'menipis'}`,
      title: `${habis} produk habis, ${menipis} menipis`, text: 'Segera buat pesanan ke supplier.',
    });
  }

  const pending = getTransactions().filter((trx) => trx.status === 'pending' && (user.peran === 'admin' || trx.kasir === user.id)).length;
  if (pending) {
    items.push({
      icon: 'schedule', variant: 'warning', href: `${pageUrl('riwayat-transaksi')}?status=pending`,
      title: `${pending} pembayaran non-tunai pending`, text: 'Konfirmasi setelah memeriksa layar Midtrans.',
    });
  }

  if (user.peran === 'admin') {
    const waiting = getReturns().filter((item) => item.status === 'menunggu').length;
    if (waiting) {
      items.push({
        icon: 'assignment_return', variant: 'info', href: `${pageUrl('retur-penjualan')}?status=menunggu`,
        title: `${waiting} retur menunggu approval`, text: 'Diajukan oleh kasir, perlu persetujuan admin.',
      });
    }
    const soon = addDays(startOfDay(new Date()), 7);
    const due = getPurchases().filter((item) => item.status_bayar === 'belum_lunas' && new Date(item.jatuh_tempo) <= soon).length;
    if (due) {
      items.push({
        icon: 'receipt', variant: 'danger', href: `${pageUrl('barang-masuk')}?bayar=belum_lunas`,
        title: `${due} faktur supplier jatuh tempo`, text: 'Jatuh tempo dalam 7 hari ke depan.',
      });
    }
  }
  return items;
}

function notificationPanelHtml(items) {
  const list = items.length
    ? items.map((item) => `
        <li>
          <a class="notif__item" href="${item.href}">
            <span class="notif__icon notif__icon--${item.variant}" aria-hidden="true"><span class="icon">${item.icon}</span></span>
            <span class="notif__text">
              <span class="notif__title">${item.title}</span>
              <span class="notif__sub">${item.text}</span>
            </span>
          </a>
        </li>`).join('')
    : '<li class="notif__empty">Semua beres. Tidak ada yang perlu ditindaklanjuti.</li>';
  return `
    <p class="notif__heading">Perlu tindakan</p>
    <ul class="notif__list" role="list">${list}</ul>`;
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

function shiftStatus(user) {
  const shift = getOpenShift(user);
  if (shift) return { live: true, text: `Shift dibuka ${formatTime(new Date(shift.waktu_buka))}` };
  if (user.peran === 'kasir') return { live: false, text: 'Shift belum dibuka' };
  return { live: true, text: 'Terminal 01 · Online' };
}

function topbarTemplate(user) {
  const notifications = getNotifications(user);
  const status = shiftStatus(user);
  const count = notifications.length;
  return `
    <button class="icon-btn" type="button" data-action="toggle-sidebar"
            aria-controls="app-sidebar" aria-expanded="true" aria-label="Tampilkan atau sembunyikan menu">
      <span class="icon" aria-hidden="true">menu</span>
    </button>
    <form class="topbar__search" role="search" data-action="global-search">
      <label class="sr-only" for="global-search">Cari di seluruh aplikasi</label>
      <div class="control control--sm">
        <span class="icon" aria-hidden="true">search</span>
        <input class="control__input" id="global-search" name="q" type="search"
               placeholder="${user.peran === 'admin' ? 'Cari produk, struk, pelanggan…' : 'Cari struk atau produk…'}" autocomplete="off">
        <kbd class="kbd">Ctrl K</kbd>
      </div>
    </form>
    <div class="topbar__end">
      <span class="status-pill"><span class="status-pill__dot ${status.live ? '' : 'status-pill__dot--off'}" aria-hidden="true"></span>${status.text}</span>
      <div class="notif">
        <button class="icon-btn" type="button" data-action="notifications" aria-expanded="false" aria-controls="notif-panel"
                aria-label="Notifikasi${count ? `, ${count} perlu tindakan` : ''}">
          <span class="icon" aria-hidden="true">notifications</span>
          ${count ? '<span class="icon-btn__dot" aria-hidden="true"></span>' : ''}
        </button>
        <div class="notif__panel" id="notif-panel" role="region" aria-label="Notifikasi" hidden>
          ${notificationPanelHtml(notifications)}
        </div>
      </div>
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

/* ---------- Panel notifikasi ---------- */

function setNotificationsOpen(open, { restoreFocus = false } = {}) {
  const button = els.topbar.querySelector('[data-action="notifications"]');
  const panel = els.topbar.querySelector('#notif-panel');
  panel.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  if (open) panel.querySelector('a')?.focus();
  else if (restoreFocus) button.focus();
}

/* ---------- Pencarian global ---------- */

/** Arahkan kata kunci ke halaman yang paling mungkin berisi hasilnya */
function searchTarget(query, role) {
  const q = query.toLowerCase();
  const withQuery = (id) => `${pageUrl(id)}?q=${encodeURIComponent(query)}`;
  if (/^(trx|#trx|\d{8}-\d{3,4}$)/i.test(q)) return withQuery(role === 'admin' ? 'cetak-struk' : 'riwayat-transaksi');

  const matchesProduct = getProducts().some((item) => item.nama.toLowerCase().includes(q) || item.barcode.includes(q));
  if (role !== 'admin') return withQuery(matchesProduct ? 'stok-barang' : 'riwayat-transaksi');
  if (matchesProduct) return withQuery('produk');
  const digits = q.replace(/\D/g, '');
  const matchesCustomer = getCustomers().some((item) => item.nama.toLowerCase().includes(q)
    || (digits.length >= 4 && item.no_hp.replace(/\D/g, '').includes(digits)));
  if (matchesCustomer) return withQuery('pelanggan');
  if (getSuppliers().some((item) => item.nama.toLowerCase().includes(q))) return withQuery('supplier');
  return withQuery('produk');
}

/* ---------- Event ---------- */

function comingSoon(what) {
  showToast({ type: 'info', title: 'Segera hadir', message: `${what} sedang dibangun.` });
}

async function logout() {
  const confirmed = await confirmDialog({
    title: 'Keluar dari aplikasi?',
    message: 'Sesi Anda akan diakhiri. Keranjang kasir dan shift yang sedang berjalan tetap tersimpan di perangkat ini.',
    confirmLabel: 'Keluar',
    variant: 'primary',
    icon: 'logout',
  });
  if (!confirmed) return;
  signOut();
  window.location.href = loginUrl();
}

function bindEvents() {
  els.app.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-ready="false"]');
    if (link) {
      event.preventDefault();
      const label = link.querySelector('.sidebar__label')?.textContent ?? link.dataset.label ?? link.textContent.trim();
      comingSoon(`Halaman ${label}`);
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle-sidebar') toggleSidebar();
    if (action === 'close-drawer') closeDrawer();
    if (action === 'logout') logout();
    if (action === 'notifications') {
      setNotificationsOpen(els.topbar.querySelector('#notif-panel').hidden);
    } else if (!event.target.closest('.notif__panel')) {
      const panel = els.topbar.querySelector('#notif-panel');
      if (panel && !panel.hidden) setNotificationsOpen(false);
    }
  });

  els.app.addEventListener('submit', (event) => {
    if (!event.target.matches('[data-action="global-search"]')) return;
    event.preventDefault();
    const query = event.target.elements.q.value.trim();
    if (query) window.location.href = searchTarget(query, getCurrentUser().peran);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (els.app.dataset.drawer === 'open') closeDrawer();
      const panel = els.topbar.querySelector('#notif-panel');
      if (panel && !panel.hidden) setNotificationsOpen(false, { restoreFocus: true });
    }

    // Ctrl/⌘ + K → fokus ke pencarian. F2 sengaja tidak dipakai: dicadangkan untuk BAYAR di Kasir.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById('global-search')?.focus();
    }
  });

  DESKTOP.addEventListener('change', applySidebarMode);
  WIDE.addEventListener('change', applySidebarMode);
}
