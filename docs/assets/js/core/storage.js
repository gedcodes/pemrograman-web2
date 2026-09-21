/**
 * Pembungkus localStorage. Semua akses dibungkus try/catch karena storage
 * bisa diblokir (mode privat, pengaturan browser); aplikasi harus tetap jalan.
 */

const PREFIX = 'sa-pos:';

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* storage tidak tersedia — tidak ada yang perlu dihapus */
  }
}
