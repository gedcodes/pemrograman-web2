<script setup lang="ts">
import { useKasirInduk } from '../../composables/useKasir';
import InputAngka from '../InputAngka.vue';

/** Shift wajib dibuka lebih dulu (alur PERANCANGAN Bagian 4.1 langkah B–C). */
defineProps<{ besar?: boolean }>();

const kasir = useKasirInduk();
</script>

<template>
    <form
        class="card gerbang"
        :class="{ 'gerbang-besar': besar }"
        novalidate
        @submit.prevent="kasir.bukaShift()"
    >
        <h2>Buka shift dahulu</h2>
        <p class="muted">Masukkan modal awal laci kas untuk mulai berjualan.</p>
        <div class="field" style="width: min(320px, 100%)">
            <label for="modal-awal">Modal awal</label>
            <InputAngka
                id="modal-awal"
                v-model="kasir.modalAwal"
                awalan="Rp"
                :langkah="50000"
            />
        </div>
        <button
            type="submit"
            class="btn btn-primary"
            :class="{ 'btn-lg': besar }"
            :disabled="kasir.membukaShift"
            :aria-busy="kasir.membukaShift"
        >
            {{ kasir.membukaShift ? 'Membuka…' : 'Buka Shift' }}
        </button>
    </form>
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

.gerbang-besar {
    margin-top: var(--space-12);
}
</style>
