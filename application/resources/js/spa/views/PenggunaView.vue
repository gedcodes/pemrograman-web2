<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import {
    ambilPenuh,
    ApiError,
    hapus,
    perbarui,
    simpan,
    type PaginationMeta,
} from '../api/client';
import type { User } from '../api/types';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import KeadaanData from '../components/KeadaanData.vue';
import PagePagination from '../components/PagePagination.vue';

const daftar = ref<User[]>([]);
const meta = ref<PaginationMeta | null>(null);
const cari = ref('');
const halaman = ref(1);
const memuat = ref(true);
const galat = ref<string | null>(null);

const formTerbuka = ref(false);
const sedangUbah = ref<User | null>(null);
const form = ref({
    name: '',
    email: '',
    peran: 'kasir',
    aktif: true,
    password: '',
});
const galatField = ref<Record<string, string>>({});
const mengirim = ref(false);
const akanDihapus = ref<User | null>(null);

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        const r = await ambilPenuh<User[]>('/users', {
            page: halaman.value,
            q: cari.value || undefined,
        });
        daftar.value = r.data;
        meta.value = r.meta ?? null;
    } catch (e) {
        galat.value =
            e instanceof ApiError ? e.message : 'Gagal memuat pengguna.';
    } finally {
        memuat.value = false;
    }
}

function bukaForm(u: User | null) {
    sedangUbah.value = u;
    galatField.value = {};
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

async function kirim() {
    mengirim.value = true;
    galatField.value = {};
    const muatan: Record<string, unknown> = { ...form.value };
    if (sedangUbah.value && !form.value.password) delete muatan.password;

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
        const r = await hapus(`/users/${akanDihapus.value.id}`);
        toast.sukses(r.message ?? 'Pengguna dihapus.');
        akanDihapus.value = null;
        await muat();
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal menghapus pengguna.',
        );
    }
}

watch(cari, () => {
    halaman.value = 1;
    void muat();
});

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <input
            v-model="cari"
            class="input"
            style="max-width: 280px"
            type="search"
            placeholder="Cari nama atau email…"
        />
        <button class="btn btn-primary" @click="bukaForm(null)">
            + Tambah Pengguna
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
                            <th>Nama</th>
                            <th>Email</th>
                            <th>Peran</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="u in daftar" :key="u.id">
                            <td>{{ u.name }}</td>
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
                            <td>
                                <div class="row">
                                    <button
                                        class="btn btn-soft btn-sm"
                                        @click="bukaForm(u)"
                                    >
                                        Ubah
                                    </button>
                                    <button
                                        class="btn btn-ghost btn-sm"
                                        @click="akanDihapus = u"
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
        :judul="sedangUbah ? 'Ubah Pengguna' : 'Tambah Pengguna'"
        @tutup="formTerbuka = false"
    >
        <div class="stack">
            <div class="field">
                <label for="n">Nama *</label>
                <input
                    id="n"
                    v-model="form.name"
                    class="input"
                    :class="{ 'is-error': galatField.name }"
                />
                <p v-if="galatField.name" class="field-error">
                    {{ galatField.name }}
                </p>
            </div>
            <div class="field">
                <label for="e">Email *</label>
                <input
                    id="e"
                    v-model="form.email"
                    type="email"
                    class="input"
                    :class="{ 'is-error': galatField.email }"
                />
                <p v-if="galatField.email" class="field-error">
                    {{ galatField.email }}
                </p>
            </div>
            <div class="field">
                <label for="p">Peran *</label>
                <select id="p" v-model="form.peran" class="select">
                    <option value="kasir">Kasir</option>
                    <option value="admin">Admin / Pemilik</option>
                </select>
            </div>
            <div class="field">
                <label for="pw"
                    >Kata sandi
                    {{
                        sedangUbah ? '(kosongkan bila tidak diubah)' : '*'
                    }}</label
                >
                <input
                    id="pw"
                    v-model="form.password"
                    type="password"
                    class="input"
                    :class="{ 'is-error': galatField.password }"
                />
                <p v-if="galatField.password" class="field-error">
                    {{ galatField.password }}
                </p>
            </div>
            <label class="row" style="cursor: pointer">
                <input v-model="form.aktif" type="checkbox" />
                <span class="caption">Akun aktif dan boleh masuk</span>
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
        judul="Hapus pengguna?"
        @tutup="akanDihapus = null"
    >
        <p>
            Pengguna <strong>{{ akanDihapus.name }}</strong> akan dihapus.
        </p>
        <p class="caption" style="margin-top: var(--space-2)">
            Pengguna yang pernah membuka shift atau mencatat dokumen tidak dapat
            dihapus.
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
