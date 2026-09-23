/**
 * Pesan sekali tampil yang dibawa ke halaman berikutnya, mis. toast
 * "Produk tersimpan" setelah form mengarahkan kembali ke daftar produk.
 */

const FLASH_KEY = 'sa-pos:flash';

export function setFlash(toast) {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify(toast));
  } catch {
    /* sessionStorage tidak tersedia — pesan dilewati */
  }
}

export function consumeFlash() {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
