<script setup lang="ts">
import { ref, watch } from 'vue';

/**
 * Isian persentase berdesimal, mis. tarif PPN 11 atau MDR 0,7.
 *
 * Nilainya dalam PERSEN (11 berarti 11%), bukan pecahan; halaman yang
 * memakainya yang mengubah ke pecahan saat mengirim ke server. Koma dan titik
 * sama-sama diterima sebagai pemisah desimal, karena papan ketik Indonesia
 * memakai koma. Tampilan mengikuti InputAngka supaya seragam.
 */
defineOptions({ inheritAttrs: false });

const props = withDefaults(
    defineProps<{
        id?: string;
        invalid?: boolean;
        disabled?: boolean;
        /** Jumlah angka di belakang koma yang boleh diketik. */
        desimal?: number;
        ariaDescribedby?: string;
    }>(),
    {
        id: undefined,
        desimal: 2,
        ariaDescribedby: undefined,
    },
);

const model = defineModel<number | null>({ required: true });

const format = (n: number | null) =>
    n === null ? '' : String(n).replace('.', ',');

const teks = ref(format(model.value));

/* Nilai dari luar (mis. dimuat dari server) menimpa teks, kecuali bila
   angkanya memang sama -- supaya "11," yang sedang diketik tidak hilang. */
watch(model, (n) => {
    if (urai(teks.value) !== n) teks.value = format(n);
});

function urai(t: string): number | null {
    const bersih = t.trim().replace(',', '.');
    if (bersih === '' || bersih === '.') return null;
    const n = Number(bersih);
    return Number.isFinite(n) ? n : null;
}

function padaInput(e: Event) {
    const el = e.target as HTMLInputElement;

    // Hanya angka dan SATU pemisah desimal, dengan batas angka di belakangnya.
    let t = el.value.replace(/[^\d.,]/g, '');
    const pisah = t.search(/[.,]/);
    if (pisah !== -1) {
        const depan = t.slice(0, pisah);
        const belakang = t
            .slice(pisah + 1)
            .replace(/[.,]/g, '')
            .slice(0, props.desimal);
        t = `${depan},${belakang}`;
    }

    teks.value = t;
    el.value = t;
    model.value = urai(t);
}
</script>

<template>
    <div
        class="angka"
        :class="{ 'is-error': props.invalid, 'is-nonaktif': props.disabled }"
    >
        <input
            v-bind="$attrs"
            :id="props.id"
            class="angka-input"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            :value="teks"
            :disabled="props.disabled"
            :aria-invalid="props.invalid || undefined"
            :aria-describedby="props.ariaDescribedby"
            @input="padaInput"
        />
        <span class="angka-imbuhan" aria-hidden="true">%</span>
    </div>
</template>

<style scoped>
.angka {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--control-h);
    padding: 0 var(--space-4);
    background: var(--surface-base);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-inset);
    transition: box-shadow var(--dur-base) var(--ease);
}

.angka:focus-within {
    box-shadow: var(--shadow-inset), var(--focus-ring);
}

.angka.is-error {
    box-shadow: var(--error-ring);
}

.angka.is-nonaktif {
    opacity: 0.6;
}

.angka-imbuhan {
    flex: 0 0 auto;
    font: var(--text-small);
    color: var(--text-muted);
}

.angka-input {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: calc(var(--control-h-sm) - 4px);
    padding: 0;
    background: transparent;
    border: 0;
    outline: none;
    font: var(--text-numeric);
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--text-primary);
}

.angka-input:disabled {
    cursor: not-allowed;
}
</style>
