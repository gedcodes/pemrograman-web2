<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
    ambilPenuh,
    ApiError,
    simpan,
    type PaginationMeta,
} from '../api/client';
import type { Product, StockOpname } from '../api/types';
import { angka, tanggal } from '../composables/format';
import { adalahAdmin } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import KeadaanData from '../components/KeadaanData.vue';
import PagePagination from '../components/PagePagination.vue';

const daftar = ref<StockOpname[]>([]);
const meta = ref<PaginationMeta | null>(null);
const halaman = ref(1);
const memuat = ref(true);
const galat = ref<string | null>(null);

const formTerbuka = ref(false);
const produk = ref<Product[]>([]);
const hitung = ref<Record<number, number>>({});
const catatan = ref('');
const mengirim = ref(false);

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        const r = await ambilPenuh<StockOpname[]>('/opnames', {
            page: halaman.value,
        });
        daftar.value = r.data;
        meta.value = r.meta ?? null;
    } catch (e) {
        galat.value = e instanceof ApiError ? e.message : 'Gagal memuat data.';
    } finally {
        memuat.value = false;
    }
}

async function bukaForm() {
    const p = await ambilPenuh<Product[]>('/products', { per_page: 200 });
    produk.value = p.data;
    // Nilai awal = stok sistem, jadi kasir hanya mengubah yang selisih.
    hitung.value = Object.fromEntries(p.data.map((x) => [x.id, x.stok]));
    catatan.value = '';
    formTerbuka.value = true;
}

async function kirim() {
    const items = produk.value
        .filter((p) => hitung.value[p.id] !== p.stok)
        .map((p) => ({ product_id: p.id, stok_fisik: hitung.value[p.id] }));

    if (items.length === 0) {
        toast.info('Tidak ada selisih untuk dicatat.');
        return;
    }

    mengirim.value = true;
    try {
        const r = await simpan<StockOpname>('/opnames', {
            catatan: catatan.value,
            items,
        });
        toast.sukses(r.message ?? 'Opname selesai.');
        formTerbuka.value = false;
        await muat();
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal menyimpan opname.',
        );
    } finally {
        mengirim.value = false;
    }
}

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <p class="caption">Menyesuaikan stok sistem ke hasil hitung fisik.</p>
        <button v-if="adalahAdmin" class="btn btn-primary" @click="bukaForm">
            + Mulai Opname
        </button>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Belum ada sesi opname."
        >
            <div class="table-scroll">
                <table class="data">
                    <thead>
                        <tr>
                            <th>No. Dokumen</th>
                            <th>Tanggal</th>
                            <th>Petugas</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="o in daftar" :key="o.id">
                            <td>{{ o.no_dokumen }}</td>
                            <td>{{ tanggal(o.tanggal) }}</td>
                            <td>{{ o.user?.name ?? '-' }}</td>
                            <td>
                                <span class="badge badge-info">{{
                                    o.status
                                }}</span>
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

    <BaseModal
        v-if="formTerbuka"
        judul="Sesi Stok Opname"
        lebar="720px"
        @tutup="formTerbuka = false"
    >
        <div class="stack">
            <p class="caption">
                Isi stok fisik hasil hitung. Hanya produk yang berselisih yang
                akan dicatat dan disesuaikan.
            </p>

            <div class="field">
                <label for="cat">Catatan</label>
                <input
                    id="cat"
                    v-model="catatan"
                    class="input"
                    placeholder="mis. opname akhir bulan"
                />
            </div>

            <div class="table-scroll" style="max-height: 50vh">
                <table class="data">
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th class="num">Sistem</th>
                            <th class="num">Fisik</th>
                            <th class="num">Selisih</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in produk" :key="p.id">
                            <td>{{ p.nama_produk }}</td>
                            <td class="num">{{ angka(p.stok) }}</td>
                            <td class="num">
                                <input
                                    v-model.number="hitung[p.id]"
                                    type="number"
                                    min="0"
                                    class="input input-kecil"
                                />
                            </td>
                            <td
                                class="num"
                                :class="{ selisih: hitung[p.id] !== p.stok }"
                            >
                                {{ (hitung[p.id] ?? p.stok) - p.stok }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <template #aksi>
            <button class="btn btn-soft" @click="formTerbuka = false">
                Batal
            </button>
            <button class="btn btn-primary" :disabled="mengirim" @click="kirim">
                {{ mengirim ? 'Menyimpan…' : 'Selesaikan Opname' }}
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.input-kecil {
    min-height: 36px;
    width: 90px;
    text-align: right;
}
.selisih {
    color: var(--danger-text);
    font: var(--text-body-strong);
}
</style>
