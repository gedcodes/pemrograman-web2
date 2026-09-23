<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ambilPenuh, ApiError, type PaginationMeta } from '../api/client';
import type { Product } from '../api/types';
import { angka, rupiah } from '../composables/format';
import KeadaanData from '../components/KeadaanData.vue';
import PagePagination from '../components/PagePagination.vue';
import StokBadge from '../components/StokBadge.vue';

const daftar = ref<Product[]>([]);
const meta = ref<PaginationMeta | null>(null);
const cari = ref('');
const hanyaMenipis = ref(false);
const halaman = ref(1);
const memuat = ref(true);
const galat = ref<string | null>(null);

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        const r = await ambilPenuh<Product[]>('/products', {
            page: halaman.value,
            q: cari.value || undefined,
            stok_menipis: hanyaMenipis.value ? 1 : undefined,
        });
        daftar.value = r.data;
        meta.value = r.meta ?? null;
    } catch (e) {
        galat.value = e instanceof ApiError ? e.message : 'Gagal memuat stok.';
    } finally {
        memuat.value = false;
    }
}

watch([cari, hanyaMenipis], () => {
    halaman.value = 1;
    void muat();
});

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <div class="row row-wrap">
            <input
                v-model="cari"
                class="input"
                style="max-width: 280px"
                type="search"
                placeholder="Cari produk…"
            />
            <label class="row" style="cursor: pointer">
                <input v-model="hanyaMenipis" type="checkbox" />
                <span class="caption">Stok menipis saja</span>
            </label>
        </div>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
        >
            <div class="table-scroll">
                <table class="data">
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th>Satuan</th>
                            <th class="num">Stok</th>
                            <th class="num">Minimum</th>
                            <th class="num">Nilai persediaan</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in daftar" :key="p.id">
                            <td>{{ p.nama_produk }}</td>
                            <td>{{ p.unit?.nama_satuan ?? '-' }}</td>
                            <td class="num">{{ angka(p.stok) }}</td>
                            <td class="num">{{ angka(p.stok_minimum) }}</td>
                            <td class="num">
                                {{ rupiah(p.stok * p.harga_beli) }}
                            </td>
                            <td>
                                <StokBadge
                                    :stok="p.stok"
                                    :minimum="p.stok_minimum"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <PagePagination
                :meta="meta"
                @pindah="
                    (h) => {
                        halaman = h;
                        muat();
                    }
                "
            />
        </KeadaanData>
    </div>
</template>
