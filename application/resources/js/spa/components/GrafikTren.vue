<script setup lang="ts">
import { useElementSize } from '@vueuse/core';
import { computed, ref, useId } from 'vue';
import type { TitikTren } from '../api/types';
import { angka, rupiah } from '../composables/format';

/**
 * Tren pendapatan: grafik area satu deret (SVG).
 *
 * Mengikuti skill dataviz: garis 2px, arsiran 10%, garis bantu tipis tanpa
 * putus-putus, sumbu Y berangka bulat, satu label langsung (titik tertinggi)
 * alih-alih angka di setiap titik, dan crosshair + tooltip yang juga dapat
 * dijelajahi dengan tombol panah. Satu deret tidak butuh kotak legenda: judul
 * kartu sudah menyebut isinya. Nilai lengkap tetap ada di tabel di bawahnya.
 *
 * Warna deret #00897b lolos validator palet (lightness, chroma, kontras 3:1
 * terhadap permukaan kartu); teal-600 merek gagal di chroma (terbaca abu-abu).
 */
const props = defineProps<{
    titik: TitikTren[];
    satuan: 'hari' | 'bulan';
}>();

const TINGGI_PLOT = 220;
const PITA_X = 28; // pita label sumbu-x, ikut dihitung dalam tinggi wadah
const KIRI = 56;
const KANAN = 16;
const ATAS = 28; // ruang untuk label titik tertinggi

const wadah = ref<HTMLElement | null>(null);
const { width } = useElementSize(wadah);
const lebar = computed(() => Math.max(280, Math.round(width.value)));
const lebarPlot = computed(() => lebar.value - KIRI - KANAN);

/* ------------------------------------------------------------ skala Y */

/** Batas atas "bulat" dan jarak garis bantu: 1, 2, 2,5, atau 5 × 10^n. */
const skalaY = computed(() => {
    const maks = Math.max(0, ...props.titik.map((t) => t.total));
    if (maks === 0) return { atas: 1_000_000, langkah: 250_000 };
    const kasar = maks / 4;
    const pangkat = 10 ** Math.floor(Math.log10(kasar));
    const langkah =
        [1, 2, 2.5, 5, 10].map((k) => k * pangkat).find((s) => s >= kasar) ??
        10 * pangkat;
    return { atas: Math.ceil(maks / langkah) * langkah, langkah };
});

const garisY = computed(() => {
    const { atas, langkah } = skalaY.value;
    const hasil: number[] = [];
    for (let v = 0; v <= atas + 1e-6; v += langkah) hasil.push(v);
    return hasil;
});

const ringkas = new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

const y = (v: number) =>
    ATAS + TINGGI_PLOT - (v / skalaY.value.atas) * TINGGI_PLOT;

const x = (i: number) =>
    props.titik.length <= 1
        ? KIRI + lebarPlot.value / 2
        : KIRI + (i / (props.titik.length - 1)) * lebarPlot.value;

/* ------------------------------------------------------------- bentuk */

const garis = computed(() =>
    props.titik
        .map(
            (t, i) =>
                `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(t.total).toFixed(1)}`,
        )
        .join(' '),
);

const area = computed(() => {
    if (props.titik.length === 0) return '';
    const dasar = y(0).toFixed(1);
    const akhir = x(props.titik.length - 1).toFixed(1);
    return `${garis.value} L${akhir},${dasar} L${x(0).toFixed(1)},${dasar} Z`;
});

/* ------------------------------------------------------------- label */

const fmtHari = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
});
const fmtHariPanjang = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});
const fmtBulan = new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    year: 'numeric',
});
const fmtBulanPanjang = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
});

/** "2026-09-17" dibaca sebagai tanggal SETEMPAT, bukan UTC. */
const keTanggal = (s: string) => {
    const [th, bl, hr] = s.split('-').map(Number);
    return new Date(th, bl - 1, hr);
};

const labelPendek = (t: TitikTren) =>
    (props.satuan === 'bulan' ? fmtBulan : fmtHari).format(keTanggal(t.mulai));
const labelPanjang = (t: TitikTren) =>
    (props.satuan === 'bulan' ? fmtBulanPanjang : fmtHariPanjang).format(
        keTanggal(t.mulai),
    );

/** Label sumbu-x dijarangkan supaya berjarak ≥ 64px dan tidak bertumpuk. */
const labelX = computed(() => {
    const n = props.titik.length;
    if (n === 0) return [];
    const muat = Math.max(1, Math.floor(lebarPlot.value / 64));
    const langkah = Math.max(1, Math.ceil(n / muat));
    return props.titik
        .map((t, i) => ({ i, teks: labelPendek(t) }))
        .filter(({ i }) => i % langkah === 0);
});

/* Label yang jatuh di tepi kanan plot dirata-kanankan: bila tetap di
   tengah, separuhnya keluar dari wadah dan terpotong. */
const jangkarX = (i: number) => (x(i) + 32 > lebar.value ? 'end' : 'middle');

/** Satu-satunya label langsung: titik tertinggi. */
const puncak = computed(() => {
    let terbaik = -1;
    props.titik.forEach((t, i) => {
        if (
            t.total > 0 &&
            (terbaik < 0 || t.total > props.titik[terbaik].total)
        )
            terbaik = i;
    });
    return terbaik;
});

const kosong = computed(() => props.titik.every((t) => t.total === 0));

/* ------------------------------------------------ crosshair & tooltip */

const aktif = ref<number | null>(null);

function dariPointer(e: PointerEvent) {
    const kotak = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - kotak.left;
    const n = props.titik.length;
    if (n === 0) return;
    const i =
        n === 1 ? 0 : Math.round(((px - KIRI) / lebarPlot.value) * (n - 1));
    aktif.value = Math.min(n - 1, Math.max(0, i));
}

function padaTombol(e: KeyboardEvent) {
    const n = props.titik.length;
    if (n === 0) return;
    const sekarang = aktif.value ?? (e.key === 'ArrowLeft' ? n : -1);
    const ke: Record<string, number> = {
        ArrowRight: sekarang + 1,
        ArrowLeft: sekarang - 1,
        Home: 0,
        End: n - 1,
    };
    if (!(e.key in ke)) return;
    e.preventDefault();
    aktif.value = Math.min(n - 1, Math.max(0, ke[e.key]));
}

const titikAktif = computed(() =>
    aktif.value === null ? null : props.titik[aktif.value],
);

/** Tooltip berpindah ke kiri crosshair di separuh kanan grafik. */
const posisiTooltip = computed(() => {
    if (aktif.value === null) return {};
    const px = x(aktif.value);
    return px > lebar.value / 2
        ? { right: `${lebar.value - px + 12}px` }
        : { left: `${px + 12}px` };
});

const idPetunjuk = `grafik-${useId()}`;
</script>

<template>
    <div
        ref="wadah"
        class="grafik"
        :style="{ height: `${ATAS + TINGGI_PLOT + PITA_X}px` }"
    >
        <!-- Di atas SVG: sr-only berposisi absolut, dan di bawah plot ia
             akan menjulur 1px keluar dari wadah yang tingginya pas. -->
        <p :id="idPetunjuk" class="sr-only">
            Nilai setiap {{ props.satuan }} juga tersedia di tabel rincian di
            bawah grafik.
        </p>
        <svg
            :width="lebar"
            :height="ATAS + TINGGI_PLOT + PITA_X"
            class="grafik-svg"
            role="group"
            tabindex="0"
            :aria-label="`Grafik tren pendapatan ${props.satuan === 'bulan' ? 'per bulan' : 'per hari'}. Gunakan panah kiri dan kanan untuk membaca setiap titik.`"
            :aria-describedby="idPetunjuk"
            @pointermove="dariPointer"
            @pointerleave="aktif = null"
            @blur="aktif = null"
            @keydown="padaTombol"
        >
            <!-- garis bantu & label sumbu-y: tipis, tanpa putus-putus -->
            <g class="sumbu">
                <g v-for="v in garisY" :key="v">
                    <line
                        :x1="KIRI"
                        :x2="lebar - KANAN"
                        :y1="y(v)"
                        :y2="y(v)"
                    />
                    <text
                        :x="KIRI - 8"
                        :y="y(v)"
                        text-anchor="end"
                        dominant-baseline="middle"
                    >
                        {{ v === 0 ? '0' : ringkas.format(v) }}
                    </text>
                </g>
                <text
                    v-for="l in labelX"
                    :key="l.i"
                    :x="x(l.i)"
                    :y="ATAS + TINGGI_PLOT + 18"
                    :text-anchor="jangkarX(l.i)"
                >
                    {{ l.teks }}
                </text>
            </g>

            <path v-if="!kosong" class="deret-area" :d="area" />
            <path v-if="!kosong" class="deret-garis" :d="garis" />

            <!-- label langsung: hanya titik tertinggi -->
            <g v-if="puncak >= 0 && aktif === null" class="puncak">
                <circle
                    :cx="x(puncak)"
                    :cy="y(props.titik[puncak].total)"
                    r="4"
                />
                <text
                    :x="
                        Math.min(
                            Math.max(x(puncak), KIRI + 60),
                            lebar - KANAN - 60,
                        )
                    "
                    :y="y(props.titik[puncak].total) - 12"
                    text-anchor="middle"
                >
                    Tertinggi {{ rupiah(props.titik[puncak].total) }}
                </text>
            </g>

            <!-- crosshair -->
            <g v-if="titikAktif && aktif !== null" class="silang">
                <line
                    :x1="x(aktif)"
                    :x2="x(aktif)"
                    :y1="ATAS"
                    :y2="ATAS + TINGGI_PLOT"
                />
                <circle :cx="x(aktif)" :cy="y(titikAktif.total)" r="5" />
            </g>

            <!-- area sentuh: seluruh plot, supaya pembaca membidik tanggal,
                 bukan garis 2px -->
            <rect
                class="sentuh"
                :x="KIRI"
                :y="ATAS"
                :width="lebarPlot"
                :height="TINGGI_PLOT"
            />
        </svg>

        <p v-if="kosong" class="grafik-kosong">
            Tidak ada penjualan pada periode ini.
        </p>

        <div
            v-if="titikAktif"
            class="tooltip"
            :style="posisiTooltip"
            role="status"
            aria-live="polite"
        >
            <strong class="num">{{ rupiah(titikAktif.total) }}</strong>
            <span>{{ angka(titikAktif.jumlah_transaksi) }} transaksi</span>
            <span class="tooltip-tanggal">{{ labelPanjang(titikAktif) }}</span>
        </div>
    </div>
</template>

<style scoped>
.grafik {
    --deret: #00897b;
    position: relative;
    width: 100%;
    /* Wadah menampung tinggi plot + pita sumbu-x: tidak ada gulir bertingkat. */
    overflow: hidden;
}

.grafik-svg {
    display: block;
    touch-action: pan-y;
}

.grafik-svg:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--radius-sm);
}

.sumbu line {
    stroke: var(--divider);
    stroke-width: 1;
    shape-rendering: crispEdges;
}

.sumbu text {
    font: var(--text-caption);
    fill: var(--text-muted);
    font-variant-numeric: tabular-nums;
}

.deret-area {
    fill: var(--deret);
    opacity: 0.1;
}

.deret-garis {
    fill: none;
    stroke: var(--deret);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
}

.puncak circle,
.silang circle {
    fill: var(--deret);
    stroke: var(--surface-raised);
    stroke-width: 2;
}

.puncak text {
    font: var(--text-caption);
    font-weight: 600;
    fill: var(--text-primary);
    font-variant-numeric: tabular-nums;
}

.silang line {
    stroke: var(--text-muted);
    stroke-width: 1;
    shape-rendering: crispEdges;
}

.sentuh {
    fill: transparent;
    cursor: crosshair;
}

.grafik-kosong {
    position: absolute;
    inset: 0 0 28px 56px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    font: var(--text-small);
    pointer-events: none;
}

.tooltip {
    position: absolute;
    top: 8px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 150px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--surface-canvas);
    box-shadow:
        0 6px 18px rgb(11 43 39 / 0.14),
        0 0 0 1px var(--divider);
    font: var(--text-caption);
    color: var(--text-secondary);
    pointer-events: none;
}

.tooltip strong {
    font: var(--text-body-strong);
    color: var(--text-primary);
}

.tooltip-tanggal {
    color: var(--text-muted);
}
</style>
