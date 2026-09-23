/**
 * SHIFT_KASIR (ER-D §3): shift dibuka di halaman Kasir dengan modal awal
 * (flow 4.1 langkah B–C). Satu shift aktif per perangkat, berlaku hari itu.
 */

import { isSameDay, toDateKey } from './dates.js';
import { readJSON, writeJSON } from './storage.js';

const SHIFT_KEY = 'pos:shift';

/** Shift milik pengguna ini yang dibuka hari ini, atau null */
export function getOpenShift(user) {
  const shift = readJSON(SHIFT_KEY, null);
  if (!shift || shift.kasir !== user.id || !isSameDay(new Date(shift.waktu_buka), new Date())) return null;
  return shift;
}

export function openShift(user, modalAwal) {
  const now = new Date();
  const shift = {
    id: `SHIFT-${toDateKey(now)}-${user.id}`,
    kasir: user.id,
    waktu_buka: now.toISOString(),
    modal_awal: modalAwal,
  };
  return writeJSON(SHIFT_KEY, shift) ? shift : null;
}
