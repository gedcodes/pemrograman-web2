<script setup lang="ts">
// Kerangka aplikasi. Halaman login berdiri sendiri, sedangkan seluruh
// halaman lain dibungkus AppLayout lewat rute bersarang.
//
// Batang progres dipasang di sini, bukan di AppLayout, supaya ikut menyala
// di halaman login dan pada pemuatan pertama sebelum layout tampil.
import ProgresAtas from './components/ProgresAtas.vue';
</script>

<template>
    <ProgresAtas />
    <RouterView />
</template>
