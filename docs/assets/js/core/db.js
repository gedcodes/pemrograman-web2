/**
 * Repositori data client-side — satu-satunya pintu akses data untuk semua
 * halaman, sehingga angka di Dashboard, Master, Inventori, Kasir, dan Laporan
 * selalu berasal dari sumber yang sama.
 *
 * - Master & produk: data awal disalin ke localStorage saat pertama diubah.
 * - Transaksi: riwayat tiruan (dibangkitkan) + transaksi baru dari Kasir.
 * - Inventori: barang masuk, opname, dan mutasi stok. Setiap perubahan stok
 *   lewat applyStockChanges() sehingga jejaknya tercatat di mutasi.
 */

import { PRODUCT_SEED } from '../data/products.js';
import { CATEGORY_SEED, CUSTOMER_SEED, SUPPLIER_SEED, UNIT_SEED } from '../data/master.js';
import { USER_SEED } from '../data/users.js';
import { generateHistory } from '../data/transactions.js';
import { buildInventorySeed } from '../data/inventory.js';
import { addDays, isSameDay, startOfDay, toDateKey } from './dates.js';
import { readJSON, writeJSON, removeItem } from './storage.js';

const KEYS = {
  products: 'db:products',
  categories: 'db:categories',
  units: 'db:units',
  suppliers: 'db:suppliers',
  customers: 'db:customers',
  users: 'db:users',
  transactions: 'db:transactions',
  historyCutoff: 'db:history-cutoff',
  overrides: 'db:transaction-overrides',
  purchases: 'db:purchases',
  opnames: 'db:opnames',
  moves: 'db:stock-moves',
  returns: 'db:returns',
  reprints: 'db:reprints',
};

/* ---------- Store generik ---------- */

function nextId(list, prefix) {
  const max = list.reduce((highest, item) => Math.max(highest, Number(item.id.split('-')[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

/** Nomor dokumen harian: PREFIX-YYYYMMDD-NNN */
function dailyId(list, prefix, date = new Date(), width = 3) {
  const head = `${prefix}-${toDateKey(date)}-`;
  const last = list
    .filter((item) => item.id.startsWith(head))
    .reduce((highest, item) => Math.max(highest, Number(item.id.slice(head.length)) || 0), 0);
  return `${head}${String(last + 1).padStart(width, '0')}`;
}

/**
 * Koleksi berbasis localStorage dengan data awal.
 * @param {string} key kunci storage
 * @param {Array|(() => Array)} seed data awal, atau fungsi pembuatnya
 * @param {string} prefix awalan id baru (KAT → KAT-006)
 */
function createStore(key, seed, prefix) {
  const all = () => readJSON(key, null) ?? structuredClone(typeof seed === 'function' ? seed() : seed);
  const find = (id) => (id ? all().find((item) => item.id === id) ?? null : null);
  const write = (list) => writeJSON(key, list);

  /** @returns item tersimpan, atau null bila penyimpanan gagal */
  function save(item) {
    const list = all();
    const index = list.findIndex((entry) => entry.id === item.id);
    const saved = index >= 0 ? item : { ...item, id: item.id ?? nextId(list, prefix) };
    if (index >= 0) list[index] = saved;
    else list.push(saved);
    return write(list) ? saved : null;
  }

  function remove(ids) {
    const removed = new Set([ids].flat());
    return write(all().filter((item) => !removed.has(item.id)));
  }

  return { all, find, save, remove, write };
}

/* ---------- Master data ---------- */

const categories = createStore(KEYS.categories, CATEGORY_SEED, 'KAT');
const units = createStore(KEYS.units, UNIT_SEED, 'SAT');
const suppliers = createStore(KEYS.suppliers, SUPPLIER_SEED, 'SUP');
const customers = createStore(KEYS.customers, CUSTOMER_SEED, 'CUST');
const users = createStore(KEYS.users, USER_SEED, 'USR');

export const getCategories = categories.all;
export const findCategory = categories.find;
export const saveCategory = categories.save;
export const deleteCategory = categories.remove;

export const getUnits = units.all;
export const findUnit = units.find;
export const saveUnit = units.save;
export const deleteUnit = units.remove;

export const getSuppliers = suppliers.all;
export const findSupplier = suppliers.find;
export const saveSupplier = suppliers.save;
export const deleteSupplier = suppliers.remove;

export const getCustomers = customers.all;
export const findCustomer = customers.find;
export const saveCustomer = customers.save;
export const deleteCustomer = customers.remove;

export const getUsers = users.all;
export const findUser = users.find;
export const saveUser = users.save;
export const deleteUser = users.remove;

export function findUserByUsername(username) {
  const target = username.trim().toLowerCase();
  return getUsers().find((user) => user.username.toLowerCase() === target) ?? null;
}

/* ---------- Produk ---------- */

const products = createStore(KEYS.products, PRODUCT_SEED, 'PRD');

export const getProducts = products.all;
export const getProduct = products.find;
export const saveProduct = products.save;
export const deleteProducts = products.remove;

export function isBarcodeTaken(barcode, exceptId = null) {
  return getProducts().some((item) => item.barcode === barcode && item.id !== exceptId);
}

/** 'habis' | 'menipis' | 'aman' */
export function getStockStatus(item) {
  if (item.stok <= 0) return 'habis';
  if (item.stok <= item.stok_minimum) return 'menipis';
  return 'aman';
}

/* ---------- Mutasi stok ---------- */

let inventorySeed = null;
const getInventorySeed = () => {
  inventorySeed ??= buildInventorySeed(startOfDay(new Date()));
  return inventorySeed;
};

const moves = createStore(KEYS.moves, () => getInventorySeed().moves, 'MUT');

/** Semua mutasi stok, terbaru lebih dulu */
export function getStockMoves() {
  return moves.all().sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

let moveCounter = 0;

/**
 * Ubah stok beberapa produk sekaligus dan catat jejaknya.
 * @param {Array<{id: string, delta: number, catatan?: string}>} changes delta negatif = stok keluar
 * @param {{tipe?: string, referensi?: string|null, catatan?: string, oleh?: string|null}} meta
 *   tipe: 'penjualan' | 'masuk' | 'retur' | 'penyesuaian' | 'opname'
 */
export function applyStockChanges(changes, { tipe = 'penyesuaian', referensi = null, catatan = '', oleh = null } = {}) {
  const list = getProducts();
  const tanggal = new Date().toISOString();
  const logged = [];

  for (const change of changes) {
    const target = list.find((item) => item.id === change.id);
    if (!target || !change.delta) continue;
    const before = target.stok;
    target.stok = Math.max(0, before + change.delta);
    moveCounter += 1;
    logged.push({
      id: `MUT-${Date.now().toString(36).toUpperCase()}${moveCounter}`,
      tanggal,
      id_produk: target.id,
      nama: target.nama,
      tipe,
      delta: target.stok - before,
      stok_sebelum: before,
      stok_sesudah: target.stok,
      referensi,
      catatan: change.catatan ?? catatan,
      oleh,
    });
  }

  if (!products.write(list)) return false;
  if (logged.length) moves.write([...moves.all(), ...logged]);
  return true;
}

/* ---------- Barang masuk (purchasing) ---------- */

const purchases = createStore(KEYS.purchases, () => getInventorySeed().purchases, 'BM');

export function getPurchases() {
  return purchases.all().sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

export function isInvoiceTaken(noFaktur, supplierId) {
  const target = noFaktur.trim().toLowerCase();
  return purchases.all().some((item) => item.supplier === supplierId && item.no_faktur.toLowerCase() === target);
}

export function nextPurchaseId(date = new Date()) {
  return dailyId(purchases.all(), 'BM', date);
}

/**
 * Bukukan penerimaan barang: simpan dokumen, tambah stok, dan (opsional)
 * perbarui harga beli produk dengan harga faktur terbaru.
 */
export function addPurchase(purchase, { updateCost = false } = {}) {
  const saved = { ...purchase, id: nextPurchaseId(new Date(purchase.tanggal)) };
  if (!purchases.write([...purchases.all(), saved])) return null;

  applyStockChanges(saved.items.map((item) => ({ id: item.id_produk, delta: item.qty })), {
    tipe: 'masuk',
    referensi: saved.id,
    catatan: `Faktur ${saved.no_faktur}`,
    oleh: saved.penerima,
  });

  if (updateCost) {
    const list = getProducts();
    for (const item of saved.items) {
      const target = list.find((entry) => entry.id === item.id_produk);
      if (target && item.harga_beli < target.harga_jual) target.harga_beli = item.harga_beli;
    }
    products.write(list);
  }
  return saved;
}

export function markPurchasePaid(id) {
  const target = purchases.find(id);
  return target ? Boolean(purchases.save({ ...target, status_bayar: 'lunas' })) : false;
}

/* ---------- Stok opname ---------- */

const opnames = createStore(KEYS.opnames, () => getInventorySeed().opnames, 'SO');

export function getOpnames() {
  return opnames.all().sort((a, b) => b.tanggal_mulai.localeCompare(a.tanggal_mulai));
}

export const findOpname = opnames.find;
export const saveOpname = opnames.save;
export const deleteOpname = opnames.remove;

/** Buka sesi baru dengan snapshot stok sistem saat ini */
export function createOpname({ kategori = '', petugas, blind = true, catatan = '', dibuat_oleh }) {
  const now = new Date();
  const items = getProducts()
    .filter((item) => item.aktif && (!kategori || item.kategori === kategori))
    .map((item) => ({ id_produk: item.id, nama: item.nama, stok_sistem: item.stok, fisik: null, harga_beli: item.harga_beli }));

  return opnames.save({
    id: dailyId(opnames.all(), 'SO', now, 2),
    tanggal_mulai: now.toISOString(),
    tanggal_selesai: null,
    kategori,
    petugas,
    status: 'draft',
    blind,
    catatan,
    items,
    dibuat_oleh,
    difinalisasi_oleh: null,
  });
}

/**
 * Finalisasi: selisih (fisik − stok sistem saat snapshot) diterapkan ke stok
 * terkini. Memakai selisih, bukan menimpa angka stok, agar penjualan yang
 * terjadi selama penghitungan tidak ikut terhapus.
 */
export function finalizeOpname(id, userId) {
  const session = opnames.find(id);
  if (!session || session.status !== 'draft') return false;

  const changes = session.items
    .filter((item) => item.fisik !== null && item.fisik !== item.stok_sistem)
    .map((item) => ({ id: item.id_produk, delta: item.fisik - item.stok_sistem }));

  const saved = opnames.save({
    ...session,
    items: session.items.map((item) => ({ ...item, fisik: item.fisik ?? item.stok_sistem })),
    status: 'final',
    tanggal_selesai: new Date().toISOString(),
    difinalisasi_oleh: userId,
  });
  if (!saved) return false;
  if (changes.length) applyStockChanges(changes, { tipe: 'opname', referensi: id, catatan: 'Selisih hitung fisik', oleh: userId });
  return true;
}

/* ---------- Transaksi ---------- */

/**
 * Batas riwayat tiruan untuk hari ini dikunci saat aplikasi pertama dibuka
 * hari itu. Transaksi sesudahnya hanya berasal dari Kasir, sehingga nomor
 * struk tidak pernah bertabrakan.
 */
function getHistoryCutoff() {
  const now = new Date();
  const saved = readJSON(KEYS.historyCutoff, null);
  if (saved && isSameDay(new Date(saved), now)) return new Date(saved);
  writeJSON(KEYS.historyCutoff, now.toISOString());
  return now;
}

let historyCache = null;

function getStoredTransactions() {
  return readJSON(KEYS.transactions, []);
}

/** Semua transaksi, terbaru lebih dulu */
export function getTransactions() {
  historyCache ??= generateHistory(getHistoryCutoff());
  const overrides = readJSON(KEYS.overrides, {});
  const history = historyCache.map((trx) => (overrides[trx.id] ? { ...trx, ...overrides[trx.id] } : trx));
  return [...history, ...getStoredTransactions()].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

export function findTransaction(id) {
  const target = id.trim().toUpperCase();
  return getTransactions().find((trx) => trx.id === target) ?? null;
}

/** Nomor struk berikutnya untuk hari ini: TRX-YYYYMMDD-NNNN */
export function nextReceiptNumber(date = new Date()) {
  const prefix = `TRX-${toDateKey(date)}-`;
  const lastSequence = getTransactions()
    .filter((trx) => trx.id.startsWith(prefix))
    .reduce((highest, trx) => Math.max(highest, Number(trx.id.slice(prefix.length))), 0);
  return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
}

export function addTransaction(transaction) {
  return writeJSON(KEYS.transactions, [...getStoredTransactions(), transaction]);
}

/**
 * Ubah transaksi (mis. pending → settlement). Transaksi dari Kasir diubah
 * langsung; transaksi riwayat tiruan disimpan sebagai override.
 */
export function updateTransaction(id, patch) {
  const stored = getStoredTransactions();
  const target = stored.find((trx) => trx.id === id);
  if (target) {
    Object.assign(target, patch);
    return writeJSON(KEYS.transactions, stored);
  }
  const overrides = readJSON(KEYS.overrides, {});
  overrides[id] = { ...overrides[id], ...patch };
  return writeJSON(KEYS.overrides, overrides);
}

function statusLog(trx, statusBaru, userId, waktu) {
  return [...(trx.log ?? []), { status_lama: trx.status, status_baru: statusBaru, waktu, oleh: userId }];
}

/**
 * Konfirmasi manual pembayaran non-tunai (PERANCANGAN §4.3): pending →
 * settlement, lalu stok dikurangi (flow 4.1 langkah V).
 */
export function confirmTransaction(id, userId) {
  const trx = findTransaction(id);
  if (!trx || trx.status !== 'pending') return false;
  const now = new Date().toISOString();
  const saved = updateTransaction(id, {
    status: 'settlement',
    pembayaran: { ...trx.pembayaran, bayar: trx.total, kembalian: 0, waktu_settlement: now },
    log: statusLog(trx, 'settlement', userId, now),
  });
  if (saved) {
    applyStockChanges(trx.items.map((item) => ({ id: item.id_produk, delta: -item.qty })), {
      tipe: 'penjualan', referensi: id, oleh: userId,
    });
  }
  return saved;
}

/** Batalkan transaksi pending (pelanggan batal / link kedaluwarsa). Stok tidak berubah. */
export function cancelTransaction(id, userId, status = 'cancel') {
  const trx = findTransaction(id);
  if (!trx || trx.status !== 'pending') return false;
  const now = new Date().toISOString();
  return updateTransaction(id, { status, log: statusLog(trx, status, userId, now) });
}

/* ---------- Retur penjualan ---------- */

/** Data awal retur diambil dari riwayat tiruan agar selalu merujuk struk yang ada */
function buildReturnSeed() {
  const settled = getTransactions().filter((trx) => trx.status === 'settlement');
  const today = startOfDay(new Date());
  const onDay = (offset, predicate = () => true) =>
    settled.filter((trx) => isSameDay(new Date(trx.tanggal), addDays(today, -offset)) && predicate(trx)).at(-1);

  const approvedSource = onDay(4, (trx) => trx.pelanggan) ?? onDay(4);
  const pendingSource = onDay(1, (trx) => trx.kasir === 'USR-008') ?? onDay(1);
  const seed = [];

  const build = (trx, offsetMinutes, fields) => {
    const [item] = trx.items;
    const tanggal = new Date(new Date(trx.tanggal).getTime() + offsetMinutes * 60_000);
    const lines = [{ id_produk: item.id_produk, nama: item.nama, qty: 1, harga_satuan: item.harga_satuan }];
    return {
      id: `RTR-${toDateKey(tanggal)}-001`,
      tanggal: tanggal.toISOString(),
      id_transaksi: trx.id,
      pelanggan: trx.pelanggan,
      items: lines,
      jumlah_refund: refundFor(trx, lines),
      kembali_ke_stok: false,
      catatan_proses: '',
      waktu_proses: null,
      diproses_oleh: null,
      ...fields,
    };
  };

  if (approvedSource) {
    seed.push(build(approvedSource, 95, {
      alasan: 'rusak',
      catatan: 'Kemasan sobek, isi tumpah saat dibuka di rumah.',
      status: 'disetujui',
      dibuat_oleh: 'USR-008',
      diproses_oleh: 'USR-001',
      waktu_proses: new Date(new Date(approvedSource.tanggal).getTime() + 120 * 60_000).toISOString(),
      catatan_proses: 'Barang rusak dimusnahkan, tidak kembali ke rak.',
    }));
  }
  if (pendingSource) {
    seed.push(build(pendingSource, 40, {
      alasan: 'salah_barang',
      catatan: 'Pelanggan salah ambil varian, kemasan masih tersegel.',
      status: 'menunggu',
      kembali_ke_stok: true,
      dibuat_oleh: 'USR-008',
    }));
  }
  return seed;
}

const returns = createStore(KEYS.returns, buildReturnSeed, 'RTR');

/** Nilai refund proporsional terhadap total struk (diskon & PPN ikut terbagi rata) */
export function refundFor(trx, lines) {
  const portion = lines.reduce((sum, line) => sum + line.harga_satuan * line.qty, 0);
  return trx.subtotal ? Math.round(trx.total * (portion / trx.subtotal)) : 0;
}

export function getReturns() {
  return returns.all().sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/** Jumlah yang sudah (atau sedang) diretur per produk untuk satu struk */
export function returnedQuantities(trxId) {
  const result = {};
  for (const item of returns.all()) {
    if (item.id_transaksi !== trxId || item.status === 'ditolak') continue;
    for (const line of item.items) result[line.id_produk] = (result[line.id_produk] ?? 0) + line.qty;
  }
  return result;
}

function restock(ret, userId) {
  if (!ret.kembali_ke_stok) return;
  applyStockChanges(ret.items.map((line) => ({ id: line.id_produk, delta: line.qty })), {
    tipe: 'retur', referensi: ret.id, catatan: `Retur dari ${ret.id_transaksi}`, oleh: userId,
  });
}

/**
 * Admin langsung menyetujui; retur dari kasir menunggu approval (PERANCANGAN §2.2).
 * @returns retur tersimpan atau null
 */
export function addReturn(ret, user) {
  const now = new Date();
  const approved = user.peran === 'admin';
  const saved = {
    ...ret,
    id: dailyId(returns.all(), 'RTR', now),
    tanggal: now.toISOString(),
    status: approved ? 'disetujui' : 'menunggu',
    dibuat_oleh: user.id,
    diproses_oleh: approved ? user.id : null,
    waktu_proses: approved ? now.toISOString() : null,
    catatan_proses: '',
  };
  if (!returns.write([...returns.all(), saved])) return null;
  if (approved) restock(saved, user.id);
  return saved;
}

export function processReturn(id, { approve, userId, note = '' }) {
  const target = returns.find(id);
  if (!target || target.status !== 'menunggu') return false;
  const saved = returns.save({
    ...target,
    status: approve ? 'disetujui' : 'ditolak',
    diproses_oleh: userId,
    waktu_proses: new Date().toISOString(),
    catatan_proses: note,
  });
  if (saved && approve) restock(saved, userId);
  return Boolean(saved);
}

/* ---------- Cetak ulang struk ---------- */

export function getReprintInfo(trxId) {
  return readJSON(KEYS.reprints, {})[trxId] ?? { jumlah: 0, terakhir: null, oleh: null };
}

export function recordReprint(trxId, userId) {
  const all = readJSON(KEYS.reprints, {});
  const current = all[trxId] ?? { jumlah: 0 };
  all[trxId] = { jumlah: current.jumlah + 1, terakhir: new Date().toISOString(), oleh: userId };
  writeJSON(KEYS.reprints, all);
  return all[trxId];
}

/* ---------- Reset ---------- */

/** Kembalikan semua data ke kondisi awal (tombol demo). Sesi & pengaturan tidak ikut. */
export function resetDemoData() {
  Object.values(KEYS).forEach(removeItem);
  ['pos:cart', 'pos:held', 'pos:shift'].forEach(removeItem);
  historyCache = null;
  inventorySeed = null;
}
