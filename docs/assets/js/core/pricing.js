/**
 * Perhitungan harga — dipakai bersama oleh Kasir, riwayat, dan laporan
 * agar angka di semua halaman selalu sama.
 *
 *   subtotal  = Σ harga_satuan × qty
 *   diskon    = subtotal × tarif diskon (member)
 *   DPP       = subtotal − diskon
 *   pajak     = DPP × tarif PPN
 *   total     = DPP + pajak
 */

export function calculateTotals(lines, { discountRate = 0, taxRate = 0 } = {}) {
  const subtotal = lines.reduce((sum, line) => sum + line.harga_satuan * line.qty, 0);
  const diskon = Math.round(subtotal * discountRate);
  const dpp = subtotal - diskon;
  const pajak = Math.round(dpp * taxRate);
  return { subtotal, diskon, pajak, total: dpp + pajak };
}

/** Margin kotor terhadap harga jual: (jual − beli) ÷ jual */
export function marginOnPrice(hargaBeli, hargaJual) {
  return hargaJual > 0 ? (hargaJual - hargaBeli) / hargaJual : 0;
}

/** Markup terhadap harga beli: (jual − beli) ÷ beli */
export function markupOnCost(hargaBeli, hargaJual) {
  return hargaBeli > 0 ? (hargaJual - hargaBeli) / hargaBeli : 0;
}
