<script setup lang="ts" generic="T extends string | number">
import { Check, ChevronDown, Package, Search } from '@lucide/vue';
import {
    ComboboxAnchor,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxItemIndicator,
    ComboboxPortal,
    ComboboxRoot,
    ComboboxTrigger,
    ComboboxViewport,
    SelectContent,
    SelectIcon,
    SelectItem,
    SelectItemIndicator,
    SelectItemText,
    SelectPortal,
    SelectRoot,
    SelectTrigger,
    SelectValue,
    SelectViewport,
} from 'reka-ui';
import { useDebounceFn } from '@vueuse/core';
import { computed, reactive, ref, watch } from 'vue';
import type { OpsiPilihan } from '../composables/pilihan';

/**
 * Pengganti <select> bawaan, dibangun di atas primitif reka-ui.
 *
 * Dua mode dengan satu API:
 * - Daftar pendek (≤ 7 opsi, mis. Peran, Status) memakai Select biasa:
 *   klik lalu pilih, tanpa kotak cari yang tidak dibutuhkan.
 * - Daftar panjang (Produk, Supplier, Transaksi) otomatis memakai Combobox:
 *   ketik untuk menyaring label maupun keterangannya (mis. barcode).
 *   Paksa salah satu mode lewat prop `cari`.
 *
 * Nilai `null` berarti "belum dipilih". Bila `labelKosong` diisi, pilihan
 * kosong itu muncul sebagai opsi sungguhan (mis. "Semua kategori").
 */
const props = withDefaults(
    defineProps<{
        opsi: OpsiPilihan<T>[];
        id?: string;
        placeholder?: string;
        labelKosong?: string;
        cari?: boolean;
        invalid?: boolean;
        disabled?: boolean;
        /**
         * Daftar opsi masih diambil dari server. Daftar yang terbuka lebih
         * dulu menampilkan "Memuat…", bukan tampak kosong tanpa penjelasan.
         */
        memuat?: boolean;
        /**
         * Mode pencarian SERVER: dipanggil dengan kata yang diketik (setelah
         * jeda singkat) dan mengembalikan opsi yang cocok. Dipakai untuk
         * daftar yang dapat tumbuh besar (produk, transaksi, pelanggan),
         * supaya tidak perlu memuat seluruh isinya di awal. `opsi` lalu hanya
         * berfungsi sebagai opsi awal (mis. yang sudah terpilih).
         */
        cariServer?: (kata: string) => Promise<OpsiPilihan<T>[]>;
        ariaLabel?: string;
        ariaDescribedby?: string;
    }>(),
    {
        id: undefined,
        placeholder: 'Pilih…',
        labelKosong: undefined,
        cari: undefined,
        cariServer: undefined,
        ariaLabel: undefined,
        ariaDescribedby: undefined,
    },
);

const model = defineModel<T | null>({ required: true });

/* Primitifnya menolak string kosong sebagai nilai opsi, jadi pilihan
   "kosong" diwakili penanda internal yang tidak pernah keluar komponen. */
const KOSONG = '__kosong__';

const modeServer = computed(() => props.cariServer !== undefined);
const modeCari = computed(
    () => modeServer.value || (props.cari ?? props.opsi.length > 7),
);

/* ---------------------------------------------------- pencarian server */

const hasilServer = ref<OpsiPilihan<T>[] | null>(null);
const memuatServer = ref(false);

/* Label setiap opsi yang pernah terlihat. Opsi terpilih mungkin tidak ada
   di hasil pencarian berikutnya, tetapi labelnya harus tetap tampil. */
const labelDikenal = new Map<unknown, string>();

/* Foto setiap opsi yang pernah terlihat, untuk ditampilkan di kotak pilihan
   setelah dipilih. Reaktif, karena kotak itu digambar ulang saat nilai
   berganti -- berbeda dengan label yang dibaca lewat fungsi. */
const gambarDikenal = reactive(new Map<unknown, string | null>());

const adaGambar = (o: { nilai: unknown; gambar?: string | null }): boolean =>
    'gambar' in o && o.gambar !== undefined;

const gambarTerpilih = computed<{ ada: boolean; url: string | null }>(() => {
    const v = model.value;
    return v !== null && gambarDikenal.has(v)
        ? { ada: true, url: gambarDikenal.get(v) ?? null }
        : { ada: false, url: null };
});

let urutCari = 0;

async function cariKeServer(kata: string) {
    if (!props.cariServer) return;
    const ke = ++urutCari;
    memuatServer.value = true;
    try {
        const hasil = await props.cariServer(kata.trim());
        if (ke === urutCari) hasilServer.value = hasil;
    } catch {
        if (ke === urutCari) hasilServer.value = [];
    } finally {
        if (ke === urutCari) memuatServer.value = false;
    }
}

const cariTertunda = useDebounceFn((kata: string) => cariKeServer(kata), 250);

function padaKetik(e: Event) {
    if (modeServer.value && e.target instanceof HTMLInputElement) {
        void cariTertunda(e.target.value);
    }
}

/* Daftar dibuka pertama kali: tampilkan hasil awal tanpa menunggu ketikan. */
function padaBuka(terbuka: boolean) {
    if (terbuka && modeServer.value && hasilServer.value === null) {
        void cariKeServer('');
    }
}

const daftarOpsi = computed(() =>
    modeServer.value ? (hasilServer.value ?? props.opsi) : props.opsi,
);

const semuaOpsi = computed(() => {
    const kosong =
        props.labelKosong !== undefined
            ? [{ nilai: KOSONG, label: props.labelKosong }]
            : [];
    return [...kosong, ...daftarOpsi.value] as Array<
        OpsiPilihan<T> | { nilai: typeof KOSONG; label: string }
    >;
});

watch(
    [() => props.opsi, hasilServer],
    () => {
        for (const o of [...props.opsi, ...(hasilServer.value ?? [])]) {
            labelDikenal.set(o.nilai, o.label);
            if (adaGambar(o)) gambarDikenal.set(o.nilai, o.gambar ?? null);
        }
    },
    { immediate: true },
);

const sedangMemuat = computed(() => props.memuat || memuatServer.value);

function keluar(v: unknown): T | null {
    return v === null || v === undefined || v === '' || v === KOSONG
        ? null
        : (v as T);
}

/* Combobox: `null` = tidak ada yang dipilih. `undefined` dihindari karena
   membuat primitifnya lepas kendali dari v-model. */
const nilaiCombobox = computed({
    get: () => model.value ?? (props.labelKosong !== undefined ? KOSONG : null),
    set: (v: unknown) => {
        model.value = keluar(v);
    },
});

/* Select: string kosong = kosongkan dan tampilkan placeholder. */
const nilaiSelect = computed({
    get: () => model.value ?? (props.labelKosong !== undefined ? KOSONG : ''),
    set: (v: unknown) => {
        model.value = keluar(v);
    },
});

function labelDari(v: unknown): string {
    return (
        semuaOpsi.value.find((o) => o.nilai === v)?.label ??
        labelDikenal.get(v) ??
        ''
    );
}

/* Mengetik langsung menggantikan label yang sedang tampil, bukan
   menempel di belakangnya. */
function pilihSemua(e: FocusEvent) {
    if (e.target instanceof HTMLInputElement) e.target.select();
}

function teksCari(o: { label: string; keterangan?: string }): string {
    return o.keterangan ? `${o.label} ${o.keterangan}` : o.label;
}
</script>

<template>
    <ComboboxRoot
        v-if="modeCari"
        v-model="nilaiCombobox"
        class="pilih"
        :disabled="props.disabled"
        :open-on-click="true"
        :reset-search-term-on-blur="true"
        :ignore-filter="modeServer"
        @update:open="padaBuka"
    >
        <ComboboxAnchor
            class="pilih-kontrol"
            :class="{
                'is-error': props.invalid,
                'is-nonaktif': props.disabled,
            }"
        >
            <span
                v-if="gambarTerpilih.ada"
                class="pilih-gambar pilih-gambar-terpilih"
                aria-hidden="true"
            >
                <img
                    v-if="gambarTerpilih.url"
                    :src="gambarTerpilih.url"
                    alt=""
                />
                <Package v-else :size="16" :stroke-width="1.5" />
            </span>
            <Search
                v-else
                class="pilih-ikon-cari"
                :size="16"
                :stroke-width="1.75"
                aria-hidden="true"
            />
            <ComboboxInput
                :id="props.id"
                class="pilih-input"
                :placeholder="props.placeholder"
                :display-value="labelDari"
                :aria-invalid="props.invalid || undefined"
                :aria-label="props.ariaLabel"
                :aria-describedby="props.ariaDescribedby"
                @focus="pilihSemua"
                @input="padaKetik"
            />
            <ComboboxTrigger class="pilih-panah" aria-label="Tampilkan pilihan">
                <ChevronDown
                    :size="18"
                    :stroke-width="1.75"
                    aria-hidden="true"
                />
            </ComboboxTrigger>
        </ComboboxAnchor>

        <ComboboxPortal>
            <ComboboxContent
                class="pilih-konten pilih-konten-combobox"
                position="popper"
                :side-offset="6"
                :collision-padding="12"
            >
                <ComboboxViewport class="pilih-viewport">
                    <p
                        v-if="sedangMemuat"
                        class="pilih-kosong pilih-memuat"
                        role="status"
                    >
                        <span class="pilih-putar" aria-hidden="true" />
                        Memuat…
                    </p>
                    <ComboboxEmpty v-else class="pilih-kosong">
                        Tidak ada yang cocok.
                    </ComboboxEmpty>
                    <ComboboxItem
                        v-for="o in semuaOpsi"
                        :key="String(o.nilai)"
                        :value="o.nilai"
                        :text-value="teksCari(o)"
                        :disabled="'nonaktif' in o && o.nonaktif"
                        class="pilih-item"
                    >
                        <span
                            v-if="adaGambar(o)"
                            class="pilih-gambar"
                            aria-hidden="true"
                        >
                            <img
                                v-if="'gambar' in o && o.gambar"
                                :src="o.gambar"
                                alt=""
                                loading="lazy"
                            />
                            <Package v-else :size="18" :stroke-width="1.5" />
                        </span>
                        <span class="pilih-item-teks">
                            <span>{{ o.label }}</span>
                            <small v-if="'keterangan' in o && o.keterangan">{{
                                o.keterangan
                            }}</small>
                        </span>
                        <ComboboxItemIndicator class="pilih-centang">
                            <Check :size="16" :stroke-width="2" />
                        </ComboboxItemIndicator>
                    </ComboboxItem>
                </ComboboxViewport>
            </ComboboxContent>
        </ComboboxPortal>
    </ComboboxRoot>

    <SelectRoot v-else v-model="nilaiSelect" :disabled="props.disabled">
        <SelectTrigger
            :id="props.id"
            class="pilih-kontrol pilih-tombol"
            :class="{ 'is-error': props.invalid }"
            :aria-invalid="props.invalid || undefined"
            :aria-label="props.ariaLabel"
            :aria-describedby="props.ariaDescribedby"
        >
            <SelectValue class="pilih-nilai" :placeholder="props.placeholder" />
            <SelectIcon as-child>
                <ChevronDown
                    class="pilih-panah-ikon"
                    :size="18"
                    :stroke-width="1.75"
                />
            </SelectIcon>
        </SelectTrigger>

        <SelectPortal>
            <SelectContent
                class="pilih-konten pilih-konten-select"
                position="popper"
                :side-offset="6"
                :collision-padding="12"
            >
                <SelectViewport class="pilih-viewport">
                    <p
                        v-if="props.memuat"
                        class="pilih-kosong pilih-memuat"
                        role="status"
                    >
                        <span class="pilih-putar" aria-hidden="true" />
                        Memuat…
                    </p>
                    <SelectItem
                        v-for="o in semuaOpsi"
                        :key="String(o.nilai)"
                        :value="o.nilai"
                        :disabled="'nonaktif' in o && o.nonaktif"
                        class="pilih-item"
                    >
                        <span class="pilih-item-teks">
                            <SelectItemText>{{ o.label }}</SelectItemText>
                            <small v-if="'keterangan' in o && o.keterangan">{{
                                o.keterangan
                            }}</small>
                        </span>
                        <SelectItemIndicator class="pilih-centang">
                            <Check :size="16" :stroke-width="2" />
                        </SelectItemIndicator>
                    </SelectItem>
                </SelectViewport>
            </SelectContent>
        </SelectPortal>
    </SelectRoot>
</template>

<style>
/* Tidak scoped: daftar pilihan dipindah ke <body> oleh Portal. */

.pilih {
    width: 100%;
}

.pilih-kontrol {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--control-h);
    padding: 0 var(--space-2) 0 var(--space-4);
    background: var(--surface-base);
    border: 0;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-inset);
    color: var(--text-primary);
    transition: box-shadow var(--dur-base) var(--ease);
}

.pilih-kontrol:focus-within,
.pilih-tombol:focus-visible,
.pilih-tombol[data-state='open'] {
    outline: none;
    box-shadow: var(--shadow-inset), var(--focus-ring);
}

.pilih-kontrol.is-error {
    box-shadow: var(--error-ring);
}

.pilih-kontrol.is-nonaktif,
.pilih-tombol[data-disabled] {
    opacity: 0.6;
    cursor: not-allowed;
}

.pilih-ikon-cari {
    flex: 0 0 auto;
    color: var(--text-muted);
}

.pilih-input {
    flex: 1;
    min-width: 0;
    height: calc(var(--control-h) - 4px);
    padding: 0;
    background: transparent;
    border: 0;
    outline: none;
    font: inherit;
    color: inherit;
    text-overflow: ellipsis;
}

.pilih-input::placeholder,
.pilih-nilai[data-placeholder] {
    color: var(--text-muted);
}

.pilih-panah {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
    border: 0;
    border-radius: var(--radius-xs);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
}

.pilih-panah:hover {
    background: rgba(11, 107, 98, 0.08);
}

.pilih-tombol {
    justify-content: space-between;
    padding-right: var(--space-3);
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.pilih-nilai {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.pilih-panah-ikon {
    flex: 0 0 auto;
    color: var(--text-secondary);
    transition: transform var(--dur-base) var(--ease);
}

.pilih-tombol[data-state='open'] .pilih-panah-ikon,
.pilih-kontrol:has([aria-expanded='true']) .pilih-panah svg {
    transform: rotate(180deg);
}

/* ---------------------------------------------------------------- daftar */

.pilih-konten {
    z-index: var(--z-popover);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-crisp);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-crisp);
    animation: pilih-muncul var(--dur-base) var(--ease);
}

.pilih-konten-combobox {
    width: var(--reka-combobox-trigger-width);
    max-height: min(320px, var(--reka-combobox-content-available-height));
}

.pilih-konten-select {
    width: var(--reka-select-trigger-width);
    max-height: min(320px, var(--reka-select-content-available-height));
}

.pilih-viewport {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-1);
}

.pilih-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-xs);
    font: var(--text-small);
    color: var(--text-primary);
    cursor: pointer;
    user-select: none;
    outline: none;
}

.pilih-item[data-highlighted] {
    background: var(--teal-100);
}

.pilih-item[data-state='checked'] {
    font: var(--text-label);
    color: var(--teal-700);
}

.pilih-item[data-disabled] {
    opacity: 0.45;
    cursor: not-allowed;
}

.pilih-item-teks {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.pilih-item-teks small {
    font: var(--text-caption);
    color: var(--text-muted);
}

/* Foto opsi: cukup besar untuk membedakan kemasan (mis. dua varian mi
   instan yang namanya mirip), dengan latar putih untuk foto transparan. */
.pilih-gambar {
    flex: 0 0 40px;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    overflow: hidden;
    border-radius: var(--radius-xs);
    background: #fff;
    box-shadow: 0 0 0 1px var(--divider);
    color: var(--text-muted);
}

.pilih-gambar img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.pilih-gambar-terpilih {
    flex-basis: 28px;
    width: 28px;
    height: 28px;
}

.pilih-centang {
    flex: 0 0 auto;
    color: var(--teal-700);
}

.pilih-kosong {
    padding: var(--space-4);
    text-align: center;
    font: var(--text-small);
    color: var(--text-muted);
}

.pilih-memuat {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-top: 1px solid var(--divider);
}

.pilih-putar {
    width: 14px;
    height: 14px;
    border: 2px solid var(--teal-100);
    border-top-color: var(--teal-700);
    border-radius: 50%;
    animation: putar 0.7s linear infinite;
}

@keyframes pilih-muncul {
    from {
        opacity: 0;
        transform: translateY(-4px);
    }
}
</style>
