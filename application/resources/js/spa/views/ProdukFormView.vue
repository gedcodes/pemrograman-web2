<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { ambil, ambilPenuh, ApiError, perbarui, simpan } from '../api/client';
import type { Category, Product, Unit } from '../api/types';
import { persen, rupiah } from '../composables/format';
import { keOpsi } from '../composables/pilihan';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import BaseSelect from '../components/BaseSelect.vue';
import BaseSwitch from '../components/BaseSwitch.vue';
import FieldForm from '../components/FieldForm.vue';
import InputAngka from '../components/InputAngka.vue';

const route = useRoute();
const router = useRouter();

const id = computed(() => (route.params.id ? Number(route.params.id) : null));
const mengubah = computed(() => id.value !== null);

const kategori = ref<Category[]>([]);
const satuan = ref<Unit[]>([]);

const opsiKategori = computed(() =>
    keOpsi(
        kategori.value,
        (k) => k.id,
        (k) => k.nama_kategori,
    ),
);
const opsiSatuan = computed(() =>
    keOpsi(
        satuan.value,
        (s) => s.id,
        (s) => s.nama_satuan,
        (s) => s.simbol,
    ),
);

interface FormProduk {
    barcode: string;
    nama_produk: string;
    category_id: number | null;
    unit_id: number | null;
    harga_beli: number | null;
    harga_jual: number | null;
    stok: number | null;
    stok_minimum: number | null;
    gambar: string | null;
    aktif: boolean;
}

function formKosong(): FormProduk {
    return {
        barcode: '',
        nama_produk: '',
        category_id: null,
        unit_id: null,
        harga_beli: null,
        harga_jual: null,
        stok: 0,
        stok_minimum: 0,
        gambar: null,
        aktif: true,
    };
}

const form = ref<FormProduk>(formKosong());

/* Potret isian saat dimuat, untuk mendeteksi perubahan yang belum disimpan. */
const awal = ref(JSON.stringify(form.value));
const kotor = computed(() => JSON.stringify(form.value) !== awal.value);

const galatServer = ref<Record<string, string>>({});
const mengirim = ref(false);
const memuat = ref(true);
const galatMuat = ref<string | null>(null);

/* Galat baru ditampilkan setelah isian disentuh atau tombol simpan ditekan.
   Formulir yang baru dibuka tidak boleh langsung penuh tulisan merah. */
const dicoba = ref(false);
const disentuh = ref(new Set<string>());

function sentuh(field: string) {
    disentuh.value.add(field);
}

const beli = computed(() => form.value.harga_beli ?? 0);
const jual = computed(() => form.value.harga_jual ?? 0);

/* Pratinjau margin, dengan definisi yang sama seperti accessor di server:
   margin = laba dibagi HARGA JUAL, bukan harga beli. Markup ditampilkan
   terpisah supaya keduanya tidak tertukar. */
const laba = computed(() => jual.value - beli.value);
const margin = computed(() =>
    jual.value > 0 ? (laba.value / jual.value) * 100 : 0,
);
const markup = computed(() =>
    beli.value > 0 ? (laba.value / beli.value) * 100 : 0,
);

/* Validasi sisi klien. Aturan yang sama ditegakkan ulang di server;
   yang di sini hanya untuk umpan balik cepat. Urutannya mengikuti urutan
   isian di layar, karena isian pertama yang salah akan difokuskan. */
const galatLokal = computed(() => {
    const f = form.value;
    const e: Record<string, string> = {};

    if (f.nama_produk.trim() === '') e.nama_produk = 'Nama produk wajib diisi.';
    else if (f.nama_produk.length > 180)
        e.nama_produk = 'Nama produk paling panjang 180 karakter.';
    if (f.barcode.length > 50)
        e.barcode = 'Barcode paling panjang 50 karakter.';
    if (f.category_id === null) e.category_id = 'Kategori wajib dipilih.';
    if (f.unit_id === null) e.unit_id = 'Satuan wajib dipilih.';
    if (f.harga_beli === null) e.harga_beli = 'Harga beli wajib diisi.';
    if (f.harga_jual === null) e.harga_jual = 'Harga jual wajib diisi.';
    else if (f.harga_beli !== null && f.harga_jual < f.harga_beli)
        e.harga_jual =
            'Harga jual tidak boleh lebih kecil daripada harga beli.';
    if (!mengubah.value && f.stok === null)
        e.stok = 'Isi 0 bila belum ada stok.';

    return e;
});

function pesanGalat(field: string): string | undefined {
    if (galatServer.value[field]) return galatServer.value[field];
    if (dicoba.value || disentuh.value.has(field))
        return galatLokal.value[field];
    return undefined;
}

/* Id isian, supaya isian pertama yang salah dapat difokuskan. */
const ID: Record<string, string> = {
    nama_produk: 'nama',
    barcode: 'barcode',
    category_id: 'kategori',
    unit_id: 'satuan',
    harga_beli: 'beli',
    harga_jual: 'jual',
    stok: 'stok',
};

async function fokusGalatPertama(daftar: string[]) {
    await nextTick();
    const pertama = daftar.find((f) => ID[f]);
    if (pertama) document.getElementById(ID[pertama])?.focus();
}

let tersimpan = false;

async function kirim() {
    if (mengirim.value) return;

    dicoba.value = true;
    galatServer.value = {};

    const kunciGalat = Object.keys(galatLokal.value);
    if (kunciGalat.length > 0) {
        toast.peringatan('Periksa kembali isian yang ditandai.');
        await fokusGalatPertama(kunciGalat);
        return;
    }

    mengirim.value = true;

    const f = form.value;
    const muatan: Record<string, unknown> = {
        barcode: f.barcode.trim() || null,
        nama_produk: f.nama_produk.trim(),
        category_id: f.category_id,
        unit_id: f.unit_id,
        harga_beli: f.harga_beli,
        harga_jual: f.harga_jual,
        stok_minimum: f.stok_minimum ?? 0,
        gambar: f.gambar || null,
        aktif: f.aktif,
    };

    // Stok HANYA dikirim saat produk dibuat. Saat mengubah, mengirim angka
    // yang dimuat ketika formulir dibuka akan menimpa penjualan yang terjadi
    // selama formulir terbuka, tanpa tercatat di mutasi stok.
    if (!mengubah.value) muatan.stok = f.stok ?? 0;

    try {
        if (mengubah.value) {
            await perbarui(`/products/${id.value}`, muatan);
            toast.sukses('Produk diperbarui.');
        } else {
            await simpan('/products', muatan);
            toast.sukses('Produk ditambahkan.');
        }
        tersimpan = true;
        await router.push({ name: 'produk' });
    } catch (e) {
        if (e instanceof ApiError) {
            galatServer.value = Object.fromEntries(
                Object.entries(e.errors).map(([k, v]) => [k, v[0]]),
            );
            toast.galat(e.message);
            await fokusGalatPertama(Object.keys(galatServer.value));
        } else {
            toast.galat('Gagal menyimpan produk.');
        }
    } finally {
        mengirim.value = false;
    }
}

async function muat() {
    memuat.value = true;
    galatMuat.value = null;
    try {
        const [k, s, p] = await Promise.all([
            ambilPenuh<Category[]>('/categories', { per_page: 100 }),
            ambilPenuh<Unit[]>('/units', { per_page: 100 }),
            mengubah.value
                ? ambil<Product>(`/products/${id.value}`)
                : Promise.resolve(null),
        ]);
        kategori.value = k.data;
        satuan.value = s.data;

        if (p) {
            form.value = {
                barcode: p.barcode ?? '',
                nama_produk: p.nama_produk,
                category_id: p.category_id,
                unit_id: p.unit_id,
                harga_beli: p.harga_beli,
                harga_jual: p.harga_jual,
                stok: p.stok,
                stok_minimum: p.stok_minimum,
                gambar: p.gambar,
                aktif: p.aktif,
            };
        }
        awal.value = JSON.stringify(form.value);
    } catch (e) {
        galatMuat.value =
            e instanceof ApiError ? e.message : 'Gagal memuat formulir.';
    } finally {
        memuat.value = false;
    }
}

/* ---------------------------------------------- perubahan belum disimpan */

const jawabTinggalkan = ref<((ya: boolean) => void) | null>(null);

onBeforeRouteLeave(() => {
    if (tersimpan || !kotor.value) return true;
    return new Promise<boolean>((selesai) => {
        jawabTinggalkan.value = selesai;
    });
});

function jawab(ya: boolean) {
    jawabTinggalkan.value?.(ya);
    jawabTinggalkan.value = null;
}

/* Menutup tab atau memuat ulang halaman juga diperingatkan. */
function sebelumTutup(e: BeforeUnloadEvent) {
    if (kotor.value && !tersimpan) e.preventDefault();
}

/* Ctrl/⌘ + S menyimpan, seperti pada prototipe. */
function pintasan(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void kirim();
    }
}

onMounted(() => {
    window.addEventListener('beforeunload', sebelumTutup);
    document.addEventListener('keydown', pintasan);
    void muat();
});

onUnmounted(() => {
    window.removeEventListener('beforeunload', sebelumTutup);
    document.removeEventListener('keydown', pintasan);
});
</script>

<template>
    <div v-if="memuat" class="form-grid" aria-busy="true">
        <div class="card stack">
            <div class="skeleton" style="width: 40%; height: 22px" />
            <div
                v-for="i in 5"
                :key="i"
                class="skeleton"
                style="height: 48px"
            />
        </div>
        <div class="card stack">
            <div class="skeleton" style="width: 55%; height: 18px" />
            <div
                v-for="i in 3"
                :key="i"
                class="skeleton"
                style="height: 20px"
            />
        </div>
    </div>

    <div v-else-if="galatMuat" class="card keadaan-galat">
        <p>{{ galatMuat }}</p>
        <button class="btn btn-soft" @click="muat">Coba lagi</button>
    </div>

    <!-- Tata letak asimetris 2fr / 1fr (DESIGN.md Bagian 8.5). -->
    <form v-else class="form-grid" novalidate @submit.prevent="kirim">
        <div class="stack" style="gap: var(--space-5)">
            <section class="card stack">
                <h2>Informasi produk</h2>

                <FieldForm
                    v-slot="{ id: i, invalid, describedby }"
                    label="Nama produk"
                    untuk="nama"
                    wajib
                    :galat="pesanGalat('nama_produk')"
                >
                    <input
                        :id="i"
                        v-model="form.nama_produk"
                        class="input"
                        :class="{ 'is-error': invalid }"
                        :aria-invalid="invalid || undefined"
                        :aria-describedby="describedby"
                        maxlength="180"
                        placeholder="mis. Indomie Goreng Rendang 85g"
                        required
                        @blur="sentuh('nama_produk')"
                    />
                </FieldForm>

                <FieldForm
                    v-slot="{ id: i, invalid, describedby }"
                    label="Barcode"
                    untuk="barcode"
                    bantuan="Kosongkan bila produk tidak berbarcode."
                    :galat="pesanGalat('barcode')"
                >
                    <input
                        :id="i"
                        v-model="form.barcode"
                        class="input input-mono"
                        :class="{ 'is-error': invalid }"
                        :aria-invalid="invalid || undefined"
                        :aria-describedby="describedby"
                        maxlength="50"
                        inputmode="numeric"
                        autocomplete="off"
                        @blur="sentuh('barcode')"
                    />
                </FieldForm>

                <div class="dua-kolom">
                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Kategori"
                        untuk="kategori"
                        wajib
                        :galat="pesanGalat('category_id')"
                    >
                        <BaseSelect
                            :id="i"
                            v-model="form.category_id"
                            :opsi="opsiKategori"
                            placeholder="Pilih kategori"
                            :invalid="invalid"
                            :aria-describedby="describedby"
                            @update:model-value="sentuh('category_id')"
                        />
                    </FieldForm>

                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Satuan"
                        untuk="satuan"
                        wajib
                        :galat="pesanGalat('unit_id')"
                    >
                        <BaseSelect
                            :id="i"
                            v-model="form.unit_id"
                            :opsi="opsiSatuan"
                            placeholder="Pilih satuan"
                            :invalid="invalid"
                            :aria-describedby="describedby"
                            @update:model-value="sentuh('unit_id')"
                        />
                    </FieldForm>
                </div>
            </section>

            <section class="card stack">
                <h2>Harga &amp; stok</h2>

                <div class="dua-kolom">
                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Harga beli"
                        untuk="beli"
                        wajib
                        :galat="pesanGalat('harga_beli')"
                    >
                        <InputAngka
                            :id="i"
                            v-model="form.harga_beli"
                            awalan="Rp"
                            placeholder="0"
                            :langkah="500"
                            :invalid="invalid"
                            :aria-describedby="describedby"
                            @blur="sentuh('harga_beli')"
                        />
                    </FieldForm>

                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Harga jual"
                        untuk="jual"
                        wajib
                        :galat="pesanGalat('harga_jual')"
                    >
                        <InputAngka
                            :id="i"
                            v-model="form.harga_jual"
                            awalan="Rp"
                            placeholder="0"
                            :langkah="500"
                            :invalid="invalid"
                            :aria-describedby="describedby"
                            @blur="sentuh('harga_jual')"
                        />
                    </FieldForm>
                </div>

                <div class="dua-kolom">
                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        :label="mengubah ? 'Stok saat ini' : 'Stok awal'"
                        untuk="stok"
                        :bantuan="
                            mengubah
                                ? 'Diubah lewat Barang Masuk atau Stok Opname, supaya setiap pergerakannya tercatat.'
                                : undefined
                        "
                        :galat="pesanGalat('stok')"
                    >
                        <InputAngka
                            :id="i"
                            v-model="form.stok"
                            :akhiran="
                                satuan.find((s) => s.id === form.unit_id)
                                    ?.simbol
                            "
                            :disabled="mengubah"
                            :invalid="invalid"
                            :aria-describedby="describedby"
                            @blur="sentuh('stok')"
                        />
                    </FieldForm>

                    <FieldForm
                        v-slot="{ id: i, describedby }"
                        label="Stok minimum"
                        bantuan='Ambang munculnya badge "menipis".'
                    >
                        <InputAngka
                            :id="i"
                            v-model="form.stok_minimum"
                            :aria-describedby="describedby"
                        />
                    </FieldForm>
                </div>

                <BaseSwitch v-model="form.aktif">
                    Produk aktif dan dapat dijual di halaman Kasir
                </BaseSwitch>
            </section>
        </div>

        <aside class="stack samping">
            <div class="card stack">
                <h3>Ringkasan harga</h3>
                <div class="row">
                    <span>Laba per unit</span><span class="spacer" /><span
                        class="num"
                        :class="{ rugi: laba < 0 }"
                        >{{ rupiah(laba) }}</span
                    >
                </div>
                <div class="row">
                    <span>Margin</span><span class="spacer" /><span
                        class="num"
                        >{{ persen(margin) }}</span
                    >
                </div>
                <div class="row">
                    <span>Markup</span><span class="spacer" /><span
                        class="num"
                        >{{ persen(markup) }}</span
                    >
                </div>
                <p class="caption">
                    Margin dihitung terhadap harga jual, markup terhadap harga
                    beli. Keduanya sengaja ditampilkan agar tidak tertukar.
                </p>
            </div>

            <div class="card stack">
                <button
                    class="btn btn-primary btn-block"
                    type="submit"
                    :disabled="mengirim"
                    :aria-busy="mengirim"
                >
                    {{
                        mengirim
                            ? 'Menyimpan…'
                            : mengubah
                              ? 'Simpan Perubahan'
                              : 'Simpan Produk'
                    }}
                </button>
                <RouterLink
                    class="btn btn-soft btn-block"
                    :to="{ name: 'produk' }"
                    >Batal</RouterLink
                >
                <p class="caption pintasan">
                    <kbd>Ctrl</kbd> + <kbd>S</kbd> untuk menyimpan
                </p>
            </div>
        </aside>
    </form>

    <BaseModal
        v-if="jawabTinggalkan"
        judul="Tinggalkan formulir?"
        deskripsi="Perubahan pada produk ini belum disimpan dan akan hilang."
        @tutup="jawab(false)"
    >
        <template #aksi>
            <button class="btn btn-soft" @click="jawab(false)">
                Kembali ke formulir
            </button>
            <button class="btn btn-danger" @click="jawab(true)">
                Buang perubahan
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.form-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-5);
    align-items: start;
}

.samping {
    position: sticky;
    top: calc(var(--topbar-h) + var(--space-4));
}

.dua-kolom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
}

.input-mono {
    font: var(--text-numeric);
}

.rugi {
    color: var(--danger-text);
}

.keadaan-galat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    color: var(--danger-text);
}

.pintasan {
    text-align: center;
}

kbd {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--surface-base);
    box-shadow: var(--shadow-inset-sm);
    font: var(--text-caption);
}

/* Runtuh jadi satu kolom di bawah 768px. */
@media (max-width: 767px) {
    .form-grid,
    .dua-kolom {
        grid-template-columns: 1fr;
    }

    .samping {
        position: static;
    }
}
</style>
