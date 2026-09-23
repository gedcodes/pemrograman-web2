<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import {
    ambilPenuh,
    ApiError,
    hapus,
    type PaginationMeta,
} from '../api/client';
import type { Category, Product } from '../api/types';
import { angka, gambarProduk, persen } from '../composables/format';
import { adalahAdmin } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import KeadaanData from '../components/KeadaanData.vue';
import PagePagination from '../components/PagePagination.vue';
import StokBadge from '../components/StokBadge.vue';

const daftar = ref<Product[]>([]);
const meta = ref<PaginationMeta | null>(null);
const kategori = ref<Category[]>([]);

const cari = ref('');
const filterKategori = ref<number | ''>('');
const hanyaMenipis = ref(false);
const halaman = ref(1);

const memuat = ref(true);
const galat = ref<string | null>(null);
const akanDihapus = ref<Product | null>(null);
const menghapus = ref(false);

let tunda: number | undefined;

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        const r = await ambilPenuh<Product[]>('/products', {
            page: halaman.value,
            q: cari.value || undefined,
            category_id: filterKategori.value || undefined,
            stok_menipis: hanyaMenipis.value ? 1 : undefined,
        });
        daftar.value = r.data;
        meta.value = r.meta ?? null;
    } catch (e) {
        galat.value =
            e instanceof ApiError ? e.message : 'Gagal memuat produk.';
    } finally {
        memuat.value = false;
    }
}

/* Pencarian ditunda 300 ms supaya tidak memanggil API pada setiap ketikan. */
watch(cari, () => {
    window.clearTimeout(tunda);
    tunda = window.setTimeout(() => {
        halaman.value = 1;
        void muat();
    }, 300);
});

watch([filterKategori, hanyaMenipis], () => {
    halaman.value = 1;
    void muat();
});

function pindah(h: number) {
    halaman.value = h;
    void muat();
}

async function konfirmasiHapus() {
    if (akanDihapus.value === null) return;
    menghapus.value = true;
    try {
        const r = await hapus(`/products/${akanDihapus.value.id}`);
        toast.sukses(r.message ?? 'Produk dihapus.');
        akanDihapus.value = null;
        await muat();
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal menghapus produk.',
        );
    } finally {
        menghapus.value = false;
    }
}

onMounted(async () => {
    const k = await ambilPenuh<Category[]>('/categories', { per_page: 100 });
    kategori.value = k.data;
    await muat();
});
</script>

<template>
    <div class="page-head">
        <div class="row row-wrap filter">
            <input
                v-model="cari"
                class="input cari"
                type="search"
                placeholder="Cari nama atau barcode…"
            />
            <select v-model="filterKategori" class="select">
                <option value="">Semua kategori</option>
                <option v-for="k in kategori" :key="k.id" :value="k.id">
                    {{ k.nama_kategori }}
                </option>
            </select>
            <label class="row toggle">
                <input v-model="hanyaMenipis" type="checkbox" />
                <span class="caption">Stok menipis saja</span>
            </label>
        </div>

        <RouterLink
            v-if="adalahAdmin"
            class="btn btn-primary"
            :to="{ name: 'produk-baru' }"
        >
            + Tambah Produk
        </RouterLink>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Tidak ada produk yang cocok dengan penyaring."
            :baris-skeleton="6"
        >
            <template #aksi>
                <button class="btn btn-soft" @click="muat">Muat ulang</button>
            </template>

            <div class="table-scroll">
                <table class="data">
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th>Kategori</th>
                            <th class="num">Harga beli</th>
                            <th class="num">Harga jual</th>
                            <th class="num">Margin</th>
                            <th class="num">Stok</th>
                            <th>Status</th>
                            <th v-if="adalahAdmin">
                                <span class="sr-only">Aksi</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in daftar" :key="p.id">
                            <td>
                                <div class="produk-sel">
                                    <div class="thumb">
                                        <img
                                            v-if="p.gambar"
                                            :src="gambarProduk(p.gambar) ?? ''"
                                            :alt="p.nama_produk"
                                            loading="lazy"
                                        />
                                        <span v-else aria-hidden="true"
                                            >📦</span
                                        >
                                    </div>
                                    <div>
                                        <p>{{ p.nama_produk }}</p>
                                        <p class="caption">
                                            {{ p.barcode ?? 'tanpa barcode' }}
                                        </p>
                                    </div>
                                </div>
                            </td>
                            <td>{{ p.category?.nama_kategori ?? '-' }}</td>
                            <td class="num">{{ angka(p.harga_beli) }}</td>
                            <td class="num">{{ angka(p.harga_jual) }}</td>
                            <td class="num">{{ persen(p.margin) }}</td>
                            <td class="num">
                                {{ angka(p.stok) }} {{ p.unit?.simbol ?? '' }}
                            </td>
                            <td>
                                <StokBadge
                                    :stok="p.stok"
                                    :minimum="p.stok_minimum"
                                />
                            </td>
                            <td v-if="adalahAdmin">
                                <div class="row">
                                    <RouterLink
                                        class="btn btn-soft btn-sm"
                                        :to="{
                                            name: 'produk-ubah',
                                            params: { id: p.id },
                                        }"
                                    >
                                        Ubah
                                    </RouterLink>
                                    <button
                                        class="btn btn-ghost btn-sm"
                                        @click="akanDihapus = p"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <PagePagination :meta="meta" @pindah="pindah" />
        </KeadaanData>
    </div>

    <BaseModal
        v-if="akanDihapus"
        judul="Hapus produk?"
        @tutup="akanDihapus = null"
    >
        <p>
            Produk <strong>{{ akanDihapus.nama_produk }}</strong> akan dihapus.
        </p>
        <p class="caption" style="margin-top: var(--space-2)">
            Produk yang pernah terjual tidak dapat dihapus, supaya riwayat struk
            lama tetap utuh.
        </p>

        <template #aksi>
            <button class="btn btn-soft" @click="akanDihapus = null">
                Batal
            </button>
            <button
                class="btn btn-danger"
                :disabled="menghapus"
                @click="konfirmasiHapus"
            >
                {{ menghapus ? 'Menghapus…' : 'Ya, hapus' }}
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.filter {
    flex: 1;
}

.cari {
    max-width: 280px;
}

.select {
    max-width: 200px;
}

.toggle {
    cursor: pointer;
}

.produk-sel {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.thumb {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-xs);
    background: var(--surface-sunken);
    overflow: hidden;
}

.thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
</style>
