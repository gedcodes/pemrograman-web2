<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ambil, ApiError } from '../api/client';
import type { DashboardData } from '../api/types';
import { angka, jam, rupiah } from '../composables/format';
import KeadaanData from '../components/KeadaanData.vue';
import StatCard from '../components/StatCard.vue';
import StatusBadge from '../components/StatusBadge.vue';

const data = ref<DashboardData | null>(null);
const memuat = ref(true);
const galat = ref<string | null>(null);

async function muat() {
    memuat.value = true;
    galat.value = null;
    try {
        data.value = await ambil<DashboardData>('/dashboard');
    } catch (e) {
        galat.value =
            e instanceof ApiError ? e.message : 'Gagal memuat dashboard.';
    } finally {
        memuat.value = false;
    }
}

onMounted(muat);

/** Skala grafik dihitung dari nilai tertinggi, supaya batang selalu terbaca. */
const puncak = computed(() =>
    Math.max(1, ...(data.value?.grafik_7_hari ?? []).map((d) => d.omzet)),
);

function tinggi(omzet: number): string {
    return `${Math.max(2, Math.round((omzet / puncak.value) * 100))}%`;
}

function label(tanggal: string): string {
    return new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'short' });
}
</script>

<template>
    <KeadaanData :memuat="memuat" :galat="galat" :baris-skeleton="6">
        <template #aksi>
            <button class="btn btn-soft" @click="muat">Coba lagi</button>
        </template>

        <div v-if="data" class="stack" style="gap: var(--space-6)">
            <!-- Empat kartu statistik (PERANCANGAN Bagian 9). -->
            <section class="grid-stats grid">
                <StatCard
                    label="Omzet hari ini"
                    :nilai="rupiah(data.kartu.omzet_hari_ini)"
                    keterangan="Hanya transaksi lunas"
                />
                <StatCard
                    label="Jumlah transaksi"
                    :nilai="angka(data.kartu.jumlah_transaksi)"
                    keterangan="Struk terbit hari ini"
                />
                <StatCard
                    label="Produk terjual"
                    :nilai="angka(data.kartu.produk_terjual)"
                    keterangan="Total unit keluar"
                />
                <StatCard
                    label="Stok menipis"
                    :nilai="angka(data.kartu.stok_menipis)"
                    keterangan="Sudah di bawah batas minimum"
                    :nada="
                        data.kartu.stok_menipis > 0 ? 'peringatan' : 'netral'
                    "
                />
            </section>

            <!-- Grafik 7 hari. Digambar dengan CSS murni: satu deret batang
                 tidak sepadan dengan memuat pustaka grafik penuh. -->
            <section class="card">
                <h2>Penjualan 7 hari terakhir</h2>
                <div
                    class="grafik"
                    role="img"
                    aria-label="Grafik omzet tujuh hari terakhir"
                >
                    <div
                        v-for="d in data.grafik_7_hari"
                        :key="d.tanggal"
                        class="kolom"
                    >
                        <span class="kolom-nilai num">{{
                            angka(d.omzet)
                        }}</span>
                        <div
                            class="batang"
                            :style="{ height: tinggi(d.omzet) }"
                        />
                        <span class="caption">{{ label(d.tanggal) }}</span>
                    </div>
                </div>
            </section>

            <!-- Transaksi terakhir. -->
            <section class="table-wrap">
                <div class="tabel-kepala">
                    <h2>Transaksi terakhir</h2>
                    <RouterLink
                        class="btn btn-soft btn-sm"
                        :to="{ name: 'riwayat-transaksi' }"
                    >
                        Lihat semua
                    </RouterLink>
                </div>
                <div class="table-scroll">
                    <table class="data">
                        <thead>
                            <tr>
                                <th>No. Struk</th>
                                <th>Waktu</th>
                                <th>Pelanggan</th>
                                <th>Status</th>
                                <th class="num">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="t in data.transaksi_terakhir"
                                :key="t.id"
                            >
                                <td>{{ t.no_struk }}</td>
                                <td>{{ jam(t.tanggal) }}</td>
                                <td>{{ t.customer?.nama ?? 'Umum' }}</td>
                                <td><StatusBadge :status="t.status" /></td>
                                <td class="num">{{ angka(t.total) }}</td>
                            </tr>
                            <tr v-if="data.transaksi_terakhir.length === 0">
                                <td colspan="5" class="muted">
                                    Belum ada transaksi.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </KeadaanData>
</template>

<style scoped>
.grafik {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    height: 220px;
    margin-top: var(--space-5);
}

.kolom {
    flex: 1;
    min-width: 0; /* tanpa ini, label angka memaksa kolom melebar */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    height: 100%;
}

.kolom-nilai {
    font: var(--text-caption);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}

.batang {
    width: 100%;
    max-width: 56px;
    border-radius: var(--radius-xs) var(--radius-xs) 0 0;
    background: var(--chart-1);
    transition: height var(--dur-slow) var(--ease);
}

/* Di layar sempit label angka lebih lebar daripada kolomnya dan memaksa
   seluruh halaman menggulung ke samping. Batang dan nama hari sudah cukup
   menyampaikan bentuk grafik; angka persisnya ada di Laporan Penjualan. */
@media (max-width: 767px) {
    .kolom-nilai {
        display: none;
    }

    .grafik {
        height: 180px;
    }
}

.tabel-kepala {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--divider);
}
</style>
