<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const props = defineProps<{ judul: string; lebar?: string }>();
const emit = defineEmits<{ tutup: [] }>();

function padaTombol(e: KeyboardEvent) {
    if (e.key === 'Escape') emit('tutup');
}

onMounted(() => {
    document.addEventListener('keydown', padaTombol);
    document.body.style.overflow = 'hidden';
});

onUnmounted(() => {
    document.removeEventListener('keydown', padaTombol);
    document.body.style.overflow = '';
});
</script>

<template>
    <div class="backdrop no-print" @click.self="emit('tutup')">
        <div
            class="modal"
            role="dialog"
            aria-modal="true"
            :aria-label="props.judul"
            :style="{ maxWidth: props.lebar ?? '560px' }"
        >
            <header class="modal-head">
                <h2>{{ props.judul }}</h2>
                <button
                    class="btn btn-ghost btn-sm"
                    aria-label="Tutup"
                    @click="emit('tutup')"
                >
                    &times;
                </button>
            </header>
            <div class="modal-body">
                <slot />
            </div>
            <footer v-if="$slots.aksi" class="modal-aksi">
                <slot name="aksi" />
            </footer>
        </div>
    </div>
</template>

<style scoped>
.backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-toast);
    background: rgba(11, 43, 39, 0.45);
    display: grid;
    place-items: center;
    padding: var(--space-4);
    animation: fade 200ms var(--ease);
}

.modal {
    width: 100%;
    max-height: calc(100dvh - 2 * var(--space-8));
    display: flex;
    flex-direction: column;
    background: var(--surface-crisp);
    border-radius: var(--radius-2xl);
    box-shadow: var(--shadow-raised-lg);
    animation: pop var(--dur-slow) var(--ease);
}

.modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--divider);
}

.modal-body {
    padding: var(--space-6);
    overflow-y: auto;
}

.modal-aksi {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--divider);
}

@keyframes fade {
    from {
        opacity: 0;
    }
}
@keyframes pop {
    from {
        opacity: 0;
        transform: scale(0.96);
    }
}
</style>
