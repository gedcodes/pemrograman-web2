<script setup lang="ts">
import { ImageUp, Package, Trash2, WandSparkles } from '@lucide/vue';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import {
    ambil,
    ambilPenuh,
    ApiError,
    hapus,
    perbarui,
    simpan,
} from '../api/client';
import type { Category, Product, Unit } from '../api/types';
import { persen, rupiah } from '../composables/format';
import { keOpsi } from '../composables/pilihan';
import { toast } from '../stores/toast';
import BarcodeSvg from '../components/BarcodeSvg.vue';
import BaseModal from '../components/BaseModal.vue';
import BaseSelect from '../components/BaseSelect.vue';
import BaseSwitch from '../components/BaseSwitch.vue';
import FieldForm from '../components/FieldForm.vue';
import InputAngka from '../components/InputAngka.vue';
import PratinjauGambar from '../components/PratinjauGambar.vue';

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
        aktif: true,
    };
}

const form = ref<FormProduk>(formKosong());

/* Potret isian saat dimuat, untuk mendeteksi perubahan yang belum disimpan. */
const awal = ref(JSON.stringify(form.value));
const kotor = computed(
    () =>
        JSON.stringify(form.value) !== awal.value ||
        berkasBaru.value !== null ||
        hapusFoto.value,
);

/* ---------------------------------------------------------------- foto */

/* Foto dipilih di sini tetapi baru diunggah SETELAH produk tersimpan:
   produk baru belum punya id sebelum itu. */
const gambarUrl = ref<string | null>(null);
const berkasBaru = ref<File | null>(null);
const pratinjauBaru = ref<string | null>(null);
const hapusFoto = ref(false);
const galatFoto = ref<string | null>(null);
const pemilihFoto = ref<HTMLInputElement | null>(null);
const perbesar = ref(false);

const JENIS_FOTO = ['image/png', 'image/jpeg', 'image/webp'];

/** Foto yang tampil sekarang: pilihan baru, atau yang tersimpan. */
const fotoTampil = computed(() =>
    hapusFoto.value ? null : (pratinjauBaru.value ?? gambarUrl.value),
);

function lepasPratinjau() {
    if (pratinjauBaru.value) URL.revokeObjectURL(pratinjauBaru.value);
    pratinjauBaru.value = null;
}

function pilihFoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const berkas = input.files?.[0];
    input.value = ''; // supaya berkas yang sama dapat dipilih lagi
    if (!berkas) return;

    galatFoto.value = null;
    if (!JENIS_FOTO.includes(berkas.type)) {
        galatFoto.value = 'Foto harus berupa gambar PNG, JPG, atau WebP.';
        return;
    }
    if (berkas.size > 2 * 1024 * 1024) {
        galatFoto.value = 'Ukuran foto paling besar 2 MB.';
        return;
    }

    lepasPratinjau();
    berkasBaru.value = berkas;
    pratinjauBaru.value = URL.createObjectURL(berkas);
    hapusFoto.value = false;
}

function buangFoto() {
    lepasPratinjau();
    berkasBaru.value = null;
    galatFoto.value = null;
    // Foto tersimpan baru benar-benar dihapus saat formulir disimpan.
    hapusFoto.value = gambarUrl.value !== null;
}

/** Unggah/hapus foto untuk produk yang sudah tersimpan. */
async function simpanFoto(produkId: number): Promise<void> {
    if (berkasBaru.value) {
        const data = new FormData();
        data.append('gambar', berkasBaru.value);
        await simpan<Product>(`/products/${produkId}/gambar`, data);
    } else if (hapusFoto.value) {
        await hapus<Product>(`/products/${produkId}/gambar`);
    }
}

/* ------------------------------------------------------------- barcode */

const membuatBarcode = ref(false);

async function buatBarcode() {
    membuatBarcode.value = true;
    try {
        const r = await ambil<{ barcode: string }>('/products/barcode-baru');
        form.value.barcode = r.barcode;
        delete galatServer.value.barcode;
        toast.info('Barcode internal dibuat. Simpan produk untuk memakainya.');
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal membuat barcode.',
        );
    } finally {
        membuatBarcode.value = false;
    }
}

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
    else if (f.barcode.trim() !== '' && !/^[!-~]+$/.test(f.barcode.trim()))
        e.barcode =
            'Barcode hanya boleh berisi huruf, angka, dan tanda baca, tanpa spasi.';
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
        aktif: f.aktif,
    };

    // Stok HANYA dikirim saat produk dibuat. Saat mengubah, mengirim angka
    // yang dimuat ketika formulir dibuka akan menimpa penjualan yang terjadi
    // selama formulir terbuka, tanpa tercatat di mutasi stok.
    if (!mengubah.value) muatan.stok = f.stok ?? 0;

    let produkId: number | null = null;
    try {
        const r = mengubah.value
            ? await perbarui<Product>(`/products/${id.value}`, muatan)
            : await simpan<Product>('/products', muatan);
        produkId = r.data.id;

        await simpanFoto(produkId);

        toast.sukses(
            mengubah.value ? 'Produk diperbarui.' : 'Produk ditambahkan.',
        );
        tersimpan = true;
        await router.push({ name: 'produk' });
    } catch (e) {
        // Produk sudah tersimpan tetapi fotonya gagal: jangan buang data
        // yang sudah masuk. Buka formulir ubah supaya foto dapat dicoba lagi.
        if (produkId !== null) {
            toast.galat(
                `Produk tersimpan, tetapi foto gagal diunggah: ${
                    e instanceof ApiError
                        ? (e.field('gambar') ?? e.message)
                        : 'kesalahan tak terduga'
                }`,
            );
            if (mengubah.value) {
                // Isian produk sudah tersimpan; yang tersisa hanya fotonya,
                // jadi tetap di sini dan biarkan pengguna menyimpan ulang.
                awal.value = JSON.stringify(form.value);
            } else {
                // Rute dikunci dengan path, jadi formulir ubah dimuat sebagai
                // komponen baru berisi produk yang baru tersimpan.
                tersimpan = true;
                await router.replace({
                    name: 'produk-ubah',
                    params: { id: produkId },
                });
            }
            return;
        }
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
                aktif: p.aktif,
            };
            gambarUrl.value = p.gambar_url;
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
    lepasPratinjau();
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
                    bantuan="Pindai barcode pabrik, atau buat barcode internal bila produk tidak punya."
                    :galat="pesanGalat('barcode')"
                >
                    <div class="barcode-baris">
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
                        <button
                            type="button"
                            class="btn btn-soft"
                            :disabled="membuatBarcode"
                            :aria-busy="membuatBarcode"
                            @click="buatBarcode"
                        >
                            <WandSparkles
                                :size="16"
                                :stroke-width="1.75"
                                aria-hidden="true"
                            />
                            {{ membuatBarcode ? 'Membuat…' : 'Buat otomatis' }}
                        </button>
                    </div>
                </FieldForm>

                <div
                    v-if="form.barcode.trim() && !galatLokal.barcode"
                    class="barcode-pratinjau"
                >
                    <BarcodeSvg :kode="form.barcode.trim()" :tinggi="48" />
                </div>

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
                <h3>Foto produk</h3>
                <button
                    v-if="fotoTampil"
                    type="button"
                    class="foto-pratinjau"
                    :aria-label="`Perbesar foto ${form.nama_produk || 'produk'}`"
                    @click="perbesar = true"
                >
                    <img :src="fotoTampil" alt="" />
                    <span
                        v-if="berkasBaru"
                        class="badge badge-warning foto-tanda"
                        >Belum disimpan</span
                    >
                </button>
                <div v-else class="foto-kosong">
                    <Package
                        :size="40"
                        :stroke-width="1.25"
                        aria-hidden="true"
                    />
                    <span class="caption">Belum ada foto</span>
                </div>

                <div class="row" style="gap: var(--space-2)">
                    <button
                        type="button"
                        class="btn btn-soft"
                        @click="pemilihFoto?.click()"
                    >
                        <ImageUp :size="16" aria-hidden="true" />
                        {{ fotoTampil ? 'Ganti foto' : 'Pilih foto' }}
                    </button>
                    <button
                        v-if="fotoTampil"
                        type="button"
                        class="btn btn-ghost btn-bahaya"
                        @click="buangFoto"
                    >
                        <Trash2 :size="16" aria-hidden="true" />
                        Hapus
                    </button>
                </div>
                <p v-if="galatFoto" class="field-error" role="alert">
                    {{ galatFoto }}
                </p>
                <p v-else-if="hapusFoto" class="caption">
                    Foto akan dihapus saat produk disimpan.
                </p>
                <p v-else class="caption">
                    PNG, JPG, atau WebP, maks. 2 MB. Sebaiknya persegi dengan
                    latar polos.
                </p>
                <input
                    ref="pemilihFoto"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="sr-only"
                    tabindex="-1"
                    aria-hidden="true"
                    @change="pilihFoto"
                />
            </div>

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

    <PratinjauGambar
        v-if="perbesar && fotoTampil"
        :src="fotoTampil"
        :judul="form.nama_produk || 'Foto produk'"
        :keterangan="berkasBaru ? 'Foto baru, belum disimpan.' : undefined"
        @tutup="perbesar = false"
    />

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

.barcode-baris {
    display: flex;
    gap: var(--space-2);
}

.barcode-baris .input {
    flex: 1;
    min-width: 0;
}

.barcode-pratinjau {
    align-self: flex-start;
    width: 240px;
    max-width: 100%;
    padding: var(--space-2);
    background: #fff;
    border-radius: var(--radius-sm);
    box-shadow: 0 0 0 1px var(--divider);
}

.foto-pratinjau {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: #fff;
    box-shadow: 0 0 0 1px var(--divider);
    cursor: zoom-in;
    overflow: hidden;
}

.foto-pratinjau img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.foto-pratinjau:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
}

.foto-tanda {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
}

.foto-kosong {
    display: grid;
    place-items: center;
    gap: var(--space-2);
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    background: var(--surface-base);
    color: var(--text-muted);
}

.btn-bahaya {
    color: var(--danger-text);
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
