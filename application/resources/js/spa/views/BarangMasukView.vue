<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue';
import { computed, nextTick, ref } from 'vue';
import { ambil, ambilPenuh, ApiError, simpan } from '../api/client';
import type { Product, Purchase, Supplier } from '../api/types';
import { angka, kunciTanggal, rupiah, tanggal } from '../composables/format';
import { keOpsi, type OpsiPilihan } from '../composables/pilihan';
import { useDaftarServer } from '../composables/useDaftarServer';
import { adalahAdmin } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import BaseSelect from '../components/BaseSelect.vue';
import FieldForm from '../components/FieldForm.vue';
import InputAngka from '../components/InputAngka.vue';
import InputTanggal from '../components/InputTanggal.vue';
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
} = useDaftarServer<Purchase>('/purchases');

/* ---------------------------------------------------------------- formulir */

interface BarisForm {
    /** Kunci tetap per baris. Indeks tidak boleh dipakai sebagai kunci:
        menghapus baris tengah akan menggeser isian ke baris yang salah. */
    kunci: number;
    product_id: number | null;
    qty: number | null;
    harga_beli: number | null;
}

let urutBaris = 0;

function barisBaru(): BarisForm {
    return { kunci: ++urutBaris, product_id: null, qty: 1, harga_beli: null };
}

const formTerbuka = ref(false);
const menyiapkan = ref(false);
const supplier = ref<Supplier[]>([]);
/* Produk yang pernah muncul di hasil pencarian: sumber harga beli dan
   simbol satuan untuk baris yang memilihnya. */
const produkDikenal = ref(new Map<number, Product>());
const mengirim = ref(false);
const dicoba = ref(false);
const galatServer = ref<Record<string, string>>({});

const form = ref({
    supplier_id: null as number | null,
    tanggal_masuk: kunciTanggal(),
    catatan: '',
    items: [] as BarisForm[],
});

const opsiSupplier = computed(() =>
    keOpsi(
        supplier.value,
        (s) => s.id,
        (s) => s.nama_supplier,
        (s) => s.kontak ?? undefined,
    ),
);

/**
 * Pencarian produk di server untuk satu baris. Produk tidak lagi dimuat
 * seluruhnya (dulu dibatasi 200) saat formulir dibuka.
 *
 * Produk yang sudah dipilih di baris lain dinonaktifkan, supaya satu
 * produk tidak tercatat dua kali dalam satu dokumen.
 */
async function cariProduk(
    b: BarisForm,
    kata: string,
): Promise<OpsiPilihan<number>[]> {
    const hasil = await ambil<Product[]>('/products', {
        q: kata || undefined,
        per_page: 20,
    });
    const dipakai = new Set(
        form.value.items
            .filter((x) => x.kunci !== b.kunci && x.product_id !== null)
            .map((x) => x.product_id),
    );
    for (const p of hasil) produkDikenal.value.set(p.id, p);
    return hasil.map((p) => ({
        nilai: p.id,
        label: p.nama_produk,
        keterangan: `${p.barcode ?? 'tanpa barcode'} · stok ${angka(p.stok)}`,
        // Foto membedakan kemasan yang namanya mirip, supaya penerimaan
        // barang tidak tercatat ke produk yang salah.
        gambar: p.gambar_url,
        nonaktif: dipakai.has(p.id),
    }));
}

function simbol(b: BarisForm): string | undefined {
    return b.product_id === null
        ? undefined
        : produkDikenal.value.get(b.product_id)?.unit?.simbol;
}

const totalForm = computed(() =>
    form.value.items.reduce(
        (s, i) => s + (i.qty ?? 0) * (i.harga_beli ?? 0),
        0,
    ),
);

async function bukaForm() {
    menyiapkan.value = true;
    try {
        if (supplier.value.length === 0) {
            supplier.value = (
                await ambilPenuh<Supplier[]>('/suppliers', { per_page: 100 })
            ).data;
        }
        form.value = {
            supplier_id: null,
            tanggal_masuk: kunciTanggal(),
            catatan: '',
            items: [barisBaru()],
        };
        dicoba.value = false;
        galatServer.value = {};
        formTerbuka.value = true;
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal menyiapkan formulir.',
        );
    } finally {
        menyiapkan.value = false;
    }
}

async function tambahBaris() {
    const b = barisBaru();
    form.value.items.push(b);
    await nextTick();
    document.getElementById(`produk-${b.kunci}`)?.focus();
}

function hapusBaris(kunci: number) {
    form.value.items = form.value.items.filter((b) => b.kunci !== kunci);
}

/** Harga beli diisikan otomatis dari master produk sebagai titik awal. */
function padaPilihProduk(b: BarisForm) {
    const p =
        b.product_id === null
            ? undefined
            : produkDikenal.value.get(b.product_id);
    if (p && (b.harga_beli === null || b.harga_beli === 0)) {
        b.harga_beli = p.harga_beli;
    }
}

const galatLokal = computed(() => {
    const e: Record<string, string> = {};
    const f = form.value;
    if (f.supplier_id === null) e.supplier_id = 'Supplier wajib dipilih.';
    if (!f.tanggal_masuk) e.tanggal_masuk = 'Tanggal wajib diisi.';
    else if (f.tanggal_masuk > kunciTanggal())
        e.tanggal_masuk = 'Tanggal masuk tidak boleh di masa depan.';
    f.items.forEach((b, i) => {
        if (b.product_id === null) e[`items.${i}.product_id`] = 'Pilih produk.';
        if (!b.qty || b.qty < 1) e[`items.${i}.qty`] = 'Minimal 1.';
        if (b.harga_beli === null) e[`items.${i}.harga_beli`] = 'Isi harga.';
    });
    return e;
});

function pesanGalat(kunci: string): string | undefined {
    return (
        galatServer.value[kunci] ??
        (dicoba.value ? galatLokal.value[kunci] : undefined)
    );
}

function galatBaris(i: number): string | undefined {
    return (
        pesanGalat(`items.${i}.product_id`) ??
        pesanGalat(`items.${i}.qty`) ??
        pesanGalat(`items.${i}.harga_beli`)
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

    mengirim.value = true;
    try {
        const r = await simpan<Purchase>('/purchases', {
            supplier_id: form.value.supplier_id,
            tanggal_masuk: form.value.tanggal_masuk,
            catatan: form.value.catatan.trim() || null,
            items: form.value.items.map((b) => ({
                product_id: b.product_id,
                qty: b.qty,
                harga_beli: b.harga_beli,
            })),
        });
        toast.sukses(r.message ?? 'Barang masuk dicatat.');
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
</script>

<template>
    <div class="page-head">
        <p class="caption">
            Mencatat penerimaan barang sekaligus menambah stok.
        </p>
        <button
            v-if="adalahAdmin"
            class="btn btn-primary"
            :disabled="menyiapkan"
            :aria-busy="menyiapkan"
            @click="bukaForm"
        >
            <Plus
                v-if="!menyiapkan"
                :size="18"
                :stroke-width="2"
                aria-hidden="true"
            />
            Catat Penerimaan
        </button>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Belum ada dokumen barang masuk."
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
                                kolom="tanggal_masuk"
                                :urut="urut"
                                :arah="arah"
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <th>Supplier</th>
                            <KepalaUrut
                                label="Total biaya"
                                kolom="total_biaya"
                                :urut="urut"
                                :arah="arah"
                                num
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
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
                v-model:per-halaman="perHalaman"
                :meta="meta"
                @pindah="pindahHalaman"
            />
        </KeadaanData>
    </div>

    <BaseModal
        v-if="formTerbuka"
        judul="Catat Penerimaan Barang"
        lebar="820px"
        formulir
        :terkunci="mengirim"
        @tutup="formTerbuka = false"
    >
        <form id="form-bm" class="stack" novalidate @submit.prevent="kirim">
            <div class="dua">
                <FieldForm
                    v-slot="{ id, invalid, describedby }"
                    label="Supplier"
                    wajib
                    :galat="pesanGalat('supplier_id')"
                >
                    <BaseSelect
                        :id="id"
                        v-model="form.supplier_id"
                        :opsi="opsiSupplier"
                        placeholder="Pilih supplier"
                        :invalid="invalid"
                        :aria-describedby="describedby"
                    />
                </FieldForm>
                <FieldForm
                    v-slot="{ id, invalid, describedby }"
                    label="Tanggal masuk"
                    wajib
                    :galat="pesanGalat('tanggal_masuk')"
                >
                    <InputTanggal
                        :id="id"
                        v-model="form.tanggal_masuk"
                        :maks="kunciTanggal()"
                        :invalid="invalid"
                        :aria-describedby="describedby"
                    />
                </FieldForm>
            </div>

            <fieldset class="rincian">
                <legend class="overline">Rincian barang</legend>

                <div class="rincian-kepala" aria-hidden="true">
                    <span>Produk</span>
                    <span class="num">Qty</span>
                    <span class="num">Harga beli / unit</span>
                    <span class="num">Subtotal</span>
                    <span />
                </div>

                <div
                    v-for="(b, i) in form.items"
                    :key="b.kunci"
                    class="baris-item"
                >
                    <BaseSelect
                        :id="`produk-${b.kunci}`"
                        v-model="b.product_id"
                        :opsi="[]"
                        :cari-server="(kata: string) => cariProduk(b, kata)"
                        :cari="true"
                        placeholder="Cari nama atau barcode…"
                        :aria-label="`Produk baris ${i + 1}`"
                        :invalid="Boolean(pesanGalat(`items.${i}.product_id`))"
                        @update:model-value="padaPilihProduk(b)"
                    />
                    <InputAngka
                        v-model="b.qty"
                        :akhiran="simbol(b)"
                        :aria-label="`Jumlah baris ${i + 1}`"
                        :invalid="Boolean(pesanGalat(`items.${i}.qty`))"
                    />
                    <InputAngka
                        v-model="b.harga_beli"
                        awalan="Rp"
                        :langkah="500"
                        :aria-label="`Harga beli baris ${i + 1}`"
                        :invalid="Boolean(pesanGalat(`items.${i}.harga_beli`))"
                    />
                    <span class="num subtotal">{{
                        angka((b.qty ?? 0) * (b.harga_beli ?? 0))
                    }}</span>
                    <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-ikon"
                        :aria-label="`Hapus baris ${i + 1}`"
                        :disabled="form.items.length === 1"
                        @click="hapusBaris(b.kunci)"
                    >
                        <Trash2 :size="16" :stroke-width="1.75" />
                    </button>
                    <p v-if="galatBaris(i)" class="field-error galat-baris">
                        Baris {{ i + 1 }}: {{ galatBaris(i) }}
                    </p>
                </div>

                <button
                    type="button"
                    class="btn btn-soft btn-sm tambah"
                    @click="tambahBaris"
                >
                    <Plus :size="16" :stroke-width="2" aria-hidden="true" />
                    Tambah baris
                </button>
            </fieldset>

            <FieldForm v-slot="{ id }" label="Catatan">
                <input
                    :id="id"
                    v-model="form.catatan"
                    class="input"
                    maxlength="500"
                    placeholder="mis. nomor surat jalan"
                />
            </FieldForm>

            <div class="total">
                <span>Total biaya</span>
                <span class="num">{{ rupiah(totalForm) }}</span>
            </div>
            <p class="caption">
                Total dihitung ulang di server dari baris yang dikirim.
            </p>
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
                form="form-bm"
                :disabled="mengirim"
                :aria-busy="mengirim"
            >
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

.rincian {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
}

.rincian legend {
    margin-bottom: var(--space-2);
}

.rincian-kepala,
.baris-item {
    display: grid;
    grid-template-columns: minmax(0, 2.4fr) 110px 150px 96px 36px;
    gap: var(--space-2);
    align-items: center;
}

.rincian-kepala {
    font: var(--text-caption);
    color: var(--text-muted);
}

.subtotal {
    font: var(--text-numeric);
}

.galat-baris {
    grid-column: 1 / -1;
}

.tambah {
    align-self: flex-start;
}

.total {
    display: flex;
    justify-content: space-between;
    padding-top: var(--space-3);
    border-top: 1px solid var(--divider);
    font: var(--text-body-strong);
}

@media (max-width: 767px) {
    .dua {
        grid-template-columns: 1fr;
    }

    .rincian-kepala {
        display: none;
    }

    /* Di layar sempit tiap baris menjadi kartu kecil dua kolom. */
    .baris-item {
        grid-template-columns: 1fr 1fr;
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: var(--surface-raised);
    }

    .baris-item > :first-child {
        grid-column: 1 / -1;
    }
}
</style>
