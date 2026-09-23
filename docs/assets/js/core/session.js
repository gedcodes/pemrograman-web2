/**
 * Sesi login tiruan (tanpa back-end). Kredensial dicocokkan dengan data
 * pengguna di core/db.js; sesi disimpan di localStorage.
 */

import { findUser, findUserByUsername, getUsers, saveUser } from './db.js';
import { readJSON, writeJSON, removeItem, isStorageAvailable } from './storage.js';

const SESSION_KEY = 'session';

function sessionUser() {
  const session = readJSON(SESSION_KEY, null);
  const user = session ? findUser(session.userId) : null;
  return user?.aktif ? user : null;
}

/** true bila ada sesi aktif, atau bila storage diblokir (login tidak mungkin disimpan) */
export function hasSession() {
  return !isStorageAvailable() || sessionUser() !== null;
}

/**
 * Pengguna yang sedang masuk. Tanpa sesi (mis. storage diblokir), jatuh ke
 * admin aktif pertama agar halaman tetap bisa dirender.
 */
export function getCurrentUser() {
  return sessionUser() ?? getUsers().find((user) => user.aktif && user.peran === 'admin') ?? getUsers()[0];
}

export function signInAs(userId) {
  const user = findUser(userId);
  if (user) saveUser({ ...user, terakhir_login: new Date().toISOString() });
  return writeJSON(SESSION_KEY, { userId, since: new Date().toISOString() });
}

/**
 * @returns {{ user?: object, error?: string, field?: 'username'|'pin' }}
 */
export function signIn(username, pin) {
  const user = findUserByUsername(username);
  if (!user) return { error: 'Username tidak terdaftar.', field: 'username' };
  if (!user.aktif) return { error: 'Akun ini dinonaktifkan. Hubungi Admin / Pemilik toko.', field: 'username' };
  if (user.pin !== pin) return { error: 'PIN salah. Periksa kembali 6 digit PIN Anda.', field: 'pin' };
  if (!signInAs(user.id)) return { error: 'Browser menolak penyimpanan sesi. Nonaktifkan mode privat lalu coba lagi.' };
  return { user };
}

export function signOut() {
  removeItem(SESSION_KEY);
}
