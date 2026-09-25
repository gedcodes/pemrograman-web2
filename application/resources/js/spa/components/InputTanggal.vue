<script setup lang="ts">
import { CalendarDays } from '@lucide/vue';
import flatpickr from 'flatpickr';
import { Indonesian } from 'flatpickr/dist/l10n/id.js';
import type { Instance } from 'flatpickr/dist/types/instance';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import 'flatpickr/dist/flatpickr.css';

/**
 * Pemilih tanggal berbasis flatpickr, menggantikan `<input type="date">`
 * bawaan browser yang tampilannya berbeda-beda di setiap browser dan tidak
 * mendukung pemilihan rentang dalam satu kalender.
 *
 * - Satu tanggal: `v-model` berisi "YYYY-MM-DD".
 * - Rentang (`rentang`): `v-model:dari` dan `v-model:sampai`; event `pilih`
 *   terbit setelah KEDUA ujung rentang dipilih.
 *
 * Nilai selalu "YYYY-MM-DD" (format yang dikirim ke API); yang tampil di
 * layar "24 Sep 2026" dalam bahasa Indonesia.
 */
const props = withDefaults(
    defineProps<{
        id?: string;
        rentang?: boolean;
        /** Batas pilihan, "YYYY-MM-DD". */
        min?: string;
        maks?: string;
        placeholder?: string;
        invalid?: boolean;
        disabled?: boolean;
        ariaLabel?: string;
        ariaDescribedby?: string;
    }>(),
    {
        id: undefined,
        min: undefined,
        maks: undefined,
        placeholder: 'Pilih tanggal',
        ariaLabel: undefined,
        ariaDescribedby: undefined,
    },
);

const nilai = defineModel<string>({ default: '' });
const dari = defineModel<string>('dari', { default: '' });
const sampai = defineModel<string>('sampai', { default: '' });

const emit = defineEmits<{ pilih: [] }>();

const masukan = ref<HTMLInputElement | null>(null);
let fp: Instance | null = null;

/** "YYYY-MM-DD" menurut kalender SETEMPAT (bukan toISOString yang UTC). */
function kunci(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function tanggalModel(): string[] {
    if (!props.rentang) return nilai.value ? [nilai.value] : [];
    return [dari.value, sampai.value].filter(Boolean);
}

onMounted(() => {
    if (!masukan.value) return;
    fp = flatpickr(masukan.value, {
        locale: { ...Indonesian, rangeSeparator: ' – ', firstDayOfWeek: 1 },
        mode: props.rentang ? 'range' : 'single',
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'j M Y',
        altInputClass: 'input input-tanggal',
        defaultDate: tanggalModel(),
        minDate: props.min,
        maxDate: props.maks,
        // Tampilan sama di ponsel, alih-alih jatuh ke pemilih bawaan OS.
        disableMobile: true,
        monthSelectorType: 'static',
        onChange(tanggal) {
            if (!props.rentang) {
                nilai.value = tanggal[0] ? kunci(tanggal[0]) : '';
                emit('pilih');
                return;
            }
            // Klik pertama baru memilih ujung awal; tunggu ujung akhir.
            if (tanggal.length === 2) {
                dari.value = kunci(tanggal[0]);
                sampai.value = kunci(tanggal[1]);
                emit('pilih');
            }
        },
        onClose(tanggal) {
            // Rentang ditinggalkan setengah jalan: kembalikan tampilan.
            if (props.rentang && tanggal.length < 2)
                fp?.setDate(tanggalModel(), false);
        },
    }) as Instance;

    // altInput menggantikan input asli di layar: pindahkan atribut
    // aksesibilitasnya supaya label dan pesan galat tetap tertaut.
    const tampil = fp.altInput;
    if (tampil) {
        if (props.id) {
            masukan.value.removeAttribute('id');
            tampil.id = props.id;
        }
        if (props.ariaLabel) tampil.setAttribute('aria-label', props.ariaLabel);
        if (props.ariaDescribedby)
            tampil.setAttribute('aria-describedby', props.ariaDescribedby);
        tampil.placeholder = props.placeholder;
        tampil.disabled = props.disabled;
    }
});

/* Nilai dari luar (preset, formulir di-reset) ikut ke kalender. */
watch([nilai, dari, sampai], () => {
    if (fp) fp.setDate(tanggalModel(), false);
});

watch(
    () => [props.min, props.maks] as const,
    ([min, maks]) => {
        fp?.set('minDate', min);
        fp?.set('maxDate', maks);
    },
);

watch(
    () => [props.invalid, props.disabled] as const,
    ([invalid, disabled]) => {
        const tampil = fp?.altInput;
        if (!tampil) return;
        tampil.classList.toggle('is-error', Boolean(invalid));
        tampil.toggleAttribute('aria-invalid', Boolean(invalid));
        tampil.disabled = Boolean(disabled);
    },
    { immediate: true, flush: 'post' },
);

onBeforeUnmount(() => {
    fp?.destroy();
    fp = null;
});
</script>

<template>
    <span class="tanggal" :class="{ 'is-error': props.invalid }">
        <CalendarDays
            class="tanggal-ikon"
            :size="17"
            :stroke-width="1.75"
            aria-hidden="true"
        />
        <input ref="masukan" type="text" tabindex="-1" aria-hidden="true" />
    </span>
</template>

<style scoped>
.tanggal {
    position: relative;
    display: inline-block;
    width: 100%;
}

.tanggal-ikon {
    position: absolute;
    top: 50%;
    left: var(--space-3);
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
    z-index: 1;
}

.tanggal :deep(.input-tanggal) {
    padding-left: calc(var(--space-3) + 17px + var(--space-2));
    cursor: pointer;
    font-variant-numeric: tabular-nums;
}
</style>
