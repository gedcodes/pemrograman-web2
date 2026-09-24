<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import { computed, useId } from 'vue';

/**
 * Pembungkus satu isian formulir: label, penanda wajib, teks bantuan, dan
 * pesan galat, beserta atribut aksesibilitas yang menghubungkan semuanya.
 *
 * Isiannya dipasang lewat slot dan menerima `id`, `invalid`, serta
 * `describedby`, sehingga label selalu tertaut dan pembaca layar membacakan
 * pesan galat saat isian difokuskan.
 *
 * Galat ditandai cincin merah + ikon + teks, tidak pernah warna saja
 * (DESIGN.md Bagian 3.1).
 */
const props = defineProps<{
    label: string;
    wajib?: boolean;
    galat?: string | null;
    bantuan?: string;
    /** Id isian bila perlu ditentukan sendiri; bawaannya dibuat otomatis. */
    untuk?: string;
}>();

const otomatis = useId();
const id = computed(() => props.untuk ?? `isian-${otomatis}`);
const idKeterangan = computed(() => `${id.value}-keterangan`);
const adaKeterangan = computed(() => Boolean(props.galat || props.bantuan));
</script>

<template>
    <div class="field" :class="{ 'is-error': props.galat }">
        <label :for="id">
            {{ props.label
            }}<span v-if="props.wajib" class="wajib" aria-hidden="true">*</span>
        </label>

        <slot
            :id="id"
            :invalid="Boolean(props.galat)"
            :describedby="adaKeterangan ? idKeterangan : undefined"
        />

        <p v-if="props.galat" :id="idKeterangan" class="field-error">
            <CircleAlert :size="14" :stroke-width="2" aria-hidden="true" />
            {{ props.galat }}
        </p>
        <p v-else-if="props.bantuan" :id="idKeterangan" class="caption">
            {{ props.bantuan }}
        </p>
    </div>
</template>

<style scoped>
.wajib {
    margin-left: 2px;
    color: var(--danger-text);
}

.field-error {
    display: flex;
    align-items: flex-start;
    gap: var(--space-1);
}

.field-error svg {
    flex: 0 0 auto;
    margin-top: 2px;
}
</style>
