<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ambil, ApiError, simpan } from '../api/client';
import type {
    BarisKeranjang,
    Customer,
    MidtransConfig,
    Product,
    Shift,
    Transaction,
} from '../api/types';
import { angka, gambarProduk, rupiah } from '../composables/format';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import StokBadge from '../components/StokBadge.vue';

/* ------------------------------------------------------------------ shift */

const shift = ref<Shift | null>(null);
const modalAwal = ref(300000);
const membukaShift = ref(false);

async function muatShift() {
    shift.value = await ambil<Shift | null>('/shifts/aktif');
}

async function bukaShift() {
    membukaShift.value = true;
    try {
        const r = await simpan<Shift>('/shifts/open', {
            modal_awal: modalAwal.value,
        });
        shift.value = r.data;
        toast.sukses('Shift dibuka.');
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal membuka shift.');
    } finally {
        membukaShift.value = false;
    }
}

/* ---------------------------------------------------------------- produk */

const produk = ref<Product[]>([]);
const cari = ref('');
const memuatProduk = ref(true);
const kotakCari = ref<HTMLInputElement | null>(null);

async function muatProduk() {
    memuatProduk.value = true;
    try {
        produk.value = await ambil<Product[]>('/products', {
            per_page: 100,
            aktif: 1,
            q: cari.value || undefined,
        });
    } finally {
        memuatProduk.value = false;
    }
}

/**
 * Pemindaian barcode.
 *
 * Pemindai barcode berperilaku seperti papan ketik lalu menekan Enter, jadi
 * Enter pada kotak cari diperlakukan sebagai hasil pindaian: cari persis
 * dulu lewat endpoint barcode, dan baru jatuh ke pencarian biasa bila gagal.
 */
async function padaEnter() {
    const kode = cari.value.trim();
    if (kode === '') return;

    try {
        const p = await ambil<Product>(
            `/products/barcode/${encodeURIComponent(kode)}`,
        );
        tambah(p);
        cari.value = '';
        await muatProduk();
    } catch {
        await muatProduk();
        if (produk.value.length === 1) {
            tambah(produk.value[0]);
            cari.value = '';
            await muatProduk();
        } else if (produk.value.length === 0) {
            toast.peringatan('Produk tidak ditemukan.');
        }
    }
}

/* -------------------------------------------------------------- keranjang */

const keranjang = ref<BarisKeranjang[]>([]);
const pelangganId = ref<number | null>(null);
const pelanggan = ref<Customer[]>([]);

function tambah(p: Product) {
    const ada = keranjang.value.find((b) => b.product.id === p.id);
    const qtyBaru = (ada?.qty ?? 0) + 1;

    if (qtyBaru > p.stok) {
        toast.peringatan(`Stok ${p.nama_produk} hanya ${p.stok}.`);
        return;
    }

    if (ada) ada.qty = qtyBaru;
    else keranjang.value.push({ product: p, qty: 1 });
}

function ubahQty(baris: BarisKeranjang, qty: number) {
    if (qty <= 0) {
        hapusBaris(baris);
        return;
    }
    if (qty > baris.product.stok) {
        toast.peringatan(
            `Stok ${baris.product.nama_produk} hanya ${baris.product.stok}.`,
        );
        return;
    }
    baris.qty = qty;
}

function hapusBaris(baris: BarisKeranjang) {
    keranjang.value = keranjang.value.filter((b) => b !== baris);
}

function kosongkan() {
    keranjang.value = [];
    pelangganId.value = null;
}

/* Total dihitung ulang di server; angka di sini hanya pratinjau bagi kasir. */
const subtotal = computed(() =>
    keranjang.value.reduce((s, b) => s + b.qty * b.product.harga_jual, 0),
);
const diskon = computed(() =>
    pelangganId.value !== null ? Math.round(subtotal.value * 0.05) : 0,
);
const pajak = computed(() =>
    Math.round((subtotal.value - diskon.value) * 0.11),
);
const total = computed(() => subtotal.value - diskon.value + pajak.value);

/* ------------------------------------------------------------- pembayaran */

const modalBayar = ref(false);
const metode = ref<'tunai' | 'non_tunai'>('tunai');
const uangDiterima = ref<number>(0);
const memproses = ref(false);
const strukTerakhir = ref<Transaction | null>(null);
const konfigMidtrans = ref<MidtransConfig | null>(null);

const kembalian = computed(() => Math.max(0, uangDiterima.value - total.value));
const cukup = computed(
    () => metode.value !== 'tunai' || uangDiterima.value >= total.value,
);

/** Pecahan uang yang sering diserahkan pelanggan. */
const pecahan = computed(() => {
    const t = total.value;
    const bulat = (n: number) => Math.ceil(t / n) * n;
    return [
        ...new Set([t, bulat(5000), bulat(10000), bulat(50000), bulat(100000)]),
    ];
});

function bukaBayar() {
    if (keranjang.value.length === 0) {
        toast.peringatan('Keranjang masih kosong.');
        return;
    }
    if (shift.value === null) {
        toast.peringatan('Buka shift terlebih dahulu.');
        return;
    }
    uangDiterima.value = total.value;
    modalBayar.value = true;
}

async function bayar() {
    memproses.value = true;
    try {
        const r = await simpan<Transaction>('/transactions', {
            metode: metode.value,
            customer_id: pelangganId.value,
            jumlah_bayar:
                metode.value === 'tunai' ? uangDiterima.value : undefined,
            items: keranjang.value.map((b) => ({
                product_id: b.product.id,
                qty: b.qty,
            })),
        });

        if (metode.value === 'tunai') {
            selesai(r.data, 'Transaksi tersimpan.');
        } else {
            await bayarSnap(r.data);
        }
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal menyimpan transaksi.',
        );
    } finally {
        memproses.value = false;
    }
}

/** Muat snap.js sekali, memakai Client Key dari server. */
async function muatSnap(): Promise<boolean> {
    if (konfigMidtrans.value === null) {
        konfigMidtrans.value = await ambil<MidtransConfig>('/midtrans/config');
    }
    const cfg = konfigMidtrans.value;
    if (!cfg.siap) return false;

    if (document.getElementById('midtrans-snap')) return true;

    return new Promise((resolve) => {
        const s = document.createElement('script');
        s.id = 'midtrans-snap';
        s.src = cfg.snap_url;
        s.setAttribute('data-client-key', cfg.client_key);
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
    });
}

interface SnapGlobal {
    pay(token: string, opsi: Record<string, (hasil?: unknown) => void>): void;
}

async function bayarSnap(trx: Transaction) {
    const siap = await muatSnap();
    if (!siap) {
        toast.peringatan(
            'Pembayaran non-tunai belum aktif. Transaksi tersimpan sebagai menunggu pembayaran.',
        );
        selesai(trx, null);
        return;
    }

    let token: string;
    try {
        const r = await simpan<{ snap_token: string }>(
            `/transactions/${trx.id}/snap-token`,
        );
        token = r.data.snap_token;
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal membuat Snap Token.',
        );
        return;
    }

    const snap = (window as unknown as { snap?: SnapGlobal }).snap;
    if (!snap) return;

    // Keempat callback ditangani. Status akhir tetap ditentukan webhook,
    // karena callback di browser dapat dimanipulasi.
    snap.pay(token, {
        onSuccess: () => selesai(trx, 'Pembayaran diterima.'),
        onPending: () => selesai(trx, 'Pembayaran menunggu penyelesaian.'),
        onError: () => toast.galat('Pembayaran gagal.'),
        onClose: () =>
            toast.peringatan(
                'Pembayaran dibatalkan. Transaksi menunggu di Riwayat Transaksi.',
            ),
    });
}

function cetak() {
    window.print();
}

function selesai(trx: Transaction, pesan: string | null) {
    strukTerakhir.value = trx;
    modalBayar.value = false;
    kosongkan();
    void muatProduk();
    if (pesan) toast.sukses(pesan);
}

/* --------------------------------------------------------------- pintasan */

function pintasan(e: KeyboardEvent) {
    // F2 = Bayar (PERANCANGAN Bagian 4.1).
    if (e.key === 'F2') {
        e.preventDefault();
        if (!modalBayar.value) bukaBayar();
    }
    // F3 memindahkan fokus ke kotak pindai.
    if (e.key === 'F3') {
        e.preventDefault();
        kotakCari.value?.focus();
    }
}

onMounted(async () => {
    document.addEventListener('keydown', pintasan);
    await Promise.all([muatShift(), muatProduk()]);
    pelanggan.value = await ambil<Customer[]>('/customers', { per_page: 100 });
});

onUnmounted(() => document.removeEventListener('keydown', pintasan));
</script>

<template>
    <!-- Shift wajib dibuka lebih dulu (alur Bagian 4.1 langkah B-C). -->
    <div v-if="shift === null" class="card gerbang">
        <h2>Buka shift dahulu</h2>
        <p class="muted">Masukkan modal awal laci kas untuk mulai berjualan.</p>
        <div class="field" style="max-width: 260px">
            <label for="modal">Modal awal</label>
            <input
                id="modal"
                v-model.number="modalAwal"
                type="number"
                min="0"
                class="input"
            />
        </div>
        <button
            class="btn btn-primary"
            :disabled="membukaShift"
            @click="bukaShift"
        >
            {{ membukaShift ? 'Membuka…' : 'Buka Shift' }}
        </button>
    </div>

    <!-- Dua zona: grid produk di kiri, keranjang di kanan (DESIGN.md Bagian 8.2). -->
    <div v-else class="kasir">
        <section class="zona-produk">
            <div class="cari-bar">
                <input
                    ref="kotakCari"
                    v-model="cari"
                    class="input"
                    type="search"
                    placeholder="Pindai barcode atau ketik nama produk… (F3)"
                    @keyup.enter="padaEnter"
                    @input="muatProduk"
                />
            </div>

            <div v-if="memuatProduk" class="grid-produk">
                <div
                    v-for="i in 8"
                    :key="i"
                    class="skeleton"
                    style="height: 170px"
                />
            </div>

            <div
                v-else-if="produk.length === 0"
                class="center"
                style="padding: var(--space-12)"
            >
                <p class="muted">Tidak ada produk yang cocok.</p>
            </div>

            <div v-else class="grid-produk">
                <button
                    v-for="p in produk"
                    :key="p.id"
                    class="kartu-produk"
                    :disabled="p.stok <= 0"
                    @click="tambah(p)"
                >
                    <div class="thumb">
                        <img
                            v-if="p.gambar"
                            :src="gambarProduk(p.gambar) ?? ''"
                            :alt="p.nama_produk"
                            loading="lazy"
                        />
                        <span v-else class="thumb-kosong" aria-hidden="true"
                            >📦</span
                        >
                    </div>
                    <p class="nama">{{ p.nama_produk }}</p>
                    <p class="harga num">{{ rupiah(p.harga_jual) }}</p>
                    <StokBadge :stok="p.stok" :minimum="p.stok_minimum" />
                </button>
            </div>
        </section>

        <aside class="zona-keranjang">
            <div class="keranjang-kepala">
                <h2>Keranjang</h2>
                <button
                    class="btn btn-ghost btn-sm"
                    :disabled="keranjang.length === 0"
                    @click="kosongkan"
                >
                    Kosongkan
                </button>
            </div>

            <div class="field" style="padding: 0 var(--space-5)">
                <label for="pelanggan">Pelanggan</label>
                <select id="pelanggan" v-model="pelangganId" class="select">
                    <option :value="null">Umum (tanpa diskon)</option>
                    <option v-for="c in pelanggan" :key="c.id" :value="c.id">
                        {{ c.nama }}
                    </option>
                </select>
            </div>

            <div class="baris-list">
                <p
                    v-if="keranjang.length === 0"
                    class="muted center"
                    style="padding: var(--space-8)"
                >
                    Pindai atau pilih produk untuk memulai.
                </p>

                <div v-for="b in keranjang" :key="b.product.id" class="baris">
                    <div class="baris-info">
                        <p class="baris-nama">{{ b.product.nama_produk }}</p>
                        <p class="caption">
                            {{ rupiah(b.product.harga_jual) }} /
                            {{ b.product.unit?.simbol ?? 'pcs' }}
                        </p>
                    </div>
                    <div class="qty">
                        <button
                            class="qty-btn"
                            aria-label="Kurangi"
                            @click="ubahQty(b, b.qty - 1)"
                        >
                            −
                        </button>
                        <span class="num qty-nilai">{{ b.qty }}</span>
                        <button
                            class="qty-btn"
                            aria-label="Tambah"
                            @click="ubahQty(b, b.qty + 1)"
                        >
                            +
                        </button>
                    </div>
                    <p class="num baris-total">
                        {{ angka(b.qty * b.product.harga_jual) }}
                    </p>
                    <button
                        class="btn btn-ghost btn-sm"
                        aria-label="Hapus"
                        @click="hapusBaris(b)"
                    >
                        ×
                    </button>
                </div>
            </div>

            <div class="ringkas">
                <div class="row">
                    <span>Subtotal</span><span class="spacer" /><span
                        class="num"
                        >{{ angka(subtotal) }}</span
                    >
                </div>
                <div v-if="diskon > 0" class="row">
                    <span>Diskon member 5%</span><span class="spacer" /><span
                        class="num"
                        >−{{ angka(diskon) }}</span
                    >
                </div>
                <div class="row">
                    <span>PPN 11%</span><span class="spacer" /><span
                        class="num"
                        >{{ angka(pajak) }}</span
                    >
                </div>
                <div class="row total-baris">
                    <span>Total</span><span class="spacer" />
                    <span class="num-hero"
                        ><span class="rp">Rp</span>{{ angka(total) }}</span
                    >
                </div>

                <button
                    class="btn btn-success btn-lg btn-block"
                    :disabled="keranjang.length === 0"
                    @click="bukaBayar"
                >
                    BAYAR · F2
                </button>
            </div>
        </aside>
    </div>

    <!-- Modal pembayaran dua metode (DESIGN.md Bagian 8.3). -->
    <BaseModal v-if="modalBayar" judul="Pembayaran" @tutup="modalBayar = false">
        <div class="stack">
            <div class="row metode-pilih">
                <button
                    class="btn"
                    :class="metode === 'tunai' ? 'btn-primary' : 'btn-soft'"
                    @click="metode = 'tunai'"
                >
                    Tunai
                </button>
                <button
                    class="btn"
                    :class="metode === 'non_tunai' ? 'btn-primary' : 'btn-soft'"
                    @click="metode = 'non_tunai'"
                >
                    Non-Tunai (QRIS / GoPay / VA)
                </button>
            </div>

            <div class="total-modal">
                <span class="overline">Total belanja</span>
                <span class="num-hero"
                    ><span class="rp">Rp</span>{{ angka(total) }}</span
                >
            </div>

            <template v-if="metode === 'tunai'">
                <div class="field">
                    <label for="uang">Uang diterima</label>
                    <input
                        id="uang"
                        v-model.number="uangDiterima"
                        type="number"
                        min="0"
                        class="input"
                    />
                    <p v-if="!cukup" class="field-error">
                        Nominal kurang dari total belanja.
                    </p>
                </div>

                <div class="row row-wrap">
                    <button
                        v-for="n in pecahan"
                        :key="n"
                        class="btn btn-soft btn-sm"
                        @click="uangDiterima = n"
                    >
                        {{ angka(n) }}
                    </button>
                </div>

                <div class="row kembali">
                    <span>Kembalian</span><span class="spacer" />
                    <span class="num kembali-nilai">{{
                        angka(kembalian)
                    }}</span>
                </div>
            </template>

            <p v-else class="muted">
                Popup Midtrans akan terbuka. Pelanggan memilih sendiri QRIS,
                GoPay, Virtual Account, atau kartu. Status lunas ditentukan
                notifikasi dari Midtrans, bukan oleh tampilan di layar ini.
            </p>
        </div>

        <template #aksi>
            <button class="btn btn-soft" @click="modalBayar = false">
                Batal
            </button>
            <button
                class="btn btn-success"
                :disabled="!cukup || memproses"
                @click="bayar"
            >
                {{ memproses ? 'Memproses…' : 'Konfirmasi' }}
            </button>
        </template>
    </BaseModal>

    <!-- Struk siap cetak. -->
    <BaseModal
        v-if="strukTerakhir"
        judul="Struk"
        lebar="380px"
        @tutup="strukTerakhir = null"
    >
        <div class="struk">
            <div class="struk-kepala">
                <strong>Toko Sari Amerta</strong>
                <p class="caption">{{ strukTerakhir.no_struk }}</p>
            </div>
            <table class="struk-item">
                <tr v-for="i in strukTerakhir.items ?? []" :key="i.id">
                    <td>
                        {{ i.nama_produk }}<br /><span class="caption"
                            >{{ i.qty }} × {{ angka(i.harga_satuan) }}</span
                        >
                    </td>
                    <td class="num">{{ angka(i.subtotal) }}</td>
                </tr>
            </table>
            <div class="struk-total">
                <div class="row">
                    <span>Subtotal</span><span class="spacer" /><span
                        class="num"
                        >{{ angka(strukTerakhir.subtotal) }}</span
                    >
                </div>
                <div v-if="strukTerakhir.diskon > 0" class="row">
                    <span>Diskon</span><span class="spacer" /><span class="num"
                        >−{{ angka(strukTerakhir.diskon) }}</span
                    >
                </div>
                <div class="row">
                    <span>PPN</span><span class="spacer" /><span class="num">{{
                        angka(strukTerakhir.pajak)
                    }}</span>
                </div>
                <div class="row total-baris">
                    <span>Total</span><span class="spacer" /><span
                        class="num"
                        >{{ angka(strukTerakhir.total) }}</span
                    >
                </div>
                <div v-if="strukTerakhir.payment" class="row">
                    <span>Kembalian</span><span class="spacer" /><span
                        class="num"
                        >{{ angka(strukTerakhir.payment.kembalian) }}</span
                    >
                </div>
            </div>
        </div>

        <template #aksi>
            <button class="btn btn-soft" @click="strukTerakhir = null">
                Tutup
            </button>
            <button class="btn btn-neutral" @click="cetak">Cetak</button>
        </template>
    </BaseModal>
</template>

<style scoped>
.gerbang {
    max-width: 480px;
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
}

.kasir {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: var(--space-5);
    align-items: start;
}

/* ---------------------------------------------------------------- produk */

.cari-bar {
    margin-bottom: var(--space-5);
}

.grid-produk {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-4);
}

.kartu-produk {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--surface-raised);
    border: 0;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-raised-sm);
    cursor: pointer;
    text-align: left;
    transition:
        transform var(--dur-fast) var(--ease),
        box-shadow var(--dur-base) var(--ease);
}

.kartu-produk:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-raised-md);
}

.kartu-produk:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.thumb {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-xs);
    background: var(--surface-sunken);
    display: grid;
    place-items: center;
    overflow: hidden;
}

.thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.thumb-kosong {
    font-size: 1.75rem;
    opacity: 0.4;
}

.nama {
    font: var(--text-small);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.harga {
    font: var(--text-body-strong);
    text-align: left;
}

/* ------------------------------------------------------------- keranjang */

.zona-keranjang {
    position: sticky;
    top: calc(var(--topbar-h) + var(--space-4));
    display: flex;
    flex-direction: column;
    background: var(--surface-raised);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-raised-md);
    max-height: calc(100dvh - var(--topbar-h) - var(--space-8));
}

.keranjang-kepala {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-5);
}

.baris-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4) var(--space-5);
}

.baris {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--divider);
}

.baris-info {
    flex: 1;
    min-width: 0;
}

.baris-nama {
    font: var(--text-small);
}

.qty {
    display: flex;
    align-items: center;
    gap: var(--space-1);
}

.qty-btn {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--radius-xs);
    background: var(--surface-base);
    box-shadow: var(--shadow-inset-sm);
    cursor: pointer;
}

.qty-nilai {
    min-width: 28px;
    text-align: center;
}

.baris-total {
    min-width: 72px;
}

.ringkas {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-5);
    border-top: 1px solid var(--divider);
}

.total-baris {
    font: var(--text-body-strong);
    padding-top: var(--space-2);
    margin-bottom: var(--space-2);
}

/* ------------------------------------------------------------- pembayaran */

.metode-pilih {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
}

.total-modal {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    background: var(--surface-base);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-inset-sm);
}

.kembali {
    padding-top: var(--space-2);
    border-top: 1px solid var(--divider);
    font: var(--text-body-strong);
}

.kembali-nilai {
    color: var(--success-text);
    font: var(--text-h3);
    font-variant-numeric: tabular-nums;
}

/* ------------------------------------------------------------------ struk */

.struk {
    font: var(--text-small);
}

.struk-kepala {
    text-align: center;
    padding-bottom: var(--space-3);
    border-bottom: 1px dashed var(--divider);
}

.struk-item {
    width: 100%;
    margin: var(--space-3) 0;
}

.struk-item td {
    padding: var(--space-1) 0;
    vertical-align: top;
}

.struk-total {
    padding-top: var(--space-3);
    border-top: 1px dashed var(--divider);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

/* ------------------------------------------------------------- responsif */

@media (max-width: 1023px) {
    .kasir {
        grid-template-columns: 1fr;
    }

    /* Keranjang jadi panel biasa di bawah grid, bukan kolom melayang. */
    .zona-keranjang {
        position: static;
        max-height: none;
    }
}
</style>
