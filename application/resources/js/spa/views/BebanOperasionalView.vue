<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
    ambilPenuh,
    ApiError,
    hapus,
    perbarui,
    simpan,
    type PaginationMeta,
} from '../api/client';
import type { OperationalExpense } from '../api/types';
import { angka, rupiah } from '../composables/format';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import KeadaanData from '../components/KeadaanData.vue';
import PagePagination from '../components/PagePagination.vue';

const daftar = ref<OperationalExpense[]>([]);
const meta = ref<PaginationMeta | null>(null);
const halaman = ref(1);
const memuat = ref(true);
const galat = ref<string | null>(null);

const formTerbuka = ref(false);
const sedangUbah = ref<OperationalExpense | null>(null);
const form = ref({ nama: '', jumlah_bulanan: 0, keterangan: '', aktif: true });
const galatField = ref<Record<string, string>>({});
const mengirim = ref(false);
const akanDihapus = ref<OperationalExpense | null>(null);

/** Total per bulan dari beban yang sedang berlaku saja. */
const totalAktif = computed(() =>
    daftar.value
        .filter((b) => b.aktif)
        .reduce((s, b) => s + b.jumlah_bulanan, 0),
);

const perHari = computed(() => Math.round(totalAktif.value / 30));

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        const r = await ambilPenuh<OperationalExpense[]>('/expenses', {
            page: halaman.value,
            per_page: 100,
        });
        daftar.value = r.data;
        meta.value = r.meta ?? null;
    } catch (e) {
        galat.value = e instanceof ApiError ? e.message : 'Gagal memuat beban.';
    } finally {
        memuat.value = false;
    }
}

function bukaForm(b: OperationalExpense | null) {
    sedangUbah.value = b;
    galatField.value = {};
    form.value = b
        ? {
              nama: b.nama,
              jumlah_bulanan: b.jumlah_bulanan,
              keterangan: b.keterangan ?? '',
              aktif: b.aktif,
          }
        : { nama: '', jumlah_bulanan: 0, keterangan: '', aktif: true };
    formTerbuka.value = true;
}

async function kirim() {
    mengirim.value = true;
    galatField.value = {};
    try {
        if (sedangUbah.value) {
            await perbarui(`/expenses/${sedangUbah.value.id}`, form.value);
            toast.sukses('Beban diperbarui.');
        } else {
            await simpan('/expenses', form.value);
            toast.sukses('Beban ditambahkan.');
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
        const r = await hapus(`/expenses/${akanDihapus.value.id}`);
        toast.sukses(r.message ?? 'Beban dihapus.');
        akanDihapus.value = null;
        await muat();
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal menghapus.');
    }
}

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <p class="caption" style="max-width: min(46ch, 100%)">
            Beban tetap bulanan yang dipakai Laporan Laba Rugi. Nilainya
            diprorata sesuai panjang periode laporan.
        </p>
        <button class="btn btn-primary" @click="bukaForm(null)">
            + Tambah Beban
        </button>
    </div>

    <div class="stack" style="gap: var(--space-5)">
        <section class="grid-stats grid">
            <div class="card">
                <p class="overline">Total per bulan</p>
                <p class="nilai">{{ rupiah(totalAktif) }}</p>
                <p class="caption">Hanya beban yang berlaku</p>
            </div>
            <div class="card">
                <p class="overline">Setara per hari</p>
                <p class="nilai">{{ rupiah(perHari) }}</p>
                <p class="caption">Dasar prorata (bulan = 30 hari)</p>
            </div>
        </section>

        <div class="table-wrap">
            <KeadaanData
                :memuat="memuat"
                :galat="galat"
                :kosong="daftar.length === 0"
                pesan-kosong="Belum ada beban operasional. Tanpa ini laporan hanya menampilkan laba kotor."
            >
                <div class="table-scroll">
                    <table class="data">
                        <thead>
                            <tr>
                                <th>Nama beban</th>
                                <th>Keterangan</th>
                                <th class="num">Per bulan</th>
                                <th class="num">Per hari</th>
                                <th>Status</th>
                                <th><span class="sr-only">Aksi</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="b in daftar" :key="b.id">
                                <td>{{ b.nama }}</td>
                                <td class="muted">{{ b.keterangan ?? '-' }}</td>
                                <td class="num">
                                    {{ angka(b.jumlah_bulanan) }}
                                </td>
                                <td class="num">
                                    {{
                                        angka(Math.round(b.jumlah_bulanan / 30))
                                    }}
                                </td>
                                <td>
                                    <span
                                        class="badge"
                                        :class="
                                            b.aktif
                                                ? 'badge-success'
                                                : 'badge-danger'
                                        "
                                    >
                                        {{ b.aktif ? 'Berlaku' : 'Nonaktif' }}
                                    </span>
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
    </div>

    <BaseModal
        v-if="formTerbuka"
        :judul="sedangUbah ? 'Ubah Beban' : 'Tambah Beban'"
        @tutup="formTerbuka = false"
    >
        <div class="stack">
            <div class="field">
                <label for="nama">Nama beban *</label>
                <input
                    id="nama"
                    v-model="form.nama"
                    class="input"
                    :class="{ 'is-error': galatField.nama }"
                    placeholder="mis. Gaji dua kasir paruh waktu"
                />
                <p v-if="galatField.nama" class="field-error">
                    {{ galatField.nama }}
                </p>
            </div>
            <div class="field">
                <label for="jml">Jumlah per bulan *</label>
                <input
                    id="jml"
                    v-model.number="form.jumlah_bulanan"
                    type="number"
                    min="0"
                    class="input"
                    :class="{ 'is-error': galatField.jumlah_bulanan }"
                />
                <p class="caption">
                    Setara
                    {{ rupiah(Math.round(form.jumlah_bulanan / 30)) }} per hari.
                </p>
                <p v-if="galatField.jumlah_bulanan" class="field-error">
                    {{ galatField.jumlah_bulanan }}
                </p>
            </div>
            <div class="field">
                <label for="ket">Keterangan</label>
                <input id="ket" v-model="form.keterangan" class="input" />
            </div>
            <label class="row" style="cursor: pointer">
                <input v-model="form.aktif" type="checkbox" />
                <span class="caption"
                    >Beban ini masih berlaku dan ikut dihitung</span
                >
            </label>
        </div>

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
        judul="Hapus beban?"
        @tutup="akanDihapus = null"
    >
        <p>
            Beban <strong>{{ akanDihapus.nama }}</strong> akan dihapus dan tidak
            lagi dihitung pada Laporan Laba Rugi.
        </p>
        <p class="caption" style="margin-top: var(--space-2)">
            Bila hanya ingin menghentikannya sementara, lebih baik nonaktifkan
            lewat tombol Ubah.
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

<style scoped>
.nilai {
    font: var(--text-h2);
    letter-spacing: var(--tracking-h2);
    font-variant-numeric: tabular-nums;
    margin-top: var(--space-2);
}
</style>
