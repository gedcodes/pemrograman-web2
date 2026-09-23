<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
    ambilPenuh,
    ApiError,
    simpan,
    type PaginationMeta,
} from '../api/client';
import type { Product, Purchase, Supplier } from '../api/types';
import { angka, kunciTanggal, rupiah, tanggal } from '../composables/format';
import { adalahAdmin } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import KeadaanData from '../components/KeadaanData.vue';
import PagePagination from '../components/PagePagination.vue';

const daftar = ref<Purchase[]>([]);
const meta = ref<PaginationMeta | null>(null);
const halaman = ref(1);
const memuat = ref(true);
const galat = ref<string | null>(null);

const formTerbuka = ref(false);
const supplier = ref<Supplier[]>([]);
const produk = ref<Product[]>([]);
const mengirim = ref(false);

const form = ref({
    supplier_id: '' as number | '',
    tanggal_masuk: kunciTanggal(),
    catatan: '',
    items: [] as Array<{
        product_id: number | '';
        qty: number;
        harga_beli: number;
    }>,
});

const totalForm = computed(() =>
    form.value.items.reduce((s, i) => s + i.qty * i.harga_beli, 0),
);

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        const r = await ambilPenuh<Purchase[]>('/purchases', {
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
    if (supplier.value.length === 0) {
        const [s, p] = await Promise.all([
            ambilPenuh<Supplier[]>('/suppliers', { per_page: 100 }),
            ambilPenuh<Product[]>('/products', { per_page: 200 }),
        ]);
        supplier.value = s.data;
        produk.value = p.data;
    }
    form.value = {
        supplier_id: '',
        tanggal_masuk: kunciTanggal(),
        catatan: '',
        items: [{ product_id: '', qty: 1, harga_beli: 0 }],
    };
    formTerbuka.value = true;
}

function tambahBaris() {
    form.value.items.push({ product_id: '', qty: 1, harga_beli: 0 });
}

function hapusBaris(i: number) {
    form.value.items.splice(i, 1);
}

/** Harga beli diisikan otomatis dari master produk sebagai titik awal. */
function padaPilihProduk(i: number) {
    const p = produk.value.find((x) => x.id === form.value.items[i].product_id);
    if (p) form.value.items[i].harga_beli = p.harga_beli;
}

async function kirim() {
    mengirim.value = true;
    try {
        const r = await simpan<Purchase>('/purchases', form.value);
        toast.sukses(r.message ?? 'Barang masuk dicatat.');
        formTerbuka.value = false;
        await muat();
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal menyimpan.');
    } finally {
        mengirim.value = false;
    }
}

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <p class="caption">
            Mencatat penerimaan barang sekaligus menambah stok.
        </p>
        <button v-if="adalahAdmin" class="btn btn-primary" @click="bukaForm">
            + Catat Penerimaan
        </button>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Belum ada dokumen barang masuk."
        >
            <div class="table-scroll">
                <table class="data">
                    <thead>
                        <tr>
                            <th>No. Dokumen</th>
                            <th>Tanggal</th>
                            <th>Supplier</th>
                            <th class="num">Total biaya</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in daftar" :key="p.id">
                            <td>{{ p.no_dokumen }}</td>
                            <td>{{ tanggal(p.tanggal_masuk) }}</td>
                            <td>{{ p.supplier?.nama_supplier ?? '-' }}</td>
                            <td class="num">{{ angka(p.total_biaya) }}</td>
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
        judul="Catat Penerimaan Barang"
        lebar="720px"
        @tutup="formTerbuka = false"
    >
        <div class="stack">
            <div class="dua">
                <div class="field">
                    <label for="sup">Supplier *</label>
                    <select id="sup" v-model="form.supplier_id" class="select">
                        <option value="">Pilih supplier</option>
                        <option v-for="s in supplier" :key="s.id" :value="s.id">
                            {{ s.nama_supplier }}
                        </option>
                    </select>
                </div>
                <div class="field">
                    <label for="tgl">Tanggal masuk</label>
                    <input
                        id="tgl"
                        v-model="form.tanggal_masuk"
                        type="date"
                        class="input"
                    />
                </div>
            </div>

            <div v-for="(it, i) in form.items" :key="i" class="baris-item">
                <select
                    v-model="it.product_id"
                    class="select"
                    @change="padaPilihProduk(i)"
                >
                    <option value="">Pilih produk</option>
                    <option v-for="p in produk" :key="p.id" :value="p.id">
                        {{ p.nama_produk }}
                    </option>
                </select>
                <input
                    v-model.number="it.qty"
                    type="number"
                    min="1"
                    class="input"
                    placeholder="Qty"
                />
                <input
                    v-model.number="it.harga_beli"
                    type="number"
                    min="0"
                    class="input"
                    placeholder="Harga beli"
                />
                <span class="num">{{ angka(it.qty * it.harga_beli) }}</span>
                <button
                    class="btn btn-ghost btn-sm"
                    :disabled="form.items.length === 1"
                    @click="hapusBaris(i)"
                >
                    ×
                </button>
            </div>

            <button class="btn btn-soft btn-sm" @click="tambahBaris">
                + Tambah baris
            </button>

            <div class="row" style="font: var(--text-body-strong)">
                <span>Total biaya</span><span class="spacer" /><span
                    class="num"
                    >{{ rupiah(totalForm) }}</span
                >
            </div>
            <p class="caption">
                Total dihitung ulang di server dari baris yang dikirim.
            </p>
        </div>

        <template #aksi>
            <button class="btn btn-soft" @click="formTerbuka = false">
                Batal
            </button>
            <button class="btn btn-primary" :disabled="mengirim" @click="kirim">
                {{ mengirim ? 'Menyimpan…' : 'Simpan & Tambah Stok' }}
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.dua {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
}

.baris-item {
    display: grid;
    grid-template-columns: 2fr 80px 120px 100px 40px;
    gap: var(--space-2);
    align-items: center;
}

@media (max-width: 767px) {
    .dua,
    .baris-item {
        grid-template-columns: 1fr;
    }
}
</style>
