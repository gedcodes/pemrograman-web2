/**
 * Perhitungan agregat untuk Dashboard dan Laporan.
 *
 * Istilah:
 *   omzet            = Σ total yang dibayar pelanggan (termasuk PPN)
 *   penjualan bersih = Σ (subtotal − diskon), tanpa PPN
 *   HPP              = Σ harga_beli × qty
 *   laba kotor       = penjualan bersih − HPP
 *   margin kotor     = laba kotor ÷ penjualan bersih
 * Hanya transaksi berstatus settlement (lunas) yang dihitung.
 */

import { addDays, startOfDay } from './dates.js';

export const isSettled = (trx) => trx.status === 'settlement';

/** Transaksi dengan waktu di [start, end) */
export function inRange(transactions, start, end) {
  const from = start.getTime();
  const to = end.getTime();
  return transactions.filter((trx) => {
    const time = new Date(trx.tanggal).getTime();
    return time >= from && time < to;
  });
}

export function summarize(transactions) {
  const settled = transactions.filter(isSettled);
  const result = {
    jumlahTransaksi: settled.length,
    omzet: 0,
    penjualanKotor: 0,
    diskon: 0,
    pajak: 0,
    hpp: 0,
    itemTerjual: 0,
  };

  for (const trx of settled) {
    result.omzet += trx.total;
    result.penjualanKotor += trx.subtotal;
    result.diskon += trx.diskon;
    result.pajak += trx.pajak;
    for (const item of trx.items) {
      result.hpp += item.harga_beli * item.qty;
      result.itemTerjual += item.qty;
    }
  }

  result.penjualanBersih = result.penjualanKotor - result.diskon;
  result.labaKotor = result.penjualanBersih - result.hpp;
  result.margin = result.penjualanBersih ? result.labaKotor / result.penjualanBersih : 0;
  result.rataRata = settled.length ? result.omzet / settled.length : 0;
  return result;
}

/** Perubahan relatif; null bila periode pembanding kosong */
export function percentChange(current, previous) {
  return previous ? (current - previous) / previous : null;
}

/** Omzet & jumlah transaksi per hari, mulai `start` sebanyak `days` hari */
export function dailySeries(transactions, start, days) {
  const buckets = Array.from({ length: days }, (_, index) => ({
    date: addDays(startOfDay(start), index),
    omzet: 0,
    transaksi: 0,
  }));
  const first = buckets[0].date.getTime();

  for (const trx of transactions.filter(isSettled)) {
    const index = Math.round((startOfDay(new Date(trx.tanggal)).getTime() - first) / 86_400_000);
    const bucket = buckets[index];
    if (!bucket) continue;
    bucket.omzet += trx.total;
    bucket.transaksi += 1;
  }
  return buckets;
}

/** Produk terlaris berdasarkan kuantitas terjual */
export function topProducts(transactions, limit = 10) {
  const byProduct = new Map();
  for (const trx of transactions.filter(isSettled)) {
    for (const item of trx.items) {
      const row = byProduct.get(item.id_produk) ?? { id: item.id_produk, nama: item.nama, qty: 0, penjualan: 0, laba: 0 };
      row.qty += item.qty;
      row.penjualan += item.harga_satuan * item.qty;
      row.laba += (item.harga_satuan - item.harga_beli) * item.qty;
      byProduct.set(item.id_produk, row);
    }
  }
  return [...byProduct.values()]
    .map((row) => ({ ...row, margin: row.penjualan ? row.laba / row.penjualan : 0 }))
    .sort((a, b) => b.qty - a.qty || b.penjualan - a.penjualan)
    .slice(0, limit);
}

/**
 * Ringkasan satu sesi stok opname.
 * akurasi = item yang cocok ÷ item yang sudah dihitung
 */
export function summarizeOpname(session) {
  const counted = session.items.filter((item) => item.fisik !== null);
  const diffs = counted.filter((item) => item.fisik !== item.stok_sistem);
  return {
    total: session.items.length,
    counted: counted.length,
    cocok: counted.length - diffs.length,
    selisihItem: diffs.length,
    kurang: diffs.filter((item) => item.fisik < item.stok_sistem).length,
    lebih: diffs.filter((item) => item.fisik > item.stok_sistem).length,
    selisihUnit: diffs.reduce((sum, item) => sum + item.fisik - item.stok_sistem, 0),
    selisihNilai: diffs.reduce((sum, item) => sum + (item.fisik - item.stok_sistem) * item.harga_beli, 0),
    akurasi: counted.length ? (counted.length - diffs.length) / counted.length : null,
  };
}

/** Kuantitas terjual per produk (transaksi lunas): Map id_produk → qty */
export function soldByProduct(transactions) {
  const result = new Map();
  for (const trx of transactions.filter(isSettled)) {
    for (const item of trx.items) result.set(item.id_produk, (result.get(item.id_produk) ?? 0) + item.qty);
  }
  return result;
}

/** Rekap per jenis pembayaran: { tunai: {jumlah, total}, qris: … } */
export function paymentBreakdown(transactions) {
  const result = {};
  for (const trx of transactions.filter(isSettled)) {
    const key = trx.pembayaran.tipe;
    result[key] ??= { jumlah: 0, total: 0 };
    result[key].jumlah += 1;
    result[key].total += trx.total;
  }
  return result;
}

/* ---------- Laba rugi ---------- */

const inWindow = (iso, start, end) => {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < end.getTime();
};

const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

/** Jenis mutasi yang mengubah nilai persediaan di luar jual-beli */
const INVENTORY_ADJUSTMENTS = new Set(['penyesuaian', 'opname']);

/**
 * Laporan laba rugi periode [start, end).
 *   pendapatan bersih = penjualan kotor − diskon − retur (tanpa PPN)
 *   HPP               = harga beli barang terjual − HPP retur kembali ke stok + susut persediaan
 *   beban operasional = beban bulanan diprorata per hari + biaya MDR non-tunai
 *   PPh final UMKM    = tarif × pendapatan bersih (PP 55/2022, atas peredaran bruto)
 *
 * @param {{ transactions, returns, moves, costOf: (id: string) => number, start: Date, end: Date,
 *           expenses: Array<{id, nama, jumlah}>, mdrRate: number, incomeTaxRate: number }} input
 */
export function profitAndLoss({ transactions, returns, moves, costOf, start, end, expenses, mdrRate, incomeTaxRate }) {
  const sales = summarize(inRange(transactions, start, end));
  const byId = new Map(transactions.map((trx) => [trx.id, trx]));

  let returNet = 0;
  let returHpp = 0;
  for (const ret of returns) {
    if (ret.status !== 'disetujui' || !inWindow(ret.waktu_proses ?? ret.tanggal, start, end)) continue;
    const trx = byId.get(ret.id_transaksi);
    if (!trx) continue;
    returNet += Math.round(ret.jumlah_refund / (1 + (trx.tarif_pajak ?? 0)));
    if (ret.kembali_ke_stok) {
      for (const line of ret.items) {
        const sold = trx.items.find((item) => item.id_produk === line.id_produk);
        returHpp += (sold?.harga_beli ?? costOf(line.id_produk)) * line.qty;
      }
    }
  }

  // Susut (delta negatif) menambah HPP, surplus mengurangi
  const susut = moves
    .filter((move) => INVENTORY_ADJUSTMENTS.has(move.tipe) && inWindow(move.tanggal, start, end))
    .reduce((sum, move) => sum - move.delta * costOf(move.id_produk), 0);

  const pendapatanBersih = sales.penjualanKotor - sales.diskon - returNet;
  const hpp = sales.hpp - returHpp + susut;
  const labaKotor = pendapatanBersih - hpp;

  // Beban bulanan dibagi rata per hari sesuai panjang bulan tiap tanggal
  const beban = expenses.map((expense) => ({ ...expense, nilai: 0 }));
  for (let day = new Date(start); day < end; day = addDays(day, 1)) {
    beban.forEach((item) => { item.nilai += item.jumlah / daysInMonth(day); });
  }
  beban.forEach((item) => { item.nilai = Math.round(item.nilai); });

  const nonTunai = inRange(transactions, start, end)
    .filter((trx) => isSettled(trx) && trx.pembayaran.metode === 'non_tunai')
    .reduce((sum, trx) => sum + trx.total, 0);
  const mdr = Math.round(nonTunai * mdrRate);
  const totalBeban = beban.reduce((sum, item) => sum + item.nilai, 0) + mdr;

  const labaOperasional = labaKotor - totalBeban;
  const pph = Math.max(0, Math.round(pendapatanBersih * incomeTaxRate));
  const labaBersih = labaOperasional - pph;
  const ratio = (value) => (pendapatanBersih ? value / pendapatanBersih : 0);

  return {
    sales,
    penjualanKotor: sales.penjualanKotor,
    diskon: sales.diskon,
    returNet,
    pendapatanBersih,
    hppTerjual: sales.hpp,
    returHpp,
    susut,
    hpp,
    labaKotor,
    beban,
    nonTunai,
    mdr,
    totalBeban,
    labaOperasional,
    pph,
    labaBersih,
    marginKotor: ratio(labaKotor),
    marginOperasional: ratio(labaOperasional),
    marginBersih: ratio(labaBersih),
    rasioBeban: ratio(totalBeban),
    ratio,
  };
}

/* ---------- Laporan stok ---------- */

/** Mutasi di luar penjualan kasir (penjualan diambil dari transaksi agar riwayat lama ikut terhitung) */
const NON_SALE_MOVES = new Set(['masuk', 'penyesuaian', 'opname', 'retur']);

/**
 * Pergerakan stok per produk untuk periode [start, end). Stok awal & akhir
 * dihitung mundur dari stok saat ini:
 *   akhir = stok kini − masuk/penyesuaian sesudah periode + terjual sesudah periode
 *   awal  = akhir − masuk − penyesuaian + terjual (di dalam periode)
 */
export function stockMovement({ products, transactions, moves, start, end }) {
  const soldIn = soldByProduct(inRange(transactions, start, end));
  const soldAfter = soldByProduct(transactions.filter((trx) => new Date(trx.tanggal).getTime() >= end.getTime()));
  const blank = () => ({ masuk: 0, adj: 0 });
  const inside = new Map();
  const after = new Map();

  for (const move of moves) {
    if (!NON_SALE_MOVES.has(move.tipe)) continue;
    const time = new Date(move.tanggal).getTime();
    const bucket = time >= end.getTime() ? after : time >= start.getTime() ? inside : null;
    if (!bucket) continue;
    const row = bucket.get(move.id_produk) ?? blank();
    if (move.tipe === 'masuk') row.masuk += move.delta;
    else row.adj += move.delta;
    bucket.set(move.id_produk, row);
  }

  return products.map((product) => {
    const inRow = inside.get(product.id) ?? blank();
    const afterRow = after.get(product.id) ?? blank();
    const keluar = soldIn.get(product.id) ?? 0;
    const akhir = product.stok - afterRow.masuk - afterRow.adj + (soldAfter.get(product.id) ?? 0);
    const awal = akhir - inRow.masuk - inRow.adj + keluar;
    return {
      product,
      awal,
      masuk: inRow.masuk,
      keluar,
      penyesuaian: inRow.adj,
      akhir,
      nilaiAkhir: akhir * product.harga_beli,
      hppKeluar: keluar * product.harga_beli,
      rataNilai: ((awal + akhir) / 2) * product.harga_beli,
    };
  });
}

/** Unit masuk (barang masuk) vs keluar (terjual) per hari */
export function dailyUnits({ transactions, moves, start, days }) {
  const buckets = Array.from({ length: days }, (_, index) => ({ date: addDays(startOfDay(start), index), masuk: 0, keluar: 0 }));
  const first = buckets[0].date.getTime();
  const indexOf = (iso) => Math.round((startOfDay(new Date(iso)).getTime() - first) / 86_400_000);

  for (const trx of transactions.filter(isSettled)) {
    const bucket = buckets[indexOf(trx.tanggal)];
    if (bucket) bucket.keluar += trx.items.reduce((sum, item) => sum + item.qty, 0);
  }
  for (const move of moves) {
    if (move.tipe !== 'masuk') continue;
    const bucket = buckets[indexOf(move.tanggal)];
    if (bucket) bucket.masuk += move.delta;
  }
  return buckets;
}
