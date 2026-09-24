<script setup lang="ts">
import { ClipboardCheck, Search } from '@lucide/vue';
import { computed, ref } from 'vue';
import { ambilPenuh, ApiError, simpan } from '../api/client';
import type { Product, StockOpname } from '../api/types';
import { angka, tanggal } from '../composables/format';
import { useDaftarServer } from '../composables/useDaftarServer';
import { adalahAdmin } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import BaseSwitch from '../components/BaseSwitch.vue';
import FieldForm from '../components/FieldForm.vue';
import InputAngka from '../components/InputAngka.vue';
import KeadaanData from '../components/KeadaanData.vue';
import KepalaUrut from '../components/KepalaUrut.vue';
import PagePagination from '../components/PagePagination.vue';

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
} = useDaftarServer<StockOpname>('/opnames');

/* ------------------------------------------------------------ lembar hitung */

const formTerbuka = ref(false);
const menyiapkan = ref(false);
const produk = ref<Product[]>([]);
/** Hasil hitung fisik per produk; `null` berarti isiannya dikosongkan. */
const hitung = ref<Record<number, number | null>>({});
const catatan = ref('');
const mengirim = ref(false);

const cariLembar = ref('');
const hanyaSelisih = ref(false);

function selisih(p: Product): number {
    const h = hitung.value[p.id];
    return h === null || h === undefined ? 0 : h - p.stok;
}

const berselisih = computed(() => produk.value.filter((p) => selisih(p) !== 0));

const barisTampil = computed(() => {
    const q = cariLembar.value.trim().toLowerCase();
    return produk.value.filter(
        (p) =>
            (!hanyaSelisih.value || selisih(p) !== 0) &&
            (q === '' ||
                p.nama_produk.toLowerCase().includes(q) ||
                (p.barcode ?? '').includes(q)),
    );
});

async function bukaForm() {
    menyiapkan.value = true;
    try {
        const p = await ambilPenuh<Product[]>('/products', { per_page: 200 });
        produk.value = p.data;
        // Nilai awal = stok sistem, jadi petugas hanya mengubah yang selisih.
        hitung.value = Object.fromEntries(p.data.map((x) => [x.id, x.stok]));
        catatan.value = '';
        cariLembar.value = '';
        hanyaSelisih.value = false;
        formTerbuka.value = true;
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal memuat daftar produk.',
        );
    } finally {
        menyiapkan.value = false;
    }
}

async function kirim() {
    if (mengirim.value) return;

    // Isian yang dikosongkan dianggap "tidak dihitung" dan tidak dikirim,
    // bukan dikirim sebagai kosong lalu ditolak server.
    const items = berselisih.value.map((p) => ({
        product_id: p.id,
        stok_fisik: hitung.value[p.id],
        // Stok buku saat lembar ini dibuka. Server menerapkan SELISIHNYA ke
        // stok terkini, jadi penjualan selama penghitungan tidak terhapus.
        stok_sistem: p.stok,
    }));

    if (items.length === 0) {
        toast.info('Tidak ada selisih untuk dicatat.');
        return;
    }

    mengirim.value = true;
    try {
        const r = await simpan<StockOpname>('/opnames', {
            catatan: catatan.value.trim() || null,
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
</script>

<template>
    <div class="page-head">
        <p class="caption">Menyesuaikan stok sistem ke hasil hitung fisik.</p>
        <button
            v-if="adalahAdmin"
            class="btn btn-primary"
            :disabled="menyiapkan"
            :aria-busy="menyiapkan"
            @click="bukaForm"
        >
            <ClipboardCheck
                v-if="!menyiapkan"
                :size="18"
                :stroke-width="1.75"
                aria-hidden="true"
            />
            Mulai Opname
        </button>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Belum ada sesi opname."
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
                                label="No. Dokumen"
                                kolom="no_dokumen"
                                :urut="urut"
                                :arah="arah"
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <KepalaUrut
                                label="Tanggal"
                                kolom="tanggal"
                                :urut="urut"
                                :arah="arah"
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <th>Petugas</th>
                            <th>Catatan</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="o in daftar" :key="o.id">
                            <td>{{ o.no_dokumen }}</td>
                            <td>{{ tanggal(o.tanggal) }}</td>
                            <td>{{ o.user?.name ?? '-' }}</td>
                            <td class="muted">{{ o.catatan ?? '-' }}</td>
                            <td>
                                <span
                                    class="badge"
                                    :class="
                                        o.status === 'selesai'
                                            ? 'badge-success'
                                            : 'badge-info'
                                    "
                                    >{{
                                        o.status === 'selesai'
                                            ? 'Selesai'
                                            : 'Draf'
                                    }}</span
                                >
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
        v-if="formTerbuka"
        judul="Sesi Stok Opname"
        deskripsi="Isi stok fisik hasil hitung. Selisihnya diterapkan ke stok terkini, jadi kasir tetap boleh berjualan selama penghitungan."
        lebar="760px"
        formulir
        :terkunci="mengirim"
        @tutup="formTerbuka = false"
    >
        <div class="stack">
            <FieldForm v-slot="{ id }" label="Catatan">
                <input
                    :id="id"
                    v-model="catatan"
                    class="input"
                    maxlength="500"
                    placeholder="mis. opname akhir bulan"
                />
            </FieldForm>

            <div class="alat-lembar">
                <label class="kotak-cari">
                    <Search
                        :size="18"
                        :stroke-width="1.75"
                        aria-hidden="true"
                    />
                    <span class="sr-only">Cari produk di lembar hitung</span>
                    <input
                        v-model="cariLembar"
                        type="search"
                        placeholder="Cari produk atau barcode…"
                    />
                </label>
                <BaseSwitch v-model="hanyaSelisih">
                    Hanya yang berselisih
                </BaseSwitch>
            </div>

            <div class="table-scroll lembar">
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
                        <tr
                            v-for="p in barisTampil"
                            :key="p.id"
                            :class="{ 'baris-selisih': selisih(p) !== 0 }"
                        >
                            <td>
                                {{ p.nama_produk }}
                                <span class="caption blok">{{
                                    p.barcode ?? 'tanpa barcode'
                                }}</span>
                            </td>
                            <td class="num">{{ angka(p.stok) }}</td>
                            <td class="num">
                                <InputAngka
                                    v-model="hitung[p.id]"
                                    kecil
                                    :aria-label="`Stok fisik ${p.nama_produk}`"
                                />
                            </td>
                            <td
                                class="num"
                                :class="{
                                    kurang: selisih(p) < 0,
                                    lebih: selisih(p) > 0,
                                }"
                            >
                                {{ selisih(p) > 0 ? '+' : ''
                                }}{{ angka(selisih(p)) }}
                            </td>
                        </tr>
                        <tr v-if="barisTampil.length === 0">
                            <td colspan="4" class="muted">
                                Tidak ada produk yang cocok.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <template #aksi>
            <span class="caption ringkas-selisih">
                {{ berselisih.length }} produk berselisih
            </span>
            <button
                class="btn btn-soft"
                :disabled="mengirim"
                @click="formTerbuka = false"
            >
                Batal
            </button>
            <button
                class="btn btn-primary"
                :disabled="mengirim || berselisih.length === 0"
                :aria-busy="mengirim"
                @click="kirim"
            >
                {{ mengirim ? 'Menyimpan…' : 'Selesaikan Opname' }}
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.alat-lembar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
}

.lembar {
    max-height: 48vh;
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--divider);
}

.lembar :deep(.angka) {
    width: 110px;
    margin-left: auto;
}

.blok {
    display: block;
}

.baris-selisih td {
    background: rgba(179, 122, 0, 0.06);
}

.kurang {
    color: var(--danger-text);
    font: var(--text-body-strong);
}

.lebih {
    color: var(--success-text);
    font: var(--text-body-strong);
}

.ringkas-selisih {
    margin-right: auto;
    align-self: center;
}
</style>
