/**
 * Riwayat TRANSAKSI tiruan untuk 62 hari terakhir.
 *
 * Dibangkitkan dengan PRNG ber-seed tanggal, sehingga setiap hari selalu
 * menghasilkan transaksi yang sama. Transaksi hari ini hanya dibangkitkan
 * sampai "batas riwayat" (lihat core/db.js); transaksi setelahnya berasal
 * dari halaman Kasir.
 */

import { PRODUCT_SEED } from './products.js';
import { CUSTOMER_SEED } from './master.js';
import { createRandom, hashString } from '../core/random.js';
import { calculateTotals } from '../core/pricing.js';
import { addDays, isSameDay, startOfDay, toDateKey } from '../core/dates.js';

export const HISTORY_DAYS = 62;

const TAX_RATE = 0.11;
const MEMBER_DISCOUNT_RATE = 0.05;
const OPEN_MINUTE = 7 * 60;
const CLOSE_MINUTE = 21 * 60 + 30;
const SHIFT_CHANGE_MINUTE = 15 * 60;
const CASHIER_PAGI = 'USR-008';
const CASHIER_SIANG = 'USR-009';

/** Seberapa sering produk muncul di keranjang (bobot relatif) */
const POPULARITY = {
  'PRD-001': 12, 'PRD-002': 11, 'PRD-003': 8, 'PRD-004': 2, 'PRD-005': 4, 'PRD-006': 4,
  'PRD-007': 5, 'PRD-008': 2, 'PRD-009': 1, 'PRD-010': 9, 'PRD-011': 5, 'PRD-012': 6,
  'PRD-013': 4, 'PRD-014': 3, 'PRD-015': 2, 'PRD-016': 8, 'PRD-017': 5, 'PRD-018': 2,
  'PRD-019': 2, 'PRD-020': 2, 'PRD-021': 2, 'PRD-022': 6, 'PRD-023': 5, 'PRD-024': 3,
};

const PRODUCT_WEIGHTS = PRODUCT_SEED.map((item) => [item, POPULARITY[item.id] ?? 1]);
const LINE_COUNT_WEIGHTS = [[1, 30], [2, 30], [3, 20], [4, 12], [5, 5], [6, 3]];
const PAYMENT_WEIGHTS = [['tunai', 46], ['qris', 34], ['gopay', 9], ['bank_transfer', 11]];
const CHEAP_QTY_WEIGHTS = [[1, 40], [2, 25], [3, 12], [4, 8], [6, 6], [10, 5], [12, 4]];
const MID_QTY_WEIGHTS = [[1, 70], [2, 22], [3, 8]];

function quantityFor(item, rng) {
  if (item.harga_jual < 6000) return rng.weighted(CHEAP_QTY_WEIGHTS);
  if (item.harga_jual < 30000) return rng.weighted(MID_QTY_WEIGHTS);
  return 1;
}

/** Uang yang diserahkan pelanggan: pas, atau dibulatkan ke pecahan umum */
function cashTendered(total, rng) {
  const roundUp = (step) => Math.ceil(total / step) * step;
  return rng.weighted([[roundUp(1000), 2], [roundUp(5000), 3], [roundUp(10000), 3], [roundUp(50000), 3], [roundUp(100000), 2]]);
}

function buildTransaction(rng, day, minute, sequence, isToday) {
  const lineCount = rng.weighted(LINE_COUNT_WEIGHTS);
  const chosen = new Map();
  while (chosen.size < lineCount) {
    const item = rng.weighted(PRODUCT_WEIGHTS);
    chosen.set(item.id, item);
  }

  const items = [...chosen.values()].map((item) => ({
    id_produk: item.id,
    nama: item.nama,
    qty: quantityFor(item, rng),
    harga_satuan: item.harga_jual,
    harga_beli: item.harga_beli,
  }));

  const pelanggan = rng.next() < 0.28 ? rng.pick(CUSTOMER_SEED).id : null;
  const discountRate = pelanggan ? MEMBER_DISCOUNT_RATE : 0;
  const totals = calculateTotals(items, { discountRate, taxRate: TAX_RATE });

  const tipe = rng.weighted(PAYMENT_WEIGHTS);
  const statusRoll = rng.next();
  const nonTunai = tipe !== 'tunai';
  let status = 'settlement';
  if (statusRoll < 0.02) status = 'cancel';
  else if (nonTunai && isToday && statusRoll < 0.07) status = 'pending';
  else if (nonTunai && !isToday && statusRoll < 0.035) status = 'expire';

  const tanggal = new Date(day);
  tanggal.setHours(0, minute, rng.int(0, 59));

  const paid = status === 'settlement';
  const bayar = paid ? (nonTunai ? totals.total : cashTendered(totals.total, rng)) : 0;
  const id = `TRX-${toDateKey(day)}-${String(sequence).padStart(4, '0')}`;

  return {
    id,
    tanggal: tanggal.toISOString(),
    kasir: minute < SHIFT_CHANGE_MINUTE ? CASHIER_PAGI : CASHIER_SIANG,
    pelanggan,
    items,
    ...totals,
    tarif_diskon: discountRate,
    tarif_pajak: TAX_RATE,
    status,
    pembayaran: {
      metode: nonTunai ? 'non_tunai' : 'tunai',
      tipe,
      order_id: nonTunai ? `SA-${id}` : null,
      bayar,
      kembalian: paid ? bayar - totals.total : 0,
    },
  };
}

function generateDay(day, cutoff) {
  const rng = createRandom(hashString(toDateKey(day)));
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  const count = Math.round(rng.int(36, 52) * (weekend ? 1.25 : 1));
  const minutes = Array.from({ length: count }, () => rng.int(OPEN_MINUTE, CLOSE_MINUTE)).sort((a, b) => a - b);
  const isToday = isSameDay(day, cutoff);

  // Seluruh transaksi hari itu dibangkitkan dulu agar urutan acak tidak
  // bergantung pada jam; baru kemudian dipotong di batas riwayat.
  return minutes
    .map((minute, index) => buildTransaction(rng, day, minute, index + 1, isToday))
    .filter((trx) => new Date(trx.tanggal) <= cutoff);
}

/** @param {Date} cutoff transaksi setelah waktu ini tidak dibangkitkan */
export function generateHistory(cutoff) {
  const today = startOfDay(cutoff);
  const history = [];
  for (let offset = HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
    history.push(...generateDay(addDays(today, -offset), cutoff));
  }
  return history;
}
