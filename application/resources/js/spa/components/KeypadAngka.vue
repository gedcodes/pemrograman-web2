<script setup lang="ts">
import { Delete } from '@lucide/vue';
import { ref } from 'vue';

/**
 * Papan angka layar sentuh untuk mengisi nominal di tablet.
 *
 * Di tablet, papan ketik bawaan sistem menutupi separuh layar, termasuk
 * total dan kembalian yang justru sedang dilihat kasir. Papan angka ini
 * menggantikannya dengan tombol besar yang mudah ditekan.
 *
 * Tekanan angka PERTAMA menggantikan nilai isian awal (yang biasanya sudah
 * diisi sebesar total belanja), bukan menempel di belakangnya.
 */
const model = defineModel<number | null>({ required: true });

const DIGIT_MAKS = 12;

const TOMBOL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'];

const pertama = ref(true);

function tekan(t: string) {
    const lama = pertama.value ? '' : String(model.value ?? '');
    pertama.value = false;

    const baru = (lama === '0' ? '' : lama) + t;
    const bersih = baru.replace(/^0+(?=\d)/, '');
    if (bersih.length > DIGIT_MAKS) return;
    model.value = bersih === '' ? null : Number(bersih);
}

function mundur() {
    pertama.value = false;
    const s = String(model.value ?? '').slice(0, -1);
    model.value = s === '' ? null : Number(s);
}

function kosongkan() {
    pertama.value = false;
    model.value = null;
}
</script>

<template>
    <div class="keypad" role="group" aria-label="Papan angka">
        <button
            v-for="t in TOMBOL"
            :key="t"
            type="button"
            class="kunci"
            @click="tekan(t)"
        >
            {{ t }}
        </button>
        <button
            type="button"
            class="kunci kunci-fungsi"
            aria-label="Hapus satu angka"
            @click="mundur"
            @contextmenu.prevent="kosongkan"
        >
            <Delete :size="22" :stroke-width="1.75" aria-hidden="true" />
        </button>
        <button type="button" class="kunci-kosong" @click="kosongkan">
            Kosongkan
        </button>
    </div>
</template>

<style scoped>
.keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
}

.kunci {
    min-height: 60px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: var(--shadow-raised-sm);
    font: var(--text-h2);
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
    cursor: pointer;
    touch-action: manipulation;
    user-select: none;
    transition:
        transform var(--dur-fast) var(--ease),
        box-shadow var(--dur-fast) var(--ease);
}

.kunci:active {
    transform: scale(0.96);
    box-shadow: var(--shadow-inset-sm);
}

.kunci-fungsi {
    display: grid;
    place-items: center;
    color: var(--text-secondary);
}

.kunci-kosong {
    grid-column: 1 / -1;
    min-height: 40px;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    font: var(--text-label);
    color: var(--text-secondary);
    cursor: pointer;
}
</style>
