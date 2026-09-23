<script setup lang="ts"></script>

<template>
    <div class="layar">
        <div
            class="card stack"
            style="max-width: 420px; text-align: center; align-items: center"
        >
            <h1>404</h1>
            <p class="muted">Halaman yang Anda cari tidak ada.</p>
            <RouterLink class="btn btn-primary" to="/"
                >Kembali ke Dashboard</RouterLink
            >
        </div>
    </div>
</template>

<style scoped>
.layar {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--space-4);
}
</style>
