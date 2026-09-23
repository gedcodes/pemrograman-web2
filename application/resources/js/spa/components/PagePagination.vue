<script setup lang="ts">
import type { PaginationMeta } from '../api/client';

const props = defineProps<{ meta: PaginationMeta | null }>();
const emit = defineEmits<{ pindah: [halaman: number] }>();
</script>

<template>
    <div v-if="props.meta && props.meta.last_page > 1" class="pager no-print">
        <span class="caption">
            Halaman {{ props.meta.current_page }} dari
            {{ props.meta.last_page }} &middot; {{ props.meta.total }} baris
        </span>
        <div class="row">
            <button
                class="btn btn-soft btn-sm"
                :disabled="props.meta.current_page <= 1"
                @click="emit('pindah', props.meta.current_page - 1)"
            >
                Sebelumnya
            </button>
            <button
                class="btn btn-soft btn-sm"
                :disabled="props.meta.current_page >= props.meta.last_page"
                @click="emit('pindah', props.meta.current_page + 1)"
            >
                Berikutnya
            </button>
        </div>
    </div>
</template>

<style scoped>
.pager {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
}
</style>
