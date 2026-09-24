<script setup lang="ts">
import { Eye, EyeOff, Pencil, Plus, Search, Trash2 } from '@lucide/vue';
import { computed, nextTick, ref } from 'vue';
import { ApiError, hapus, perbarui, simpan } from '../api/client';
import type { Peran, User } from '../api/types';
import type { OpsiPilihan } from '../composables/pilihan';
import { useDaftarServer } from '../composables/useDaftarServer';
import { auth } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import BaseSelect from '../components/BaseSelect.vue';
import BaseSwitch from '../components/BaseSwitch.vue';
import FieldForm from '../components/FieldForm.vue';
import KeadaanData from '../components/KeadaanData.vue';
import KepalaUrut from '../components/KepalaUrut.vue';
import PagePagination from '../components/PagePagination.vue';

const OPSI_PERAN: OpsiPilihan<Peran>[] = [
    {
        nilai: 'kasir',
        label: 'Kasir',
        keterangan: 'Kasir, riwayat shift sendiri, retur perlu persetujuan',
    },
    {
        nilai: 'admin',
        label: 'Admin / Pemilik',
        keterangan: 'Akses penuh termasuk laporan dan pengaturan',
    },
];

const cari = ref('');
const filterPeran = ref<Peran | null>(null);

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
} = useDaftarServer<User>('/users', () => ({
    q: cari.value || undefined,
    peran: filterPeran.value ?? undefined,
}));

/* ---------------------------------------------------------------- formulir */

interface FormPengguna {
    name: string;
    email: string;
    peran: Peran | null;
    aktif: boolean;
    password: string;
}

const formTerbuka = ref(false);
const sedangUbah = ref<User | null>(null);
const form = ref<FormPengguna>({
    name: '',
    email: '',
    peran: 'kasir',
    aktif: true,
    password: '',
});
const lihatSandi = ref(false);
const galatServer = ref<Record<string, string>>({});
const dicoba = ref(false);
const mengirim = ref(false);

/* Mengubah akun sendiri: peran dan status aktif dikunci, supaya admin tidak
   tanpa sengaja mencabut aksesnya sendiri di tengah sesi. */
const akunSendiri = computed(
    () => sedangUbah.value !== null && sedangUbah.value.id === auth.user?.id,
);

function bukaForm(u: User | null) {
    sedangUbah.value = u;
    galatServer.value = {};
    dicoba.value = false;
    lihatSandi.value = false;
    form.value = u
        ? {
              name: u.name,
              email: u.email,
              peran: u.peran,
              aktif: u.aktif,
              password: '',
          }
        : { name: '', email: '', peran: 'kasir', aktif: true, password: '' };
    formTerbuka.value = true;
}

const galatLokal = computed(() => {
    const f = form.value;
    const e: Record<string, string> = {};
    if (f.name.trim() === '') e.name = 'Nama wajib diisi.';
    if (f.email.trim() === '') e.email = 'Email wajib diisi.';
    else if (!/^\S+@\S+\.\S+$/.test(f.email.trim()))
        e.email = 'Format email tidak valid.';
    if (f.peran === null) e.peran = 'Peran wajib dipilih.';
    if (!sedangUbah.value && f.password === '')
        e.password = 'Kata sandi wajib diisi untuk pengguna baru.';
    else if (f.password !== '' && f.password.length < 8)
        e.password = 'Kata sandi minimal 8 karakter.';
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

    const muatan: Record<string, unknown> = {
        ...form.value,
        name: form.value.name.trim(),
        email: form.value.email.trim(),
    };
    if (sedangUbah.value && !form.value.password) delete muatan.password;

    mengirim.value = true;
    try {
        if (sedangUbah.value) {
            await perbarui(`/users/${sedangUbah.value.id}`, muatan);
            toast.sukses('Pengguna diperbarui.');
        } else {
            await simpan('/users', muatan);
            toast.sukses('Pengguna ditambahkan.');
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
            toast.galat('Gagal menyimpan pengguna.');
        }
    } finally {
        mengirim.value = false;
    }
}

/* ---------------------------------------------------------------- hapus */

const akanDihapus = ref<User | null>(null);
const menghapus = ref(false);

async function konfirmasiHapus() {
    if (!akanDihapus.value || menghapus.value) return;
    menghapus.value = true;
    try {
        const r = await hapus(`/users/${akanDihapus.value.id}`);
        toast.sukses(r.message ?? 'Pengguna dihapus.');
        akanDihapus.value = null;
        await muat();
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal menghapus pengguna.',
        );
    } finally {
        menghapus.value = false;
    }
}
</script>

<template>
    <div class="page-head">
        <div class="penyaring">
            <label class="kotak-cari">
                <Search :size="18" :stroke-width="1.75" aria-hidden="true" />
                <span class="sr-only">Cari pengguna</span>
                <input
                    v-model="cari"
                    type="search"
                    placeholder="Cari nama atau email…"
                />
            </label>
            <BaseSelect
                v-model="filterPeran"
                :opsi="
                    OPSI_PERAN.map((o) => ({ nilai: o.nilai, label: o.label }))
                "
                label-kosong="Semua peran"
                aria-label="Saring peran"
            />
        </div>
        <button class="btn btn-primary" @click="bukaForm(null)">
            <Plus :size="18" :stroke-width="2" aria-hidden="true" />
            Tambah Pengguna
        </button>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Tidak ada pengguna yang cocok."
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
                                label="Nama"
                                kolom="name"
                                :urut="urut"
                                :arah="arah"
                                @urutkan="urutkan"
                            />
                            <KepalaUrut
                                label="Email"
                                kolom="email"
                                :urut="urut"
                                :arah="arah"
                                @urutkan="urutkan"
                            />
                            <KepalaUrut
                                label="Peran"
                                kolom="peran"
                                :urut="urut"
                                :arah="arah"
                                @urutkan="urutkan"
                            />
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
                        <tr v-for="u in daftar" :key="u.id">
                            <td>
                                {{ u.name }}
                                <span
                                    v-if="u.id === auth.user?.id"
                                    class="caption"
                                    >(Anda)</span
                                >
                            </td>
                            <td>{{ u.email }}</td>
                            <td>
                                <span
                                    class="badge"
                                    :class="
                                        u.peran === 'admin'
                                            ? 'badge-info'
                                            : 'badge-success'
                                    "
                                >
                                    {{
                                        u.peran === 'admin'
                                            ? 'Admin / Pemilik'
                                            : 'Kasir'
                                    }}
                                </span>
                            </td>
                            <td>
                                <span
                                    class="badge"
                                    :class="
                                        u.aktif
                                            ? 'badge-success'
                                            : 'badge-danger'
                                    "
                                >
                                    {{ u.aktif ? 'Aktif' : 'Nonaktif' }}
                                </span>
                            </td>
                            <td class="kolom-aksi">
                                <div class="row aksi-baris">
                                    <button
                                        class="btn btn-soft btn-sm"
                                        @click="bukaForm(u)"
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
                                        :aria-label="`Hapus ${u.name}`"
                                        :disabled="u.id === auth.user?.id"
                                        :title="
                                            u.id === auth.user?.id
                                                ? 'Akun yang sedang dipakai tidak dapat dihapus'
                                                : undefined
                                        "
                                        @click="akanDihapus = u"
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
        :judul="sedangUbah ? 'Ubah Pengguna' : 'Tambah Pengguna'"
        formulir
        :terkunci="mengirim"
        @tutup="formTerbuka = false"
    >
        <form
            id="form-pengguna"
            class="stack"
            novalidate
            @submit.prevent="kirim"
        >
            <FieldForm
                v-slot="{ id, invalid, describedby }"
                label="Nama"
                wajib
                :galat="pesanGalat('name')"
            >
                <input
                    :id="id"
                    v-model="form.name"
                    class="input"
                    :class="{ 'is-error': invalid }"
                    :aria-invalid="invalid || undefined"
                    :aria-describedby="describedby"
                    maxlength="150"
                    autocomplete="off"
                />
            </FieldForm>

            <FieldForm
                v-slot="{ id, invalid, describedby }"
                label="Email"
                wajib
                bantuan="Dipakai untuk masuk ke aplikasi."
                :galat="pesanGalat('email')"
            >
                <input
                    :id="id"
                    v-model="form.email"
                    type="email"
                    class="input"
                    :class="{ 'is-error': invalid }"
                    :aria-invalid="invalid || undefined"
                    :aria-describedby="describedby"
                    autocomplete="off"
                />
            </FieldForm>

            <FieldForm
                v-slot="{ id, invalid, describedby }"
                label="Peran"
                wajib
                :bantuan="
                    akunSendiri
                        ? 'Peran akun Anda sendiri tidak dapat diubah dari sini.'
                        : undefined
                "
                :galat="pesanGalat('peran')"
            >
                <BaseSelect
                    :id="id"
                    v-model="form.peran"
                    :opsi="OPSI_PERAN"
                    :invalid="invalid"
                    :disabled="akunSendiri"
                    :aria-describedby="describedby"
                />
            </FieldForm>

            <FieldForm
                v-slot="{ id, invalid, describedby }"
                label="Kata sandi"
                :wajib="!sedangUbah"
                :bantuan="
                    sedangUbah
                        ? 'Kosongkan bila tidak diubah. Minimal 8 karakter.'
                        : 'Minimal 8 karakter.'
                "
                :galat="pesanGalat('password')"
            >
                <div class="sandi">
                    <input
                        :id="id"
                        v-model="form.password"
                        :type="lihatSandi ? 'text' : 'password'"
                        class="input"
                        :class="{ 'is-error': invalid }"
                        :aria-invalid="invalid || undefined"
                        :aria-describedby="describedby"
                        autocomplete="new-password"
                    />
                    <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-ikon sandi-lihat"
                        :aria-label="
                            lihatSandi
                                ? 'Sembunyikan kata sandi'
                                : 'Tampilkan kata sandi'
                        "
                        :aria-pressed="lihatSandi"
                        @click="lihatSandi = !lihatSandi"
                    >
                        <EyeOff
                            v-if="lihatSandi"
                            :size="18"
                            :stroke-width="1.75"
                        />
                        <Eye v-else :size="18" :stroke-width="1.75" />
                    </button>
                </div>
            </FieldForm>

            <BaseSwitch v-model="form.aktif" :disabled="akunSendiri">
                Akun aktif dan boleh masuk
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
                form="form-pengguna"
                :disabled="mengirim"
                :aria-busy="mengirim"
            >
                {{ mengirim ? 'Menyimpan…' : 'Simpan' }}
            </button>
        </template>
    </BaseModal>

    <BaseModal
        v-if="akanDihapus"
        judul="Hapus pengguna?"
        :terkunci="menghapus"
        @tutup="akanDihapus = null"
    >
        <p>
            Pengguna <strong>{{ akanDihapus.name }}</strong> akan dihapus.
        </p>
        <p class="caption" style="margin-top: var(--space-2)">
            Pengguna yang pernah membuka shift atau mencatat dokumen tidak dapat
            dihapus. Nonaktifkan saja lewat tombol Ubah.
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
.sandi {
    position: relative;
}

.sandi .input {
    padding-right: 48px;
}

.sandi-lihat {
    position: absolute;
    top: 6px;
    right: 6px;
}
</style>
