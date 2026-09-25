<script setup lang="ts">
import {
    Clock,
    Lock,
    Minus,
    Package,
    Plus,
    Search,
    Tablet,
    Volume2,
    VolumeX,
    X,
} from '@lucide/vue';
import { useMediaQuery } from '@vueuse/core';
import { onMounted, onUnmounted, ref } from 'vue';
import { angka, rupiah } from '../composables/format';
import { bunyiAktif } from '../composables/useBunyi';
import { useKasir } from '../composables/useKasir';
import { toast } from '../stores/toast';
import BaseSelect from '../components/BaseSelect.vue';
import InputQty from '../components/InputQty.vue';
import StokBadge from '../components/StokBadge.vue';
import KasirGerbangShift from '../components/kasir/KasirGerbangShift.vue';
import KasirModalBayar from '../components/kasir/KasirModalBayar.vue';
import KasirModalMenunggu from '../components/kasir/KasirModalMenunggu.vue';
import KasirModalStruk from '../components/kasir/KasirModalStruk.vue';
import KasirModalTutupShift from '../components/kasir/KasirModalTutupShift.vue';

/**
 * Kasir mode desktop. Seluruh aturan berjualan ada di `useKasir`, dipakai
 * bersama Mode Tablet; halaman ini hanya menata tampilannya.
 */
const kasir = useKasir(toast);

const kotakCari = ref<HTMLInputElement | null>(null);

/* Di perangkat berlayar sentuh, tombol Mode Tablet ditonjolkan. */
const layarSentuh = useMediaQuery('(pointer: coarse)');

function pintasan(e: KeyboardEvent) {
    // F2 = Bayar (PERANCANGAN Bagian 4.1).
    if (e.key === 'F2') {
        e.preventDefault();
        if (!kasir.modalBayar) kasir.bukaBayar();
    }
    // F3, atau "/" seperti pada prototipe, memindahkan fokus ke kotak pindai.
    // "/" diabaikan saat kursor sedang di dalam isian lain.
    const sedangMengetik =
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea, [contenteditable="true"]') !== null;
    if (e.key === 'F3' || (e.key === '/' && !sedangMengetik)) {
        e.preventDefault();
        kotakCari.value?.focus();
    }
}

onMounted(() => {
    document.addEventListener('keydown', pintasan);
    kasir.mulai();
});

onUnmounted(() => document.removeEventListener('keydown', pintasan));
</script>

<template>
    <!-- Menunggu jawaban server soal shift: kerangka dua zona, bukan kedipan
         gerbang "Buka shift" yang lalu menghilang. -->
    <div v-if="kasir.memuatShift" class="kasir" aria-busy="true">
        <div class="grid-produk">
            <div
                v-for="i in 8"
                :key="i"
                class="skeleton"
                style="height: 190px; border-radius: var(--radius-lg)"
            />
        </div>
        <div
            class="skeleton"
            style="height: 420px; border-radius: var(--radius-xl)"
        />
    </div>

    <KasirGerbangShift v-else-if="kasir.shift === null" />

    <!-- Dua zona: grid produk di kiri, keranjang di kanan (DESIGN.md Bagian 8.2). -->
    <div v-else class="kasir">
        <section class="zona-produk">
            <div class="alat-atas">
                <label
                    class="kotak-cari cari-bar"
                    :class="
                        kasir.statusPindai && `pindai-${kasir.statusPindai}`
                    "
                >
                    <Search
                        :size="20"
                        :stroke-width="1.75"
                        aria-hidden="true"
                    />
                    <span class="sr-only">Pindai barcode atau cari produk</span>
                    <input
                        ref="kotakCari"
                        v-model="kasir.cari"
                        type="search"
                        placeholder="Pindai barcode atau ketik nama produk…"
                        autocomplete="off"
                        @keyup.enter="kasir.padaEnter()"
                    />
                    <kbd class="petunjuk-tombol" aria-hidden="true">F3</kbd>
                </label>

                <!-- Tagihan non-tunai hari ini yang belum lunas: tempat
                     membuka lagi QRIS / VA yang popup-nya sempat ditutup. -->
                <button
                    v-if="kasir.menunggu.length > 0"
                    type="button"
                    class="btn btn-soft tombol-menunggu"
                    @click="kasir.daftarMenungguTerbuka = true"
                >
                    <Clock :size="18" :stroke-width="1.75" aria-hidden="true" />
                    Menunggu bayar
                    <span class="hitungan">{{ kasir.menunggu.length }}</span>
                </button>

                <RouterLink
                    :to="{ name: 'kasir-tablet' }"
                    class="btn"
                    :class="layarSentuh ? 'btn-primary' : 'btn-soft'"
                    title="Tampilan kasir layar penuh dengan tombol besar untuk tablet"
                >
                    <Tablet
                        :size="18"
                        :stroke-width="1.75"
                        aria-hidden="true"
                    />
                    Mode Tablet
                </RouterLink>

                <button
                    type="button"
                    class="btn btn-ghost btn-ikon"
                    :aria-label="
                        bunyiAktif
                            ? 'Matikan bunyi pindai'
                            : 'Nyalakan bunyi pindai'
                    "
                    :aria-pressed="bunyiAktif"
                    :title="
                        bunyiAktif
                            ? 'Bunyi pindai: nyala'
                            : 'Bunyi pindai: mati'
                    "
                    @click="bunyiAktif = !bunyiAktif"
                >
                    <Volume2
                        v-if="bunyiAktif"
                        :size="18"
                        :stroke-width="1.75"
                    />
                    <VolumeX v-else :size="18" :stroke-width="1.75" />
                </button>

                <button
                    type="button"
                    class="btn btn-ghost"
                    title="Hitung laci dan tutup shift"
                    @click="kasir.bukaTutupShift()"
                >
                    <Lock :size="18" :stroke-width="1.75" aria-hidden="true" />
                    Tutup Shift
                </button>
            </div>

            <div
                v-if="kasir.memuatProduk && kasir.produk.length === 0"
                class="grid-produk"
                aria-busy="true"
            >
                <div
                    v-for="i in 8"
                    :key="i"
                    class="skeleton"
                    style="height: 190px; border-radius: var(--radius-lg)"
                />
            </div>

            <div
                v-else-if="kasir.produk.length === 0"
                class="center"
                style="padding: var(--space-12)"
            >
                <p class="muted">Tidak ada produk yang cocok.</p>
            </div>

            <div
                v-else
                class="grid-produk"
                :class="{ 'is-memuat': kasir.memuatProduk }"
                :aria-busy="kasir.memuatProduk"
            >
                <button
                    v-for="p in kasir.produk"
                    :key="p.id"
                    class="kartu-produk"
                    :disabled="p.stok <= 0"
                    @click="kasir.tambah(p)"
                >
                    <div class="thumb">
                        <img
                            v-if="p.gambar_url"
                            :src="p.gambar_url"
                            :alt="p.nama_produk"
                            loading="lazy"
                        />
                        <Package
                            v-else
                            class="thumb-kosong"
                            :size="32"
                            :stroke-width="1.25"
                            aria-hidden="true"
                        />
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
                    :disabled="kasir.keranjang.length === 0"
                    @click="kasir.kosongkan()"
                >
                    Kosongkan
                </button>
            </div>

            <div class="field" style="padding: 0 var(--space-5)">
                <label for="pelanggan">Pelanggan</label>
                <BaseSelect
                    id="pelanggan"
                    v-model="kasir.pelangganId"
                    :opsi="[]"
                    :cari-server="kasir.cariPelanggan"
                    :cari="true"
                    label-kosong="Umum (tanpa diskon)"
                    placeholder="Cari nama atau no. HP…"
                />
            </div>

            <div class="baris-list">
                <p
                    v-if="kasir.keranjang.length === 0"
                    class="muted center"
                    style="padding: var(--space-8)"
                >
                    Pindai atau pilih produk untuk memulai.
                </p>

                <div
                    v-for="b in kasir.keranjang"
                    :key="b.product.id"
                    class="baris"
                    :class="{
                        'is-kilat': kasir.kilatProdukId === b.product.id,
                    }"
                >
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
                            :aria-label="`Kurangi ${b.product.nama_produk}`"
                            @click="kasir.ubahQty(b, b.qty - 1)"
                        >
                            <Minus :size="14" :stroke-width="2" />
                        </button>
                        <InputQty
                            :nilai="b.qty"
                            :label="`Jumlah ${b.product.nama_produk}`"
                            @ubah="(n) => kasir.ubahQty(b, n)"
                        />
                        <button
                            class="qty-btn"
                            :aria-label="`Tambah ${b.product.nama_produk}`"
                            :disabled="b.qty >= b.product.stok"
                            @click="kasir.ubahQty(b, b.qty + 1)"
                        >
                            <Plus :size="14" :stroke-width="2" />
                        </button>
                    </div>
                    <p class="num baris-total">
                        {{ angka(b.qty * b.product.harga_jual) }}
                    </p>
                    <button
                        class="btn btn-ghost btn-sm btn-ikon"
                        :aria-label="`Hapus ${b.product.nama_produk}`"
                        @click="kasir.hapusBaris(b)"
                    >
                        <X :size="16" :stroke-width="1.75" />
                    </button>
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
                    <span>{{ kasir.labelDiskon }}</span
                    ><span class="spacer" /><span class="num"
                        >−{{ angka(kasir.diskon) }}</span
                    >
                </div>
                <div v-if="kasir.adaPajak" class="row">
                    <span>{{ kasir.labelPajak }}</span
                    ><span class="spacer" /><span class="num">{{
                        angka(kasir.pajak)
                    }}</span>
                </div>
                <div class="row total-baris">
                    <span>Total</span><span class="spacer" />
                    <span class="num-hero"
                        ><span class="rp">Rp</span
                        >{{ angka(kasir.total) }}</span
                    >
                </div>

                <button
                    class="btn btn-success btn-lg btn-block"
                    :disabled="kasir.keranjang.length === 0"
                    @click="kasir.bukaBayar()"
                >
                    BAYAR · F2
                </button>
            </div>
        </aside>
    </div>

    <KasirModalBayar />
    <KasirModalMenunggu />
    <KasirModalStruk />
    <KasirModalTutupShift />
</template>

<style scoped>
.kasir {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: var(--space-5);
    align-items: start;
}

/* ---------------------------------------------------------------- produk */

.alat-atas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
}

.cari-bar {
    flex: 1 1 280px;
    width: auto;
}

.tombol-menunggu {
    color: var(--warning-text);
}

.hitungan {
    display: grid;
    place-items: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--warning-bg);
    font: var(--text-caption);
}

.petunjuk-tombol {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--surface-raised);
    box-shadow: var(--shadow-raised-sm);
    font: var(--text-caption);
    color: var(--text-secondary);
}

/* Hasil pencarian baru sedang dimuat: grid lama diredupkan, bukan dikosongkan. */
.grid-produk.is-memuat {
    opacity: 0.55;
    transition: opacity var(--dur-base) var(--ease);
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
    color: var(--text-muted);
    opacity: 0.6;
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
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--radius-xs);
    background: var(--surface-base);
    box-shadow: var(--shadow-inset-sm);
    color: var(--text-primary);
    cursor: pointer;
}

.qty-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
