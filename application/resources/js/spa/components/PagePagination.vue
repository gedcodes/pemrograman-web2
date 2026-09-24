<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { computed } from 'vue';
import type { PaginationMeta } from '../api/client';
import { angka } from '../composables/format';
import { nomorHalaman } from '../composables/halaman';
import BaseSelect from './BaseSelect.vue';

/**
 * Kaki tabel: rentang baris yang tampil, nomor halaman, dan jumlah baris
 * per halaman.
 *
 * Tetap tampil walau hanya satu halaman, selama pilihan jumlah baris masih
 * berguna (datanya lebih banyak daripada ukuran terkecil).
 */
const props = defineProps<{ meta: PaginationMeta | null }>();
const emit = defineEmits<{ pindah: [halaman: number] }>();

/** Jumlah baris per halaman; tanpa v-model, pilihannya disembunyikan. */
const perHalaman = defineModel<number>('perHalaman');

const UKURAN = [10, 20, 50, 100].map((n) => ({
    nilai: n,
    label: `${n} baris`,
}));

const dari = computed(() =>
    props.meta && props.meta.total > 0
        ? (props.meta.current_page - 1) * props.meta.per_page + 1
        : 0,
);
const sampai = computed(() =>
    props.meta
        ? Math.min(
              props.meta.current_page * props.meta.per_page,
              props.meta.total,
          )
        : 0,
);

const nomor = computed(() =>
    props.meta
        ? nomorHalaman(props.meta.current_page, props.meta.last_page)
        : [],
);

const tampil = computed(
    () =>
        props.meta !== null &&
        (props.meta.last_page > 1 ||
            (perHalaman.value !== undefined &&
                props.meta.total > UKURAN[0].nilai)),
);

const ukuranPilihan = computed({
    get: () => perHalaman.value ?? null,
    set: (n: number | null) => {
        if (n !== null) perHalaman.value = n;
    },
});
</script>

<template>
    <nav
        v-if="tampil && props.meta"
        class="pager no-print"
        aria-label="Paginasi"
    >
        <span class="caption rentang">
            {{ angka(dari) }}–{{ angka(sampai) }} dari
            {{ angka(props.meta.total) }}
        </span>

        <div class="halaman">
            <button
                type="button"
                class="btn btn-soft btn-sm btn-ikon"
                aria-label="Halaman sebelumnya"
                :disabled="props.meta.current_page <= 1"
                @click="emit('pindah', props.meta.current_page - 1)"
            >
                <ChevronLeft :size="16" :stroke-width="2" aria-hidden="true" />
            </button>
            <template v-for="(n, i) in nomor" :key="`${n}-${i}`">
                <span v-if="n === '…'" class="elipsis" aria-hidden="true"
                    >…</span
                >
                <button
                    v-else
                    type="button"
                    class="btn btn-sm nomor"
                    :class="
                        n === props.meta.current_page
                            ? 'btn-primary'
                            : 'btn-ghost'
                    "
                    :aria-label="`Halaman ${n}`"
                    :aria-current="
                        n === props.meta.current_page ? 'page' : undefined
                    "
                    @click="n !== props.meta.current_page && emit('pindah', n)"
                >
                    {{ n }}
                </button>
            </template>
            <button
                type="button"
                class="btn btn-soft btn-sm btn-ikon"
                aria-label="Halaman berikutnya"
                :disabled="props.meta.current_page >= props.meta.last_page"
                @click="emit('pindah', props.meta.current_page + 1)"
            >
                <ChevronRight :size="16" :stroke-width="2" aria-hidden="true" />
            </button>
        </div>

        <div v-if="perHalaman !== undefined" class="ukuran">
            <BaseSelect
                v-model="ukuranPilihan"
                :opsi="UKURAN"
                aria-label="Jumlah baris per halaman"
            />
        </div>
    </nav>
</template>

<style scoped>
.pager {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--divider);
}

.halaman {
    display: flex;
    align-items: center;
    gap: var(--space-1);
}

.nomor {
    min-width: var(--control-h-sm);
    padding: 0 var(--space-2);
    font-variant-numeric: tabular-nums;
}

.elipsis {
    min-width: 24px;
    text-align: center;
    color: var(--text-muted);
}

.ukuran {
    width: 140px;
}

.ukuran :deep(.pilih-kontrol) {
    min-height: var(--control-h-sm);
}
</style>
