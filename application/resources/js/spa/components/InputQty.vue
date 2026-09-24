<script setup lang="ts">
import { ref, watch } from 'vue';

/**
 * Jumlah barang di keranjang yang dapat diketik langsung.
 *
 * Menekan + dua puluh kali untuk 20 bungkus mi melelahkan. Kasir cukup
 * mengetuk angkanya, mengetik 20, lalu Enter. Nilai baru dikirim lewat
 * `ubah` saat Enter ditekan atau fokus berpindah; Esc membatalkan.
 * Validasi (stok, 0 = hapus) tetap di pemanggil.
 */
const props = defineProps<{
    nilai: number;
    label: string;
    besar?: boolean;
}>();

const emit = defineEmits<{ ubah: [qty: number] }>();

const teks = ref(String(props.nilai));

watch(
    () => props.nilai,
    (n) => {
        teks.value = String(n);
    },
);

function simpan() {
    const angka = Number(teks.value.replace(/\D/g, ''));
    if (teks.value.trim() === '' || angka === props.nilai) {
        teks.value = String(props.nilai);
        return;
    }
    emit('ubah', angka);
}

function batal(e: KeyboardEvent) {
    teks.value = String(props.nilai);
    (e.target as HTMLInputElement).blur();
}
</script>

<template>
    <input
        v-model="teks"
        class="input-qty"
        :class="{ 'input-qty-besar': besar }"
        type="text"
        inputmode="numeric"
        enterkeyhint="done"
        maxlength="4"
        autocomplete="off"
        :aria-label="props.label"
        @focus="($event.target as HTMLInputElement).select()"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @keydown.esc.prevent="batal"
        @blur="simpan"
    />
</template>

<style scoped>
.input-qty {
    width: 40px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-xs);
    background: transparent;
    font: var(--text-numeric);
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: var(--text-primary);
}

.input-qty:hover {
    background: var(--surface-base);
}

.input-qty:focus-visible,
.input-qty:focus {
    outline: none;
    background: var(--surface-crisp);
    box-shadow: var(--focus-ring);
}

.input-qty-besar {
    width: 56px;
    height: 44px;
    font: var(--text-h3);
}
</style>
