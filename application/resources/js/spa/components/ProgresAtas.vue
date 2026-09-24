<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { sedangBekerja } from '../stores/progres';

/**
 * Batang progres tipis di tepi atas layar, menyala untuk setiap perpindahan
 * halaman dan setiap panggilan ke server.
 *
 * Progres sebenarnya tidak diketahui, jadi batang "merayap" mendekati 90%
 * lalu melompat ke 100% saat pekerjaan selesai. Permintaan yang selesai di
 * bawah TUNDA ms tidak memunculkan batang sama sekali, supaya layar tidak
 * berkedip untuk respons yang memang sudah cepat.
 */
const TUNDA = 150;

const tampil = ref(false);
const lebar = ref(0);

let tundaMulai: number | undefined;
let rayap: number | undefined;
let tundaHilang: number | undefined;

function mulai() {
    window.clearTimeout(tundaHilang);
    tampil.value = true;
    lebar.value = 0.08;
    window.clearInterval(rayap);
    rayap = window.setInterval(() => {
        lebar.value += (0.9 - lebar.value) * 0.08;
    }, 200);
}

function selesai() {
    window.clearInterval(rayap);
    lebar.value = 1;
    tundaHilang = window.setTimeout(() => {
        tampil.value = false;
        lebar.value = 0;
    }, 320);
}

watch(sedangBekerja, (aktif) => {
    if (aktif) {
        window.clearTimeout(tundaMulai);
        if (tampil.value) {
            // Pekerjaan baru datang saat batang sedang menghilang.
            mulai();
        } else {
            tundaMulai = window.setTimeout(mulai, TUNDA);
        }
    } else {
        window.clearTimeout(tundaMulai);
        if (tampil.value) selesai();
    }
});

onUnmounted(() => {
    window.clearTimeout(tundaMulai);
    window.clearTimeout(tundaHilang);
    window.clearInterval(rayap);
});
</script>

<template>
    <div
        class="progres-atas no-print"
        :class="{ 'is-tampil': tampil }"
        role="progressbar"
        aria-label="Memuat"
        :aria-hidden="!tampil"
        :aria-busy="tampil"
    >
        <div class="progres-isi" :style="{ transform: `scaleX(${lebar})` }" />
    </div>
</template>

<style scoped>
.progres-atas {
    position: fixed;
    inset: 0 0 auto;
    z-index: var(--z-progres);
    height: 3px;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--dur-base) var(--ease);
}

.progres-atas.is-tampil {
    opacity: 1;
}

.progres-isi {
    height: 100%;
    transform-origin: left center;
    background: var(--teal-600);
    box-shadow: 0 0 8px rgba(13, 124, 116, 0.55);
    transition: transform var(--dur-slow) var(--ease);
}
</style>
