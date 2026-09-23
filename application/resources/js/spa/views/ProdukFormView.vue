<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ambil, ambilPenuh, ApiError, perbarui, simpan } from '../api/client';
import type { Category, Product, Unit } from '../api/types';
import { persen, rupiah } from '../composables/format';
import { toast } from '../stores/toast';

const route = useRoute();
const router = useRouter();

const id = computed(() => (route.params.id ? Number(route.params.id) : null));
const mengubah = computed(() => id.value !== null);

const kategori = ref<Category[]>([]);
const satuan = ref<Unit[]>([]);

const form = ref({
    barcode: '',
    nama_produk: '',
    category_id: '' as number | '',
    unit_id: '' as number | '',
    harga_beli: 0,
    harga_jual: 0,
    stok: 0,
    stok_minimum: 0,
    gambar: '' as string | null,
    aktif: true,
});

const galatField = ref<Record<string, string>>({});
const mengirim = ref(false);
const memuat = ref(true);

/* Pratinjau margin, dengan definisi yang sama seperti accessor di server:
   margin = laba dibagi HARGA JUAL, bukan harga beli. Markup ditampilkan
   terpisah supaya keduanya tidak tertukar. */
const margin = computed(() =>
    form.value.harga_jual > 0
        ? ((form.value.harga_jual - form.value.harga_beli) /
              form.value.harga_jual) *
          100
        : 0,
);

const markup = computed(() =>
    form.value.harga_beli > 0
        ? ((form.value.harga_jual - form.value.harga_beli) /
              form.value.harga_beli) *
          100
        : 0,
);

const laba = computed(() => form.value.harga_jual - form.value.harga_beli);

/* Validasi sisi klien. Aturan yang sama ditegakkan ulang di server;
   yang di sini hanya untuk umpan balik cepat. */
const galatLokal = computed(() => {
    const e: Record<string, string> = {};
    if (form.value.nama_produk.trim() === '')
        e.nama_produk = 'Nama produk wajib diisi.';
    if (form.value.category_id === '')
        e.category_id = 'Kategori wajib dipilih.';
    if (form.value.unit_id === '') e.unit_id = 'Satuan wajib dipilih.';
    if (form.value.harga_beli < 0)
        e.harga_beli = 'Harga beli tidak boleh negatif.';
    if (form.value.harga_jual < form.value.harga_beli) {
        e.harga_jual =
            'Harga jual tidak boleh lebih kecil daripada harga beli.';
    }
    if (form.value.stok < 0) e.stok = 'Stok tidak boleh negatif.';
    return e;
});

const sah = computed(() => Object.keys(galatLokal.value).length === 0);

function pesanGalat(field: string): string | undefined {
    return galatField.value[field] || galatLokal.value[field];
}

async function kirim() {
    if (!sah.value) {
        galatField.value = {};
        toast.peringatan('Periksa kembali isian yang ditandai.');
        return;
    }

    mengirim.value = true;
    galatField.value = {};

    const muatan = { ...form.value, gambar: form.value.gambar || null };

    try {
        if (mengubah.value) {
            await perbarui(`/products/${id.value}`, muatan);
            toast.sukses('Produk diperbarui.');
        } else {
            await simpan('/products', muatan);
            toast.sukses('Produk ditambahkan.');
        }
        await router.push({ name: 'produk' });
    } catch (e) {
        if (e instanceof ApiError) {
            galatField.value = Object.fromEntries(
                Object.entries(e.errors).map(([k, v]) => [k, v[0]]),
            );
            toast.galat(e.message);
        } else {
            toast.galat('Gagal menyimpan produk.');
        }
    } finally {
        mengirim.value = false;
    }
}

onMounted(async () => {
    const [k, s] = await Promise.all([
        ambilPenuh<Category[]>('/categories', { per_page: 100 }),
        ambilPenuh<Unit[]>('/units', { per_page: 100 }),
    ]);
    kategori.value = k.data;
    satuan.value = s.data;

    if (mengubah.value) {
        const p = await ambil<Product>(`/products/${id.value}`);
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

    memuat.value = false;
});
</script>

<template>
    <div v-if="memuat" class="stack">
        <div v-for="i in 6" :key="i" class="skeleton" style="height: 56px" />
    </div>

    <!-- Tata letak asimetris 2fr / 1fr (DESIGN.md Bagian 8.5). -->
    <form v-else class="form-grid" novalidate @submit.prevent="kirim">
        <div class="card stack">
            <h2>Informasi produk</h2>

            <div class="field">
                <label for="nama">Nama produk *</label>
                <input
                    id="nama"
                    v-model="form.nama_produk"
                    class="input"
                    :class="{ 'is-error': pesanGalat('nama_produk') }"
                    required
                />
                <p v-if="pesanGalat('nama_produk')" class="field-error">
                    {{ pesanGalat('nama_produk') }}
                </p>
            </div>

            <div class="field">
                <label for="barcode">Barcode</label>
                <input
                    id="barcode"
                    v-model="form.barcode"
                    class="input"
                    :class="{ 'is-error': pesanGalat('barcode') }"
                    placeholder="Kosongkan bila produk tidak berbarcode"
                />
                <p v-if="pesanGalat('barcode')" class="field-error">
                    {{ pesanGalat('barcode') }}
                </p>
            </div>

            <div class="dua-kolom">
                <div class="field">
                    <label for="kategori">Kategori *</label>
                    <select
                        id="kategori"
                        v-model="form.category_id"
                        class="select"
                        :class="{ 'is-error': pesanGalat('category_id') }"
                    >
                        <option value="">Pilih kategori</option>
                        <option v-for="k in kategori" :key="k.id" :value="k.id">
                            {{ k.nama_kategori }}
                        </option>
                    </select>
                    <p v-if="pesanGalat('category_id')" class="field-error">
                        {{ pesanGalat('category_id') }}
                    </p>
                </div>

                <div class="field">
                    <label for="satuan">Satuan *</label>
                    <select
                        id="satuan"
                        v-model="form.unit_id"
                        class="select"
                        :class="{ 'is-error': pesanGalat('unit_id') }"
                    >
                        <option value="">Pilih satuan</option>
                        <option v-for="s in satuan" :key="s.id" :value="s.id">
                            {{ s.nama_satuan }}
                        </option>
                    </select>
                    <p v-if="pesanGalat('unit_id')" class="field-error">
                        {{ pesanGalat('unit_id') }}
                    </p>
                </div>
            </div>

            <h2 style="margin-top: var(--space-4)">Harga & stok</h2>

            <div class="dua-kolom">
                <div class="field">
                    <label for="beli">Harga beli *</label>
                    <input
                        id="beli"
                        v-model.number="form.harga_beli"
                        type="number"
                        min="0"
                        class="input"
                        :class="{ 'is-error': pesanGalat('harga_beli') }"
                    />
                    <p v-if="pesanGalat('harga_beli')" class="field-error">
                        {{ pesanGalat('harga_beli') }}
                    </p>
                </div>

                <div class="field">
                    <label for="jual">Harga jual *</label>
                    <input
                        id="jual"
                        v-model.number="form.harga_jual"
                        type="number"
                        min="0"
                        class="input"
                        :class="{ 'is-error': pesanGalat('harga_jual') }"
                    />
                    <p v-if="pesanGalat('harga_jual')" class="field-error">
                        {{ pesanGalat('harga_jual') }}
                    </p>
                </div>
            </div>

            <div class="dua-kolom">
                <div class="field">
                    <label for="stok">Stok</label>
                    <input
                        id="stok"
                        v-model.number="form.stok"
                        type="number"
                        min="0"
                        class="input"
                        :class="{ 'is-error': pesanGalat('stok') }"
                        :disabled="mengubah"
                    />
                    <p v-if="mengubah" class="caption">
                        Stok hanya dapat diubah lewat Barang Masuk atau Stok
                        Opname, supaya setiap pergerakannya tercatat.
                    </p>
                    <p v-if="pesanGalat('stok')" class="field-error">
                        {{ pesanGalat('stok') }}
                    </p>
                </div>

                <div class="field">
                    <label for="minimum">Stok minimum</label>
                    <input
                        id="minimum"
                        v-model.number="form.stok_minimum"
                        type="number"
                        min="0"
                        class="input"
                    />
                    <p class="caption">Ambang munculnya badge "menipis".</p>
                </div>
            </div>

            <label class="row toggle">
                <input v-model="form.aktif" type="checkbox" />
                <span class="caption"
                    >Produk aktif dan dapat dijual di halaman Kasir</span
                >
            </label>
        </div>

        <aside class="stack">
            <div class="card stack">
                <h3>Ringkasan harga</h3>
                <div class="row">
                    <span>Laba per unit</span><span class="spacer" /><span
                        class="num"
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
            </div>
        </aside>
    </form>
</template>

<style scoped>
.form-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-5);
    align-items: start;
}

.dua-kolom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
}

.toggle {
    cursor: pointer;
}

/* Runtuh jadi satu kolom di bawah 768px. */
@media (max-width: 767px) {
    .form-grid,
    .dua-kolom {
        grid-template-columns: 1fr;
    }
}
</style>
