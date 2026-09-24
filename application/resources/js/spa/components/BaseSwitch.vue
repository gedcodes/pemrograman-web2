<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui';

/**
 * Saklar hidup/mati untuk isian ya-tidak (aktif, berlaku).
 *
 * Lebih jelas daripada kotak centang untuk menyatakan KEADAAN, dan area
 * kliknya mencakup seluruh teks di sampingnya.
 */
defineProps<{ id?: string; disabled?: boolean }>();

const model = defineModel<boolean>({ required: true });
</script>

<template>
    <label class="saklar-baris" :class="{ 'is-nonaktif': disabled }">
        <SwitchRoot
            :id="id"
            v-model="model"
            class="saklar"
            :disabled="disabled"
        >
            <SwitchThumb class="saklar-jempol" />
        </SwitchRoot>
        <span class="saklar-teks"><slot /></span>
    </label>
</template>

<style scoped>
.saklar-baris {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    cursor: pointer;
}

.saklar-baris.is-nonaktif {
    opacity: 0.6;
    cursor: not-allowed;
}

.saklar {
    position: relative;
    flex: 0 0 auto;
    width: 44px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-pill);
    background: var(--surface-sunken);
    box-shadow: var(--shadow-inset-sm);
    cursor: inherit;
    transition: background-color var(--dur-base) var(--ease);
}

.saklar[data-state='checked'] {
    background: var(--teal-700);
}

.saklar-jempol {
    display: block;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--surface-crisp);
    box-shadow: 0 1px 3px rgba(22, 48, 44, 0.3);
    transform: translateX(3px);
    transition: transform var(--dur-base) var(--ease);
}

.saklar-jempol[data-state='checked'] {
    transform: translateX(21px);
}

.saklar-teks {
    font: var(--text-small);
    color: var(--text-secondary);
}
</style>
