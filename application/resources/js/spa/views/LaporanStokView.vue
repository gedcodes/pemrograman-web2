<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ambil, ApiError } from '../api/client';
import type { LaporanStok } from '../api/types';
import { angka, rupiah } from '../composables/format';
import KeadaanData from '../components/KeadaanData.vue';
import TombolUnduh from '../components/TombolUnduh.vue';
import StokBadge from '../components/StokBadge.vue';

const data = ref<LaporanStok | null>(null);
const memuat = ref(true);
const galat = ref<string | null>(null);

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        data.value = await ambil<LaporanStok>('/reports/stock');
    } catch (e) {
        galat.value =
            e instanceof ApiError ? e.message : 'Gagal memuat laporan.';
    } finally {
        memuat.value = false;
    }
}

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <p class="caption">
            Posisi stok saat ini. Unduhan memuat seluruh produk beserta nilai
            persediaannya.
        </p>
        <TombolUnduh url="/reports/stock/unduh" nama="laporan-stok" />
    </div>

    <KeadaanData :memuat="memuat" :galat="galat" kerangka="halaman">
        <template #aksi
            ><button class="btn btn-soft" @click="muat">
                Coba lagi
            </button></template
        >

        <div v-if="data" class="stack" style="gap: var(--space-5)">
            <section class="grid-stats grid">
                <div class="card">
                    <p class="overline">Jumlah produk</p>
                    <p class="nilai">{{ angka(data.jumlah_produk) }}</p>
                </div>
                <div class="card">
                    <p class="overline">Total unit</p>
                    <p class="nilai">{{ angka(data.total_unit) }}</p>
                </div>
                <div class="card">
                    <p class="overline">Nilai persediaan</p>
                    <p class="nilai">{{ rupiah(data.nilai_persediaan) }}</p>
                    <p class="caption">Dinilai pada harga beli</p>
                </div>
                <div class="card">
                    <p class="overline">Produk habis</p>
                    <p class="nilai">{{ angka(data.produk_habis) }}</p>
                </div>
            </section>

            <section class="table-wrap">
                <div class="tabel-kepala">
                    <h2>Stok menipis ({{ data.produk_stok_menipis }})</h2>
                </div>
                <div class="table-scroll">
                    <table class="data">
                        <thead>
                            <tr>
                                <th>Produk</th>
                                <th>Kategori</th>
                                <th class="num">Stok</th>
                                <th class="num">Minimum</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="p in data.daftar_stok_menipis"
                                :key="p.id"
                            >
                                <td>{{ p.nama_produk }}</td>
                                <td>{{ p.category?.nama_kategori ?? '-' }}</td>
                                <td class="num">{{ angka(p.stok) }}</td>
                                <td class="num">{{ angka(p.stok_minimum) }}</td>
                                <td>
                                    <StokBadge
                                        :stok="p.stok"
                                        :minimum="p.stok_minimum"
                                    />
                                </td>
                            </tr>
                            <tr v-if="data.daftar_stok_menipis.length === 0">
                                <td colspan="5" class="muted">
                                    Semua stok aman.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </KeadaanData>
</template>

<style scoped>
.nilai {
    font: var(--text-h2);
    letter-spacing: var(--tracking-h2);
    font-variant-numeric: tabular-nums;
    margin-top: var(--space-2);
}

.tabel-kepala {
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--divider);
}
</style>
