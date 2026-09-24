<script setup lang="ts">
import { Printer } from '@lucide/vue';
import { onMounted, ref } from 'vue';
import { ambil, ApiError } from '../api/client';
import type { LaporanPenjualan } from '../api/types';
import {
    angka,
    hariLalu,
    kunciTanggal,
    rupiah,
    tanggal,
} from '../composables/format';
import FilterPeriode from '../components/FilterPeriode.vue';
import KeadaanData from '../components/KeadaanData.vue';

const dari = ref(hariLalu(6));
const sampai = ref(kunciTanggal());
const data = ref<LaporanPenjualan | null>(null);
const memuat = ref(true);
const galat = ref<string | null>(null);

let urutan = 0;

async function muat() {
    const ke = ++urutan;
    memuat.value = true;
    galat.value = null;
    try {
        const hasil = await ambil<LaporanPenjualan>('/reports/sales', {
            dari: dari.value,
            sampai: sampai.value,
        });
        if (ke === urutan) data.value = hasil;
    } catch (e) {
        if (ke === urutan)
            galat.value =
                e instanceof ApiError ? e.message : 'Gagal memuat laporan.';
    } finally {
        if (ke === urutan) memuat.value = false;
    }
}

function cetak() {
    window.print();
}

onMounted(muat);
</script>

<template>
    <div class="page-head no-print">
        <FilterPeriode
            v-model:dari="dari"
            v-model:sampai="sampai"
            :memuat="memuat"
            @terapkan="muat"
        />
        <button class="btn btn-neutral" :disabled="!data" @click="cetak">
            <Printer :size="18" :stroke-width="1.75" aria-hidden="true" />
            Cetak
        </button>
    </div>

    <KeadaanData :memuat="memuat" :galat="galat" kerangka="halaman">
        <template #aksi
            ><button class="btn btn-soft" @click="muat">
                Coba lagi
            </button></template
        >

        <div v-if="data" class="stack" style="gap: var(--space-5)">
            <div class="kop">
                <h2>Laporan Penjualan</h2>
                <p class="caption">
                    Toko Sari Amerta &middot;
                    {{ tanggal(data.periode.dari) }} &ndash;
                    {{ tanggal(data.periode.sampai) }}
                </p>
                <p class="caption">Hanya memuat transaksi berstatus lunas.</p>
            </div>

            <section class="grid-stats grid">
                <div class="card">
                    <p class="overline">Transaksi</p>
                    <p class="ringkas-nilai">
                        {{ angka(data.ringkasan.jumlah_transaksi) }}
                    </p>
                </div>
                <div class="card">
                    <p class="overline">Subtotal</p>
                    <p class="ringkas-nilai">
                        {{ rupiah(data.ringkasan.subtotal) }}
                    </p>
                </div>
                <div class="card">
                    <p class="overline">Diskon</p>
                    <p class="ringkas-nilai">
                        {{ rupiah(data.ringkasan.diskon) }}
                    </p>
                </div>
                <div class="card">
                    <p class="overline">Total diterima</p>
                    <p class="ringkas-nilai">
                        {{ rupiah(data.ringkasan.total) }}
                    </p>
                </div>
            </section>

            <section class="table-wrap">
                <div class="table-scroll">
                    <table class="data">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th class="num">Transaksi</th>
                                <th class="num">Subtotal</th>
                                <th class="num">Diskon</th>
                                <th class="num">PPN</th>
                                <th class="num">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="h in data.harian" :key="h.tanggal_str">
                                <td>{{ tanggal(h.tanggal_str) }}</td>
                                <td class="num">
                                    {{ angka(h.jumlah_transaksi) }}
                                </td>
                                <td class="num">{{ angka(h.subtotal) }}</td>
                                <td class="num">{{ angka(h.diskon) }}</td>
                                <td class="num">{{ angka(h.pajak) }}</td>
                                <td class="num">{{ angka(h.total) }}</td>
                            </tr>
                            <tr v-if="data.harian.length === 0">
                                <td colspan="6" class="muted">
                                    Tidak ada penjualan pada periode ini.
                                </td>
                            </tr>
                        </tbody>
                        <tfoot v-if="data.harian.length > 0">
                            <tr>
                                <th>Jumlah</th>
                                <th class="num">
                                    {{ angka(data.ringkasan.jumlah_transaksi) }}
                                </th>
                                <th class="num">
                                    {{ angka(data.ringkasan.subtotal) }}
                                </th>
                                <th class="num">
                                    {{ angka(data.ringkasan.diskon) }}
                                </th>
                                <th class="num">
                                    {{ angka(data.ringkasan.pajak) }}
                                </th>
                                <th class="num">
                                    {{ angka(data.ringkasan.total) }}
                                </th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>
        </div>
    </KeadaanData>
</template>

<style scoped>
.kop {
    display: none;
}

.ringkas-nilai {
    font: var(--text-h2);
    letter-spacing: var(--tracking-h2);
    font-variant-numeric: tabular-nums;
    margin-top: var(--space-2);
}

/* Kop laporan hanya muncul saat dicetak (PERANCANGAN Bagian 9). */
@media print {
    .kop {
        display: block;
        margin-bottom: var(--space-4);
    }

    .card,
    .table-wrap {
        box-shadow: none;
        border: 1px solid var(--divider);
    }

    .grid-stats {
        grid-template-columns: repeat(4, 1fr);
    }
}
</style>
