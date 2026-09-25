<script setup lang="ts">
import { ListPlus, Printer, Trash2, TriangleAlert } from '@lucide/vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ambil, ApiError, simpan } from '../api/client';
import type { Product } from '../api/types';
import { angka, rupiah } from '../composables/format';
import type { OpsiPilihan } from '../composables/pilihan';
import { toko } from '../stores/toko';
import { toast } from '../stores/toast';
import BarcodeSvg from '../components/BarcodeSvg.vue';
import BaseSelect from '../components/BaseSelect.vue';
import BaseSwitch from '../components/BaseSwitch.vue';
import InputQty from '../components/InputQty.vue';

/**
 * Cetak label barcode untuk ditempel di produk atau rak.
 *
 * Dua ukuran kertas:
 * - A4 berisi 21 label 63,5 × 38,1 mm (3 × 7), ukuran lembar stiker yang umum
 *   dijual. Margin halaman diatur supaya baris ke-8 tidak pernah terpotong,
 *   sehingga halaman kedua dan seterusnya tetap pas dengan lembar stiker.
 *   Di kertas biasa, label dapat digunting mengikuti garis putus-putus.
 * - Printer label thermal 50 × 30 mm, satu label per halaman.
 *
 * Yang dicetak hanyalah `.lembar`; seluruh pengaturan bertanda `no-print`.
 */

interface Baris {
    produk: Product;
    jumlah: number;
}

type Ukuran = 'a4' | 'thermal';

const UKURAN: Record<Ukuran, { label: string; halaman: string }> = {
    a4: {
        label: 'A4 · 21 label (63,5 × 38,1 mm)',
        // 7 baris × 38,1 mm = 266,7 mm + 2 × 15,1 mm = 296,9 mm ≤ 297 mm.
        halaman: '@page { size: A4; margin: 15.1mm 7.2mm; }',
    },
    thermal: {
        label: 'Printer label thermal (50 × 30 mm)',
        halaman: '@page { size: 50mm 30mm; margin: 0; }',
    },
};

/** Batas wajar supaya pratinjau tidak membekukan browser. */
const MAKS_LABEL = 1000;

const route = useRoute();

const daftar = ref<Baris[]>([]);
const ukuran = ref<Ukuran>('a4');
const tampilkanHarga = ref(true);
const tampilkanToko = ref(true);
const memuat = ref(false);

/* ------------------------------------------------------ memilih produk */

const pilihan = ref<number | null>(null);
const produkDikenal = new Map<number, Product>();

async function cariProduk(kata: string): Promise<OpsiPilihan<number>[]> {
    const hasil = await ambil<Product[]>('/products', {
        q: kata || undefined,
        aktif: 1,
        per_page: 20,
    });
    for (const p of hasil) produkDikenal.set(p.id, p);
    return hasil.map((p) => ({
        nilai: p.id,
        label: p.nama_produk,
        keterangan: `${p.barcode ?? 'tanpa barcode'} · ${rupiah(p.harga_jual)}`,
        gambar: p.gambar_url,
    }));
}

function tambahProduk(p: Product, jumlah = 1) {
    const ada = daftar.value.find((b) => b.produk.id === p.id);
    if (ada) ada.jumlah += jumlah;
    else daftar.value.push({ produk: p, jumlah });
}

watch(pilihan, (id) => {
    if (id === null) return;
    const p = produkDikenal.get(id);
    if (p) tambahProduk(p);
    pilihan.value = null;
});

const menambahSemua = ref(false);

async function tambahSemua() {
    menambahSemua.value = true;
    try {
        const semua = await ambil<Product[]>('/products', {
            aktif: 1,
            per_page: 200,
        });
        for (const p of semua) {
            if (!daftar.value.some((b) => b.produk.id === p.id))
                tambahProduk(p);
        }
        toast.info(`${semua.length} produk aktif ada di daftar.`);
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal memuat produk.');
    } finally {
        menambahSemua.value = false;
    }
}

function ubahJumlah(b: Baris, n: number | null) {
    if (n === null || !Number.isFinite(n) || n < 1) {
        daftar.value = daftar.value.filter((x) => x !== b);
        return;
    }
    b.jumlah = Math.min(Math.floor(n), MAKS_LABEL);
}

/* ------------------------------------------- produk tanpa barcode */

const tanpaBarcode = computed(() =>
    daftar.value.filter((b) => !b.produk.barcode),
);
const membuatBarcode = ref(false);

async function buatBarcode() {
    membuatBarcode.value = true;
    try {
        const ids = tanpaBarcode.value.map((b) => b.produk.id);
        const r = await simpan<{ jumlah: number }>(
            '/products/barcode-otomatis',
            { ids },
        );
        // Muat ulang produk yang baru diberi barcode.
        const baru = await Promise.all(
            ids.map((id) => ambil<Product>(`/products/${id}`)),
        );
        for (const p of baru) {
            const b = daftar.value.find((x) => x.produk.id === p.id);
            if (b) b.produk = p;
        }
        toast.sukses(r.message ?? 'Barcode dibuat.');
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal membuat barcode.',
        );
    } finally {
        membuatBarcode.value = false;
    }
}

/* -------------------------------------------------------------- label */

const labels = computed(() => {
    const hasil: { kunci: string; produk: Product }[] = [];
    for (const b of daftar.value) {
        if (!b.produk.barcode) continue;
        for (let i = 0; i < b.jumlah && hasil.length < MAKS_LABEL; i++) {
            hasil.push({ kunci: `${b.produk.id}-${i}`, produk: b.produk });
        }
    }
    return hasil;
});

const jumlahLabel = computed(() =>
    daftar.value
        .filter((b) => b.produk.barcode)
        .reduce((s, b) => s + b.jumlah, 0),
);
const terpotong = computed(() => jumlahLabel.value > MAKS_LABEL);
const jumlahLembar = computed(() =>
    ukuran.value === 'a4'
        ? Math.ceil(labels.value.length / 21)
        : labels.value.length,
);

/* ---------------------------------------------------------------- cetak */

/* Aturan @page tidak dapat dibatasi ke satu komponen, jadi disisipkan ke
   <head> selama halaman ini terbuka dan diganti saat ukuran berubah. */
const gayaHalaman = document.createElement('style');
gayaHalaman.dataset.cetakLabel = '';

watch(
    ukuran,
    (u) => {
        gayaHalaman.textContent = `@media print { ${UKURAN[u].halaman} }`;
    },
    { immediate: true },
);

function cetak() {
    if (labels.value.length === 0) {
        toast.peringatan('Belum ada label untuk dicetak.');
        return;
    }
    window.print();
}

onMounted(async () => {
    document.head.append(gayaHalaman);

    const q = route.query.produk;
    const ids = (Array.isArray(q) ? q : [q])
        .flatMap((x) => String(x ?? '').split(','))
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) return;

    memuat.value = true;
    try {
        const produk = await Promise.all(
            ids.map((id) => ambil<Product>(`/products/${id}`)),
        );
        for (const p of produk) tambahProduk(p);
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal memuat produk.');
    } finally {
        memuat.value = false;
    }
});

onUnmounted(() => gayaHalaman.remove());
</script>

<template>
    <div class="tata no-print">
        <!-- ================================================ pengaturan -->
        <section class="card stack">
            <h2>Produk yang dicetak</h2>

            <div class="pemilih">
                <BaseSelect
                    v-model="pilihan"
                    :opsi="[]"
                    :cari-server="cariProduk"
                    :cari="true"
                    placeholder="Cari nama atau barcode produk…"
                    aria-label="Tambah produk ke daftar label"
                />
                <button
                    class="btn btn-soft"
                    :disabled="menambahSemua"
                    :aria-busy="menambahSemua"
                    @click="tambahSemua"
                >
                    <ListPlus :size="18" aria-hidden="true" />
                    Semua produk aktif
                </button>
            </div>

            <div
                v-if="tanpaBarcode.length > 0"
                class="peringatan"
                role="status"
            >
                <TriangleAlert :size="18" aria-hidden="true" />
                <p>
                    {{ tanpaBarcode.length }} produk belum punya barcode dan
                    tidak ikut tercetak.
                </p>
                <span class="spacer" />
                <button
                    class="btn btn-soft btn-sm"
                    :disabled="membuatBarcode"
                    :aria-busy="membuatBarcode"
                    @click="buatBarcode"
                >
                    {{ membuatBarcode ? 'Membuat…' : 'Buat barcode' }}
                </button>
            </div>

            <p v-if="memuat" class="caption">Memuat produk…</p>
            <p v-else-if="daftar.length === 0" class="kosong caption">
                Belum ada produk. Cari produk di atas, atau pilih
                <strong>Semua produk aktif</strong>.
            </p>

            <ul v-else class="daftar-label">
                <li v-for="b in daftar" :key="b.produk.id">
                    <div class="daftar-nama">
                        <strong>{{ b.produk.nama_produk }}</strong>
                        <span class="caption">
                            {{ b.produk.barcode ?? 'tanpa barcode' }} ·
                            {{ rupiah(b.produk.harga_jual) }}
                        </span>
                    </div>
                    <InputQty
                        :nilai="b.jumlah"
                        :label="`Jumlah label ${b.produk.nama_produk}`"
                        @ubah="ubahJumlah(b, $event)"
                    />
                    <button
                        class="btn btn-ghost btn-sm btn-ikon"
                        :aria-label="`Keluarkan ${b.produk.nama_produk}`"
                        @click="daftar = daftar.filter((x) => x !== b)"
                    >
                        <Trash2 :size="16" aria-hidden="true" />
                    </button>
                </li>
            </ul>
        </section>

        <section class="card stack samping">
            <h2>Kertas &amp; isi label</h2>

            <fieldset class="pilihan-ukuran">
                <legend class="sr-only">Ukuran label</legend>
                <label
                    v-for="(u, kunci) in UKURAN"
                    :key="kunci"
                    class="opsi-ukuran"
                    :class="{ 'is-aktif': ukuran === kunci }"
                >
                    <input v-model="ukuran" type="radio" :value="kunci" />
                    {{ u.label }}
                </label>
            </fieldset>

            <BaseSwitch v-model="tampilkanToko">Nama toko</BaseSwitch>
            <BaseSwitch v-model="tampilkanHarga">Harga jual</BaseSwitch>

            <div class="ringkas">
                <span>Label</span><span class="spacer" /><strong class="num">{{
                    angka(labels.length)
                }}</strong>
            </div>
            <div class="ringkas">
                <span>{{
                    ukuran === 'a4' ? 'Lembar A4' : 'Label thermal'
                }}</span
                ><span class="spacer" /><strong class="num">{{
                    angka(jumlahLembar)
                }}</strong>
            </div>
            <p v-if="terpotong" class="caption galat-teks">
                Dibatasi {{ angka(MAKS_LABEL) }} label per cetak.
            </p>

            <button
                class="btn btn-primary btn-block"
                :disabled="labels.length === 0"
                @click="cetak"
            >
                <Printer :size="18" aria-hidden="true" />
                Cetak {{ angka(labels.length) }} label
            </button>
            <p class="caption">
                Di jendela cetak, pilih skala <strong>100%</strong> (bukan
                "Sesuaikan dengan halaman") dan matikan header/footer, supaya
                ukuran label tepat.
            </p>
        </section>
    </div>

    <!-- ===================================================== lembar -->
    <h2 v-if="labels.length > 0" class="judul-pratinjau no-print">Pratinjau</h2>
    <div v-if="labels.length > 0" class="gulir-pratinjau">
        <div class="lembar" :class="`lembar-${ukuran}`">
            <div v-for="l in labels" :key="l.kunci" class="label">
                <span v-if="tampilkanToko" class="label-toko">{{
                    toko.publik.nama_toko
                }}</span>
                <span class="label-nama">{{ l.produk.nama_produk }}</span>
                <BarcodeSvg
                    class="label-barcode"
                    :kode="l.produk.barcode ?? ''"
                    :tinggi="50"
                />
                <span v-if="tampilkanHarga" class="label-harga">{{
                    rupiah(l.produk.harga_jual)
                }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.tata {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-5);
    align-items: start;
    margin-bottom: var(--space-5);
}

.pemilih {
    display: flex;
    gap: var(--space-2);
}

.pemilih > :first-child {
    flex: 1;
    min-width: 0;
}

.peringatan {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--warning-bg);
    color: var(--warning-text);
    font: var(--text-small);
}

.kosong {
    padding: var(--space-5);
    text-align: center;
    border-radius: var(--radius-md);
    background: var(--surface-base);
}

.daftar-label {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 420px;
    overflow-y: auto;
    margin: 0;
    padding: 0;
    list-style: none;
}

.daftar-label li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-base);
}

.daftar-nama {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.daftar-nama strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.samping {
    position: sticky;
    top: calc(var(--topbar-h) + var(--space-4));
}

.pilihan-ukuran {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
}

.opsi-ukuran {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-base);
    font: var(--text-small);
    cursor: pointer;
}

.opsi-ukuran.is-aktif {
    box-shadow: 0 0 0 2px var(--teal-600, var(--teal-700));
}

.ringkas {
    display: flex;
    font: var(--text-small);
}

.galat-teks {
    color: var(--danger-text);
}

.judul-pratinjau {
    margin-bottom: var(--space-3);
}

/* ------------------------------------------------------------ lembar */

/* Di layar: tampil seukuran aslinya (mm) di atas "kertas" putih, dengan
   gulir sendiri supaya tidak melebarkan halaman di layar sempit. */
.gulir-pratinjau {
    overflow-x: auto;
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--surface-sunken);
}

.lembar {
    margin-inline: auto;
    background: #fff;
    color: #000;
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.12);
}

.lembar-a4 {
    display: grid;
    grid-template-columns: repeat(3, 63.5mm);
    grid-auto-rows: 38.1mm;
    column-gap: 2.5mm;
    width: 210mm;
    padding: 15.1mm 7.2mm;
}

.lembar-thermal {
    display: flex;
    flex-wrap: wrap;
    gap: 4mm;
    width: fit-content;
    max-width: 216mm;
    padding: 4mm;
    background: transparent;
    box-shadow: none;
}

.label {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6mm;
    overflow: hidden;
    padding: 1.8mm 2.5mm;
    text-align: center;
    break-inside: avoid;
    font-family: var(--font-body);
    line-height: 1.15;
}

.lembar-a4 .label {
    outline: 0.2mm dashed #b8c4c1;
    outline-offset: -0.1mm;
}

.lembar-thermal .label {
    width: 50mm;
    height: 30mm;
    background: #fff;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
}

.label-toko {
    font-size: 6pt;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #333;
}

.label-nama {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    max-width: 100%;
    overflow: hidden;
    font-size: 7.5pt;
    font-weight: 600;
}

.lembar-thermal .label-nama {
    -webkit-line-clamp: 1;
}

.label-barcode {
    width: 100%;
}

.label-barcode :deep(svg) {
    width: auto;
    max-width: 100%;
    height: 15mm;
    margin-inline: auto;
}

.lembar-thermal .label-barcode :deep(svg) {
    height: 13mm;
}

.label-harga {
    font-size: 9pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

@media (max-width: 1023px) {
    .tata {
        grid-template-columns: 1fr;
    }

    .samping {
        position: static;
    }
}

@media (max-width: 767px) {
    .pemilih {
        flex-direction: column;
    }
}

/* ------------------------------------------------------------- cetak */

@media print {
    .gulir-pratinjau {
        overflow: visible;
        padding: 0;
        background: none;
    }

    .lembar {
        margin: 0;
        box-shadow: none;
    }

    /* Margin halaman sudah diatur @page (disisipkan skrip). */
    .lembar-a4 {
        width: auto;
        padding: 0;
    }

    .lembar-thermal {
        display: block;
        padding: 0;
    }

    .lembar-thermal .label {
        box-shadow: none;
        break-after: page;
    }

    .lembar-thermal .label:last-child {
        break-after: auto;
    }
}
</style>

<!-- Tidak di-scope: saat mencetak, pembungkus aplikasi (AppLayout) harus
     kehilangan padding dan tinggi minimalnya. Tanpa ini label pertama
     terdorong ±8,5 mm ke bawah -- meleset dari kotak lembar stiker -- dan
     printer thermal membuang stiker kosong di awal dan akhir. -->
<style>
@media print {
    body:has(.lembar) :is(.shell, .utama, .konten, .halaman) {
        display: block !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
    }
}
</style>
