<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import {
    ambilPenuh,
    ApiError,
    simpan,
    type PaginationMeta,
} from '../api/client';
import type { SalesReturn, Transaction } from '../api/types';
import { angka, tanggal } from '../composables/format';
import { adalahAdmin } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import KeadaanData from '../components/KeadaanData.vue';
import PagePagination from '../components/PagePagination.vue';

const daftar = ref<SalesReturn[]>([]);
const meta = ref<PaginationMeta | null>(null);
const status = ref('');
const halaman = ref(1);
const memuat = ref(true);
const galat = ref<string | null>(null);

const formTerbuka = ref(false);
const transaksi = ref<Transaction[]>([]);
const form = ref({
    transaction_id: '' as number | '',
    alasan: '',
    jumlah_refund: 0,
});
const mengirim = ref(false);

const LABEL: Record<string, { teks: string; kelas: string }> = {
    pending: { teks: 'Menunggu', kelas: 'badge-warning' },
    approved: { teks: 'Disetujui', kelas: 'badge-success' },
    rejected: { teks: 'Ditolak', kelas: 'badge-danger' },
};

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        const r = await ambilPenuh<SalesReturn[]>('/returns', {
            page: halaman.value,
            status_approval: status.value || undefined,
        });
        daftar.value = r.data;
        meta.value = r.meta ?? null;
    } catch (e) {
        galat.value = e instanceof ApiError ? e.message : 'Gagal memuat retur.';
    } finally {
        memuat.value = false;
    }
}

async function bukaForm() {
    const t = await ambilPenuh<Transaction[]>('/transactions', {
        status: 'settlement',
        per_page: 50,
    });
    transaksi.value = t.data;
    form.value = { transaction_id: '', alasan: '', jumlah_refund: 0 };
    formTerbuka.value = true;
}

async function kirim() {
    mengirim.value = true;
    try {
        const r = await simpan<SalesReturn>('/returns', form.value);
        toast.sukses(r.message ?? 'Retur diajukan.');
        formTerbuka.value = false;
        await muat();
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal mengajukan retur.',
        );
    } finally {
        mengirim.value = false;
    }
}

async function putuskan(r: SalesReturn, aksi: 'approve' | 'reject') {
    try {
        const res = await simpan(`/returns/${r.id}/${aksi}`);
        toast.sukses(res.message ?? 'Retur diproses.');
        await muat();
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal memproses retur.',
        );
    }
}

watch(status, () => {
    halaman.value = 1;
    void muat();
});

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <select v-model="status" class="select" style="max-width: 200px">
            <option value="">Semua status</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
        </select>
        <button class="btn btn-primary" @click="bukaForm">
            + Ajukan Retur
        </button>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Belum ada retur."
        >
            <div class="table-scroll">
                <table class="data">
                    <thead>
                        <tr>
                            <th>No. Dokumen</th>
                            <th>Tanggal</th>
                            <th>Struk</th>
                            <th>Alasan</th>
                            <th class="num">Refund</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in daftar" :key="r.id">
                            <td>{{ r.no_dokumen }}</td>
                            <td>{{ tanggal(r.tanggal_retur) }}</td>
                            <td>{{ r.transaction?.no_struk ?? '-' }}</td>
                            <td>{{ r.alasan }}</td>
                            <td class="num">{{ angka(r.jumlah_refund) }}</td>
                            <td>
                                <span
                                    class="badge"
                                    :class="LABEL[r.status_approval]?.kelas"
                                >
                                    {{
                                        LABEL[r.status_approval]?.teks ??
                                        r.status_approval
                                    }}
                                </span>
                            </td>
                            <td>
                                <div
                                    v-if="
                                        adalahAdmin &&
                                        r.status_approval === 'pending'
                                    "
                                    class="row"
                                >
                                    <button
                                        class="btn btn-soft btn-sm"
                                        @click="putuskan(r, 'approve')"
                                    >
                                        Setujui
                                    </button>
                                    <button
                                        class="btn btn-ghost btn-sm"
                                        @click="putuskan(r, 'reject')"
                                    >
                                        Tolak
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
        judul="Ajukan Retur Penjualan"
        @tutup="formTerbuka = false"
    >
        <div class="stack">
            <div class="field">
                <label for="trx">Transaksi *</label>
                <select id="trx" v-model="form.transaction_id" class="select">
                    <option value="">Pilih transaksi</option>
                    <option v-for="t in transaksi" :key="t.id" :value="t.id">
                        {{ t.no_struk }} — {{ angka(t.total) }}
                    </option>
                </select>
            </div>
            <div class="field">
                <label for="alasan">Alasan *</label>
                <textarea id="alasan" v-model="form.alasan" class="textarea" />
            </div>
            <div class="field">
                <label for="refund">Jumlah refund *</label>
                <input
                    id="refund"
                    v-model.number="form.jumlah_refund"
                    type="number"
                    min="0"
                    class="input"
                />
            </div>
            <p class="caption">
                Retur yang diajukan kasir menunggu persetujuan admin. Retur saat
                ini merupakan catatan keuangan dan belum mengembalikan stok.
            </p>
        </div>

        <template #aksi>
            <button class="btn btn-soft" @click="formTerbuka = false">
                Batal
            </button>
            <button class="btn btn-primary" :disabled="mengirim" @click="kirim">
                {{ mengirim ? 'Mengirim…' : 'Ajukan' }}
            </button>
        </template>
    </BaseModal>
</template>
