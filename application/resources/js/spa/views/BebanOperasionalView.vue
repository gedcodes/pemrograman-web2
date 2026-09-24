<script setup lang="ts">
import { Pencil, Plus, Trash2 } from '@lucide/vue';
import { computed, nextTick, ref } from 'vue';
import { ApiError, hapus, perbarui, simpan } from '../api/client';
import type { OperationalExpense } from '../api/types';
import { angka, rupiah } from '../composables/format';
import { useDaftarServer } from '../composables/useDaftarServer';
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
    muat,
    pindahHalaman,
    urutkan,
} = useDaftarServer<OperationalExpense>('/expenses', undefined, {
    // Total per bulan dihitung dari SELURUH beban, jadi semuanya dimuat.
    perHalaman: 100,
});

/** Total per bulan dari beban yang sedang berlaku saja. */
const totalAktif = computed(() =>
    daftar.value
        .filter((b) => b.aktif)
        .reduce((s, b) => s + b.jumlah_bulanan, 0),
);

const perHari = computed(() => Math.round(totalAktif.value / 30));

/* ---------------------------------------------------------------- formulir */

interface FormBeban {
    nama: string;
    jumlah_bulanan: number | null;
    keterangan: string;
    aktif: boolean;
}

const formTerbuka = ref(false);
const sedangUbah = ref<OperationalExpense | null>(null);
const form = ref<FormBeban>({
    nama: '',
    jumlah_bulanan: null,
    keterangan: '',
    aktif: true,
});
const galatServer = ref<Record<string, string>>({});
const dicoba = ref(false);
const mengirim = ref(false);

function bukaForm(b: OperationalExpense | null) {
    sedangUbah.value = b;
    galatServer.value = {};
    dicoba.value = false;
    form.value = b
        ? {
              nama: b.nama,
              jumlah_bulanan: b.jumlah_bulanan,
              keterangan: b.keterangan ?? '',
              aktif: b.aktif,
          }
        : { nama: '', jumlah_bulanan: null, keterangan: '', aktif: true };
    formTerbuka.value = true;
}

const galatLokal = computed(() => {
    const e: Record<string, string> = {};
    if (form.value.nama.trim() === '') e.nama = 'Nama beban wajib diisi.';
    if (form.value.jumlah_bulanan === null)
        e.jumlah_bulanan = 'Jumlah per bulan wajib diisi.';
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

    const muatan = {
        nama: form.value.nama.trim(),
        jumlah_bulanan: form.value.jumlah_bulanan,
        keterangan: form.value.keterangan.trim() || null,
        aktif: form.value.aktif,
    };

    mengirim.value = true;
    try {
        if (sedangUbah.value) {
            await perbarui(`/expenses/${sedangUbah.value.id}`, muatan);
            toast.sukses('Beban diperbarui.');
        } else {
            await simpan('/expenses', muatan);
            toast.sukses('Beban ditambahkan.');
        }
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
            toast.galat('Gagal menyimpan beban.');
        }
    } finally {
        mengirim.value = false;
    }
}

/* ---------------------------------------------------------------- hapus */

const akanDihapus = ref<OperationalExpense | null>(null);
const menghapus = ref(false);

async function konfirmasiHapus() {
    if (!akanDihapus.value || menghapus.value) return;
    menghapus.value = true;
    try {
        const r = await hapus(`/expenses/${akanDihapus.value.id}`);
        toast.sukses(r.message ?? 'Beban dihapus.');
        akanDihapus.value = null;
        await muat();
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal menghapus.');
    } finally {
        menghapus.value = false;
    }
}
</script>

<template>
    <div class="page-head">
        <p class="caption" style="max-width: min(46ch, 100%)">
            Beban tetap bulanan yang dipakai Laporan Laba Rugi. Nilainya
            diprorata sesuai panjang periode laporan.
        </p>
        <button class="btn btn-primary" @click="bukaForm(null)">
            <Plus :size="18" :stroke-width="2" aria-hidden="true" />
            Tambah Beban
        </button>
    </div>

    <div class="stack" style="gap: var(--space-5)">
        <section class="grid-stats grid">
            <div class="card">
                <p class="overline">Total per bulan</p>
                <p v-if="memuat && daftar.length === 0" class="nilai">
                    <span
                        class="skeleton"
                        style="display: block; width: 60%; height: 28px"
                    />
                </p>
                <p v-else class="nilai">{{ rupiah(totalAktif) }}</p>
                <p class="caption">Hanya beban yang berlaku</p>
            </div>
            <div class="card">
                <p class="overline">Setara per hari</p>
                <p v-if="memuat && daftar.length === 0" class="nilai">
                    <span
                        class="skeleton"
                        style="display: block; width: 50%; height: 28px"
                    />
                </p>
                <p v-else class="nilai">{{ rupiah(perHari) }}</p>
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
                                    label="Nama beban"
                                    kolom="nama"
                                    :urut="urut"
                                    :arah="arah"
                                    @urutkan="urutkan"
                                />
                                <th>Keterangan</th>
                                <KepalaUrut
                                    label="Per bulan"
                                    kolom="jumlah_bulanan"
                                    :urut="urut"
                                    :arah="arah"
                                    num
                                    arah-awal="desc"
                                    @urutkan="urutkan"
                                />
                                <th class="num">Per hari</th>
                                <KepalaUrut
                                    label="Status"
                                    kolom="aktif"
                                    :urut="urut"
                                    :arah="arah"
                                    arah-awal="desc"
                                    @urutkan="urutkan"
                                />
                                <th class="kolom-aksi">
                                    <span class="sr-only">Aksi</span>
                                </th>
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
                                            :aria-label="`Hapus ${b.nama}`"
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
                <PagePagination :meta="meta" @pindah="pindahHalaman" />
            </KeadaanData>
        </div>
    </div>

    <BaseModal
        v-if="formTerbuka"
        :judul="sedangUbah ? 'Ubah Beban' : 'Tambah Beban'"
        formulir
        :terkunci="mengirim"
        @tutup="formTerbuka = false"
    >
        <form id="form-beban" class="stack" novalidate @submit.prevent="kirim">
            <FieldForm
                v-slot="{ id, invalid, describedby }"
                label="Nama beban"
                wajib
                :galat="pesanGalat('nama')"
            >
                <input
                    :id="id"
                    v-model="form.nama"
                    class="input"
                    :class="{ 'is-error': invalid }"
                    :aria-invalid="invalid || undefined"
                    :aria-describedby="describedby"
                    maxlength="150"
                    placeholder="mis. Gaji dua kasir paruh waktu"
                />
            </FieldForm>

            <FieldForm
                v-slot="{ id, invalid, describedby }"
                label="Jumlah per bulan"
                wajib
                :bantuan="
                    form.jumlah_bulanan
                        ? `Setara ${rupiah(Math.round(form.jumlah_bulanan / 30))} per hari.`
                        : undefined
                "
                :galat="pesanGalat('jumlah_bulanan')"
            >
                <InputAngka
                    :id="id"
                    v-model="form.jumlah_bulanan"
                    awalan="Rp"
                    placeholder="0"
                    :langkah="10000"
                    :invalid="invalid"
                    :aria-describedby="describedby"
                />
            </FieldForm>

            <FieldForm
                v-slot="{ id, describedby }"
                label="Keterangan"
                :galat="pesanGalat('keterangan')"
            >
                <input
                    :id="id"
                    v-model="form.keterangan"
                    class="input"
                    :aria-describedby="describedby"
                    maxlength="255"
                />
            </FieldForm>

            <BaseSwitch v-model="form.aktif">
                Beban ini masih berlaku dan ikut dihitung
            </BaseSwitch>
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
                form="form-beban"
                :disabled="mengirim"
                :aria-busy="mengirim"
            >
                {{ mengirim ? 'Menyimpan…' : 'Simpan' }}
            </button>
        </template>
    </BaseModal>

    <BaseModal
        v-if="akanDihapus"
        judul="Hapus beban?"
        :terkunci="menghapus"
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
.nilai {
    font: var(--text-h2);
    letter-spacing: var(--tracking-h2);
    font-variant-numeric: tabular-nums;
    margin-top: var(--space-2);
}
</style>
