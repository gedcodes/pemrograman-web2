<script setup lang="ts">
import { CalendarRange } from '@lucide/vue';
import { computed } from 'vue';
import { hariLalu, kunciTanggal } from '../composables/format';

/**
 * Penyaring periode laporan: rentang tanggal + preset sekali klik.
 *
 * Preset langsung menerapkan periodenya. Rentang manual baru diterapkan
 * lewat tombol Terapkan (atau Enter), supaya laporan tidak dimuat ulang
 * setiap kali satu tanggal diganti di tengah jalan.
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

const PRESET = [
    { label: '7 hari', dari: () => hariLalu(6) },
    { label: '30 hari', dari: () => hariLalu(29) },
    { label: 'Bulan ini', dari: awalBulan },
];

const galat = computed(() => {
    if (!dari.value || !sampai.value) return 'Isi kedua tanggal.';
    if (dari.value > sampai.value)
        return 'Tanggal "dari" tidak boleh setelah tanggal "sampai".';
    return null;
});

function presetAktif(p: (typeof PRESET)[number]): boolean {
    return dari.value === p.dari() && sampai.value === hariIni;
}

function pakaiPreset(p: (typeof PRESET)[number]) {
    dari.value = p.dari();
    sampai.value = hariIni;
    emit('terapkan');
}

function terapkan() {
    if (!galat.value) emit('terapkan');
}
</script>

<template>
    <form class="periode" novalidate @submit.prevent="terapkan">
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
            <CalendarRange
                class="ikon"
                :size="18"
                :stroke-width="1.75"
                aria-hidden="true"
            />
            <label class="sr-only" for="periode-dari">Dari tanggal</label>
            <input
                id="periode-dari"
                v-model="dari"
                type="date"
                class="input"
                :max="sampai || hariIni"
                :aria-invalid="Boolean(galat) || undefined"
                aria-describedby="periode-galat"
            />
            <span aria-hidden="true">–</span>
            <label class="sr-only" for="periode-sampai">Sampai tanggal</label>
            <input
                id="periode-sampai"
                v-model="sampai"
                type="date"
                class="input"
                :min="dari"
                :max="hariIni"
                :aria-invalid="Boolean(galat) || undefined"
                aria-describedby="periode-galat"
            />
            <button
                type="submit"
                class="btn btn-primary btn-sm"
                :disabled="memuat || Boolean(galat)"
                :aria-busy="memuat"
            >
                Terapkan
            </button>
        </div>

        <p v-if="galat" id="periode-galat" class="field-error">{{ galat }}</p>
    </form>
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
    gap: var(--space-2);
}

.rentang {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-muted);
}

.rentang .input {
    width: auto;
    min-height: var(--control-h-sm);
    padding: 0 var(--space-3);
}

.field-error {
    flex-basis: 100%;
}
</style>
