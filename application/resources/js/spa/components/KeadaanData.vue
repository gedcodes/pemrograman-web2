<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
    memuat: boolean;
    galat?: string | null;
    kosong?: boolean;
    pesanKosong?: string;
    barisSkeleton?: number;
    /** Bentuk kerangka saat muat pertama: tabel, atau halaman laporan penuh. */
    kerangka?: 'tabel' | 'halaman';
}>();

/**
 * Isi sudah pernah tampil sekali. Sejak saat itu pemuatan ulang (ganti
 * halaman, ganti penyaring, tombol Terapkan) TIDAK lagi menukar isi dengan
 * kerangka. Isi lama dibiarkan tampil, diredupkan, dan diberi indikator.
 * Tabel yang tiba-tiba lenyap lalu muncul lagi membuat mata kehilangan
 * posisi dan tata letak ikut melompat.
 */
const sudahTampil = ref(!props.memuat);

watch(
    () => props.memuat,
    (m) => {
        if (!m) sudahTampil.value = true;
    },
);

/* Lebar kolom kerangka dibuat berbeda-beda supaya menyerupai tabel sungguhan. */
const kolom = ['38%', '18%', '14%', '12%'];
</script>

<template>
    <!-- Muat pertama: kerangka yang menyerupai bentuk isi aslinya. -->
    <div
        v-if="memuat && !sudahTampil"
        class="kerangka"
        aria-busy="true"
        aria-live="polite"
    >
        <span class="sr-only">Memuat data…</span>

        <template v-if="kerangka === 'halaman'">
            <div class="kerangka-kartu">
                <div v-for="i in 4" :key="i" class="kartu-hantu">
                    <div class="skeleton" style="width: 45%; height: 12px" />
                    <div class="skeleton" style="width: 75%; height: 28px" />
                    <div class="skeleton" style="width: 55%; height: 12px" />
                </div>
            </div>
            <div class="skeleton" style="height: 220px" />
        </template>

        <div v-else class="kerangka-tabel">
            <div class="kerangka-kepala" />
            <div
                v-for="i in barisSkeleton ?? 5"
                :key="i"
                class="kerangka-baris"
                :style="{ opacity: 1 - (i - 1) * 0.12 }"
            >
                <div
                    v-for="(l, k) in kolom"
                    :key="k"
                    class="skeleton"
                    :style="{ width: l, height: '14px' }"
                />
            </div>
        </div>
    </div>

    <!-- Muat ulang: isi lama tetap di tempat, diredupkan, dan tidak bisa diklik. -->
    <div
        v-else
        class="isi"
        :class="{ 'is-memuat': memuat }"
        :aria-busy="memuat"
    >
        <div v-if="memuat" class="indikator" role="status">
            <span class="putar" aria-hidden="true" />
            Memuat…
        </div>

        <div v-if="galat" class="keadaan">
            <p class="keadaan-galat">{{ galat }}</p>
            <slot name="aksi" />
        </div>

        <div v-else-if="kosong" class="keadaan">
            <p class="muted">{{ pesanKosong ?? 'Belum ada data.' }}</p>
            <slot name="aksi" />
        </div>

        <slot v-else />
    </div>
</template>

<style scoped>
.kerangka {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
}

.kerangka-kartu {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-5);
}

.kartu-hantu {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-6);
    border-radius: var(--radius-xl);
    background: var(--surface-raised);
    box-shadow: var(--shadow-raised-sm);
}

.kerangka-tabel {
    display: flex;
    flex-direction: column;
}

.kerangka-kepala {
    height: 44px;
    background: var(--surface-header);
}

.kerangka-baris {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: var(--table-row-h);
    padding: 0 var(--space-4);
    border-bottom: 1px solid var(--divider);
}

.isi {
    position: relative;
}

.isi.is-memuat > :not(.indikator) {
    opacity: 0.5;
    pointer-events: none;
    transition: opacity var(--dur-base) var(--ease);
}

.indikator {
    position: absolute;
    top: var(--space-3);
    left: 50%;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    transform: translateX(-50%);
    border-radius: var(--radius-pill);
    background: var(--surface-crisp);
    box-shadow: var(--shadow-crisp);
    color: var(--teal-700);
    font: var(--text-caption);
    animation: muncul var(--dur-base) var(--ease);
}

.putar {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: putar 0.7s linear infinite;
}

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

@keyframes muncul {
    from {
        opacity: 0;
        transform: translate(-50%, -4px);
    }
}

@keyframes putar {
    to {
        transform: rotate(360deg);
    }
}
</style>
