<script setup lang="ts">
import JsBarcode from 'jsbarcode';
import { computed, onMounted, ref, watch } from 'vue';
import { formatBarcode } from '../composables/barcode';

/**
 * Barcode sebagai SVG vektor, supaya tetap tajam di printer mana pun.
 *
 * Simbologinya dipilih otomatis (EAN-13 / EAN-8 bila digit ceknya sah, selain
 * itu Code 128) -- lihat `formatBarcode`. Zona hening di kiri-kanan sengaja
 * dibiarkan lebar: tanpa itu pemindai sering gagal membaca label.
 */
const props = withDefaults(
    defineProps<{
        kode: string;
        /** Tinggi batang, dalam satuan modul SVG. */
        tinggi?: number;
        tampilkanTeks?: boolean;
    }>(),
    { tinggi: 60, tampilkanTeks: true },
);

const svg = ref<SVGSVGElement | null>(null);
const gagal = ref(false);
const format = computed(() => formatBarcode(props.kode));

function gambar() {
    if (!svg.value) return;
    try {
        JsBarcode(svg.value, props.kode, {
            format: format.value,
            width: 2,
            height: props.tinggi,
            displayValue: props.tampilkanTeks,
            fontSize: 18,
            textMargin: 2,
            font: 'JetBrains Mono, monospace',
            // ±10 modul: zona hening minimum EAN-13 adalah 11 modul di kiri.
            margin: 0,
            marginLeft: 22,
            marginRight: 22,
            marginTop: 4,
            marginBottom: 4,
            background: '#ffffff',
            lineColor: '#000000',
        });
        gagal.value = false;
    } catch {
        gagal.value = true;
    }
}

onMounted(gambar);
watch(() => [props.kode, props.tinggi, props.tampilkanTeks], gambar);
</script>

<template>
    <span class="barcode-wadah">
        <svg
            v-show="!gagal"
            ref="svg"
            class="barcode"
            role="img"
            :aria-label="`Barcode ${props.kode}`"
            :data-format="format"
        />
        <span v-if="gagal" class="barcode-gagal">{{ props.kode }}</span>
    </span>
</template>

<style scoped>
.barcode-wadah {
    display: block;
}

.barcode {
    display: block;
    width: 100%;
    height: auto;
}

.barcode-gagal {
    font: var(--text-numeric);
    color: var(--danger-text);
}
</style>
