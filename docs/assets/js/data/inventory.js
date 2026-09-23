/**
 * Data awal inventori: BARANG_MASUK + DETAIL_BARANG_MASUK (ER-D §3), sesi
 * stok opname, dan jejak mutasi stok yang ditimbulkannya.
 *
 * Tanggal dihitung mundur dari hari ini agar data selalu terasa "baru".
 * Setelah pengguna menambah data, seluruh isi disimpan di localStorage
 * (lihat core/db.js) dan tidak lagi dibangkitkan ulang.
 */

import { PRODUCT_SEED } from './products.js';
import { addDays, toDateKey } from '../core/dates.js';

const PURCHASE_TAX_RATE = 0.11;

const productById = (id) => PRODUCT_SEED.find((item) => item.id === id);

function at(today, daysAgo, hours, minutes) {
  const date = addDays(today, -daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const pad = (value, length = 2) => String(value).padStart(length, '0');

/**
 * [hari lalu, jam, menit, supplier, kode faktur, diskon, PPN?, termin hari, penerima, item [[produk, qty]]]
 * CV (SUP-003, SUP-006) belum PKP, sehingga fakturnya tanpa PPN masukan.
 */
const PURCHASES = [
  [38, 8, 20, 'SUP-001', 'ICBP', 0, true, 30, 'USR-008', [['PRD-001', 120], ['PRD-010', 80], ['PRD-011', 48], ['PRD-012', 60], ['PRD-015', 20]]],
  [33, 9, 5, 'SUP-002', 'TIV', 0, true, 14, 'USR-008', [['PRD-002', 96]]],
  [29, 10, 40, 'SUP-004', 'ULI', 0.02, true, 30, 'USR-008', [['PRD-008', 24], ['PRD-018', 12], ['PRD-019', 12], ['PRD-020', 24]]],
  [24, 8, 45, 'SUP-003', 'AJD', 0, false, 7, 'USR-001', [['PRD-004', 10], ['PRD-009', 20]]],
  [20, 9, 30, 'SUP-005', 'MYR', 0.015, true, 30, 'USR-008', [['PRD-003', 96], ['PRD-013', 24], ['PRD-016', 96]]],
  [15, 14, 10, 'SUP-008', 'DJR', 0, true, 7, 'USR-009', [['PRD-022', 40], ['PRD-023', 30], ['PRD-024', 20]]],
  [10, 8, 15, 'SUP-006', 'SPM', 0, false, 0, 'USR-008', [['PRD-006', 40], ['PRD-007', 36], ['PRD-014', 30], ['PRD-017', 48]]],
  [6, 9, 50, 'SUP-001', 'ICBP', 0.01, true, 30, 'USR-008', [['PRD-001', 80], ['PRD-005', 24], ['PRD-010', 40]]],
  [3, 15, 35, 'SUP-002', 'TIV', 0, true, 14, 'USR-009', [['PRD-002', 48]]],
];

function buildPurchases(today) {
  const perDay = new Map();

  return PURCHASES.map(([daysAgo, hours, minutes, supplier, code, discountRate, withTax, termin, penerima, lines], index) => {
    const tanggal = at(today, daysAgo, hours, minutes);
    const dateKey = toDateKey(tanggal);
    const sequence = (perDay.get(dateKey) ?? 0) + 1;
    perDay.set(dateKey, sequence);

    const items = lines.map(([id, qty]) => {
      const product = productById(id);
      return { id_produk: id, nama: product.nama, qty, harga_beli: product.harga_beli };
    });
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.harga_beli, 0);
    const diskon = Math.round(subtotal * discountRate);
    const pajak = withTax ? Math.round((subtotal - diskon) * PURCHASE_TAX_RATE) : 0;
    const jatuhTempo = addDays(tanggal, termin);

    return {
      id: `BM-${dateKey}-${pad(sequence, 3)}`,
      tanggal: tanggal.toISOString(),
      supplier,
      no_faktur: `INV-${code}/${tanggal.getFullYear()}/${pad(tanggal.getMonth() + 1)}/${pad(412 + index * 37, 4)}`,
      no_surat_jalan: `SJ-${code}-${pad(9120 + index * 11, 5)}`,
      penerima,
      items,
      subtotal,
      diskon,
      pajak,
      total: subtotal - diskon + pajak,
      termin_hari: termin,
      jatuh_tempo: jatuhTempo.toISOString(),
      status_bayar: termin === 0 || jatuhTempo < today ? 'lunas' : 'belum_lunas',
      catatan: '',
      dibuat_oleh: 'USR-001',
    };
  });
}

/** Satu sesi opname final bulan lalu: rak sembako, dua selisih kecil */
function buildOpnames(today) {
  const start = at(today, 19, 20, 30);
  const end = at(today, 19, 21, 45);
  const counts = [['PRD-004', 12, 12], ['PRD-005', 21, 20], ['PRD-006', 34, 34], ['PRD-014', 25, 24], ['PRD-015', 30, 30]];

  return [{
    id: `SO-${toDateKey(start)}-01`,
    tanggal_mulai: start.toISOString(),
    tanggal_selesai: end.toISOString(),
    kategori: 'KAT-003',
    petugas: 'USR-008',
    status: 'final',
    blind: true,
    catatan: 'Satu pouch minyak bocor di kardus bawah dan satu kilogram telur pecah saat bongkar muat.',
    items: counts.map(([id, stok_sistem, fisik]) => {
      const product = productById(id);
      return { id_produk: id, nama: product.nama, stok_sistem, fisik, harga_beli: product.harga_beli };
    }),
    dibuat_oleh: 'USR-001',
    difinalisasi_oleh: 'USR-001',
  }];
}

function buildMoves(today, purchases, opnames) {
  const moves = [];
  const push = (tanggal, id, tipe, delta, referensi, catatan, oleh) => {
    moves.push({
      id: `MUT-S${pad(moves.length + 1, 3)}`,
      tanggal,
      id_produk: id,
      nama: productById(id).nama,
      tipe,
      delta,
      stok_sebelum: null,
      stok_sesudah: null,
      referensi,
      catatan,
      oleh,
    });
  };

  for (const purchase of purchases) {
    for (const item of purchase.items) {
      push(purchase.tanggal, item.id_produk, 'masuk', item.qty, purchase.id, `Faktur ${purchase.no_faktur}`, purchase.penerima);
    }
  }
  for (const session of opnames) {
    for (const item of session.items) {
      const delta = item.fisik - item.stok_sistem;
      if (delta) push(session.tanggal_selesai, item.id_produk, 'opname', delta, session.id, 'Selisih hitung fisik', session.difinalisasi_oleh);
    }
  }
  push(at(today, 12, 16, 20).toISOString(), 'PRD-002', 'penyesuaian', -2, null, 'Rusak: dua botol bocor di rak depan', 'USR-001');
  push(at(today, 5, 7, 45).toISOString(), 'PRD-017', 'penyesuaian', -3, null, 'Kedaluwarsa: ditarik dari rak pendingin', 'USR-003');

  return moves.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

/** @param {Date} today awal hari ini */
export function buildInventorySeed(today) {
  const purchases = buildPurchases(today);
  const opnames = buildOpnames(today);
  return { purchases, opnames, moves: buildMoves(today, purchases, opnames) };
}
