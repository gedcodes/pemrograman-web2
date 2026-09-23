/**
 * Kasir (POS) — mengikuti user flow PERANCANGAN.md §4.1 dan §4.3:
 * buka shift → scan / cari produk → cek stok → keranjang → BAYAR (F2)
 * → tunai (hitung kembalian) atau non-tunai (Midtrans Payment Link,
 * konfirmasi manual) → kurangi stok → struk → keranjang direset.
 */

import { imageUrl, initShell } from '../layout/shell.js';
import { getCurrentUser } from '../core/session.js';
import {
  addTransaction, applyStockChanges, findCustomer, findUnit, getCategories, getCustomers, getProducts, getStockStatus, nextReceiptNumber,
} from '../core/db.js';
import { calculateTotals } from '../core/pricing.js';
import { PLACEHOLDER_PAYMENT_LINK, enabledChannels, getSettings } from '../core/settings.js';
import { readJSON, writeJSON } from '../core/storage.js';
import { getOpenShift, openShift } from '../core/shift.js';
import {
  escapeHtml, formatNumber, formatPercent, formatRupiah, formatTime, getInitials, parseNumber, rupiahHtml,
} from '../core/format.js';
import { PAYMENT_TYPES, STOCK_STATUS } from '../components/badges.js';
import { thumbHtml } from '../components/thumb.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { printReceipt, receiptHtml } from '../components/receipt.js';
import { bindMoneyInput } from '../components/money-input.js';

const CART_KEY = 'pos:cart';
const HELD_KEY = 'pos:held';

const settings = getSettings();
const user = getCurrentUser();
// Kanal non-tunai diatur di Pengaturan → Metode Pembayaran
const channels = enabledChannels(settings);

const state = {
  products: getProducts(),
  category: '',
  query: '',
  cart: readJSON(CART_KEY, { lines: [], member: '' }),
  checkout: null,
  channel: channels[0] ?? null,
  lastTransaction: null,
};

const $ = (selector, root = document) => root.querySelector(selector);

const els = {
  search: $('#pos-search'),
  scanForm: $('[data-scan-form]'),
  chips: $('[data-category-chips]'),
  grid: $('[data-product-grid]'),
  announcer: $('[data-announcer]'),
  lines: $('[data-cart-lines]'),
  member: $('[data-member]'),
  shiftDialog: $('#shift-dialog'),
  paymentDialog: $('#payment-dialog'),
  doneDialog: $('#done-dialog'),
  heldDialog: $('#held-dialog'),
  cashInput: $('#cash-input'),
};

/* ==========================================================================
   Keranjang
   ========================================================================== */

const findProduct = (id) => state.products.find((item) => item.id === id);
const qtyInCart = (id) => state.cart.lines.find((line) => line.id === id)?.qty ?? 0;
const maxQty = (product) => (product.backorder ? Number.POSITIVE_INFINITY : product.stok);
const canSell = (product) => product.aktif && (product.backorder || product.stok > 0);

/** Baris keranjang lengkap dengan data produk terkini */
function cartLines() {
  return state.cart.lines
    .map((line) => ({ ...line, product: findProduct(line.id) }))
    .filter((line) => line.product);
}

function cartTotals() {
  const lines = cartLines().map((line) => ({ harga_satuan: line.product.harga_jual, qty: line.qty }));
  return calculateTotals(lines, {
    discountRate: state.cart.member ? settings.memberDiscountRate : 0,
    taxRate: settings.taxRate,
  });
}

function saveCart() {
  writeJSON(CART_KEY, state.cart);
}

function announce(message) {
  els.announcer.textContent = message;
}

function addToCart(product, { flashCard = true } = {}) {
  if (!canSell(product)) {
    showToast({ type: 'warning', title: 'Stok habis', message: `${product.nama} tidak bisa dijual saat ini.` });
    return false;
  }
  const next = qtyInCart(product.id) + 1;
  if (next > maxQty(product)) {
    showToast({ type: 'warning', title: 'Stok tidak cukup', message: `${product.nama} tersisa ${product.stok} di stok.` });
    return false;
  }

  const line = state.cart.lines.find((item) => item.id === product.id);
  if (line) line.qty = next;
  else state.cart.lines.push({ id: product.id, qty: 1 });
  saveCart();
  renderCart();
  announce(`${product.nama} ditambahkan, jumlah ${next}.`);

  if (flashCard) {
    const card = els.grid.querySelector(`[data-product="${product.id}"]`);
    card?.classList.remove('is-added');
    void card?.offsetWidth; // mulai ulang animasi
    card?.classList.add('is-added');
  }
  return true;
}

function setQty(id, qty) {
  const product = findProduct(id);
  const line = state.cart.lines.find((item) => item.id === id);
  if (!product || !line) return;

  if (!Number.isFinite(qty) || qty <= 0) {
    removeLine(id);
    return;
  }
  if (qty > maxQty(product)) {
    showToast({ type: 'warning', title: 'Stok tidak cukup', message: `${product.nama} tersisa ${product.stok} di stok.` });
    line.qty = maxQty(product);
  } else {
    line.qty = Math.floor(qty);
  }
  saveCart();
  renderCart();
}

function removeLine(id) {
  const product = findProduct(id);
  state.cart.lines = state.cart.lines.filter((line) => line.id !== id);
  saveCart();
  renderCart();
  announce(`${product?.nama ?? 'Produk'} dihapus dari keranjang.`);
}

function resetCart() {
  state.cart = { lines: [], member: '' };
  saveCart();
  els.member.value = '';
  renderCart();
}

/* ==========================================================================
   Render katalog & keranjang
   ========================================================================== */

function filteredProducts() {
  const query = state.query.trim().toLowerCase();
  return state.products.filter((item) => item.aktif
    && (!state.category || item.kategori === state.category)
    && (!query || item.nama.toLowerCase().includes(query) || item.barcode.includes(query)));
}

function renderChips() {
  const active = state.products.filter((item) => item.aktif);
  const chips = [{ id: '', nama: 'Semua', count: active.length }]
    .concat(getCategories()
      .filter((category) => category.aktif)
      .map((category) => ({ ...category, count: active.filter((item) => item.kategori === category.id).length })));

  els.chips.innerHTML = chips
    .map((chip) => `
      <button class="chip" type="button" data-category="${chip.id}" aria-pressed="${chip.id === state.category}">
        ${chip.nama}<span class="chip__count">${chip.count}</span>
      </button>`)
    .join('');
}

function productCardHtml(product) {
  const status = getStockStatus(product);
  const sellable = canSell(product);
  const stockLabel = status === 'habis' ? 'Habis' : `Stok ${formatNumber(product.stok)}`;
  const name = escapeHtml(product.nama);

  return `
    <button class="product-card" type="button" data-product="${product.id}" ${sellable ? '' : 'disabled'}
            aria-label="${name}, ${formatRupiah(product.harga_jual)}, ${stockLabel}">
      <span class="badge badge--${STOCK_STATUS[status].variant} product-card__stock">${stockLabel}</span>
      ${thumbHtml(product, 'product-card__thumb')}
      <span class="product-card__name">${name}</span>
      <span class="product-card__price">${rupiahHtml(product.harga_jual)}</span>
    </button>`;
}

function renderGrid() {
  const products = filteredProducts();
  els.grid.innerHTML = products.length
    ? products.map(productCardHtml).join('')
    : `<div class="empty-state product-grid__empty">
         <span class="empty-state__icon" aria-hidden="true"><span class="icon">search_off</span></span>
         <p class="empty-state__title">Tidak ada produk yang cocok${state.query ? ` dengan "${escapeHtml(state.query)}"` : ''}</p>
         <p class="empty-state__text">Periksa ejaan atau barcode, atau tampilkan semua kategori.</p>
         <button class="btn btn--primary" type="button" data-action="clear-search">Hapus Pencarian</button>
       </div>`;
}

function lineHtml({ product, qty }) {
  const name = escapeHtml(product.nama);
  const unit = findUnit(product.satuan)?.singkatan ?? 'pcs';
  return `
    <li class="cart-line" data-line="${product.id}">
      <div class="cart-line__info">
        <span class="cart-line__name">${name}</span>
        <span class="cart-line__price">${formatRupiah(product.harga_jual)} / ${unit.toLowerCase()}</span>
      </div>
      <div class="stepper">
        <button class="stepper__btn" type="button" data-step="-1" aria-label="Kurangi ${name}">
          <span class="icon icon--sm" aria-hidden="true">remove</span>
        </button>
        <input class="stepper__input" type="number" min="1" step="1" value="${qty}" inputmode="numeric" aria-label="Jumlah ${name}">
        <button class="stepper__btn" type="button" data-step="1" aria-label="Tambah ${name}">
          <span class="icon icon--sm" aria-hidden="true">add</span>
        </button>
      </div>
      <span class="cart-line__subtotal">${formatRupiah(product.harga_jual * qty)}</span>
      <button class="icon-btn icon-btn--flat icon-btn--danger cart-line__remove" type="button" data-action="remove-line" aria-label="Hapus ${name} dari keranjang">
        <span class="icon icon--sm" aria-hidden="true">close</span>
      </button>
    </li>`;
}

function renderCart() {
  const lines = cartLines();
  const totals = cartTotals();
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const empty = lines.length === 0;

  els.lines.innerHTML = empty
    ? `<li class="empty-state cart__empty">
         <span class="empty-state__icon" aria-hidden="true"><span class="icon">shopping_cart</span></span>
         <p class="empty-state__title">Keranjang masih kosong</p>
         <p class="empty-state__text">Scan barcode produk pertama untuk memulai transaksi.</p>
       </li>`
    : lines.map(lineHtml).join('');

  $('[data-sum="subtotal"]').textContent = formatRupiah(totals.subtotal);
  $('[data-sum="diskon"]').textContent = `-${formatRupiah(totals.diskon)}`;
  $('[data-sum="pajak"]').textContent = formatRupiah(totals.pajak);
  $('[data-sum="total"]').innerHTML = rupiahHtml(totals.total);
  $('[data-discount-row]').hidden = !state.cart.member;
  $('[data-discount-label]').textContent = `Diskon Member (${formatPercent(settings.memberDiscountRate)})`;
  $('[data-tax-label]').textContent = `PPN ${formatPercent(settings.taxRate)}`;
  $('[data-trx-number]').textContent = `#${nextReceiptNumber()}`;

  document.querySelectorAll('[data-action="pay"]').forEach((button) => {
    button.disabled = empty;
  });
  $('[data-bar-count]').textContent = formatNumber(itemCount);
  $('[data-bar-total]').innerHTML = rupiahHtml(totals.total);
}

function renderCashier(shift) {
  const avatar = user.avatar
    ? `<img class="avatar" src="${imageUrl(user.avatar)}" alt="" width="36" height="36">`
    : `<span class="avatar" aria-hidden="true">${getInitials(user.nama)}</span>`;
  $('[data-cashier]').innerHTML = `
    ${avatar}
    <div class="cart__cashier-text">
      <span class="cart__cashier-name">${escapeHtml(user.nama)}</span>
      <span class="text-caption text-muted">${shift
        ? `Shift dibuka ${formatTime(new Date(shift.waktu_buka))} · modal ${formatRupiah(shift.modal_awal)}`
        : 'Shift belum dibuka'}</span>
    </div>`;
}

function renderAll() {
  renderChips();
  renderGrid();
  renderCart();
}

/* ==========================================================================
   Scan / pencarian (flow 4.1: E → F → G/H)
   ========================================================================== */

function handleScan(event) {
  event.preventDefault();
  const query = els.search.value.trim();
  if (!query) return;

  const byBarcode = state.products.find((item) => item.aktif && item.barcode === query);
  const matches = byBarcode ? [byBarcode] : filteredProducts();

  if (matches.length === 1) {
    if (addToCart(matches[0])) clearSearch();
    else els.search.select();
    return;
  }
  if (matches.length === 0) {
    showToast({ type: 'danger', title: 'Produk tidak ditemukan', message: `Tidak ada produk dengan barcode atau nama "${query}".` });
  } else {
    showToast({ type: 'info', title: `${matches.length} produk cocok`, message: 'Pilih produk dari daftar atau ketik lebih spesifik.' });
  }
  els.search.select();
}

function clearSearch() {
  els.search.value = '';
  state.query = '';
  renderGrid();
  els.search.focus();
}

/* ==========================================================================
   Shift kasir (flow 4.1: A → B → C)
   ========================================================================== */

function openShiftDialog() {
  $('[data-shift-info]').textContent = `${user.nama} · ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}`;
  // Shift wajib dibuka sebelum transaksi: Esc tidak menutup dialog
  els.shiftDialog.addEventListener('cancel', (event) => event.preventDefault());
  els.shiftDialog.showModal();
  $('#shift-cash').focus();
}

function handleShiftSubmit(event) {
  event.preventDefault();
  const input = $('#shift-cash');
  const amount = parseNumber(input.value);
  const field = input.closest('.field');
  const message = $('#shift-cash-msg');

  if (Number.isNaN(amount)) {
    field.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    message.innerHTML = '<span class="icon" aria-hidden="true">warning</span>Modal awal wajib diisi, tulis 0 bila laci kosong.';
    input.focus();
    return;
  }

  const shift = openShift(user, amount);
  if (!shift) {
    showToast({ type: 'danger', title: 'Shift gagal dibuka', message: 'Penyimpanan browser penuh atau diblokir.' });
    return;
  }
  els.shiftDialog.close();
  renderCashier(shift);
  showToast({ type: 'success', title: 'Shift dibuka', message: `Modal awal ${formatRupiah(amount)}. Selamat bertugas!` });
  els.search.focus();
}

/* ==========================================================================
   Pembayaran (flow 4.1: M → N → O/P/Q/R dan 4.3)
   ========================================================================== */

/** Nominal cepat: uang pas lalu pembulatan ke pecahan umum di atas total */
function quickAmounts(total) {
  const roundUp = (step) => Math.ceil(total / step) * step;
  const options = [roundUp(5000), roundUp(10000), roundUp(50000), roundUp(100000)]
    .filter((value) => value > total);
  return [total, ...new Set(options)].slice(0, 4);
}

function selectTab(name, { focus = false } = {}) {
  els.paymentDialog.querySelectorAll('[role="tab"]').forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  $('#panel-tunai').hidden = name !== 'tunai';
  $('#panel-nontunai').hidden = name !== 'nontunai';
  if (name === 'nontunai') renderNonCash();
  else els.cashInput.focus();
}

function openPayment() {
  const lines = cartLines();
  if (!lines.length || els.paymentDialog.open) return;

  const totals = cartTotals();
  state.checkout = { id: nextReceiptNumber(), lines, totals };
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const member = findCustomer(state.cart.member);

  $('[data-pay-meta]').textContent = `#${state.checkout.id} · ${itemCount} item${member ? ` · Member ${member.nama}` : ''}`;
  $('[data-pay-total]').innerHTML = rupiahHtml(totals.total);
  $('[data-quick-amounts]').innerHTML = quickAmounts(totals.total)
    .map((value, index) => `
      <button class="chip chip--amount" type="button" data-amount="${value}" aria-pressed="false">
        ${index === 0 ? 'Uang Pas' : formatNumber(value)}
      </button>`)
    .join('');

  els.cashInput.value = '';
  updateChange();
  els.paymentDialog.showModal();
  selectTab('tunai');
}

function updateChange() {
  const total = state.checkout?.totals.total ?? 0;
  const cash = parseNumber(els.cashInput.value);
  const field = els.cashInput.closest('.field');
  const message = $('#cash-msg');
  const panel = $('[data-change-panel]');
  const short = !Number.isNaN(cash) && cash < total;
  const enough = !Number.isNaN(cash) && cash >= total;

  field.classList.toggle('is-invalid', short);
  els.cashInput.setAttribute('aria-invalid', String(short));
  message.innerHTML = short
    ? `<span class="icon" aria-hidden="true">warning</span>Nominal kurang ${formatRupiah(total - cash)}`
    : 'Ketik nominal atau pilih nominal cepat';

  panel.classList.toggle('is-ready', enough);
  $('[data-change]').innerHTML = enough ? rupiahHtml(cash - total) : '<span class="text-muted">–</span>';
  $('[data-cash-submit]').disabled = !enough;

  $('[data-quick-amounts]').querySelectorAll('[data-amount]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(Number(chip.dataset.amount) === cash));
  });
}

function renderNonCash() {
  const total = state.checkout.totals.total;
  const url = settings.paymentLinkUrl;
  $('[data-pay-amount]').innerHTML = rupiahHtml(total);
  $('[data-payment-link]').href = url;
  $('[data-link-warning]').hidden = url !== PLACEHOLDER_PAYMENT_LINK;

  const qrBox = $('[data-qr]');
  if (window.qrcode) {
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrBox.innerHTML = qr.createSvgTag(4, 0);
  } else {
    qrBox.innerHTML = '<p class="text-small text-secondary">Kode QR gagal dimuat. Gunakan tombol buka Payment Link.</p>';
  }

  $('[data-channels]').innerHTML = channels
    .map((key) => `
      <button class="chip" type="button" data-channel="${key}" aria-pressed="${key === state.channel}">
        <span class="icon icon--sm" aria-hidden="true">${PAYMENT_TYPES[key].icon}</span>${PAYMENT_TYPES[key].label}
      </button>`)
    .join('');
}

/**
 * Simpan transaksi. Stok hanya dikurangi bila lunas (flow 4.1 langkah V);
 * transaksi pending dikurangi saat dikonfirmasi dari Riwayat Transaksi.
 */
function completeTransaction({ tipe, bayar, status }) {
  const { id, lines, totals } = state.checkout;
  const now = new Date().toISOString();
  const nonTunai = tipe !== 'tunai';
  const paid = status === 'settlement';

  const transaction = {
    id,
    tanggal: now,
    kasir: user.id,
    shift: getOpenShift(user)?.id ?? null,
    pelanggan: state.cart.member || null,
    items: lines.map(({ product, qty }) => ({
      id_produk: product.id,
      nama: product.nama,
      qty,
      harga_satuan: product.harga_jual,
      harga_beli: product.harga_beli,
    })),
    ...totals,
    tarif_diskon: state.cart.member ? settings.memberDiscountRate : 0,
    tarif_pajak: settings.taxRate,
    status,
    pembayaran: {
      metode: nonTunai ? 'non_tunai' : 'tunai',
      tipe,
      order_id: nonTunai ? `SA-${id}` : null,
      bayar: paid ? bayar : 0,
      kembalian: paid && !nonTunai ? bayar - totals.total : 0,
      waktu_settlement: paid ? now : null,
    },
    // LOG_PEMBAYARAN (ER-D): jejak perubahan status non-tunai
    log: nonTunai ? [{ status_lama: paid ? 'pending' : null, status_baru: status, waktu: now, oleh: user.id }] : [],
  };

  if (!addTransaction(transaction)) {
    showToast({ type: 'danger', title: 'Gagal menyimpan transaksi', message: 'Penyimpanan browser penuh atau diblokir.' });
    return;
  }
  if (paid) {
    applyStockChanges(transaction.items.map((item) => ({ id: item.id_produk, delta: -item.qty })), {
      tipe: 'penjualan', referensi: transaction.id, oleh: user.id,
    });
  }

  state.products = getProducts();
  state.lastTransaction = transaction;
  state.checkout = null;
  els.paymentDialog.close();
  resetCart();
  renderChips();
  renderGrid();

  if (paid) {
    showDone(transaction);
  } else {
    showToast({
      type: 'warning',
      title: 'Disimpan sebagai pending',
      message: `${transaction.id} menunggu konfirmasi di Riwayat Transaksi.`,
      duration: 5000,
    });
    els.search.focus();
  }
}

function showDone(transaction) {
  const tunai = transaction.pembayaran.metode === 'tunai';
  $('[data-done-meta]').textContent =
    `${transaction.id} · ${PAYMENT_TYPES[transaction.pembayaran.tipe].label} · ${formatTime(new Date(transaction.tanggal))}`;
  $('[data-done-change]').hidden = !tunai;
  $('[data-done-change-value]').innerHTML = rupiahHtml(transaction.pembayaran.kembalian);
  $('[data-done-receipt]').innerHTML = receiptHtml(transaction);
  els.doneDialog.showModal();
}

/* ==========================================================================
   Tahan & batalkan transaksi
   ========================================================================== */

const getHeld = () => readJSON(HELD_KEY, []);

function renderHeldButton() {
  const count = getHeld().length;
  const button = $('[data-action="open-held"]');
  button.hidden = count === 0;
  $('[data-held-count]').textContent = `${count} ditahan`;
}

function holdCart({ silent = false } = {}) {
  if (!state.cart.lines.length) {
    if (!silent) showToast({ type: 'info', title: 'Keranjang kosong', message: 'Tidak ada transaksi untuk ditahan.' });
    return;
  }
  const held = getHeld();
  held.push({ id: `HOLD-${Date.now()}`, waktu: new Date().toISOString(), total: cartTotals().total, ...state.cart });
  writeJSON(HELD_KEY, held);
  resetCart();
  renderHeldButton();
  if (!silent) showToast({ type: 'info', title: 'Transaksi ditahan', message: 'Lanjutkan kapan saja lewat tombol "ditahan" di keranjang.' });
  els.search.focus();
}

function openHeldDialog() {
  $('[data-held-list]').innerHTML = getHeld()
    .map((item) => {
      const count = item.lines.reduce((sum, line) => sum + line.qty, 0);
      const member = findCustomer(item.member);
      return `
        <li class="item-list__row">
          <div class="item-list__text">
            <span class="item-list__title">${formatRupiah(item.total)} · ${count} item</span>
            <span class="item-list__sub">Ditahan ${formatTime(new Date(item.waktu))}${member ? ` · ${escapeHtml(member.nama)}` : ''}</span>
          </div>
          <button class="btn btn--primary btn--sm" type="button" data-resume="${item.id}">Lanjutkan</button>
        </li>`;
    })
    .join('');
  els.heldDialog.showModal();
}

function resumeHeld(id) {
  const held = getHeld();
  const target = held.find((item) => item.id === id);
  if (!target) return;
  if (state.cart.lines.length) holdCart({ silent: true });

  writeJSON(HELD_KEY, getHeld().filter((item) => item.id !== id));
  state.cart = { lines: target.lines, member: target.member };
  els.member.value = target.member;
  saveCart();
  renderCart();
  renderHeldButton();
  els.heldDialog.close();
  showToast({ type: 'success', title: 'Transaksi dilanjutkan', message: `${target.lines.length} jenis produk kembali ke keranjang.` });
}

async function cancelCart() {
  if (!state.cart.lines.length) return;
  const confirmed = await confirmDialog({
    title: 'Batalkan transaksi?',
    message: 'Semua produk di keranjang akan dihapus. Stok tidak berubah karena transaksi belum dibayar.',
    confirmLabel: 'Ya, Batalkan',
    cancelLabel: 'Kembali',
    icon: 'remove_shopping_cart',
  });
  if (!confirmed) return;
  resetCart();
  showToast({ type: 'info', title: 'Transaksi dibatalkan', message: 'Keranjang sudah dikosongkan.' });
  els.search.focus();
}

/* ==========================================================================
   Event
   ========================================================================== */

function bindEvents() {
  els.scanForm.addEventListener('submit', handleScan);
  els.search.addEventListener('input', () => {
    state.query = els.search.value;
    renderGrid();
  });

  els.chips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-category]');
    if (!chip) return;
    state.category = chip.dataset.category;
    renderChips();
    renderGrid();
  });

  els.grid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-product]');
    if (card) addToCart(findProduct(card.dataset.product));
    if (event.target.closest('[data-action="clear-search"]')) {
      state.category = '';
      renderChips();
      clearSearch();
    }
  });
  els.grid.addEventListener('animationend', (event) => event.target.classList.remove('is-added'));

  els.lines.addEventListener('click', (event) => {
    const line = event.target.closest('[data-line]');
    if (!line) return;
    const step = event.target.closest('[data-step]');
    if (step) setQty(line.dataset.line, qtyInCart(line.dataset.line) + Number(step.dataset.step));
    if (event.target.closest('[data-action="remove-line"]')) removeLine(line.dataset.line);
  });
  els.lines.addEventListener('change', (event) => {
    if (!event.target.matches('.stepper__input')) return;
    setQty(event.target.closest('[data-line]').dataset.line, Number(event.target.value));
  });

  els.member.addEventListener('change', () => {
    state.cart.member = els.member.value;
    saveCart();
    renderCart();
  });

  $('[data-shift-form]').addEventListener('submit', handleShiftSubmit);
  bindMoneyInput($('#shift-cash'));

  // Pembayaran
  bindMoneyInput(els.cashInput);
  els.cashInput.addEventListener('input', updateChange);
  $('[data-quick-amounts]').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-amount]');
    if (!chip) return;
    els.cashInput.value = formatNumber(Number(chip.dataset.amount));
    updateChange();
    els.cashInput.focus();
  });
  $('[data-cash-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const cash = parseNumber(els.cashInput.value);
    if (Number.isNaN(cash) || cash < state.checkout.totals.total) {
      updateChange();
      els.cashInput.focus();
      return;
    }
    completeTransaction({ tipe: 'tunai', bayar: cash, status: 'settlement' });
  });

  const tablist = els.paymentDialog.querySelector('[role="tablist"]');
  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) selectTab(tab.dataset.tab);
  });
  tablist.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !channels.length) return;
    const current = tablist.querySelector('[aria-selected="true"]').dataset.tab;
    selectTab(current === 'tunai' ? 'nontunai' : 'tunai', { focus: true });
  });

  els.paymentDialog.addEventListener('click', async (event) => {
    if (event.target === els.paymentDialog) els.paymentDialog.close();
    const channel = event.target.closest('[data-channel]');
    if (channel) {
      state.channel = channel.dataset.channel;
      renderNonCash();
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close-payment') els.paymentDialog.close();
    if (action === 'confirm-paid') completeTransaction({ tipe: state.channel, bayar: state.checkout.totals.total, status: 'settlement' });
    if (action === 'save-pending') completeTransaction({ tipe: state.channel, bayar: 0, status: 'pending' });
    if (action === 'copy-amount') {
      try {
        await navigator.clipboard.writeText(String(state.checkout.totals.total));
        showToast({ type: 'success', title: 'Nominal disalin', message: formatRupiah(state.checkout.totals.total) });
      } catch {
        showToast({ type: 'warning', title: 'Tidak bisa menyalin', message: 'Browser menolak akses clipboard.' });
      }
    }
  });

  els.doneDialog.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'print-receipt') printReceipt(state.lastTransaction);
    if (action === 'new-transaction') els.doneDialog.close();
  });
  els.doneDialog.addEventListener('close', () => els.search.focus());

  els.heldDialog.addEventListener('click', (event) => {
    const resume = event.target.closest('[data-resume]');
    if (resume) resumeHeld(resume.dataset.resume);
  });

  document.getElementById('main').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'pay') openPayment();
    if (action === 'hold') holdCart();
    if (action === 'open-held') openHeldDialog();
    if (action === 'cancel' || action === 'clear-cart') cancelCart();
  });

  // Pintasan keyboard: F2 bayar, "/" fokus ke pencarian
  document.addEventListener('keydown', (event) => {
    const anyDialogOpen = document.querySelector('dialog[open]');
    if (event.key === 'F2') {
      event.preventDefault();
      if (!anyDialogOpen) openPayment();
    }
    const typing = event.target.closest('input, textarea, select');
    if (event.key === '/' && !typing && !anyDialogOpen) {
      event.preventDefault();
      els.search.focus();
    }
  });
}

/* ==========================================================================
   Inisialisasi
   ========================================================================== */

if (initShell()) {
  els.member.insertAdjacentHTML('beforeend', getCustomers()
    .filter((customer) => customer.aktif)
    .map((customer) => `<option value="${customer.id}">${escapeHtml(customer.nama)} · ${customer.tingkat}</option>`)
    .join(''));
  els.member.value = state.cart.member;

  // Buang baris keranjang yang produknya sudah dihapus dari katalog
  state.cart.lines = state.cart.lines.filter((line) => findProduct(line.id));
  saveCart();

  // Semua kanal non-tunai dimatikan di pengaturan → tab Non-Tunai disembunyikan
  $('#tab-nontunai').hidden = channels.length === 0;

  bindEvents();
  renderAll();
  renderHeldButton();

  const shift = getOpenShift(user);
  renderCashier(shift);
  if (shift) els.search.focus();
  else openShiftDialog();
}
