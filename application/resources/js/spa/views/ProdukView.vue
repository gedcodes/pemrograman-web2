<script setup lang="ts">
import { Package, Pencil, Plus, Search, Trash2 } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
import { ambilPenuh, ApiError, hapus } from '../api/client';
import type { Category, Product } from '../api/types';
import { angka, gambarProduk, persen } from '../composables/format';
import { keOpsi } from '../composables/pilihan';
import { useDaftarServer } from '../composables/useDaftarServer';
import { adalahAdmin } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import BaseSelect from '../components/BaseSelect.vue';
import BaseSwitch from '../components/BaseSwitch.vue';
import KeadaanData from '../components/KeadaanData.vue';
import KepalaUrut from '../components/KepalaUrut.vue';
import PagePagination from '../components/PagePagination.vue';
import StokBadge from '../components/StokBadge.vue';

const kategori = ref<Category[]>([]);
const opsiKategori = computed(() =>
    keOpsi(
        kategori.value,
        (k) => k.id,
        (k) => k.nama_kategori,
    ),
);

const cari = ref('');
const filterKategori = ref<number | null>(null);
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
    category_id: filterKategori.value ?? undefined,
    stok_menipis: hanyaMenipis.value ? 1 : undefined,
}));

const adaPenyaring = computed(
    () =>
        cari.value !== '' ||
        filterKategori.value !== null ||
        hanyaMenipis.value,
);

function hapusPenyaring() {
    cari.value = '';
    filterKategori.value = null;
    hanyaMenipis.value = false;
}

/* ---------------------------------------------------------------- hapus */

const akanDihapus = ref<Product | null>(null);
const menghapus = ref(false);

async function konfirmasiHapus() {
    if (akanDihapus.value === null || menghapus.value) return;
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
    try {
        const k = await ambilPenuh<Category[]>('/categories', {
            per_page: 100,
        });
        kategori.value = k.data;
    } catch {
        // Penyaring kategori sekadar tidak berisi; tabel tetap bekerja.
    }
});
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
            <BaseSelect
                v-model="filterKategori"
                :opsi="opsiKategori"
                label-kosong="Semua kategori"
                aria-label="Saring kategori"
            />
            <BaseSwitch v-model="hanyaMenipis">Stok menipis saja</BaseSwitch>
        </div>

        <RouterLink
            v-if="adalahAdmin"
            class="btn btn-primary"
            :to="{ name: 'produk-baru' }"
        >
            <Plus :size="18" :stroke-width="2" aria-hidden="true" />
            Tambah Produk
        </RouterLink>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            :pesan-kosong="
                adaPenyaring
                    ? 'Tidak ada produk yang cocok dengan penyaring.'
                    : 'Belum ada produk.'
            "
            :baris-skeleton="6"
        >
            <template #aksi>
                <button v-if="galat" class="btn btn-soft" @click="muat">
                    Muat ulang
                </button>
                <button
                    v-else-if="adaPenyaring"
                    class="btn btn-soft"
                    @click="hapusPenyaring"
                >
                    Hapus penyaring
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
                            <th>Kategori</th>
                            <KepalaUrut
                                label="Harga beli"
                                kolom="harga_beli"
                                :urut="urut"
                                :arah="arah"
                                num
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <KepalaUrut
                                label="Harga jual"
                                kolom="harga_jual"
                                :urut="urut"
                                :arah="arah"
                                num
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <th class="num">Margin</th>
                            <KepalaUrut
                                label="Stok"
                                kolom="stok"
                                :urut="urut"
                                :arah="arah"
                                num
                                @urutkan="urutkan"
                            />
                            <th>Status</th>
                            <th v-if="adalahAdmin" class="kolom-aksi">
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
                                        <Package
                                            v-else
                                            :size="20"
                                            :stroke-width="1.5"
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <div>
                                        <p>
                                            {{ p.nama_produk }}
                                            <span
                                                v-if="!p.aktif"
                                                class="badge badge-danger"
                                                >Nonaktif</span
                                            >
                                        </p>
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
                            <td v-if="adalahAdmin" class="kolom-aksi">
                                <div class="row aksi-baris">
                                    <RouterLink
                                        class="btn btn-soft btn-sm"
                                        :to="{
                                            name: 'produk-ubah',
                                            params: { id: p.id },
                                        }"
                                    >
                                        <Pencil
                                            :size="15"
                                            :stroke-width="1.75"
                                            aria-hidden="true"
                                        />
                                        Ubah
                                    </RouterLink>
                                    <button
                                        class="btn btn-ghost btn-sm btn-ikon"
                                        :aria-label="`Hapus ${p.nama_produk}`"
                                        @click="akanDihapus = p"
                                    >
                                        <Trash2
                                            :size="16"
                                            :stroke-width="1.75"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </div>
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

    <BaseModal
        v-if="akanDihapus"
        judul="Hapus produk?"
        :terkunci="menghapus"
        @tutup="akanDihapus = null"
    >
        <p>
            Produk <strong>{{ akanDihapus.nama_produk }}</strong> akan dihapus.
        </p>
        <p class="caption" style="margin-top: var(--space-2)">
            Produk yang pernah terjual tidak dapat dihapus, supaya riwayat struk
            lama tetap utuh. Nonaktifkan saja lewat formulir Ubah.
        </p>

        <template #aksi>
            <button
                class="btn btn-soft"
                :disabled="menghapus"
                @click="akanDihapus = null"
            >
                Batal
            </button>
            <button
                class="btn btn-danger"
                :disabled="menghapus"
                :aria-busy="menghapus"
                @click="konfirmasiHapus"
            >
                {{ menghapus ? 'Menghapus…' : 'Ya, hapus' }}
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.produk-sel {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.produk-sel .badge {
    margin-left: var(--space-1);
}

.thumb {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-xs);
    background: var(--surface-sunken);
    color: var(--text-muted);
    overflow: hidden;
}

.thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
</style>
