<script setup lang="ts">
import {
    Barcode,
    Package,
    Pencil,
    Plus,
    Printer,
    Search,
    Trash2,
} from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
import { ambilPenuh, ApiError, hapus, simpan } from '../api/client';
import type { Category, Product } from '../api/types';
import { angka, persen } from '../composables/format';
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
import PratinjauGambar from '../components/PratinjauGambar.vue';
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

/* ----------------------------------------------------------- perbesar */

const diperbesar = ref<Product | null>(null);

/* --------------------------------------------- produk tanpa barcode */

/* Jumlahnya dihitung server (bukan dari halaman yang sedang tampil), supaya
   produk tanpa barcode di halaman lain ikut terhitung. */
const jumlahTanpaBarcode = ref(0);
const konfirmasiBarcode = ref(false);
const membuatBarcode = ref(false);

async function hitungTanpaBarcode() {
    if (!adalahAdmin.value) return;
    try {
        const r = await ambilPenuh<Product[]>('/products', {
            tanpa_barcode: 1,
            per_page: 1,
        });
        jumlahTanpaBarcode.value = r.meta?.total ?? r.data.length;
    } catch {
        jumlahTanpaBarcode.value = 0;
    }
}

async function buatBarcodeSemua() {
    membuatBarcode.value = true;
    try {
        const r = await simpan<{ jumlah: number }>(
            '/products/barcode-otomatis',
        );
        toast.sukses(r.message ?? 'Barcode dibuat.');
        konfirmasiBarcode.value = false;
        await Promise.all([muat(), hitungTanpaBarcode()]);
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal membuat barcode.',
        );
    } finally {
        membuatBarcode.value = false;
    }
}

onMounted(async () => {
    void hitungTanpaBarcode();
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

        <div v-if="adalahAdmin" class="row" style="gap: var(--space-2)">
            <RouterLink class="btn btn-soft" :to="{ name: 'cetak-label' }">
                <Printer :size="18" :stroke-width="1.75" aria-hidden="true" />
                Cetak Label
            </RouterLink>
            <RouterLink class="btn btn-primary" :to="{ name: 'produk-baru' }">
                <Plus :size="18" :stroke-width="2" aria-hidden="true" />
                Tambah Produk
            </RouterLink>
        </div>
    </div>

    <div
        v-if="adalahAdmin && jumlahTanpaBarcode > 0"
        class="card peringatan-barcode"
        role="status"
    >
        <Barcode :size="22" :stroke-width="1.75" aria-hidden="true" />
        <p>
            <strong>{{ jumlahTanpaBarcode }} produk belum punya barcode</strong>
            dan tidak dapat dipindai di Kasir.
        </p>
        <span class="spacer" />
        <button class="btn btn-soft" @click="konfirmasiBarcode = true">
            Buat barcode otomatis
        </button>
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
                                    <button
                                        v-if="p.gambar_url"
                                        type="button"
                                        class="thumb thumb-tombol"
                                        :aria-label="`Perbesar foto ${p.nama_produk}`"
                                        title="Perbesar foto"
                                        @click="diperbesar = p"
                                    >
                                        <img
                                            :src="p.gambar_url"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </button>
                                    <div v-else class="thumb">
                                        <Package
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
                                    <RouterLink
                                        class="btn btn-ghost btn-sm btn-ikon"
                                        :to="{
                                            name: 'cetak-label',
                                            query: { produk: p.id },
                                        }"
                                        :aria-label="`Cetak label barcode ${p.nama_produk}`"
                                        title="Cetak label barcode"
                                    >
                                        <Printer
                                            :size="16"
                                            :stroke-width="1.75"
                                            aria-hidden="true"
                                        />
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

    <PratinjauGambar
        v-if="diperbesar?.gambar_url"
        :src="diperbesar.gambar_url"
        :judul="diperbesar.nama_produk"
        :keterangan="diperbesar.barcode ?? 'Tanpa barcode'"
        @tutup="diperbesar = null"
    />

    <BaseModal
        v-if="konfirmasiBarcode"
        judul="Buat barcode otomatis?"
        :terkunci="membuatBarcode"
        @tutup="konfirmasiBarcode = false"
    >
        <p>
            <strong>{{ jumlahTanpaBarcode }} produk</strong> akan diberi barcode
            internal EAN-13 berawalan <code>20</code>, awalan yang dicadangkan
            untuk kode internal toko sehingga tidak bertabrakan dengan barcode
            pabrik.
        </p>
        <p class="caption" style="margin-top: var(--space-2)">
            Produk yang sudah punya barcode tidak diubah. Setelah itu, cetak
            labelnya lewat tombol Cetak Label.
        </p>
        <template #aksi>
            <button
                class="btn btn-soft"
                :disabled="membuatBarcode"
                @click="konfirmasiBarcode = false"
            >
                Batal
            </button>
            <button
                class="btn btn-primary"
                :disabled="membuatBarcode"
                :aria-busy="membuatBarcode"
                @click="buatBarcodeSemua"
            >
                {{ membuatBarcode ? 'Membuat…' : 'Ya, buat barcode' }}
            </button>
        </template>
    </BaseModal>

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

/* Thumbnail berfoto dapat diklik untuk memperbesar. */
.thumb-tombol {
    padding: 0;
    border: 0;
    background: #fff;
    box-shadow: 0 0 0 1px var(--divider);
    cursor: zoom-in;
    transition: transform var(--dur-base) var(--ease);
}

.thumb-tombol:hover {
    transform: scale(1.06);
}

.thumb-tombol:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
}

.peringatan-barcode {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--warning-bg);
    color: var(--warning-text);
}

@media (max-width: 767px) {
    .peringatan-barcode {
        flex-wrap: wrap;
    }
}
</style>
