<script setup lang="ts">
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Clock,
    Maximize,
    Minimize,
    Minus,
    Package,
    Plus,
    Search,
    ShoppingCart,
    Lock,
    Trash2,
    Volume2,
    VolumeX,
} from '@lucide/vue';
import { useFullscreen, useNow, useWakeLock } from '@vueuse/core';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { angka, gambarProduk, rupiah } from '../composables/format';
import { bunyiAktif } from '../composables/useBunyi';
import { useKasir } from '../composables/useKasir';
import { auth } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseSelect from '../components/BaseSelect.vue';
import InputQty from '../components/InputQty.vue';
import StokBadge from '../components/StokBadge.vue';
import ToastHost from '../components/ToastHost.vue';
import KasirGerbangShift from '../components/kasir/KasirGerbangShift.vue';
import KasirModalBayar from '../components/kasir/KasirModalBayar.vue';
import KasirModalMenunggu from '../components/kasir/KasirModalMenunggu.vue';
import KasirModalStruk from '../components/kasir/KasirModalStruk.vue';
import KasirModalTutupShift from '../components/kasir/KasirModalTutupShift.vue';

/**
 * Kasir Mode Tablet.
 *
 * Aturan berjualannya SAMA dengan Kasir desktop (`useKasir`); yang berbeda
 * hanya penataannya untuk layar sentuh:
 *
 * - tanpa sidebar, memakai seluruh layar, dengan tombol layar penuh;
 * - kategori berupa tab yang dapat digeser, bukan kotak pilihan;
 * - kartu produk dan tombol jumlah berukuran jari (minimal 44 px);
 * - nominal tunai diisi lewat papan angka layar, bukan papan ketik sistem;
 * - saat tablet tegak, keranjang pindah ke lembar bawah dan yang tersisa
 *   di layar hanya bilah ringkas berisi jumlah item, total, dan Bayar;
 * - layar dijaga tetap menyala selama mode ini terbuka.
 */
const kasir = useKasir(toast);

const kotakCari = ref<HTMLInputElement | null>(null);

/** Lembar keranjang (tablet tegak). */
const lembarTerbuka = ref(false);

const {
    isFullscreen: layarPenuh,
    isSupported: layarPenuhDidukung,
    toggle: alihLayarPenuh,
    exit: keluarLayarPenuh,
} = useFullscreen();

/* Layar tablet kasir tidak boleh padam di tengah melayani pelanggan. */
const kunciLayar = useWakeLock();

const sekarang = useNow({ interval: 30_000 });
const jamSekarang = computed(() =>
    sekarang.value.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    }),
);

const tabKategori = computed(() => [
    { id: null as number | null, label: 'Semua' },
    ...kasir.kategori.map((k) => ({ id: k.id, label: k.nama_kategori })),
]);

const keranjangKosong = computed(() => kasir.keranjang.length === 0);

/* Keranjang yang kembali kosong (transaksi selesai) menutup lembarnya. */
watch(keranjangKosong, (kosong) => {
    if (kosong) lembarTerbuka.value = false;
});

function bayar() {
    lembarTerbuka.value = false;
    kasir.bukaBayar();
}

/* Tablet dengan papan ketik atau pemindai Bluetooth tetap dapat memakai
   pintasan yang sama dengan mode desktop. */
function pintasan(e: KeyboardEvent) {
    if (e.key === 'F2') {
        e.preventDefault();
        if (!kasir.modalBayar) bayar();
    }
    if (e.key === 'F3') {
        e.preventDefault();
        kotakCari.value?.focus();
    }
}

onMounted(() => {
    document.addEventListener('keydown', pintasan);
    kasir.mulai();
    if (kunciLayar.isSupported.value) {
        kunciLayar.request('screen').catch(() => {
            // Peramban menolak (mis. baterai hemat); mode tablet tetap jalan.
        });
    }
});

onUnmounted(() => {
    document.removeEventListener('keydown', pintasan);
    void kunciLayar.release();
    if (layarPenuh.value) void keluarLayarPenuh();
});
</script>

<template>
    <div class="tablet">
        <header class="tablet-atas">
            <RouterLink
                :to="{ name: 'kasir' }"
                class="btn btn-soft tombol-kotak"
                aria-label="Keluar dari mode tablet"
                title="Keluar dari mode tablet"
            >
                <ArrowLeft :size="22" :stroke-width="1.75" aria-hidden="true" />
            </RouterLink>

            <div class="merek">
                <span class="merek-tanda" aria-hidden="true">SA</span>
                <div class="merek-teks">
                    <strong>Kasir · Mode Tablet</strong>
                    <small>{{ auth.user?.name }} · {{ jamSekarang }}</small>
                </div>
            </div>

            <label
                class="kotak-cari cari-tablet"
                :class="kasir.statusPindai && `pindai-${kasir.statusPindai}`"
            >
                <Search :size="20" :stroke-width="1.75" aria-hidden="true" />
                <span class="sr-only">Pindai barcode atau cari produk</span>
                <input
                    ref="kotakCari"
                    v-model="kasir.cari"
                    type="search"
                    placeholder="Pindai barcode atau cari produk…"
                    autocomplete="off"
                    enterkeyhint="search"
                    @keyup.enter="kasir.padaEnter()"
                />
            </label>

            <button
                v-if="kasir.menunggu.length > 0"
                type="button"
                class="btn btn-soft tombol-menunggu"
                @click="kasir.daftarMenungguTerbuka = true"
            >
                <Clock :size="20" :stroke-width="1.75" aria-hidden="true" />
                <span class="label-lebar">Menunggu bayar</span>
                <span class="hitungan">{{ kasir.menunggu.length }}</span>
            </button>

            <button
                type="button"
                class="btn btn-soft tombol-kotak"
                :aria-label="
                    bunyiAktif
                        ? 'Matikan bunyi pindai'
                        : 'Nyalakan bunyi pindai'
                "
                :aria-pressed="bunyiAktif"
                @click="bunyiAktif = !bunyiAktif"
            >
                <Volume2 v-if="bunyiAktif" :size="22" :stroke-width="1.75" />
                <VolumeX v-else :size="22" :stroke-width="1.75" />
            </button>

            <button
                v-if="kasir.shift"
                type="button"
                class="btn btn-soft tombol-tutup"
                @click="kasir.bukaTutupShift()"
            >
                <Lock :size="20" :stroke-width="1.75" aria-hidden="true" />
                <span class="label-lebar">Tutup Shift</span>
            </button>

            <button
                v-if="layarPenuhDidukung"
                type="button"
                class="btn btn-soft tombol-kotak"
                :aria-label="
                    layarPenuh ? 'Keluar dari layar penuh' : 'Layar penuh'
                "
                :aria-pressed="layarPenuh"
                @click="alihLayarPenuh()"
            >
                <Minimize
                    v-if="layarPenuh"
                    :size="22"
                    :stroke-width="1.75"
                    aria-hidden="true"
                />
                <Maximize
                    v-else
                    :size="22"
                    :stroke-width="1.75"
                    aria-hidden="true"
                />
            </button>
        </header>

        <div v-if="kasir.memuatShift" class="tablet-isi" aria-busy="true">
            <div class="tablet-produk">
                <div class="grid-tablet">
                    <div
                        v-for="i in 12"
                        :key="i"
                        class="skeleton"
                        style="height: 210px; border-radius: var(--radius-lg)"
                    />
                </div>
            </div>
        </div>

        <div v-else-if="kasir.shift === null" class="tablet-gerbang">
            <KasirGerbangShift besar />
        </div>

        <div v-else class="tablet-isi">
            <section class="tablet-produk" aria-label="Produk">
                <div
                    class="tab-kategori"
                    role="radiogroup"
                    aria-label="Saring kategori"
                >
                    <button
                        v-for="t in tabKategori"
                        :key="String(t.id)"
                        type="button"
                        role="radio"
                        class="chip"
                        :class="{ 'is-aktif': kasir.kategoriAktif === t.id }"
                        :aria-checked="kasir.kategoriAktif === t.id"
                        @click="kasir.kategoriAktif = t.id"
                    >
                        {{ t.label }}
                    </button>
                    <!-- Kerangka tab selama kategori dimuat, supaya barisnya
                         tidak melompat ketika tab sungguhan muncul. -->
                    <template v-if="kasir.memuatKategori">
                        <span
                            v-for="i in 4"
                            :key="`kerangka-${i}`"
                            class="skeleton chip-kerangka"
                            aria-hidden="true"
                        />
                    </template>
                </div>

                <div
                    v-if="kasir.memuatProduk && kasir.produk.length === 0"
                    class="grid-tablet"
                    aria-busy="true"
                >
                    <div
                        v-for="i in 12"
                        :key="i"
                        class="skeleton"
                        style="height: 210px; border-radius: var(--radius-lg)"
                    />
                </div>

                <div v-else-if="kasir.produk.length === 0" class="kosong">
                    <Package
                        :size="40"
                        :stroke-width="1.25"
                        aria-hidden="true"
                    />
                    <p>Tidak ada produk yang cocok.</p>
                </div>

                <div
                    v-else
                    class="grid-tablet"
                    :class="{ 'is-memuat': kasir.memuatProduk }"
                    :aria-busy="kasir.memuatProduk"
                >
                    <button
                        v-for="p in kasir.produk"
                        :key="p.id"
                        type="button"
                        class="ubin"
                        :class="{
                            'is-dipilih': kasir.qtyDiKeranjang(p.id) > 0,
                            'is-kilat': kasir.kilatProdukId === p.id,
                        }"
                        :disabled="p.stok <= 0"
                        :aria-label="`${p.nama_produk}, ${rupiah(p.harga_jual)}${kasir.qtyDiKeranjang(p.id) > 0 ? `, ${kasir.qtyDiKeranjang(p.id)} di keranjang` : ''}`"
                        @click="kasir.tambah(p)"
                    >
                        <span
                            v-if="kasir.qtyDiKeranjang(p.id) > 0"
                            class="ubin-qty"
                            aria-hidden="true"
                            >{{ kasir.qtyDiKeranjang(p.id) }}</span
                        >
                        <span class="ubin-gambar">
                            <img
                                v-if="p.gambar"
                                :src="gambarProduk(p.gambar) ?? ''"
                                alt=""
                                loading="lazy"
                            />
                            <Package
                                v-else
                                :size="36"
                                :stroke-width="1.25"
                                aria-hidden="true"
                            />
                        </span>
                        <span class="ubin-nama">{{ p.nama_produk }}</span>
                        <span class="ubin-kaki">
                            <span class="ubin-harga">{{
                                rupiah(p.harga_jual)
                            }}</span>
                            <StokBadge
                                :stok="p.stok"
                                :minimum="p.stok_minimum"
                            />
                        </span>
                    </button>
                </div>
            </section>

            <!-- Latar lembar keranjang (tablet tegak). -->
            <Transition name="pudar">
                <div
                    v-if="lembarTerbuka"
                    class="latar-lembar"
                    @click="lembarTerbuka = false"
                />
            </Transition>

            <aside
                class="tablet-keranjang"
                :class="{ 'is-terbuka': lembarTerbuka }"
                aria-label="Keranjang"
            >
                <div class="keranjang-kepala">
                    <h2>
                        Keranjang
                        <span class="caption">{{ kasir.jumlahItem }} item</span>
                    </h2>
                    <button
                        type="button"
                        class="btn btn-ghost"
                        :disabled="keranjangKosong"
                        @click="kasir.kosongkan()"
                    >
                        Kosongkan
                    </button>
                    <button
                        type="button"
                        class="btn btn-soft tombol-kotak tutup-lembar"
                        aria-label="Tutup keranjang"
                        @click="lembarTerbuka = false"
                    >
                        <ChevronDown
                            :size="22"
                            :stroke-width="1.75"
                            aria-hidden="true"
                        />
                    </button>
                </div>

                <div class="field pelanggan">
                    <label for="pelanggan-tablet">Pelanggan</label>
                    <BaseSelect
                        id="pelanggan-tablet"
                        v-model="kasir.pelangganId"
                        :opsi="[]"
                        :cari-server="kasir.cariPelanggan"
                        :cari="true"
                        label-kosong="Umum (tanpa diskon)"
                        placeholder="Cari nama atau no. HP…"
                    />
                </div>

                <div class="baris-list">
                    <div v-if="keranjangKosong" class="kosong">
                        <ShoppingCart
                            :size="36"
                            :stroke-width="1.25"
                            aria-hidden="true"
                        />
                        <p>Ketuk produk atau pindai barcode.</p>
                    </div>

                    <div
                        v-for="b in kasir.keranjang"
                        :key="b.product.id"
                        class="baris"
                        :class="{
                            'is-kilat': kasir.kilatProdukId === b.product.id,
                        }"
                    >
                        <div class="baris-info">
                            <p class="baris-nama">
                                {{ b.product.nama_produk }}
                            </p>
                            <p class="caption">
                                {{ rupiah(b.product.harga_jual) }} /
                                {{ b.product.unit?.simbol ?? 'pcs' }}
                            </p>
                        </div>
                        <div class="qty">
                            <button
                                type="button"
                                class="qty-btn"
                                :aria-label="`Kurangi ${b.product.nama_produk}`"
                                @click="kasir.ubahQty(b, b.qty - 1)"
                            >
                                <Trash2
                                    v-if="b.qty === 1"
                                    :size="18"
                                    :stroke-width="1.75"
                                />
                                <Minus v-else :size="18" :stroke-width="2" />
                            </button>
                            <InputQty
                                :nilai="b.qty"
                                :label="`Jumlah ${b.product.nama_produk}`"
                                besar
                                @ubah="(n) => kasir.ubahQty(b, n)"
                            />
                            <button
                                type="button"
                                class="qty-btn"
                                :aria-label="`Tambah ${b.product.nama_produk}`"
                                :disabled="b.qty >= b.product.stok"
                                @click="kasir.ubahQty(b, b.qty + 1)"
                            >
                                <Plus :size="18" :stroke-width="2" />
                            </button>
                        </div>
                        <p class="num baris-total">
                            {{ angka(b.qty * b.product.harga_jual) }}
                        </p>
                    </div>
                </div>

                <div class="ringkas">
                    <div class="row">
                        <span>Subtotal</span><span class="spacer" /><span
                            class="num"
                            >{{ angka(kasir.subtotal) }}</span
                        >
                    </div>
                    <div v-if="kasir.diskon > 0" class="row">
                        <span>Diskon member 5%</span
                        ><span class="spacer" /><span class="num"
                            >−{{ angka(kasir.diskon) }}</span
                        >
                    </div>
                    <div class="row">
                        <span>PPN 11%</span><span class="spacer" /><span
                            class="num"
                            >{{ angka(kasir.pajak) }}</span
                        >
                    </div>
                    <button
                        type="button"
                        class="btn btn-success btn-block tombol-bayar"
                        :disabled="keranjangKosong"
                        @click="bayar"
                    >
                        <span>Bayar</span>
                        <span class="num-hero"
                            ><span class="rp">Rp</span
                            >{{ angka(kasir.total) }}</span
                        >
                    </button>
                </div>
            </aside>

            <!-- Bilah ringkas di bawah layar (tablet tegak). -->
            <div class="bilah-bawah">
                <button
                    type="button"
                    class="bilah-keranjang"
                    :disabled="keranjangKosong"
                    :aria-expanded="lembarTerbuka"
                    @click="lembarTerbuka = true"
                >
                    <ShoppingCart
                        :size="22"
                        :stroke-width="1.75"
                        aria-hidden="true"
                    />
                    <span class="bilah-jumlah"
                        >{{ kasir.jumlahItem }} item</span
                    >
                    <strong class="bilah-total num">{{
                        rupiah(kasir.total)
                    }}</strong>
                    <ChevronUp
                        :size="20"
                        :stroke-width="1.75"
                        aria-hidden="true"
                    />
                </button>
                <button
                    type="button"
                    class="btn btn-success btn-lg"
                    :disabled="keranjangKosong"
                    @click="bayar"
                >
                    Bayar
                </button>
            </div>
        </div>

        <KasirModalBayar sentuh />
        <KasirModalMenunggu />
        <KasirModalStruk sentuh />
        <KasirModalTutupShift sentuh />
        <ToastHost />
    </div>
</template>

<style scoped>
.tablet {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-canvas);
    /* Ketukan cepat tidak memicu zoom ganda di peramban seluler. */
    touch-action: manipulation;
}

/* ---------------------------------------------------------------- atas */

.tablet-atas {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 76px;
    padding: var(--space-3) var(--space-5);
    background: var(--sidebar-bg);
    color: var(--sidebar-idle);
    box-shadow: var(--shadow-sidebar);
}

.tombol-kotak {
    width: 52px;
    min-height: 52px;
    padding: 0;
    flex: 0 0 52px;
}

.merek {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
}

.merek-tanda {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border-radius: var(--radius-sm);
    background: var(--teal-700);
    color: var(--text-on-dark);
    font: var(--text-h3);
}

.merek-teks {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    white-space: nowrap;
}

.merek-teks strong {
    color: var(--sidebar-active);
    font: var(--text-body-strong);
}

.merek-teks small {
    color: var(--sidebar-label);
    font: var(--text-caption);
}

.cari-tablet {
    flex: 1 1 280px;
    width: auto;
    min-height: 52px;
    margin-left: auto;
    max-width: 560px;
}

.tombol-tutup {
    min-height: 52px;
    white-space: nowrap;
}

.tombol-menunggu {
    min-height: 52px;
    color: var(--warning-text);
    white-space: nowrap;
}

.hitungan {
    display: grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--warning-bg);
    font: var(--text-caption);
}

/* ---------------------------------------------------------------- isi */

.tablet-isi {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr minmax(360px, 34vw);
}

.tablet-gerbang {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
}

.tablet-produk {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 var(--space-5) var(--space-8);
}

/* Tab kategori: tetap terlihat saat grid digulir, dan dapat digeser
   menyamping bila kategorinya banyak. */
.tab-kategori {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 calc(-1 * var(--space-5)) var(--space-4);
    padding: var(--space-4) var(--space-5);
    background: var(--surface-canvas);
}

.tab-kategori::-webkit-scrollbar {
    display: none;
}

.chip {
    flex: 0 0 auto;
    min-height: 48px;
    padding: 0 var(--space-5);
    border: 0;
    border-radius: var(--radius-pill);
    background: var(--surface-raised);
    box-shadow: var(--shadow-raised-sm);
    color: var(--text-secondary);
    font: var(--text-label);
    cursor: pointer;
    white-space: nowrap;
}

.chip-kerangka {
    flex: 0 0 96px;
    height: 48px;
    border-radius: var(--radius-pill);
}

.chip.is-aktif {
    background: var(--teal-700);
    color: var(--text-on-dark);
    box-shadow: var(--shadow-btn-primary);
}

.grid-tablet {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
    gap: var(--space-4);
}

.grid-tablet.is-memuat {
    opacity: 0.55;
    transition: opacity var(--dur-base) var(--ease);
}

.ubin {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    box-shadow: var(--shadow-raised-sm);
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
    user-select: none;
    transition:
        transform var(--dur-fast) var(--ease),
        border-color var(--dur-base) var(--ease);
}

.ubin:not(:disabled):active {
    transform: scale(0.96);
}

.ubin.is-dipilih {
    border-color: var(--teal-600);
}

.ubin:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.ubin-qty {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    z-index: 1;
    display: grid;
    place-items: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    border-radius: var(--radius-pill);
    background: var(--teal-700);
    color: var(--text-on-dark);
    font: var(--text-label);
    box-shadow: var(--shadow-btn-primary);
}

.ubin-gambar {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
    color: var(--text-muted);
    overflow: hidden;
}

.ubin-gambar img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.ubin-nama {
    font: var(--text-body);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 2.6em;
}

.ubin-kaki {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-1);
}

.ubin-harga {
    font: var(--text-body-strong);
    font-variant-numeric: tabular-nums;
}

.kosong {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    padding: var(--space-12) var(--space-4);
    color: var(--text-muted);
    text-align: center;
}

/* ------------------------------------------------------------ keranjang */

.tablet-keranjang {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--surface-raised);
    box-shadow: -8px 0 24px rgba(22, 48, 44, 0.08);
}

.keranjang-kepala {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-5) var(--space-3);
}

.keranjang-kepala h2 {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
}

.tutup-lembar {
    display: none;
}

.pelanggan {
    padding: 0 var(--space-5) var(--space-3);
}

.baris-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 var(--space-5);
}

.baris {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
        'info total'
        'qty qty';
    align-items: center;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--divider);
}

.baris-info {
    grid-area: info;
    min-width: 0;
}

.baris-nama {
    font: var(--text-body-strong);
}

.baris-total {
    grid-area: total;
    font: var(--text-body-strong);
}

.qty {
    grid-area: qty;
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.qty-btn {
    display: grid;
    place-items: center;
    width: 48px;
    height: 44px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--surface-base);
    box-shadow: var(--shadow-inset-sm);
    color: var(--text-primary);
    cursor: pointer;
}

.qty-btn:active {
    transform: scale(0.95);
}

.qty-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.qty-nilai {
    min-width: 40px;
    text-align: center;
    font: var(--text-h3);
}

.ringkas {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-5) var(--space-5);
    border-top: 1px solid var(--divider);
}

.tombol-bayar {
    justify-content: space-between;
    min-height: 68px;
    margin-top: var(--space-2);
    padding: 0 var(--space-6);
    font: var(--text-h3);
}

.tombol-bayar .rp {
    color: inherit;
    opacity: 0.8;
}

.tombol-bayar .num-hero {
    font-size: 1.6rem;
}

.bilah-bawah,
.latar-lembar {
    display: none;
}

.pudar-enter-active,
.pudar-leave-active {
    transition: opacity var(--dur-base) var(--ease);
}

.pudar-enter-from,
.pudar-leave-to {
    opacity: 0;
}

/* -------------------------------------------------- tablet tegak / sempit */

@media (orientation: portrait), (max-width: 899px) {
    .tablet-isi {
        display: flex;
        flex-direction: column;
    }

    .tablet-produk {
        flex: 1;
    }

    /* Keranjang menjadi lembar yang naik dari bawah. */
    .tablet-keranjang {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 45;
        max-height: 88dvh;
        border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
        box-shadow: 0 -12px 40px rgba(6, 64, 59, 0.25);
        transform: translateY(105%);
        transition: transform var(--dur-slow) var(--ease);
    }

    .tablet-keranjang.is-terbuka {
        transform: translateY(0);
    }

    .tutup-lembar {
        display: inline-flex;
    }

    .latar-lembar {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 44;
        background: rgba(11, 43, 39, 0.45);
    }

    .bilah-bawah {
        display: flex;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4)
            calc(var(--space-3) + env(safe-area-inset-bottom));
        background: var(--surface-raised);
        box-shadow: 0 -8px 24px rgba(22, 48, 44, 0.12);
    }

    .bilah-keranjang {
        flex: 1;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-height: 56px;
        padding: 0 var(--space-4);
        border: 0;
        border-radius: var(--radius-md);
        background: var(--surface-base);
        box-shadow: var(--shadow-inset-sm);
        color: var(--text-primary);
        cursor: pointer;
    }

    .bilah-keranjang:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .bilah-jumlah {
        color: var(--text-secondary);
    }

    .bilah-total {
        margin-left: auto;
        font: var(--text-h3);
    }

    .bilah-bawah .btn-success {
        min-width: 120px;
    }
}

/* Tablet tegak: kepala dipadatkan supaya kotak cari tetap lega. Nama kasir
   dan label "Menunggu bayar" disembunyikan; ikon dan angkanya tetap ada. */
@media (max-width: 1023px) {
    .merek-teks,
    .label-lebar {
        display: none;
    }
}

@media (max-width: 699px) {
    .tablet-atas {
        padding: var(--space-2) var(--space-3);
    }
}
</style>
