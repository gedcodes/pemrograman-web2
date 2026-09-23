<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import {
    ambil,
    ambilPenuh,
    ApiError,
    type PaginationMeta,
} from '../api/client';
import type { Transaction } from '../api/types';
import { angka, tanggalJam } from '../composables/format';
import BaseModal from '../components/BaseModal.vue';
import KeadaanData from '../components/KeadaanData.vue';
import PagePagination from '../components/PagePagination.vue';
import StatusBadge from '../components/StatusBadge.vue';

const daftar = ref<Transaction[]>([]);
const meta = ref<PaginationMeta | null>(null);
const status = ref('');
const cari = ref('');
const halaman = ref(1);
const memuat = ref(true);
const galat = ref<string | null>(null);
const detail = ref<Transaction | null>(null);

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        const r = await ambilPenuh<Transaction[]>('/transactions', {
            page: halaman.value,
            status: status.value || undefined,
            q: cari.value || undefined,
        });
        daftar.value = r.data;
        meta.value = r.meta ?? null;
    } catch (e) {
        galat.value =
            e instanceof ApiError ? e.message : 'Gagal memuat riwayat.';
    } finally {
        memuat.value = false;
    }
}

async function bukaDetail(t: Transaction) {
    detail.value = await ambil<Transaction>(`/transactions/${t.id}`);
}

/** Cadangan bila webhook Midtrans terlambat tiba. */
async function periksaStatus(t: Transaction) {
    const r = await ambil<{ status: string }>(`/transactions/${t.id}/status`);
    t.status = r.status as Transaction['status'];
}

watch([status, cari], () => {
    halaman.value = 1;
    void muat();
});

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <div class="row row-wrap">
            <input
                v-model="cari"
                class="input"
                style="max-width: 240px"
                type="search"
                placeholder="Cari no. struk…"
            />
            <select v-model="status" class="select" style="max-width: 200px">
                <option value="">Semua status</option>
                <option value="settlement">Lunas</option>
                <option value="pending">Menunggu</option>
                <option value="expire">Kedaluwarsa</option>
                <option value="cancel">Dibatalkan</option>
                <option value="deny">Ditolak</option>
            </select>
        </div>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Belum ada transaksi."
        >
            <div class="table-scroll">
                <table class="data">
                    <thead>
                        <tr>
                            <th>No. Struk</th>
                            <th>Waktu</th>
                            <th>Kasir</th>
                            <th>Pelanggan</th>
                            <th>Metode</th>
                            <th>Status</th>
                            <th class="num">Total</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="t in daftar" :key="t.id">
                            <td>{{ t.no_struk }}</td>
                            <td>{{ tanggalJam(t.tanggal) }}</td>
                            <td>{{ t.shift?.user?.name ?? '-' }}</td>
                            <td>{{ t.customer?.nama ?? 'Umum' }}</td>
                            <td>
                                {{
                                    t.payment?.metode === 'non_tunai'
                                        ? (t.payment?.payment_type ??
                                          'Non-tunai')
                                        : 'Tunai'
                                }}
                            </td>
                            <td><StatusBadge :status="t.status" /></td>
                            <td class="num">{{ angka(t.total) }}</td>
                            <td>
                                <div class="row">
                                    <button
                                        class="btn btn-soft btn-sm"
                                        @click="bukaDetail(t)"
                                    >
                                        Detail
                                    </button>
                                    <button
                                        v-if="t.status === 'pending'"
                                        class="btn btn-ghost btn-sm"
                                        @click="periksaStatus(t)"
                                    >
                                        Periksa Status
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

    <BaseModal v-if="detail" :judul="detail.no_struk" @tutup="detail = null">
        <div class="stack">
            <p class="caption">{{ tanggalJam(detail.tanggal) }}</p>
            <table class="data" style="min-width: 0">
                <tr v-for="i in detail.items ?? []" :key="i.id">
                    <td>
                        {{ i.nama_produk }}
                        <span class="caption">× {{ i.qty }}</span>
                    </td>
                    <td class="num">{{ angka(i.subtotal) }}</td>
                </tr>
            </table>
            <div class="row">
                <span>Subtotal</span><span class="spacer" /><span class="num">{{
                    angka(detail.subtotal)
                }}</span>
            </div>
            <div class="row">
                <span>Diskon</span><span class="spacer" /><span class="num">{{
                    angka(detail.diskon)
                }}</span>
            </div>
            <div class="row">
                <span>PPN</span><span class="spacer" /><span class="num">{{
                    angka(detail.pajak)
                }}</span>
            </div>
            <div class="row" style="font: var(--text-body-strong)">
                <span>Total</span><span class="spacer" /><span class="num">{{
                    angka(detail.total)
                }}</span>
            </div>
        </div>
    </BaseModal>
</template>
