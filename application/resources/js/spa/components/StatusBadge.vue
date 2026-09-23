<script setup lang="ts">
import { computed } from 'vue';
import { statusTransaksi } from '../composables/format';

const props = defineProps<{ status: string }>();

const info = computed(() => statusTransaksi(props.status));
</script>

<template>
    <!-- Selalu berbentuk pil, supaya tidak tertukar dengan tombol
         yang selalu persegi-membulat (DESIGN.md Bagian 3.6). -->
    <span class="badge" :class="info.kelas">{{ info.label }}</span>
</template>
