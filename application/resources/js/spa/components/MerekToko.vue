<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { toko } from '../stores/toko';

/**
 * Tanda merek toko: logo dari Pengaturan Toko, atau kotak teal berisi
 * inisial ("SA") bila logo belum diunggah. Dipakai di sidebar, halaman masuk,
 * dan Kasir Mode Tablet supaya ketiganya selalu sama.
 *
 * Bila berkas logo gagal dimuat (mis. berkasnya terhapus dari server),
 * inisial yang tampil -- bukan ikon gambar rusak.
 */
const props = withDefaults(
    defineProps<{
        ukuran?: number;
        sudut?: 'sm' | 'md';
        /** Logo lain untuk pratinjau (halaman Pengaturan Toko). */
        logoUrl?: string | null;
        inisial?: string;
    }>(),
    { ukuran: 40, sudut: 'sm', logoUrl: undefined, inisial: undefined },
);

const url = computed(() =>
    props.logoUrl !== undefined ? props.logoUrl : toko.publik.logo_url,
);
const huruf = computed(() => props.inisial ?? toko.publik.inisial);

const gagal = ref(false);
watch(url, () => (gagal.value = false));

const gaya = computed(() => ({
    width: `${props.ukuran}px`,
    height: `${props.ukuran}px`,
    flexBasis: `${props.ukuran}px`,
    borderRadius: `var(--radius-${props.sudut})`,
    fontSize: `${Math.round(props.ukuran * 0.4)}px`,
}));
</script>

<template>
    <img
        v-if="url && !gagal"
        class="merek merek-logo"
        :src="url"
        :style="gaya"
        alt=""
        @error="gagal = true"
    />
    <span v-else class="merek merek-inisial" :style="gaya" aria-hidden="true">{{
        huruf
    }}</span>
</template>

<style scoped>
.merek {
    display: grid;
    place-items: center;
    flex-grow: 0;
    flex-shrink: 0;
}

.merek-inisial {
    background: var(--teal-700);
    color: var(--text-on-dark);
    font-family: var(--font-display, inherit);
    font-weight: 600;
    line-height: 1;
}

/* Latar terang + garis tipis: logo transparan tetap terbaca di sidebar gelap. */
.merek-logo {
    object-fit: contain;
    background: #fff;
    box-shadow: 0 0 0 1px var(--divider);
}
</style>
