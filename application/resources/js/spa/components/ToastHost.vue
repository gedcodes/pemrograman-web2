<script setup lang="ts">
import { toasts, tutupToast } from '../stores/toast';
</script>

<template>
    <!-- Masuk dari kanan-atas, tahan 3,5 detik (DESIGN.md Bagian 6.2). -->
    <div class="toast-host no-print" aria-live="polite">
        <TransitionGroup name="toast">
            <div
                v-for="t in toasts"
                :key="t.id"
                class="toast"
                :class="`toast-${t.jenis}`"
            >
                <span>{{ t.pesan }}</span>
                <button
                    class="toast-x"
                    aria-label="Tutup"
                    @click="tutupToast(t.id)"
                >
                    &times;
                </button>
            </div>
        </TransitionGroup>
    </div>
</template>

<style scoped>
.toast-host {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: min(380px, calc(100vw - 2 * var(--space-4)));
}

.toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--surface-crisp);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-crisp);
    font: var(--text-small);
    border-left: 4px solid var(--text-muted);
}

.toast-sukses {
    border-left-color: var(--success-text);
    color: var(--success-text);
}
.toast-galat {
    border-left-color: var(--danger-text);
    color: var(--danger-text);
}
.toast-peringatan {
    border-left-color: var(--warning-text);
    color: var(--warning-text);
}
.toast-info {
    border-left-color: var(--info-text);
    color: var(--info-text);
}

.toast-x {
    margin-left: auto;
    background: none;
    border: 0;
    cursor: pointer;
    font-size: 1.25rem;
    line-height: 1;
    color: inherit;
    opacity: 0.6;
}

.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translateX(16px);
}

.toast-enter-active,
.toast-leave-active {
    transition:
        opacity var(--dur-base) var(--ease),
        transform var(--dur-base) var(--ease);
}
</style>
