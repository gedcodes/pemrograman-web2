<script setup lang="ts">
import { Pencil, Plus, Search, Trash2 } from '@lucide/vue';
import { computed, nextTick, ref } from 'vue';
import { ApiError, hapus, perbarui, simpan } from '../api/client';
import { useDaftarServer } from '../composables/useDaftarServer';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import FieldForm from '../components/FieldForm.vue';
import InputAngka from '../components/InputAngka.vue';
import KeadaanData from '../components/KeadaanData.vue';
import KepalaUrut from '../components/KepalaUrut.vue';
import PagePagination from '../components/PagePagination.vue';

/**
 * Satu komponen untuk empat master data sederhana.
 *
 * Kategori, Satuan, Supplier, dan Pelanggan berbentuk sama persis: tabel
 * dengan pencarian ditambah formulir beberapa kolom. Menulis empat berkas
 * hampir identik hanya akan membuat keempatnya lambat laun menyimpang.
 *
 * Komponen ini dipasang ulang setiap rute berganti (kunci rute pada
 * AppLayout), jadi konfigurasinya cukup dibaca sekali saat dibuat.
 */
const props = defineProps<{
    jenis: 'kategori' | 'satuan' | 'supplier' | 'pelanggan';
}>();

interface Kolom {
    kunci: string;
    label: string;
    tipe?: 'teks' | 'angka' | 'telepon' | 'panjang';
    wajib?: boolean;
    /** Batas panjang, sama dengan aturan Form Request di server. */
    maks?: number;
    contoh?: string;
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
                maks: 100,
                contoh: 'mis. Minuman',
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
                maks: 50,
                contoh: 'mis. Botol',
                diTabel: true,
            },
            {
                kunci: 'simbol',
                label: 'Simbol',
                wajib: true,
                maks: 10,
                contoh: 'mis. btl',
                diTabel: true,
            },
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
                maks: 150,
                diTabel: true,
            },
            {
                kunci: 'kontak',
                label: 'Kontak',
                tipe: 'telepon',
                maks: 30,
                contoh: 'mis. 0361 234567',
                diTabel: true,
            },
            {
                kunci: 'alamat',
                label: 'Alamat',
                tipe: 'panjang',
                maks: 500,
                diTabel: true,
            },
        ],
    },
    pelanggan: {
        judul: 'Pelanggan',
        url: '/customers',
        kolom: [
            {
                kunci: 'nama',
                label: 'Nama',
                wajib: true,
                maks: 150,
                diTabel: true,
            },
            {
                kunci: 'no_hp',
                label: 'No. HP',
                tipe: 'telepon',
                maks: 30,
                contoh: 'mis. 0812 3456 7890',
                diTabel: true,
            },
            {
                kunci: 'poin_loyalti',
                label: 'Poin loyalti',
                tipe: 'angka',
                diTabel: true,
            },
        ],
    },
};

const cfg = KONFIG[props.jenis];
const kolomTabel = cfg.kolom.filter((c) => c.diTabel);

type Baris = Record<string, unknown> & { id: number };

const cari = ref('');

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
} = useDaftarServer<Baris>(cfg.url, () => ({ q: cari.value || undefined }));

/* ---------------------------------------------------------------- formulir */

const formTerbuka = ref(false);
const sedangUbah = ref<Baris | null>(null);
const form = ref<Record<string, string | number | null>>({});
const galatServer = ref<Record<string, string>>({});
const dicoba = ref(false);
const mengirim = ref(false);

function bukaForm(baris: Baris | null) {
    sedangUbah.value = baris;
    galatServer.value = {};
    dicoba.value = false;

    const isi: Record<string, string | number | null> = {};
    for (const k of cfg.kolom) {
        const nilai = baris?.[k.kunci];
        isi[k.kunci] =
            k.tipe === 'angka'
                ? typeof nilai === 'number'
                    ? nilai
                    : 0
                : typeof nilai === 'string'
                  ? nilai
                  : '';
    }
    form.value = isi;
    formTerbuka.value = true;
}

const galatLokal = computed(() => {
    const e: Record<string, string> = {};
    for (const k of cfg.kolom) {
        const v = form.value[k.kunci];
        const teks = typeof v === 'string' ? v.trim() : '';
        if (k.wajib && k.tipe !== 'angka' && teks === '')
            e[k.kunci] = `${k.label} wajib diisi.`;
        else if (k.maks && teks.length > k.maks)
            e[k.kunci] = `${k.label} paling panjang ${k.maks} karakter.`;
    }
    return e;
});

function pesanGalat(kunci: string): string | undefined {
    return (
        galatServer.value[kunci] ??
        (dicoba.value ? galatLokal.value[kunci] : undefined)
    );
}

async function fokusGalat() {
    await nextTick();
    document
        .querySelector<HTMLElement>('.modal [aria-invalid="true"]')
        ?.focus();
}

async function kirim() {
    if (mengirim.value) return;
    dicoba.value = true;
    galatServer.value = {};

    if (Object.keys(galatLokal.value).length > 0) {
        await fokusGalat();
        return;
    }

    const muatan: Record<string, unknown> = {};
    for (const k of cfg.kolom) {
        const v = form.value[k.kunci];
        muatan[k.kunci] = typeof v === 'string' ? v.trim() || null : (v ?? 0);
    }

    mengirim.value = true;
    try {
        const r = sedangUbah.value
            ? await perbarui(`${cfg.url}/${sedangUbah.value.id}`, muatan)
            : await simpan(cfg.url, muatan);
        toast.sukses(r.message ?? 'Tersimpan.');
        formTerbuka.value = false;
        await muat();
    } catch (e) {
        if (e instanceof ApiError) {
            galatServer.value = Object.fromEntries(
                Object.entries(e.errors).map(([k, v]) => [k, v[0]]),
            );
            toast.galat(e.message);
            await fokusGalat();
        } else {
            toast.galat('Gagal menyimpan.');
        }
    } finally {
        mengirim.value = false;
    }
}

/* ---------------------------------------------------------------- hapus */

const akanDihapus = ref<Baris | null>(null);
const menghapus = ref(false);

function namaBaris(b: Baris): string {
    const v = b[cfg.kolom[0].kunci];
    return typeof v === 'string' ? v : '';
}

async function konfirmasiHapus() {
    if (!akanDihapus.value || menghapus.value) return;
    menghapus.value = true;
    try {
        const r = await hapus(`${cfg.url}/${akanDihapus.value.id}`);
        toast.sukses(r.message ?? 'Dihapus.');
        akanDihapus.value = null;
        await muat();
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal menghapus.');
    } finally {
        menghapus.value = false;
    }
}

function tampil(v: unknown): string {
    return v === null || v === undefined || v === '' ? '-' : String(v);
}
</script>

<template>
    <div class="page-head">
        <label class="kotak-cari">
            <Search :size="18" :stroke-width="1.75" aria-hidden="true" />
            <span class="sr-only">Cari {{ cfg.judul.toLowerCase() }}</span>
            <input
                v-model="cari"
                type="search"
                :placeholder="`Cari ${cfg.judul.toLowerCase()}…`"
            />
        </label>
        <button class="btn btn-primary" @click="bukaForm(null)">
            <Plus :size="18" :stroke-width="2" aria-hidden="true" />
            Tambah {{ cfg.judul }}
        </button>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            :pesan-kosong="
                cari
                    ? `Tidak ada ${cfg.judul.toLowerCase()} yang cocok dengan &quot;${cari}&quot;.`
                    : `Belum ada data ${cfg.judul.toLowerCase()}.`
            "
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
                                v-for="k in kolomTabel"
                                :key="k.kunci"
                                :label="k.label"
                                :kolom="k.kunci"
                                :urut="urut"
                                :arah="arah"
                                :num="k.tipe === 'angka'"
                                @urutkan="urutkan"
                            />
                            <th class="kolom-aksi">
                                <span class="sr-only">Aksi</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="b in daftar" :key="b.id">
                            <td
                                v-for="k in kolomTabel"
                                :key="k.kunci"
                                :class="{ num: k.tipe === 'angka' }"
                            >
                                {{ tampil(b[k.kunci]) }}
                            </td>
                            <td class="kolom-aksi">
                                <div class="row aksi-baris">
                                    <button
                                        class="btn btn-soft btn-sm"
                                        @click="bukaForm(b)"
                                    >
                                        <Pencil
                                            :size="15"
                                            :stroke-width="1.75"
                                            aria-hidden="true"
                                        />
                                        Ubah
                                    </button>
                                    <button
                                        class="btn btn-ghost btn-sm btn-ikon"
                                        :aria-label="`Hapus ${namaBaris(b)}`"
                                        @click="akanDihapus = b"
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
        v-if="formTerbuka"
        :judul="sedangUbah ? `Ubah ${cfg.judul}` : `Tambah ${cfg.judul}`"
        formulir
        :terkunci="mengirim"
        @tutup="formTerbuka = false"
    >
        <form id="form-master" class="stack" novalidate @submit.prevent="kirim">
            <FieldForm
                v-for="k in cfg.kolom"
                :key="k.kunci"
                v-slot="{ id, invalid, describedby }"
                :label="k.label"
                :wajib="k.wajib"
                :galat="pesanGalat(k.kunci)"
            >
                <InputAngka
                    v-if="k.tipe === 'angka'"
                    :id="id"
                    :model-value="(form[k.kunci] as number | null) ?? null"
                    :invalid="invalid"
                    :aria-describedby="describedby"
                    @update:model-value="(v) => (form[k.kunci] = v)"
                />
                <textarea
                    v-else-if="k.tipe === 'panjang'"
                    :id="id"
                    v-model="form[k.kunci]"
                    class="textarea"
                    :class="{ 'is-error': invalid }"
                    :maxlength="k.maks"
                    :aria-invalid="invalid || undefined"
                    :aria-describedby="describedby"
                    rows="3"
                />
                <input
                    v-else
                    :id="id"
                    v-model="form[k.kunci]"
                    class="input"
                    :class="{ 'is-error': invalid }"
                    :type="k.tipe === 'telepon' ? 'tel' : 'text'"
                    :inputmode="k.tipe === 'telepon' ? 'tel' : undefined"
                    :maxlength="k.maks"
                    :placeholder="k.contoh"
                    :aria-invalid="invalid || undefined"
                    :aria-describedby="describedby"
                    autocomplete="off"
                />
            </FieldForm>
        </form>

        <template #aksi>
            <button
                class="btn btn-soft"
                :disabled="mengirim"
                @click="formTerbuka = false"
            >
                Batal
            </button>
            <button
                class="btn btn-primary"
                type="submit"
                form="form-master"
                :disabled="mengirim"
                :aria-busy="mengirim"
            >
                {{ mengirim ? 'Menyimpan…' : 'Simpan' }}
            </button>
        </template>
    </BaseModal>

    <BaseModal
        v-if="akanDihapus"
        :judul="`Hapus ${cfg.judul.toLowerCase()}?`"
        :terkunci="menghapus"
        @tutup="akanDihapus = null"
    >
        <p>
            <strong>{{ namaBaris(akanDihapus) }}</strong> akan dihapus. Data
            yang masih dipakai transaksi atau produk tidak dapat dihapus.
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
