/**
 * Struk belanja (tampilan printer termal 80mm). Dipakai Kasir, Laporan
 * Penjualan, dan Cetak Ulang Struk.
 */

import { escapeHtml, formatNumber, formatPercent } from '../core/format.js';
import { findCustomer, findUser } from '../core/db.js';
import { getSettings } from '../core/settings.js';
import { PAYMENT_TYPES, TRANSACTION_STATUS } from './badges.js';

const pad = (value) => String(value).padStart(2, '0');

function receiptDate(iso) {
  const date = new Date(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const row = (label, value, modifier = '') =>
  `<div class="receipt__row ${modifier}"><dt>${label}</dt><dd>${value}</dd></div>`;

/**
 * Cetak satu struk: render ke #print-root lalu buka dialog cetak browser.
 * print.css menyembunyikan semua elemen lain saat body[data-print="struk"].
 */
export function printReceipt(trx, options) {
  let root = document.querySelector('.print-root');
  if (!root) {
    root = document.createElement('div');
    root.className = 'print-root';
    document.body.append(root);
  }
  root.innerHTML = receiptHtml(trx, options);
  document.body.dataset.print = 'struk';
  window.addEventListener('afterprint', () => delete document.body.dataset.print, { once: true });
  window.print();
}

/**
 * @param {object} trx transaksi dari core/db.js
 * @param {{ reprint?: boolean, store?: object }} options reprint menambahkan tanda SALINAN;
 *   store menimpa profil toko (pratinjau di halaman Profil Toko sebelum disimpan)
 */
export function receiptHtml(trx, { reprint = false, store: storeOverride = null } = {}) {
  const settings = getSettings();
  const store = storeOverride ?? settings.store;
  // Tarif yang berlaku saat transaksi terjadi, bukan tarif pengaturan hari ini
  const taxRate = trx.tarif_pajak ?? settings.taxRate;
  const discountRate = trx.tarif_diskon || settings.memberDiscountRate;
  const kasir = findUser(trx.kasir);
  const pelanggan = trx.pelanggan ? findCustomer(trx.pelanggan) : null;
  const payment = PAYMENT_TYPES[trx.pembayaran.tipe];
  const paid = trx.status === 'settlement';

  const items = trx.items
    .map(
      (item) => `
      <li class="receipt__item">
        <span class="receipt__item-name">${escapeHtml(item.nama)}</span>
        <span class="receipt__row">
          <span>${item.qty} x ${formatNumber(item.harga_satuan)}</span>
          <span>${formatNumber(item.qty * item.harga_satuan)}</span>
        </span>
      </li>`,
    )
    .join('');

  const paymentRows = trx.pembayaran.metode === 'tunai'
    ? row('Tunai', formatNumber(trx.pembayaran.bayar)) + row('Kembali', formatNumber(trx.pembayaran.kembalian))
    : row(payment.label, 'Midtrans') + (trx.pembayaran.order_id ? row('Order ID', escapeHtml(trx.pembayaran.order_id)) : '');

  return `
    <article class="receipt" aria-label="Struk ${trx.id}">
      ${reprint ? '<p class="receipt__stamp">SALINAN</p>' : ''}
      <header class="receipt__header">
        <p class="receipt__store">${escapeHtml(store.nama.toUpperCase())}</p>
        ${store.tagline ? `<p>${escapeHtml(store.tagline)}</p>` : ''}
        <p>${escapeHtml(store.alamat)}</p>
        <p>Telp ${escapeHtml(store.telepon)} · NPWP ${escapeHtml(store.npwp)}</p>
      </header>
      <dl class="receipt__section">
        ${row('No. Struk', trx.id)}
        ${row('Tanggal', receiptDate(trx.tanggal))}
        ${row('Kasir', escapeHtml(kasir?.nama ?? '-'))}
        ${pelanggan ? row('Member', escapeHtml(pelanggan.nama)) : ''}
      </dl>
      <ul class="receipt__section receipt__items">${items}</ul>
      <dl class="receipt__section">
        ${row('Subtotal', formatNumber(trx.subtotal))}
        ${trx.diskon ? row(`Diskon Member ${formatPercent(discountRate)}`, `-${formatNumber(trx.diskon)}`) : ''}
        ${row(`PPN ${formatPercent(taxRate)}`, formatNumber(trx.pajak))}
        ${row('TOTAL', `Rp ${formatNumber(trx.total)}`, 'receipt__row--total')}
        ${paid ? paymentRows : row('Status', TRANSACTION_STATUS[trx.status].label.toUpperCase())}
      </dl>
      <footer class="receipt__footer">
        ${store.footer1 ? `<p>${escapeHtml(store.footer1)}</p>` : ''}
        ${store.footer2 ? `<p>${escapeHtml(store.footer2)}</p>` : ''}
      </footer>
    </article>`;
}
