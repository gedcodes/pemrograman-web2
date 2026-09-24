<script setup lang="ts">
import { Search } from '@lucide/vue';
import { ref } from 'vue';
import type { Product } from '../api/types';
import { angka, rupiah } from '../composables/format';
import { useDaftarServer } from '../composables/useDaftarServer';
import BaseSwitch from '../components/BaseSwitch.vue';
import KeadaanData from '../components/KeadaanData.vue';
import KepalaUrut from '../components/KepalaUrut.vue';
import PagePagination from '../components/PagePagination.vue';
import StokBadge from '../components/StokBadge.vue';

const cari = ref('');
const hanyaMenipis = ref(false);

const {
    daftar,
    meta,
    memuat,
    galat,
    urut,
    arah,
    perHalaman,
    muat,
    pindahHalaman,
    urutkan,
} = useDaftarServer<Product>('/products', () => ({
    q: cari.value || undefined,
    stok_menipis: hanyaMenipis.value ? 1 : undefined,
}));
</script>

<template>
    <div class="page-head">
        <div class="penyaring">
            <label class="kotak-cari">
                <Search :size="18" :stroke-width="1.75" aria-hidden="true" />
                <span class="sr-only">Cari produk</span>
                <input
                    v-model="cari"
                    type="search"
                    placeholder="Cari nama atau barcode…"
                />
            </label>
            <BaseSwitch v-model="hanyaMenipis">Stok menipis saja</BaseSwitch>
        </div>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Tidak ada produk yang cocok dengan penyaring."
        >
            <template #aksi>
                <button v-if="galat" class="btn btn-soft" @click="muat">
                    Coba lagi
                </button>
            </template>

            <div class="table-scroll">
                <table class="data">
                    <thead>
                        <tr>
                            <KepalaUrut
                                label="Produk"
                                kolom="nama_produk"
                                :urut="urut"
                                :arah="arah"
                                @urutkan="urutkan"
                            />
                            <th>Satuan</th>
                            <KepalaUrut
                                label="Stok"
                                kolom="stok"
                                :urut="urut"
                                :arah="arah"
                                num
                                @urutkan="urutkan"
                            />
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
                v-model:per-halaman="perHalaman"
                :meta="meta"
                @pindah="pindahHalaman"
            />
        </KeadaanData>
    </div>
</template>
