/**
 * Pengguna & Hak Akses — CRUD entitas PENGGUNA (ER-D §3) dan matriks hak
 * akses yang dibangkitkan dari layout/menu.js (PERANCANGAN §2.2).
 * Pengaman: tidak bisa menonaktifkan/menghapus akun sendiri, dan minimal
 * satu admin aktif harus tersisa.
 */

import { initShell, imageUrl, renderShell } from '../layout/shell.js';
import { MENU } from '../layout/menu.js';
import { getCurrentUser } from '../core/session.js';
import { deleteUser, getTransactions, getUsers, saveUser } from '../core/db.js';
import { ROLE_LABELS } from '../data/users.js';
import { escapeHtml, formatDateTime, formatNumber, getInitials } from '../core/format.js';
import { isPhone } from '../core/validation.js';
import { ACTIVE_STATUS, badgeHtml } from '../components/badges.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { createFormDialog } from '../components/form-dialog.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const me = getCurrentUser();
const filters = document.querySelector('[data-filters]');
const dialog = document.getElementById('user-dialog');
const state = { q: '' };

const ROLE_BADGES = {
  admin: { label: ROLE_LABELS.admin, variant: 'info', icon: 'shield_person' },
  kasir: { label: ROLE_LABELS.kasir, variant: 'neutral', icon: 'point_of_sale' },
};

let trxCounts = new Map();

function countTransactions() {
  const counts = new Map();
  for (const trx of getTransactions()) counts.set(trx.kasir, (counts.get(trx.kasir) ?? 0) + 1);
  return counts;
}

const activeAdmins = (exceptId = null) => getUsers().filter((user) => user.aktif && user.peran === 'admin' && user.id !== exceptId).length;

function filtered() {
  const query = state.q.trim().toLowerCase();
  return getUsers()
    .filter((user) => !query || `${user.nama} ${user.username} ${user.id}`.toLowerCase().includes(query))
    .sort((a, b) => Number(b.aktif) - Number(a.aktif) || a.peran.localeCompare(b.peran) || a.nama.localeCompare(b.nama, 'id'));
}

/* ---------- Tabel pengguna ---------- */

function avatarHtml(user) {
  return user.avatar
    ? `<img class="avatar" src="${imageUrl(user.avatar)}" alt="" width="36" height="36" loading="lazy">`
    : `<span class="avatar" aria-hidden="true">${getInitials(user.nama)}</span>`;
}

function rowHtml(user) {
  const name = escapeHtml(user.nama);
  const isMe = user.id === me.id;
  return `
    <tr data-id="${user.id}" class="${user.aktif ? '' : 'is-muted'}">
      <td>
        <div class="table__product">
          ${avatarHtml(user)}
          <div>
            <span class="table__name">${name}${isMe ? ' <span class="badge badge--success badge--tiny">Anda</span>' : ''}</span>
            <span class="table__sub">@${escapeHtml(user.username)} · ${user.id}</span>
          </div>
        </div>
      </td>
      <td>${badgeHtml(ROLE_BADGES[user.peran])}</td>
      <td><span class="table__name table__name--light">${escapeHtml(user.keterangan)}</span><span class="table__sub">${escapeHtml(user.no_hp || 'Tanpa nomor HP')}</span></td>
      <td class="col-num">${formatNumber(trxCounts.get(user.id) ?? 0)}</td>
      <td>${user.terakhir_login ? `<span class="num">${formatDateTime(new Date(user.terakhir_login))}</span>` : '<span class="text-muted">Belum pernah</span>'}</td>
      <td class="col-center">${badgeHtml(ACTIVE_STATUS[user.aktif])}</td>
      <td class="col-center">
        <div class="table__actions">
          <button class="icon-btn icon-btn--flat" type="button" data-action="edit" aria-label="Ubah ${name}">
            <span class="icon" aria-hidden="true">edit</span>
          </button>
          <button class="icon-btn icon-btn--flat" type="button" data-action="toggle" aria-label="${user.aktif ? 'Nonaktifkan' : 'Aktifkan'} ${name}" ${isMe ? 'disabled' : ''}>
            <span class="icon" aria-hidden="true">${user.aktif ? 'person_off' : 'person_check'}</span>
          </button>
          <button class="icon-btn icon-btn--flat icon-btn--danger" type="button" data-action="delete" aria-label="Hapus ${name}" ${isMe ? 'disabled' : ''}>
            <span class="icon" aria-hidden="true">delete</span>
          </button>
        </div>
      </td>
    </tr>`;
}

const table = createTableView({
  root: document.querySelector('[data-table]'),
  columns: 7,
  noun: 'pengguna',
  getItems: filtered,
  rowHtml,
  emptyHtml: () => emptyStateHtml({ icon: 'search_off', title: `Tidak ada pengguna yang cocok dengan "${escapeHtml(state.q)}"` }),
});

const setMetric = (key, value) => {
  document.querySelector(`[data-metric="${key}"]`).textContent = value;
};

function renderMetrics() {
  const users = getUsers();
  const active = users.filter((user) => user.aktif);
  const last = [...users].filter((user) => user.terakhir_login).sort((a, b) => b.terakhir_login.localeCompare(a.terakhir_login))[0];
  setMetric('aktif', formatNumber(active.length));
  setMetric('aktif-meta', `${users.length - active.length} akun nonaktif dari ${users.length}`);
  setMetric('admin', formatNumber(active.filter((user) => user.peran === 'admin').length));
  setMetric('kasir', formatNumber(active.filter((user) => user.peran === 'kasir').length));
  setMetric('login', last ? last.nama.split(' ').slice(-2).join(' ') : '–');
  setMetric('login-meta', last ? formatDateTime(new Date(last.terakhir_login)) : 'Belum ada yang login');
}

function render() {
  trxCounts = countTransactions();
  renderMetrics();
  table.render();
}

/* ---------- Matriks hak akses ---------- */

function accessBadge(item, role) {
  if (!item.roles.includes(role)) return badgeHtml({ label: 'Tidak ada akses', variant: 'neutral', icon: 'block' });
  if (role === 'kasir' && item.kasirNote) return badgeHtml({ label: item.kasirNote, variant: 'warning', icon: 'rule' });
  return badgeHtml({ label: 'Penuh', variant: 'success', icon: 'check' });
}

function renderMatrix() {
  document.querySelector('[data-matrix]').innerHTML = MENU.map((group) => `
    <tr class="matrix__group"><th scope="rowgroup" colspan="3">${group.label}</th></tr>
    ${group.items.map((item) => `
      <tr>
        <th scope="row"><span class="matrix__menu"><span class="icon icon--sm" aria-hidden="true">${item.icon}</span>${item.label}</span></th>
        <td class="col-center">${accessBadge(item, 'admin')}</td>
        <td class="col-center">${accessBadge(item, 'kasir')}</td>
      </tr>`).join('')}`).join('');
}

/* ---------- Form ---------- */

const editor = createFormDialog(dialog, {
  rules: {
    nama: ({ nama }) => (nama.length >= 3 ? '' : 'Nama wajib diisi, minimal 3 karakter.'),
    username: ({ username }, { id }) => {
      if (!username) return 'Username wajib diisi.';
      if (!/^[a-z0-9._]{4,20}$/.test(username)) return 'Username 4–20 karakter: huruf kecil, angka, titik, atau garis bawah.';
      if (getUsers().some((user) => user.username === username && user.id !== id)) return `Username "${username}" sudah dipakai.`;
      return '';
    },
    peran: ({ peran }, { id }) => {
      if (!peran) return 'Pilih peran.';
      if (id === me.id && peran !== 'admin') return 'Anda tidak bisa menurunkan peran akun sendiri.';
      const target = getUsers().find((user) => user.id === id);
      if (target?.peran === 'admin' && peran !== 'admin' && activeAdmins(id) === 0) return 'Harus tersisa minimal satu admin aktif.';
      return '';
    },
    keterangan: ({ keterangan }) => (keterangan.length >= 3 ? '' : 'Isi jabatan atau shift, minimal 3 karakter.'),
    no_hp: ({ no_hp: phone }) => (!phone || isPhone(phone) ? '' : 'Format nomor HP tidak valid.'),
    pin: ({ pin }, { id }) => {
      if (!pin && id) return '';
      if (!/^\d{6}$/.test(pin)) return 'PIN harus tepat 6 digit angka.';
      if (/^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'PIN terlalu mudah ditebak (angka berulang atau berurutan).';
      return '';
    },
    pin_konfirmasi: ({ pin, pin_konfirmasi: confirm }) => (pin && pin !== confirm ? 'Konfirmasi PIN tidak sama.' : ''),
  },
  onSubmit: (values, { id }) => {
    const existing = id ? getUsers().find((user) => user.id === id) : null;
    if (id === me.id && !values.aktif) values.aktif = true;
    const { pin_konfirmasi: _confirm, ...rest } = values;
    const saved = saveUser({
      avatar: null,
      terakhir_login: null,
      ...existing,
      ...rest,
      pin: values.pin || existing?.pin,
      id,
    });
    if (!saved) {
      showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
      return false;
    }
    showToast({ type: 'success', title: id ? 'Pengguna diperbarui' : 'Pengguna ditambahkan', message: `${saved.nama} (@${saved.username}) bisa login sebagai ${ROLE_LABELS[saved.peran]}.` });
    if (id === me.id) renderShell();
    render();
    return true;
  },
  onOpen: ({ id }) => {
    const editing = Boolean(id);
    dialog.querySelector('[data-pin-required]').hidden = editing;
    dialog.querySelector('#user-pin-msg').dataset.hint = editing ? 'Kosongkan bila PIN tidak diubah' : 'Dipakai untuk login di halaman masuk';
    dialog.querySelector('#user-pin-msg').textContent = dialog.querySelector('#user-pin-msg').dataset.hint;
    dialog.querySelector('[data-active-switch] input').disabled = id === me.id;
  },
});

function openEditor(id = null) {
  const user = id ? getUsers().find((item) => item.id === id) : null;
  editor.open({
    title: user ? 'Ubah Pengguna' : 'Tambah Pengguna',
    subtitle: user ? `${user.id} · @${user.username}` : 'Kode pengguna dibuat otomatis.',
    values: user ? { ...user, pin: '', pin_konfirmasi: '' } : { nama: '', username: '', peran: 'kasir', keterangan: '', no_hp: '', pin: '', pin_konfirmasi: '', aktif: true },
    context: { id },
  });
}

async function toggleActive(id) {
  const user = getUsers().find((item) => item.id === id);
  if (user.aktif && user.peran === 'admin' && activeAdmins(id) === 0) {
    showToast({ type: 'warning', title: 'Tidak bisa dinonaktifkan', message: 'Harus tersisa minimal satu admin aktif.' });
    return;
  }
  const confirmed = await confirmDialog({
    title: user.aktif ? `Nonaktifkan ${user.nama}?` : `Aktifkan ${user.nama}?`,
    message: user.aktif
      ? 'Akun tidak bisa login sampai diaktifkan lagi. Riwayat transaksinya tetap tersimpan.'
      : `Akun bisa login kembali sebagai ${ROLE_LABELS[user.peran]}.`,
    confirmLabel: user.aktif ? 'Nonaktifkan' : 'Aktifkan',
    variant: user.aktif ? 'danger' : 'primary',
    icon: user.aktif ? 'person_off' : 'person_check',
  });
  if (confirmed && saveUser({ ...user, aktif: !user.aktif })) {
    showToast({ type: 'success', title: user.aktif ? 'Akun dinonaktifkan' : 'Akun diaktifkan', message: user.nama });
    render();
  }
}

async function remove(id) {
  const user = getUsers().find((item) => item.id === id);
  const count = trxCounts.get(id) ?? 0;
  if (count) {
    showToast({ type: 'warning', title: 'Pengguna punya riwayat', message: `${count} transaksi tercatat atas nama ${user.nama}. Nonaktifkan akunnya saja.`, duration: 5000 });
    return;
  }
  if (user.peran === 'admin' && activeAdmins(id) === 0) {
    showToast({ type: 'warning', title: 'Tidak bisa dihapus', message: 'Harus tersisa minimal satu admin aktif.' });
    return;
  }
  const confirmed = await confirmDialog({
    title: 'Hapus pengguna?',
    message: `Akun @${user.username} (${user.nama}) akan dihapus permanen.`,
    confirmLabel: 'Ya, Hapus',
  });
  if (confirmed && deleteUser(id)) {
    showToast({ type: 'success', title: 'Pengguna dihapus', message: user.nama });
    render();
  }
}

function bindEvents() {
  let timer;
  filters.elements.q.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = event.target.value;
      table.reset();
    }, 150);
  });
  filters.addEventListener('submit', (event) => event.preventDefault());

  // Username selalu huruf kecil
  dialog.querySelector('[name="username"]').addEventListener('input', (event) => {
    event.target.value = event.target.value.toLowerCase().replace(/\s/g, '');
  });
  dialog.querySelectorAll('[name="pin"], [name="pin_konfirmasi"]').forEach((input) => {
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });
  });

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const id = event.target.closest('tr[data-id]')?.dataset.id;
    if (action === 'add') openEditor();
    if (action === 'edit') openEditor(id);
    if (action === 'toggle') toggleActive(id);
    if (action === 'delete') remove(id);
  });
}

if (initShell()) {
  bindEvents();
  renderMatrix();
  render();
}
