/**
 * Sesi login tiruan (tanpa back-end). Sebelum halaman login selesai,
 * pengguna default adalah Admin / Pemilik.
 */

import { USERS } from '../data/users.js';
import { readJSON, writeJSON, removeItem } from './storage.js';

const SESSION_KEY = 'session';

export function getCurrentUser() {
  const session = readJSON(SESSION_KEY, null);
  return USERS.find((user) => user.id === session?.userId) ?? USERS[0];
}

export function signInAs(userId) {
  writeJSON(SESSION_KEY, { userId, since: new Date().toISOString() });
}

export function signOut() {
  removeItem(SESSION_KEY);
}
