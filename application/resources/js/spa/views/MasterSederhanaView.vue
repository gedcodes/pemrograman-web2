<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
    ambilPenuh,
    ApiError,
    hapus,
    perbarui,
    simpan,
    type PaginationMeta,
} from '../api/client';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import KeadaanData from '../components/KeadaanData.vue';
import PagePagination from '../components/PagePagination.vue';

/**
 * Satu komponen untuk empat master data sederhana.
 *
 * Kategori, Satuan, Supplier, dan Pelanggan berbentuk sama persis: tabel
 * dengan pencarian ditambah formulir beberapa kolom. Menulis empat berkas
 * hampir identik hanya akan membuat keempatnya lambat laun menyimpang.
 */
const props = defineProps<{
    jenis: 'kategori' | 'satuan' | 'supplier' | 'pelanggan';
}>();

interface Kolom {
    kunci: string;
    label: string;
    tipe?: 'teks' | 'angka';
    wajib?: boolean;
    diTabel?: boolean;
}

interface Konfigurasi {
    judul: string;
    url: string;
    kolom: Kolom[];
}

const KONFIG: Record<string, Konfigurasi> = {
    kategori: {
        judul: 'Kategori',
        url: '/categories',
        kolom: [
            {
                kunci: 'nama_kategori',
                label: 'Nama kategori',
                wajib: true,
                diTabel: true,
            },
        ],
    },
    satuan: {
        judul: 'Satuan',
        url: '/units',
        kolom: [
            {
                kunci: 'nama_satuan',
                label: 'Nama satuan',
                wajib: true,
                diTabel: true,
            },
            { kunci: 'simbol', label: 'Simbol', wajib: true, diTabel: true },
        ],
    },
    supplier: {
        judul: 'Supplier',
        url: '/suppliers',
        kolom: [
            {
                kunci: 'nama_supplier',
                label: 'Nama supplier',
                wajib: true,
                diTabel: true,
            },
            { kunci: 'kontak', label: 'Kontak', diTabel: true },
            { kunci: 'alamat', label: 'Alamat', diTabel: true },
        ],
    },
    pelanggan: {
        judul: 'Pelanggan',
        url: '/customers',
        kolom: [
            { kunci: 'nama', label: 'Nama', wajib: true, diTabel: true },
            { kunci: 'no_hp', label: 'No. HP', diTabel: true },
            {
                kunci: 'poin_loyalti',
                label: 'Poin loyalti',
                tipe: 'angka',
                diTabel: true,
            },
        ],
    },
};

const cfg = computed(() => KONFIG[props.jenis]);

type Baris = Record<string, unknown> & { id: number };

const daftar = ref<Baris[]>([]);
const meta = ref<PaginationMeta | null>(null);
const cari = ref('');
const halaman = ref(1);
const memuat = ref(true);
const galat = ref<string | null>(null);

const formTerbuka = ref(false);
const sedangUbah = ref<Baris | null>(null);
const form = ref<Record<string, unknown>>({});
const galatField = ref<Record<string, string>>({});
const mengirim = ref(false);
const akanDihapus = ref<Baris | null>(null);

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        const r = await ambilPenuh<Baris[]>(cfg.value.url, {
            page: halaman.value,
            q: cari.value || undefined,
        });
        daftar.value = r.data;
        meta.value = r.meta ?? null;
    } catch (e) {
        galat.value = e instanceof ApiError ? e.message : 'Gagal memuat data.';
    } finally {
        memuat.value = false;
    }
}

function bukaForm(baris: Baris | null) {
    sedangUbah.value = baris;
    galatField.value = {};
    form.value = {};
    for (const k of cfg.value.kolom) {
        form.value[k.kunci] = baris
            ? (baris[k.kunci] ?? '')
            : k.tipe === 'angka'
              ? 0
              : '';
    }
    formTerbuka.value = true;
}

async function kirim() {
    mengirim.value = true;
    galatField.value = {};
    try {
        if (sedangUbah.value) {
            const r = await perbarui(
                `${cfg.value.url}/${sedangUbah.value.id}`,
                form.value,
            );
            toast.sukses(r.message ?? 'Tersimpan.');
        } else {
            const r = await simpan(cfg.value.url, form.value);
            toast.sukses(r.message ?? 'Tersimpan.');
        }
        formTerbuka.value = false;
        await muat();
    } catch (e) {
        if (e instanceof ApiError) {
            galatField.value = Object.fromEntries(
                Object.entries(e.errors).map(([k, v]) => [k, v[0]]),
            );
            toast.galat(e.message);
        }
    } finally {
        mengirim.value = false;
    }
}

async function konfirmasiHapus() {
    if (!akanDihapus.value) return;
    try {
        const r = await hapus(`${cfg.value.url}/${akanDihapus.value.id}`);
        toast.sukses(r.message ?? 'Dihapus.');
        akanDihapus.value = null;
        await muat();
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal menghapus.');
    }
}

watch(cari, () => {
    halaman.value = 1;
    void muat();
});

watch(
    () => props.jenis,
    () => {
        halaman.value = 1;
        cari.value = '';
        void muat();
    },
);

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <input
            v-model="cari"
            class="input"
            style="max-width: 280px"
            type="search"
            placeholder="Cari…"
        />
        <button class="btn btn-primary" @click="bukaForm(null)">
            + Tambah {{ cfg.judul }}
        </button>
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
                            <th
                                v-for="k in cfg.kolom.filter((c) => c.diTabel)"
                                :key="k.kunci"
                                :class="{ num: k.tipe === 'angka' }"
                            >
                                {{ k.label }}
                            </th>
                            <th><span class="sr-only">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="b in daftar" :key="b.id">
                            <td
                                v-for="k in cfg.kolom.filter((c) => c.diTabel)"
                                :key="k.kunci"
                                :class="{ num: k.tipe === 'angka' }"
                            >
                                {{ b[k.kunci] ?? '-' }}
                            </td>
                            <td>
                                <div class="row">
                                    <button
                                        class="btn btn-soft btn-sm"
                                        @click="bukaForm(b)"
                                    >
                                        Ubah
                                    </button>
                                    <button
                                        class="btn btn-ghost btn-sm"
                                        @click="akanDihapus = b"
                                    >
                                        Hapus
                                    </button>
                                </div>
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
        :judul="sedangUbah ? `Ubah ${cfg.judul}` : `Tambah ${cfg.judul}`"
        @tutup="formTerbuka = false"
    >
        <form class="stack" novalidate @submit.prevent="kirim">
            <div v-for="k in cfg.kolom" :key="k.kunci" class="field">
                <label :for="k.kunci"
                    >{{ k.label }}{{ k.wajib ? ' *' : '' }}</label
                >
                <input
                    :id="k.kunci"
                    v-model="form[k.kunci]"
                    :type="k.tipe === 'angka' ? 'number' : 'text'"
                    class="input"
                    :class="{ 'is-error': galatField[k.kunci] }"
                />
                <p v-if="galatField[k.kunci]" class="field-error">
                    {{ galatField[k.kunci] }}
                </p>
            </div>
        </form>

        <template #aksi>
            <button class="btn btn-soft" @click="formTerbuka = false">
                Batal
            </button>
            <button class="btn btn-primary" :disabled="mengirim" @click="kirim">
                {{ mengirim ? 'Menyimpan…' : 'Simpan' }}
            </button>
        </template>
    </BaseModal>

    <BaseModal
        v-if="akanDihapus"
        :judul="`Hapus ${cfg.judul.toLowerCase()}?`"
        @tutup="akanDihapus = null"
    >
        <p>
            Data ini akan dihapus. Data yang masih dipakai tidak dapat dihapus.
        </p>
        <template #aksi>
            <button class="btn btn-soft" @click="akanDihapus = null">
                Batal
            </button>
            <button class="btn btn-danger" @click="konfirmasiHapus">
                Ya, hapus
            </button>
        </template>
    </BaseModal>
</template>
