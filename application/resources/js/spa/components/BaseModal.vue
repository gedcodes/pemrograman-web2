<script setup lang="ts">
import { X } from '@lucide/vue';
import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
} from 'reka-ui';

/**
 * Modal di atas primitif Dialog reka-ui.
 *
 * Primitif itu yang memberi: fokus terkunci di dalam modal, fokus kembali ke
 * tombol pemicu saat ditutup, gulir halaman terkunci, dan tumpukan lapisan.
 * Yang terakhir penting: menekan Esc saat daftar BaseSelect terbuka cukup
 * menutup daftarnya, bukan ikut menutup modal beserta isian formulirnya.
 */
const props = defineProps<{
    judul: string;
    lebar?: string;
    deskripsi?: string;
    /**
     * Tolak penutupan (Esc, klik latar, tombol ×) selama proses berjalan,
     * supaya permintaan yang sedang dikirim tidak kehilangan formulirnya.
     */
    terkunci?: boolean;
    /** Klik di luar modal tidak menutupnya. Dipakai modal berisi formulir. */
    formulir?: boolean;
    /** Saat dicetak, hanya isi modal ini yang keluar di kertas (struk). */
    cetak?: boolean;
}>();

const emit = defineEmits<{ tutup: [] }>();

function ubahBuka(buka: boolean) {
    if (!buka && !props.terkunci) emit('tutup');
}

/* Formulir yang sudah terisi tidak boleh hilang karena salah klik di latar. */
function klikLuar(e: Event) {
    if (props.formulir || props.terkunci) e.preventDefault();
}

/**
 * Bawaan primitifnya memfokuskan elemen pertama, yaitu tombol × di kepala
 * modal. Untuk formulir, fokus langsung ke isian pertama (atau elemen
 * bertanda `data-fokus-awal`). Modal konfirmasi jatuh ke tombol pertama di
 * kaki, yaitu "Batal", pilihan yang aman.
 */
function fokusAwal(e: Event) {
    const wadah = e.target;
    if (!(wadah instanceof HTMLElement)) return;

    const sasaran =
        wadah.querySelector<HTMLElement>('[data-fokus-awal]') ??
        wadah.querySelector<HTMLElement>(
            '.modal-body :is(input, textarea, button, [role="combobox"]):not([disabled]):not([type="hidden"])',
        ) ??
        wadah.querySelector<HTMLElement>('.modal-aksi button:not([disabled])');

    if (sasaran) {
        e.preventDefault();
        sasaran.focus();
    }
}
</script>

<template>
    <DialogRoot :open="true" @update:open="ubahBuka">
        <DialogPortal>
            <DialogOverlay class="modal-latar no-print" />
            <DialogContent
                class="modal"
                :class="{ 'area-cetak': props.cetak }"
                :style="{ maxWidth: props.lebar ?? '560px' }"
                v-bind="
                    props.deskripsi ? {} : { 'aria-describedby': undefined }
                "
                @pointer-down-outside="klikLuar"
                @interact-outside="klikLuar"
                @open-auto-focus="fokusAwal"
            >
                <header class="modal-head no-print">
                    <DialogTitle class="modal-judul">{{
                        props.judul
                    }}</DialogTitle>
                    <DialogClose
                        class="btn btn-ghost btn-sm btn-ikon"
                        aria-label="Tutup"
                        :disabled="props.terkunci"
                    >
                        <X :size="18" :stroke-width="1.75" aria-hidden="true" />
                    </DialogClose>
                </header>
                <DialogDescription
                    v-if="props.deskripsi"
                    class="modal-deskripsi no-print"
                >
                    {{ props.deskripsi }}
                </DialogDescription>
                <div v-if="$slots.default" class="modal-body">
                    <slot />
                </div>
                <footer v-if="$slots.aksi" class="modal-aksi no-print">
                    <slot name="aksi" />
                </footer>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<style>
/* Tidak scoped: elemen di bawah dipindah ke <body> oleh DialogPortal. */
.modal-latar {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    background: rgba(11, 43, 39, 0.45);
    backdrop-filter: blur(2px);
    animation: modal-pudar 200ms var(--ease);
}

.modal {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: var(--z-modal);
    transform: translate(-50%, -50%);
    width: calc(100% - 2 * var(--space-4));
    max-height: calc(100dvh - 2 * var(--space-8));
    display: flex;
    flex-direction: column;
    background: var(--surface-crisp);
    border-radius: var(--radius-2xl);
    box-shadow: var(--shadow-raised-lg);
    animation: modal-muncul var(--dur-slow) var(--ease);
}

.modal:focus {
    outline: none;
}

.modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--divider);
}

.modal-judul {
    font: var(--text-h2);
    letter-spacing: var(--tracking-h2);
}

.modal-deskripsi {
    padding: var(--space-4) var(--space-6) 0;
    font: var(--text-small);
    color: var(--text-secondary);
}

.modal-body {
    padding: var(--space-6);
    overflow-y: auto;
}

/* Modal konfirmasi tanpa isi: deskripsi langsung disusul tombol aksi. */
.modal-deskripsi + .modal-aksi {
    margin-top: var(--space-5);
}

.modal-aksi {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--divider);
}

@keyframes modal-pudar {
    from {
        opacity: 0;
    }
}

@keyframes modal-muncul {
    from {
        opacity: 0;
        transform: translate(-50%, -48%) scale(0.97);
    }
}

/* Modal bertanda `cetak` (struk): saat dicetak, seluruh aplikasi di belakangnya
   disembunyikan dan isi modal mengalir biasa di atas kertas. */
@media print {
    body:has(.area-cetak) #spa {
        display: none !important;
    }

    .modal.area-cetak {
        position: static;
        transform: none;
        width: auto;
        max-width: none !important;
        max-height: none;
        box-shadow: none;
        border-radius: 0;
        animation: none;
    }

    .modal.area-cetak .modal-body {
        padding: 0;
        overflow: visible;
    }
}
</style>
