<script setup lang="ts">
import { ref, watch } from 'vue';

/**
 * Isian bilangan bulat dengan pemisah ribuan yang terbentuk saat mengetik
 * (1250000 tampil 1.250.000), untuk nominal Rupiah maupun jumlah barang.
 *
 * Kenapa bukan <input type="number">:
 * - tidak bisa menampilkan pemisah ribuan, padahal nominal tujuh digit
 *   mudah salah baca tanpanya;
 * - roda tetikus diam-diam mengubah nilainya saat halaman digulir;
 * - isian kosong menghasilkan '' yang lolos ke server sebagai bukan angka.
 *
 * Model bernilai `null` saat kosong, supaya "belum diisi" dapat dibedakan
 * dari nol.
 */
defineOptions({ inheritAttrs: false });

const props = withDefaults(
    defineProps<{
        id?: string;
        /** Teks di depan isian, mis. "Rp". */
        awalan?: string;
        /** Teks di belakang isian, mis. simbol satuan. */
        akhiran?: string;
        placeholder?: string;
        invalid?: boolean;
        disabled?: boolean;
        /** Langkah tombol panah atas/bawah. */
        langkah?: number;
        kecil?: boolean;
        /**
         * "none" menahan papan ketik bawaan di perangkat sentuh, dipakai
         * bila isiannya diisi lewat KeypadAngka (mode tablet).
         */
        modeInput?: 'numeric' | 'none';
        ariaLabel?: string;
        ariaDescribedby?: string;
    }>(),
    {
        id: undefined,
        awalan: undefined,
        akhiran: undefined,
        placeholder: undefined,
        langkah: 1,
        modeInput: 'numeric',
        ariaLabel: undefined,
        ariaDescribedby: undefined,
    },
);

const model = defineModel<number | null>({ required: true });

/* 12 digit (ratusan miliar) sudah jauh di atas kebutuhan toko, dan menjaga
   nilainya tetap di bawah batas bilangan bulat aman JavaScript. */
const DIGIT_MAKS = 12;

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

function format(v: number | null | undefined): string {
    return v === null || v === undefined ? '' : nf.format(v);
}

function urai(s: string): number | null {
    const digit = s.replace(/\D/g, '').slice(0, DIGIT_MAKS);
    return digit === '' ? null : Number(digit);
}

const teks = ref(format(model.value));

/* Nilai dari luar (reset formulir, isi otomatis) ikut tampil. */
watch(model, (v) => {
    if (urai(teks.value) !== v) teks.value = format(v);
});

function padaInput(e: Event) {
    const el = e.target as HTMLInputElement;

    // Posisi kursor dihitung dalam DIGIT, bukan karakter, karena titik
    // pemisah ribuan bergeser setiap kali angka bertambah atau berkurang.
    const posisi = el.selectionStart ?? el.value.length;
    const digitSebelum = el.value.slice(0, posisi).replace(/\D/g, '').length;

    const nilai = urai(el.value);
    teks.value = format(nilai);
    el.value = teks.value;

    let i = 0;
    for (let hitung = 0; i < el.value.length && hitung < digitSebelum; i++) {
        if (/\d/.test(el.value[i])) hitung++;
    }
    el.setSelectionRange(i, i);

    model.value = nilai;
}

function geser(arah: 1 | -1) {
    const baru = Math.max(0, (model.value ?? 0) + arah * props.langkah);
    model.value = baru;
    teks.value = format(baru);
}
</script>

<template>
    <div
        class="angka"
        :class="{
            'is-error': props.invalid,
            'is-nonaktif': props.disabled,
            'angka-kecil': props.kecil,
        }"
    >
        <span v-if="props.awalan" class="angka-imbuhan" aria-hidden="true">{{
            props.awalan
        }}</span>
        <input
            v-bind="$attrs"
            :id="props.id"
            class="angka-input"
            type="text"
            :inputmode="props.modeInput"
            autocomplete="off"
            :value="teks"
            :placeholder="props.placeholder"
            :disabled="props.disabled"
            :aria-invalid="props.invalid || undefined"
            :aria-label="props.ariaLabel"
            :aria-describedby="props.ariaDescribedby"
            @input="padaInput"
            @keydown.up.prevent="geser(1)"
            @keydown.down.prevent="geser(-1)"
        />
        <span v-if="props.akhiran" class="angka-imbuhan" aria-hidden="true">{{
            props.akhiran
        }}</span>
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

.angka-kecil {
    min-height: var(--control-h-sm);
    padding: 0 var(--space-3);
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

.angka-input::placeholder {
    color: var(--text-muted);
}

.angka-input:disabled {
    cursor: not-allowed;
}
</style>
