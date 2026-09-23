<script setup lang="ts">
defineProps<{
    memuat: boolean;
    galat?: string | null;
    kosong?: boolean;
    pesanKosong?: string;
    barisSkeleton?: number;
}>();
</script>

<template>
    <!-- Satu komponen untuk tiga keadaan yang selalu muncul bersama:
         sedang memuat, gagal, dan tidak ada data. -->
    <div v-if="memuat" class="stack" style="padding: var(--space-6)">
        <div
            v-for="i in barisSkeleton ?? 4"
            :key="i"
            class="skeleton"
            style="height: 44px"
        />
    </div>

    <div v-else-if="galat" class="keadaan">
        <p class="keadaan-galat">{{ galat }}</p>
        <slot name="aksi" />
    </div>

    <div v-else-if="kosong" class="keadaan">
        <p class="muted">{{ pesanKosong ?? 'Belum ada data.' }}</p>
        <slot name="aksi" />
    </div>

    <slot v-else />
</template>

<style scoped>
.keadaan {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-12) var(--space-6);
    text-align: center;
}

.keadaan-galat {
    color: var(--danger-text);
    font: var(--text-body-strong);
}
</style>
