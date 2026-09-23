/**
 * Stok Opname — daftar sesi hitung fisik dan pembukaan sesi baru.
 * Lembar hitungnya ada di form-stok-opname.html?id=<kode sesi>.
 */

import { initShell } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import {
  createOpname, deleteOpname, findCategory, findUser, getCategories, getOpnames, getProducts, getUsers,
} from '../core/db.js';
import { summarizeOpname } from '../core/analytics.js';
import { addDays, startOfDay } from '../core/dates.js';
import { escapeHtml, formatDateShort, formatNumber, formatPercent, formatTime, rupiahHtml } from '../core/format.js';
import { OPNAME_STATUS, badgeHtml } from '../components/badges.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { createFormDialog } from '../components/form-dialog.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const user = getCurrentUser();
const canEdit = user.peran === 'admin';
const sessionForm = document.querySelector('#session-dialog form');

const scopeLabel = (session) => (session.kategori ? findCategory(session.kategori)?.nama ?? session.kategori : 'Seluruh toko');

/* ---------- Tabel ---------- */

function rowHtml(session) {
  const summary = summarizeOpname(session);
  const date = new Date(session.tanggal_mulai);
  const draft = session.status === 'draft';
  const progress = summary.total ? summary.counted / summary.total : 0;
  const deltaClass = summary.selisihNilai < 0 ? 'delta--down' : summary.selisihNilai > 0 ? 'delta--up' : '';
  return `
    <tr data-id="${session.id}" class="${draft ? 'is-warning' : ''}">
      <td class="num">${session.id}</td>
      <td><span class="num">${formatDateShort(date)}</span><span class="table__sub">${formatTime(date)}</span></td>
      <td>${escapeHtml(scopeLabel(session))}${session.blind ? '<span class="table__sub">Blind count</span>' : ''}</td>
      <td>${escapeHtml(findUser(session.petugas)?.nama ?? '-')}</td>
      <td class="col-meter">
        <div class="meter" role="img" aria-label="${summary.counted} dari ${summary.total} item dihitung">
          <div class="meter__fill" style="--value: ${progress.toFixed(3)}"></div>
        </div>
        <span class="table__sub">${summary.counted}/${summary.total} SKU</span>
      </td>
      <td class="col-num">${summary.akurasi === null ? '–' : formatPercent(summary.akurasi)}</td>
      <td class="col-num"><span class="delta ${deltaClass}">${summary.selisihItem ? rupiahHtml(summary.selisihNilai) : '–'}</span>
        <span class="table__sub">${summary.selisihItem} item selisih</span></td>
      <td class="col-center">${badgeHtml(OPNAME_STATUS[session.status])}</td>
      <td class="col-center">
        <div class="table__actions">
          <a class="${draft && canEdit ? 'btn btn--primary btn--sm' : 'icon-btn icon-btn--flat'}" href="form-stok-opname.html?id=${session.id}"
             aria-label="${draft && canEdit ? 'Lanjutkan hitung' : 'Lihat hasil'} ${session.id}">
            ${draft && canEdit ? 'Lanjutkan' : '<span class="icon" aria-hidden="true">visibility</span>'}
          </a>
          ${draft && canEdit ? `
            <button class="icon-btn icon-btn--flat icon-btn--danger" type="button" data-action="delete" aria-label="Hapus draf ${session.id}">
              <span class="icon" aria-hidden="true">delete</span>
            </button>` : ''}
        </div>
      </td>
    </tr>`;
}

const table = createTableView({
  root: document.querySelector('[data-table]'),
  columns: 9,
  noun: 'sesi',
  getItems: getOpnames,
  rowHtml,
  emptyHtml: () => emptyStateHtml({
    icon: 'fact_check',
    title: 'Belum ada sesi opname',
    text: 'Mulai sesi untuk mencocokkan stok fisik di rak dengan stok sistem.',
    action: canEdit ? '<button class="btn btn--primary" type="button" data-action="new">Mulai Sesi Baru</button>' : '',
  }),
});

const setMetric = (key, html) => {
  document.querySelector(`[data-metric="${key}"]`).innerHTML = html;
};

function renderMetrics() {
  const sessions = getOpnames();
  const finals = sessions.filter((item) => item.status === 'final');
  const last = finals[0];
  const since = addDays(startOfDay(new Date()), -90);
  const recent = finals.filter((item) => new Date(item.tanggal_selesai) >= since);
  const counted = new Set(recent.flatMap((item) => item.items.map((line) => line.id_produk)));
  const totals = recent.map(summarizeOpname).reduce((acc, item) => ({ counted: acc.counted + item.counted, cocok: acc.cocok + item.cocok }), { counted: 0, cocok: 0 });

  if (last) {
    const summary = summarizeOpname(last);
    setMetric('last', formatDateShort(new Date(last.tanggal_selesai)));
    setMetric('last-meta', `${escapeHtml(scopeLabel(last))} · ${summary.total} SKU`);
    setMetric('selisih', `<span class="delta ${summary.selisihNilai < 0 ? 'delta--down' : 'delta--up'}">${rupiahHtml(summary.selisihNilai)}</span>`);
    setMetric('selisih-meta', `${summary.kurang} item kurang · ${summary.lebih} item lebih`);
  } else {
    setMetric('last', '–');
    setMetric('last-meta', 'Belum ada sesi final');
    setMetric('selisih', '–');
    setMetric('selisih-meta', '');
  }
  setMetric('akurasi', totals.counted ? formatPercent(totals.cocok / totals.counted) : '–');
  setMetric('akurasi-meta', `${formatNumber(totals.cocok)} dari ${formatNumber(totals.counted)} hitungan cocok (90 hari)`);
  setMetric('belum', formatNumber(getProducts().filter((item) => !counted.has(item.id)).length));

  const draft = sessions.find((item) => item.status === 'draft');
  const notice = document.querySelector('[data-draft-notice]');
  notice.hidden = !draft || !canEdit;
  if (draft) {
    const summary = summarizeOpname(draft);
    document.querySelector('[data-draft-text]').textContent =
      `Sesi ${draft.id} (${scopeLabel(draft)}) masih berjalan: ${summary.counted} dari ${summary.total} SKU sudah dihitung.`;
    document.querySelector('[data-draft-link]').href = `form-stok-opname.html?id=${draft.id}`;
  }
}

/* ---------- Sesi baru ---------- */

const sessionEditor = createFormDialog(document.getElementById('session-dialog'), {
  rules: {
    kategori: ({ kategori }) => {
      const count = getProducts().filter((item) => item.aktif && (!kategori || item.kategori === kategori)).length;
      return count ? '' : 'Kategori ini belum punya produk aktif untuk dihitung.';
    },
    petugas: ({ petugas }) => (petugas ? '' : 'Pilih petugas penghitung.'),
  },
  onSubmit: (values) => {
    const session = createOpname({ ...values, dibuat_oleh: user.id });
    if (!session) {
      showToast({ type: 'danger', title: 'Gagal membuat sesi', message: 'Penyimpanan browser penuh atau diblokir.' });
      return false;
    }
    window.location.href = `form-stok-opname.html?id=${session.id}`;
    return true;
  },
  onOpen: () => updateScopeHint(),
});

function openNewSession() {
  const draft = getOpnames().find((item) => item.status === 'draft');
  if (draft) {
    showToast({ type: 'warning', title: 'Masih ada sesi berjalan', message: `Selesaikan atau hapus ${draft.id} sebelum memulai sesi baru.`, duration: 5000 });
    return;
  }
  sessionEditor.open({
    title: 'Mulai Sesi Opname',
    subtitle: 'Stok sistem dibekukan sebagai acuan saat sesi dimulai.',
    values: { kategori: '', petugas: user.id, blind: true },
  });
}

async function removeDraft(id) {
  const confirmed = await confirmDialog({
    title: 'Hapus draf opname?',
    message: `Hasil hitung pada ${id} akan hilang. Stok tidak berubah karena sesi belum difinalisasi.`,
    confirmLabel: 'Ya, Hapus',
  });
  if (confirmed && deleteOpname(id)) {
    showToast({ type: 'success', title: 'Draf dihapus', message: `${id} telah dihapus.` });
    renderMetrics();
    table.render();
  }
}

function updateScopeHint() {
  const kategori = sessionForm.elements.kategori.value;
  const count = getProducts().filter((item) => item.aktif && (!kategori || item.kategori === kategori)).length;
  const message = sessionForm.querySelector('#session-kategori-msg');
  message.dataset.hint = `${count} SKU aktif akan masuk lembar hitung`;
  if (!sessionForm.querySelector('[data-field="kategori"]').classList.contains('is-invalid')) message.textContent = message.dataset.hint;
}

if (initShell()) {
  if (!canEdit) document.querySelectorAll('[data-admin-only]').forEach((element) => element.remove());
  sessionForm.elements.kategori.insertAdjacentHTML('beforeend', getCategories()
    .filter((item) => item.aktif)
    .map((item) => `<option value="${item.id}">${escapeHtml(item.nama)}</option>`).join(''));
  sessionForm.elements.petugas.innerHTML = getUsers()
    .filter((item) => item.aktif)
    .map((item) => `<option value="${item.id}">${escapeHtml(item.nama)} · ${escapeHtml(item.keterangan)}</option>`).join('');
  sessionForm.elements.kategori.addEventListener('change', updateScopeHint);

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'new') openNewSession();
    if (action === 'delete') removeDraft(event.target.closest('tr[data-id]').dataset.id);
  });

  renderMetrics();
  table.render();
}
