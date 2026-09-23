<script setup lang="ts">
defineProps<{
    label: string;
    nilai: string;
    keterangan?: string;
    nada?: 'netral' | 'peringatan';
}>();
</script>

<template>
    <div class="card stat">
        <p class="overline">{{ label }}</p>
        <p
            class="stat-nilai"
            :class="{ 'stat-peringatan': nada === 'peringatan' }"
        >
            {{ nilai }}
        </p>
        <p v-if="keterangan" class="caption">{{ keterangan }}</p>
    </div>
</template>

<style scoped>
.stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

/* Angka hero: Outfit 600 + tabular-nums (DESIGN.md Bagian 4.2). */
.stat-nilai {
    font: var(--text-h1);
    letter-spacing: var(--tracking-h1);
    font-variant-numeric: tabular-nums;
}

.stat-peringatan {
    color: var(--warning-text);
}
</style>
