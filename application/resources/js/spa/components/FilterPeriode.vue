<script setup lang="ts">
import { hariLalu, kunciTanggal } from '../composables/format';
import InputTanggal from './InputTanggal.vue';

/**
 * Penyaring periode laporan: preset sekali klik + kalender rentang.
 *
 * Preset berupa tombol, bukan isi kalender: tidak ada yang mau mengeklik
 * kalender untuk "30 hari terakhir". Rentang manual dipilih di SATU kalender
 * (flatpickr) dan langsung diterapkan begitu ujung keduanya dipilih, jadi
 * tidak perlu tombol Terapkan lagi.
 */
defineProps<{ memuat?: boolean }>();

const emit = defineEmits<{ terapkan: [] }>();

const dari = defineModel<string>('dari', { required: true });
const sampai = defineModel<string>('sampai', { required: true });

const hariIni = kunciTanggal();

function awalBulan(): string {
    const d = new Date();
    return kunciTanggal(new Date(d.getFullYear(), d.getMonth(), 1));
}

function awalTahun(): string {
    return kunciTanggal(new Date(new Date().getFullYear(), 0, 1));
}

const PRESET = [
    { label: '7 hari', dari: () => hariLalu(6) },
    { label: '30 hari', dari: () => hariLalu(29) },
    { label: '90 hari', dari: () => hariLalu(89) },
    { label: 'Bulan ini', dari: awalBulan },
    { label: 'Tahun ini', dari: awalTahun },
];

function presetAktif(p: (typeof PRESET)[number]): boolean {
    return dari.value === p.dari() && sampai.value === hariIni;
}

function pakaiPreset(p: (typeof PRESET)[number]) {
    dari.value = p.dari();
    sampai.value = hariIni;
    emit('terapkan');
}
</script>

<template>
    <div class="periode">
        <div class="preset" role="group" aria-label="Periode cepat">
            <button
                v-for="p in PRESET"
                :key="p.label"
                type="button"
                class="btn btn-sm"
                :class="presetAktif(p) ? 'btn-primary' : 'btn-soft'"
                :aria-pressed="presetAktif(p)"
                :disabled="memuat"
                @click="pakaiPreset(p)"
            >
                {{ p.label }}
            </button>
        </div>

        <div class="rentang">
            <InputTanggal
                id="periode-rentang"
                v-model:dari="dari"
                v-model:sampai="sampai"
                rentang
                :maks="hariIni"
                :disabled="memuat"
                aria-label="Rentang tanggal laporan"
                placeholder="Pilih rentang tanggal"
                @pilih="emit('terapkan')"
            />
        </div>
    </div>
</template>

<style scoped>
.periode {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
}

.preset {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
}

.rentang {
    width: 17.5rem;
    max-width: 100%;
}

.rentang :deep(.input-tanggal) {
    min-height: var(--control-h-sm);
}
</style>
