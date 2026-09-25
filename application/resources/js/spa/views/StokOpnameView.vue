<script setup lang="ts">
import { ClipboardCheck, Eye, Package, Search } from '@lucide/vue';
import { computed, ref } from 'vue';
import { ambil, ambilPenuh, ApiError, simpan } from '../api/client';
import type { Product, StockOpname } from '../api/types';
import { angka, rupiah, tanggal } from '../composables/format';
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

/* Produk yang BENAR-BENAR dihitung petugas. Isian awal sama dengan stok
   sistem, jadi angka yang tidak berubah belum tentu sudah dihitung. Baris
   ditandai otomatis saat angkanya diubah, atau dicentang sendiri bila
   hitungannya cocok. Yang tercentang ikut tersimpan -- termasuk yang
   selisihnya nol -- sehingga pemilik tahu barang apa saja yang diperiksa. */
const dihitung = ref(new Set<number>());

function selisih(p: Product): number {
    const h = hitung.value[p.id];
    return h === null || h === undefined ? 0 : h - p.stok;
}

function ubahHitung(p: Product, nilai: number | null) {
    hitung.value[p.id] = nilai;
    if (nilai !== null) dihitung.value.add(p.id);
}

function tandai(p: Product, ya: boolean) {
    if (ya) dihitung.value.add(p.id);
    else dihitung.value.delete(p.id);
}

function tandaiSemuaTampil() {
    for (const p of barisTampil.value) dihitung.value.add(p.id);
}

const berselisih = computed(() => produk.value.filter((p) => selisih(p) !== 0));

/** Yang akan tersimpan: ditandai dihitung dan isiannya tidak dikosongkan. */
const tercatat = computed(() =>
    produk.value.filter(
        (p) =>
            (dihitung.value.has(p.id) || selisih(p) !== 0) &&
            hitung.value[p.id] !== null &&
            hitung.value[p.id] !== undefined,
    ),
);

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
        dihitung.value = new Set();
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
    // bukan dikirim sebagai kosong lalu ditolak server. Produk yang cocok
    // (selisih nol) tetap dikirim: server mencatatnya tanpa mengubah stok.
    const items = tercatat.value.map((p) => ({
        product_id: p.id,
        stok_fisik: hitung.value[p.id],
        // Stok buku saat lembar ini dibuka. Server menerapkan SELISIHNYA ke
        // stok terkini, jadi penjualan selama penghitungan tidak terhapus.
        stok_sistem: p.stok,
    }));

    if (items.length === 0) {
        toast.info('Tandai minimal satu produk yang sudah dihitung.');
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
/* ----------------------------------------------------------- rincian sesi */

const detail = ref<StockOpname | null>(null);
const memuatDetail = ref<number | null>(null);
const detailHanyaSelisih = ref(false);

async function lihat(o: StockOpname) {
    memuatDetail.value = o.id;
    try {
        detail.value = await ambil<StockOpname>(`/opnames/${o.id}`);
        detailHanyaSelisih.value = false;
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal memuat rincian opname.',
        );
    } finally {
        memuatDetail.value = null;
    }
}

const ringkasDetail = computed(() => {
    const items = detail.value?.items ?? [];
    return {
        produk: items.length,
        berselisih: items.filter((i) => i.selisih !== 0).length,
        lebih: items.reduce((s, i) => s + Math.max(0, i.selisih), 0),
        kurang: items.reduce((s, i) => s + Math.max(0, -i.selisih), 0),
        nilai: items.reduce((s, i) => s + (i.nilai_selisih ?? 0), 0),
    };
});

const itemDetailTampil = computed(() =>
    (detail.value?.items ?? []).filter(
        (i) => !detailHanyaSelisih.value || i.selisih !== 0,
    ),
);

const tandaSelisih = (n: number) =>
    `${n > 0 ? '+' : n < 0 ? '−' : ''}${angka(Math.abs(n))}`;
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
                            <th class="num">Dihitung</th>
                            <th class="num">Berselisih</th>
                            <th>Catatan</th>
                            <th>Status</th>
                            <th class="kolom-aksi">
                                <span class="sr-only">Aksi</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="o in daftar" :key="o.id">
                            <td>{{ o.no_dokumen }}</td>
                            <td>{{ tanggal(o.tanggal) }}</td>
                            <td>{{ o.user?.name ?? '-' }}</td>
                            <td class="num">
                                {{ angka(o.jumlah_produk ?? 0) }} produk
                            </td>
                            <td class="num">
                                <span
                                    :class="{
                                        'ada-selisih':
                                            (o.jumlah_berselisih ?? 0) > 0,
                                    }"
                                    >{{ angka(o.jumlah_berselisih ?? 0) }}</span
                                >
                            </td>
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
                            <td class="kolom-aksi">
                                <button
                                    class="btn btn-soft btn-sm"
                                    :disabled="memuatDetail === o.id"
                                    :aria-busy="memuatDetail === o.id"
                                    :aria-label="`Lihat barang yang diopname pada ${o.no_dokumen}`"
                                    @click="lihat(o)"
                                >
                                    <Eye
                                        :size="15"
                                        :stroke-width="1.75"
                                        aria-hidden="true"
                                    />
                                    Lihat
                                </button>
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
                <button
                    type="button"
                    class="btn btn-soft btn-sm"
                    @click="tandaiSemuaTampil"
                >
                    Tandai yang tampil sudah dihitung
                </button>
            </div>
            <p class="caption">
                Centang <strong>Dihitung</strong> untuk barang yang sudah
                diperiksa, termasuk yang jumlahnya cocok. Mengubah angka
                mencentangnya otomatis.
            </p>

            <div class="table-scroll lembar">
                <table class="data">
                    <thead>
                        <tr>
                            <th class="kolom-cek">Dihitung</th>
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
                            :class="{
                                'baris-selisih': selisih(p) !== 0,
                                'baris-dihitung': dihitung.has(p.id),
                            }"
                        >
                            <td class="kolom-cek">
                                <input
                                    type="checkbox"
                                    class="cek"
                                    :checked="
                                        dihitung.has(p.id) || selisih(p) !== 0
                                    "
                                    :disabled="selisih(p) !== 0"
                                    :aria-label="`${p.nama_produk} sudah dihitung`"
                                    @change="
                                        tandai(
                                            p,
                                            ($event.target as HTMLInputElement)
                                                .checked,
                                        )
                                    "
                                />
                            </td>
                            <td>
                                {{ p.nama_produk }}
                                <span class="caption blok">{{
                                    p.barcode ?? 'tanpa barcode'
                                }}</span>
                            </td>
                            <td class="num">{{ angka(p.stok) }}</td>
                            <td class="num">
                                <InputAngka
                                    :model-value="hitung[p.id]"
                                    kecil
                                    @update:model-value="ubahHitung(p, $event)"
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
                            <td colspan="5" class="muted">
                                Tidak ada produk yang cocok.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <template #aksi>
            <span class="caption ringkas-selisih">
                {{ tercatat.length }} dihitung &middot;
                {{ berselisih.length }} berselisih
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
                :disabled="mengirim || tercatat.length === 0"
                :aria-busy="mengirim"
                @click="kirim"
            >
                {{ mengirim ? 'Menyimpan…' : 'Selesaikan Opname' }}
            </button>
        </template>
    </BaseModal>
    <BaseModal
        v-if="detail"
        :judul="`Rincian ${detail.no_dokumen}`"
        :deskripsi="`${tanggal(detail.tanggal)} · petugas ${detail.user?.name ?? '-'}${detail.catatan ? ' · ' + detail.catatan : ''}`"
        lebar="880px"
        @tutup="detail = null"
    >
        <div class="stack">
            <div class="ringkas-detail">
                <div>
                    <p class="overline">Dihitung</p>
                    <p class="angka-besar">
                        {{ angka(ringkasDetail.produk) }} produk
                    </p>
                </div>
                <div>
                    <p class="overline">Berselisih</p>
                    <p class="angka-besar">
                        {{ angka(ringkasDetail.berselisih) }}
                    </p>
                </div>
                <div>
                    <p class="overline">Lebih / kurang</p>
                    <p class="angka-besar">
                        <span :class="{ lebih: ringkasDetail.lebih > 0 }">{{
                            ringkasDetail.lebih > 0
                                ? `+${angka(ringkasDetail.lebih)}`
                                : '0'
                        }}</span>
                        /
                        <span :class="{ kurang: ringkasDetail.kurang > 0 }">{{
                            ringkasDetail.kurang > 0
                                ? `−${angka(ringkasDetail.kurang)}`
                                : '0'
                        }}</span>
                    </p>
                </div>
                <div>
                    <p class="overline">Nilai selisih</p>
                    <p
                        class="angka-besar"
                        :class="{
                            kurang: ringkasDetail.nilai < 0,
                            lebih: ringkasDetail.nilai > 0,
                        }"
                    >
                        {{ rupiah(ringkasDetail.nilai) }}
                    </p>
                </div>
            </div>

            <BaseSwitch v-model="detailHanyaSelisih">
                Hanya yang berselisih
            </BaseSwitch>

            <div class="table-scroll lembar">
                <table class="data">
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th class="num">Sistem</th>
                            <th class="num">Fisik</th>
                            <th class="num">Selisih</th>
                            <th class="num">Nilai</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="i in itemDetailTampil"
                            :key="i.id"
                            :class="{ 'baris-selisih': i.selisih !== 0 }"
                        >
                            <td>
                                <div class="produk-sel">
                                    <span class="thumb" aria-hidden="true">
                                        <img
                                            v-if="i.product?.gambar_url"
                                            :src="i.product.gambar_url"
                                            alt=""
                                            loading="lazy"
                                        />
                                        <Package
                                            v-else
                                            :size="18"
                                            :stroke-width="1.5"
                                        />
                                    </span>
                                    <span>
                                        {{
                                            i.product?.nama_produk ??
                                            `Produk #${i.product_id}`
                                        }}
                                        <span
                                            v-if="i.product?.dihapus"
                                            class="badge badge-danger"
                                            >Dihapus</span
                                        >
                                        <span class="caption blok">{{
                                            i.product?.barcode ??
                                            'tanpa barcode'
                                        }}</span>
                                    </span>
                                </div>
                            </td>
                            <td class="num">
                                {{ angka(i.stok_sistem) }}
                                {{ i.product?.satuan ?? '' }}
                            </td>
                            <td class="num">
                                {{ angka(i.stok_fisik) }}
                                {{ i.product?.satuan ?? '' }}
                            </td>
                            <td
                                class="num"
                                :class="{
                                    kurang: i.selisih < 0,
                                    lebih: i.selisih > 0,
                                }"
                            >
                                {{
                                    i.selisih === 0
                                        ? 'Cocok'
                                        : tandaSelisih(i.selisih)
                                }}
                            </td>
                            <td class="num">
                                {{
                                    i.selisih === 0
                                        ? '–'
                                        : rupiah(i.nilai_selisih ?? 0)
                                }}
                            </td>
                        </tr>
                        <tr v-if="itemDetailTampil.length === 0">
                            <td colspan="5" class="muted">
                                Tidak ada barang yang berselisih.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="caption">
                Nilai selisih = selisih × harga beli saat ini. Sesi opname lama
                dicatat sebelum barang yang cocok ikut disimpan, jadi hanya
                memuat barang yang berselisih.
            </p>
        </div>

        <template #aksi>
            <button class="btn btn-primary" @click="detail = null">
                Tutup
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

.kolom-cek {
    width: 76px;
    text-align: center;
}

.cek {
    width: 18px;
    height: 18px;
    accent-color: var(--teal-700);
    cursor: pointer;
}

.baris-dihitung td:first-child {
    box-shadow: inset 3px 0 0 var(--teal-600);
}

.ada-selisih {
    color: var(--warning-text);
    font: var(--text-body-strong);
}

.ringkas-detail {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
}

.ringkas-detail > div {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-base);
}

.angka-besar {
    font: var(--text-h3);
    font-variant-numeric: tabular-nums;
    margin-top: var(--space-1);
}

.produk-sel {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.produk-sel .badge {
    margin-left: var(--space-1);
}

.thumb {
    flex: 0 0 36px;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    overflow: hidden;
    border-radius: var(--radius-xs);
    background: #fff;
    box-shadow: 0 0 0 1px var(--divider);
    color: var(--text-muted);
}

.thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

@media (max-width: 767px) {
    .ringkas-detail {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>
