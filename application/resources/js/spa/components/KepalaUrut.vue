<script setup lang="ts">
import { ArrowDown, ArrowUp, ArrowUpDown } from '@lucide/vue';
import { computed } from 'vue';

/**
 * Kepala kolom tabel yang dapat diklik untuk mengurutkan.
 *
 * Klik pertama mengurutkan sesuai `arahAwal` (naik untuk teks, turun untuk
 * angka/tanggal lebih berguna), klik berikutnya membalik arah. Status urut
 * diumumkan lewat `aria-sort` sehingga terbaca pembaca layar.
 */
const props = withDefaults(
    defineProps<{
        label: string;
        kolom: string;
        /** Kolom yang sedang dipakai mengurutkan. */
        urut: string | null;
        arah: 'asc' | 'desc';
        num?: boolean;
        arahAwal?: 'asc' | 'desc';
    }>(),
    { arahAwal: 'asc' },
);

const emit = defineEmits<{ urutkan: [kolom: string, arah: 'asc' | 'desc'] }>();

const aktif = computed(() => props.urut === props.kolom);

const ariaSort = computed(() =>
    aktif.value ? (props.arah === 'asc' ? 'ascending' : 'descending') : 'none',
);

function klik() {
    const arahBaru = aktif.value
        ? props.arah === 'asc'
            ? 'desc'
            : 'asc'
        : props.arahAwal;
    emit('urutkan', props.kolom, arahBaru);
}
</script>

<template>
    <th :class="{ num }" :aria-sort="ariaSort">
        <button
            type="button"
            class="kepala-urut"
            :class="{ 'is-aktif': aktif }"
            @click="klik"
        >
            <span>{{ label }}</span>
            <ArrowUp
                v-if="aktif && arah === 'asc'"
                :size="14"
                :stroke-width="2"
                aria-hidden="true"
            />
            <ArrowDown
                v-else-if="aktif"
                :size="14"
                :stroke-width="2"
                aria-hidden="true"
            />
            <ArrowUpDown
                v-else
                class="ikon-diam"
                :size="14"
                :stroke-width="1.75"
                aria-hidden="true"
            />
        </button>
    </th>
</template>

<style scoped>
.kepala-urut {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px 4px;
    margin: -2px -4px;
    border: 0;
    border-radius: var(--radius-xs);
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    white-space: nowrap;
}

th.num .kepala-urut {
    flex-direction: row-reverse;
}

.kepala-urut:hover {
    background: rgba(11, 107, 98, 0.08);
}

.kepala-urut.is-aktif {
    color: var(--teal-700);
}

.ikon-diam {
    opacity: 0.35;
}

.kepala-urut:hover .ikon-diam {
    opacity: 0.8;
}
</style>
