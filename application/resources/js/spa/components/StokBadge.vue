<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ stok: number; minimum: number }>();

const info = computed(() => {
    if (props.stok <= 0) return { label: 'Habis', kelas: 'badge-danger' };
    if (props.stok <= props.minimum)
        return { label: 'Menipis', kelas: 'badge-warning' };
    return { label: 'Aman', kelas: 'badge-success' };
});
</script>

<template>
    <span class="badge" :class="info.kelas">{{ info.label }}</span>
</template>
