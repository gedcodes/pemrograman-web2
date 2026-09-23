/**
 * Pelanggan — CRUD master PELANGGAN (ER-D §3). Jumlah transaksi, total
 * belanja, dan terakhir belanja dihitung dari transaksi lunas.
 */

import { initShell, pageUrl } from '../layout/shell.js';
import { deleteCustomer, getCustomers, getTransactions, saveCustomer } from '../core/db.js';
import { CUSTOMER_TIERS } from '../data/master.js';
import { toDateKey } from '../core/dates.js';
import { escapeHtml, formatDateShort, formatNumber, formatPercent, rupiahHtml } from '../core/format.js';
import { downloadCsv } from '../core/csv.js';
import { isPhone } from '../core/validation.js';
import { ACTIVE_STATUS, TIER_BADGES, badgeHtml } from '../components/badges.js';
import { createTableView, emptyStateHtml } from '../components/table-view.js';
import { createFormDialog } from '../components/form-dialog.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const filters = document.querySelector('[data-filters]');
const tierCards = document.querySelector('[data-tier-cards]');
const params = new URLSearchParams(window.location.search);
const state = { q: params.get('q') ?? '', tier: '', sort: 'belanja' };

const digitsOf = (value) => value.replace(/\D/g, '');

/* ---------- Data turunan ---------- */

function customerStats() {
  const stats = new Map(getCustomers().map((item) => [item.id, { transaksi: 0, belanja: 0, terakhir: null }]));
  let memberOmzet = 0;
  let totalOmzet = 0;
  for (const trx of getTransactions()) {
    if (trx.status !== 'settlement') continue;
    totalOmzet += trx.total;
    const row = stats.get(trx.pelanggan);
    if (!row) continue;
    memberOmzet += trx.total;
    row.transaksi += 1;
    row.belanja += trx.total;
    if (!row.terakhir || trx.tanggal > row.terakhir) row.terakhir = trx.tanggal;
  }
  return { stats, share: totalOmzet ? memberOmzet / totalOmzet : 0 };
}

let stats = new Map();

const SORTERS = {
  belanja: (a, b) => stats.get(b.id).belanja - stats.get(a.id).belanja,
  poin: (a, b) => b.poin_loyalti - a.poin_loyalti,
  terakhir: (a, b) => (stats.get(b.id).terakhir ?? '').localeCompare(stats.get(a.id).terakhir ?? ''),
  nama: (a, b) => a.nama.localeCompare(b.nama, 'id'),
};

function filtered() {
  const query = state.q.trim().toLowerCase();
  const digits = digitsOf(query);
  return getCustomers()
    .filter((item) =>
      (!query || item.nama.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
        || (digits.length >= 3 && digitsOf(item.no_hp).includes(digits)))
      && (!state.tier || item.tingkat === state.tier))
    .sort(SORTERS[state.sort]);
}

/* ---------- Template ---------- */

function rowHtml(item) {
  const row = stats.get(item.id);
  const name = escapeHtml(item.nama);
  return `
    <tr data-id="${item.id}">
      <td class="num">${item.id}</td>
      <td>
        <span class="table__name">${name}</span>
        <span class="table__desc">${badgeHtml(TIER_BADGES[item.tingkat])}</span>
      </td>
      <td class="num">${escapeHtml(item.no_hp)}</td>
      <td class="col-num">${formatNumber(row.transaksi)}</td>
      <td class="col-num">${rupiahHtml(row.belanja)}</td>
      <td class="col-num">${formatNumber(item.poin_loyalti)}</td>
      <td>${row.terakhir ? `<span class="num">${formatDateShort(new Date(row.terakhir))}</span>` : '<span class="text-muted">Belum pernah</span>'}</td>
      <td class="col-center">${badgeHtml(ACTIVE_STATUS[item.aktif])}</td>
      <td class="col-center">
        <div class="table__actions">
          <a class="icon-btn icon-btn--flat" href="${pageUrl('riwayat-transaksi')}?q=${encodeURIComponent(item.nama)}&periode=all"
             aria-label="Riwayat belanja ${name}"><span class="icon" aria-hidden="true">receipt_long</span></a>
          <button class="icon-btn icon-btn--flat" type="button" data-action="edit" aria-label="Ubah ${name}">
            <span class="icon" aria-hidden="true">edit</span>
          </button>
          <button class="icon-btn icon-btn--flat icon-btn--danger" type="button" data-action="delete" aria-label="Hapus ${name}">
            <span class="icon" aria-hidden="true">delete</span>
          </button>
        </div>
      </td>
    </tr>`;
}

const table = createTableView({
  root: document.querySelector('[data-table]'),
  columns: 9,
  noun: 'pelanggan',
  pageSize: 8,
  getItems: filtered,
  rowHtml,
  emptyHtml: () => (state.q || state.tier
    ? emptyStateHtml({
      icon: 'search_off',
      title: `Tidak ada pelanggan yang cocok${state.q ? ` dengan "${escapeHtml(state.q)}"` : ''}`,
      action: '<button class="btn btn--primary" type="button" data-action="clear-filters">Hapus Filter</button>',
    })
    : emptyStateHtml({
      icon: 'group',
      title: 'Belum ada pelanggan',
      text: 'Daftarkan member agar kasir bisa memberi diskon otomatis.',
      action: '<button class="btn btn--primary" type="button" data-action="add">Tambah Pelanggan</button>',
    })),
});

function render() {
  const result = customerStats();
  stats = result.stats;
  const customers = getCustomers();
  tierCards.querySelectorAll('[data-tier]').forEach((card) => {
    const tier = card.dataset.tier;
    card.setAttribute('aria-pressed', String(tier === state.tier));
    card.querySelector('[data-count]').textContent = formatNumber(tier ? customers.filter((item) => item.tingkat === tier).length : customers.length);
  });
  const totalPoints = customers.reduce((sum, item) => sum + item.poin_loyalti, 0);
  document.querySelector('[data-share]').textContent =
    `Member menyumbang ${formatPercent(result.share)} omzet · ${formatNumber(totalPoints)} poin beredar`;
  table.render();
}

/* ---------- Form ---------- */

const editor = createFormDialog(document.getElementById('customer-dialog'), {
  rules: {
    nama: ({ nama }) => {
      if (!nama) return 'Nama pelanggan wajib diisi.';
      if (nama.length < 3) return 'Nama minimal 3 karakter.';
      return '';
    },
    no_hp: ({ no_hp: phone }, { id }) => {
      if (!phone) return 'Nomor HP wajib diisi.';
      if (!isPhone(phone)) return 'Format nomor HP tidak valid. Contoh: 0812-3456-7890.';
      const owner = getCustomers().find((item) => digitsOf(item.no_hp) === digitsOf(phone) && item.id !== id);
      if (owner) return `Nomor ini sudah terdaftar atas nama ${owner.nama}.`;
      return '';
    },
    tingkat: ({ tingkat }) => (CUSTOMER_TIERS.includes(tingkat) ? '' : 'Pilih tingkat member.'),
    poin_loyalti: ({ poin_loyalti: poin }) => {
      if (Number.isNaN(poin)) return 'Poin wajib diisi, tulis 0 untuk member baru.';
      if (!Number.isInteger(poin) || poin < 0) return 'Poin harus bilangan bulat, tidak boleh negatif.';
      return '';
    },
  },
  onSubmit: (values, { id }) => {
    const existing = id ? getCustomers().find((item) => item.id === id) : null;
    const saved = saveCustomer({ terdaftar: new Date().toISOString().slice(0, 10), ...existing, ...values, id });
    if (!saved) {
      showToast({ type: 'danger', title: 'Gagal menyimpan', message: 'Penyimpanan browser penuh atau diblokir.' });
      return false;
    }
    showToast({ type: 'success', title: id ? 'Data pelanggan diperbarui' : 'Pelanggan ditambahkan', message: `${saved.nama} (${saved.id}) tersimpan.` });
    render();
    return true;
  },
});

function openEditor(id = null) {
  const customer = id ? getCustomers().find((item) => item.id === id) : null;
  editor.open({
    title: customer ? 'Ubah Pelanggan' : 'Tambah Pelanggan',
    subtitle: customer
      ? `${customer.id} · member sejak ${formatDateShort(new Date(customer.terdaftar))}`
      : 'Member baru langsung mendapat diskon di Kasir.',
    values: customer ?? { nama: '', no_hp: '', tingkat: 'Reguler', poin_loyalti: 0, alamat: '', aktif: true },
    context: { id },
  });
}

async function remove(id) {
  const customer = getCustomers().find((item) => item.id === id);
  const row = stats.get(id);
  if (row.transaksi) {
    showToast({
      type: 'warning',
      title: 'Pelanggan punya riwayat belanja',
      message: `${row.transaksi} transaksi tercatat atas nama ${customer.nama}. Nonaktifkan agar struk lama tetap menampilkan namanya.`,
      duration: 5000,
    });
    return;
  }
  const confirmed = await confirmDialog({
    title: 'Hapus pelanggan?',
    message: `"${customer.nama}" beserta ${formatNumber(customer.poin_loyalti)} poinnya akan dihapus permanen.`,
    confirmLabel: 'Ya, Hapus',
  });
  if (confirmed && deleteCustomer(id)) {
    showToast({ type: 'success', title: 'Pelanggan dihapus', message: `${customer.nama} telah dihapus.` });
    render();
  }
}

function exportCsv() {
  const rows = filtered().map((item) => {
    const row = stats.get(item.id);
    return [item.id, item.nama, item.no_hp, item.tingkat, item.poin_loyalti, row.transaksi, row.belanja, row.terakhir ? row.terakhir.slice(0, 10) : '', item.alamat, item.aktif ? 'Aktif' : 'Nonaktif'];
  });
  downloadCsv(`pelanggan-${toDateKey(new Date())}.csv`, [
    ['Kode', 'Nama', 'No. HP', 'Tingkat', 'Poin', 'Transaksi', 'Total Belanja', 'Terakhir Belanja', 'Alamat', 'Status'],
    ...rows,
  ]);
  showToast({ type: 'success', title: 'CSV diunduh', message: `${rows.length} pelanggan diekspor.` });
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
  filters.elements.sort.addEventListener('change', (event) => {
    state.sort = event.target.value;
    table.reset();
  });
  filters.addEventListener('submit', (event) => event.preventDefault());

  tierCards.addEventListener('click', (event) => {
    const card = event.target.closest('[data-tier]');
    if (!card) return;
    state.tier = card.dataset.tier;
    tierCards.querySelectorAll('[data-tier]').forEach((item) => item.setAttribute('aria-pressed', String(item === card)));
    table.reset();
  });

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const id = event.target.closest('tr[data-id]')?.dataset.id;
    if (action === 'add') openEditor();
    if (action === 'edit') openEditor(id);
    if (action === 'delete') remove(id);
    if (action === 'export') exportCsv();
    if (action === 'clear-filters') {
      filters.reset();
      Object.assign(state, { q: '', tier: '', sort: 'belanja' });
      render();
    }
  });
}

if (initShell()) {
  document.getElementById('cust-tingkat').innerHTML = CUSTOMER_TIERS.map((tier) => `<option value="${tier}">${tier}</option>`).join('');
  filters.elements.q.value = state.q;
  bindEvents();
  render();
}
