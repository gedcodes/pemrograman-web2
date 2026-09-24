<script setup lang="ts">
import { useKasirInduk } from '../../composables/useKasir';
import BaseModal from '../BaseModal.vue';
import StrukCetak from '../StrukCetak.vue';

/**
 * Struk transaksi yang baru selesai. `cetak` pada BaseModal membuat hanya
 * isi modal ini yang keluar di kertas, bukan seluruh halaman Kasir.
 */
defineProps<{ sentuh?: boolean }>();

const kasir = useKasirInduk();

function cetak() {
    window.print();
}
</script>

<template>
    <BaseModal
        v-if="kasir.strukTerakhir"
        judul="Struk"
        lebar="380px"
        cetak
        @tutup="kasir.strukTerakhir = null"
    >
        <StrukCetak :transaksi="kasir.strukTerakhir" />

        <template #aksi>
            <button
                class="btn btn-soft"
                :class="{ 'btn-lg': sentuh }"
                @click="kasir.strukTerakhir = null"
            >
                Tutup
            </button>
            <button
                class="btn btn-neutral"
                :class="{ 'btn-lg': sentuh }"
                @click="cetak"
            >
                Cetak
            </button>
        </template>
    </BaseModal>
</template>
