<script setup lang="ts">
import { FileSpreadsheet, FileText } from '@lucide/vue';
import { ref } from 'vue';
import { ApiError, unduh } from '../api/client';
import { toast } from '../stores/toast';

/**
 * Tombol Unduh PDF dan Unduh Excel untuk laporan, menggantikan tombol Cetak.
 *
 * Berkasnya dibuat server dari data yang sama dengan yang tampil di layar
 * (`LaporanService`), jadi angka di berkas selalu cocok dengan layar.
 */
const props = defineProps<{
    /** Endpoint unduhan, mis. "/reports/sales/unduh". */
    url: string;
    /** Parameter periode saat ini; dibaca ketika tombol ditekan. */
    params?: () => Record<string, unknown>;
    /** Nama cadangan bila server tidak menyebut nama berkas. */
    nama: string;
    disabled?: boolean;
}>();

type Format = 'pdf' | 'xlsx';

const menyiapkan = ref<Format | null>(null);

async function ambil(format: Format) {
    if (menyiapkan.value) return;
    menyiapkan.value = format;
    try {
        await unduh(
            props.url,
            { ...props.params?.(), format },
            `${props.nama}.${format}`,
        );
        toast.sukses(
            format === 'pdf' ? 'PDF diunduh.' : 'Berkas Excel diunduh.',
        );
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal mengunduh.');
    } finally {
        menyiapkan.value = null;
    }
}
</script>

<template>
    <div class="unduh" role="group" aria-label="Unduh laporan">
        <button
            class="btn btn-soft"
            :disabled="props.disabled || menyiapkan !== null"
            :aria-busy="menyiapkan === 'pdf'"
            @click="ambil('pdf')"
        >
            <FileText :size="18" :stroke-width="1.75" aria-hidden="true" />
            {{ menyiapkan === 'pdf' ? 'Menyiapkan…' : 'Unduh PDF' }}
        </button>
        <button
            class="btn btn-soft"
            :disabled="props.disabled || menyiapkan !== null"
            :aria-busy="menyiapkan === 'xlsx'"
            @click="ambil('xlsx')"
        >
            <FileSpreadsheet
                :size="18"
                :stroke-width="1.75"
                aria-hidden="true"
            />
            {{ menyiapkan === 'xlsx' ? 'Menyiapkan…' : 'Unduh Excel' }}
        </button>
    </div>
</template>

<style scoped>
.unduh {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
}
</style>
