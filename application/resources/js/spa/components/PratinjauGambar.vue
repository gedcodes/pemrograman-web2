<script setup lang="ts">
import BaseModal from './BaseModal.vue';

/**
 * Foto produk dalam ukuran besar. Dibuka dengan mengeklik thumbnail di
 * Master Produk atau pratinjau di Form Produk; ditutup dengan Esc, tombol ×,
 * atau klik di luar foto.
 */
const props = defineProps<{
    src: string;
    judul: string;
    keterangan?: string;
}>();

const emit = defineEmits<{ tutup: [] }>();
</script>

<template>
    <BaseModal
        :judul="props.judul"
        :deskripsi="props.keterangan"
        lebar="760px"
        @tutup="emit('tutup')"
    >
        <div class="bingkai">
            <img :src="props.src" :alt="props.judul" />
        </div>
        <template #aksi>
            <a
                class="btn btn-soft"
                :href="props.src"
                target="_blank"
                rel="noopener"
                >Buka ukuran asli</a
            >
            <button class="btn btn-primary" @click="emit('tutup')">
                Tutup
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
/* Latar kotak-kotak halus menandai area transparan pada foto PNG/WebP. */
.bingkai {
    display: grid;
    place-items: center;
    min-height: 240px;
    border-radius: var(--radius-md);
    background: repeating-conic-gradient(#f1f5f4 0 25%, #fff 0 50%) 50% / 20px
        20px;
}

.bingkai img {
    display: block;
    max-width: 100%;
    max-height: min(70vh, 640px);
    object-fit: contain;
}
</style>
