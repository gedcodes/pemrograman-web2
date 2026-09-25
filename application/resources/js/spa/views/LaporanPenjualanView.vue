<script setup lang="ts">
import { TrendingDown, TrendingUp } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
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
import GrafikTren from '../components/GrafikTren.vue';
import KeadaanData from '../components/KeadaanData.vue';
import TombolUnduh from '../components/TombolUnduh.vue';

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

const periode = () => ({ dari: dari.value, sampai: sampai.value });

/** Perubahan vs periode sebelumnya yang sama panjang; naik = baik. */
const perubahan = computed(() => {
    const p = data.value?.pembanding;
    if (!p || p.perubahan_persen === null) return null;
    return {
        naik: p.perubahan_persen >= 0,
        teks: `${p.perubahan_persen >= 0 ? '+' : '−'}${angka(Math.abs(p.perubahan_persen))}%`,
    };
});

onMounted(muat);
</script>

<template>
    <div class="page-head">
        <FilterPeriode
            v-model:dari="dari"
            v-model:sampai="sampai"
            :memuat="memuat"
            @terapkan="muat"
        />
        <TombolUnduh
            url="/reports/sales/unduh"
            :params="periode"
            :nama="`laporan-penjualan_${dari}_${sampai}`"
            :disabled="!data"
        />
    </div>

    <KeadaanData :memuat="memuat" :galat="galat" kerangka="halaman">
        <template #aksi
            ><button class="btn btn-soft" @click="muat">
                Coba lagi
            </button></template
        >

        <div v-if="data" class="stack" style="gap: var(--space-5)">
            <section class="grid-stats grid">
                <div class="card">
                    <p class="overline">Total diterima</p>
                    <p class="ringkas-nilai">
                        {{ rupiah(data.ringkasan.total) }}
                    </p>
                    <p v-if="perubahan" class="caption perubahan">
                        <span
                            class="perubahan-nilai"
                            :class="perubahan.naik ? 'naik' : 'turun'"
                        >
                            <component
                                :is="perubahan.naik ? TrendingUp : TrendingDown"
                                :size="15"
                                :stroke-width="2"
                                aria-hidden="true"
                            />
                            {{ perubahan.teks }}
                        </span>
                        vs {{ rupiah(data.pembanding.total) }} periode
                        sebelumnya
                    </p>
                    <p v-else class="caption">
                        Periode sebelumnya tanpa penjualan
                    </p>
                </div>
                <div class="card">
                    <p class="overline">Transaksi</p>
                    <p class="ringkas-nilai">
                        {{ angka(data.ringkasan.jumlah_transaksi) }}
                    </p>
                    <p class="caption">
                        {{ angka(data.pembanding.jumlah_transaksi) }} periode
                        sebelumnya
                    </p>
                </div>
                <div class="card">
                    <p class="overline">Rata-rata / transaksi</p>
                    <p class="ringkas-nilai">
                        {{ rupiah(data.ringkasan.rata_rata_transaksi) }}
                    </p>
                </div>
                <div class="card">
                    <p class="overline">Diskon diberikan</p>
                    <p class="ringkas-nilai">
                        {{ rupiah(data.ringkasan.diskon) }}
                    </p>
                </div>
            </section>

            <section class="card stack">
                <div>
                    <h2>
                        Tren pendapatan
                        {{
                            data.tren.satuan === 'bulan'
                                ? 'per bulan'
                                : 'per hari'
                        }}
                    </h2>
                    <p class="caption">
                        {{ tanggal(data.periode.dari) }} &ndash;
                        {{ tanggal(data.periode.sampai) }} &middot; hanya
                        transaksi lunas
                        <template v-if="data.tren.satuan === 'bulan'">
                            &middot; periode di atas 62 hari dirangkum per bulan
                        </template>
                    </p>
                </div>
                <GrafikTren
                    :titik="data.tren.titik"
                    :satuan="data.tren.satuan"
                />
            </section>

            <section class="table-wrap">
                <div class="table-scroll">
                    <table class="data">
                        <caption class="sr-only">
                            Rincian penjualan per hari
                        </caption>
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
.ringkas-nilai {
    font: var(--text-h2);
    letter-spacing: var(--tracking-h2);
    font-variant-numeric: tabular-nums;
    margin-top: var(--space-2);
}

.perubahan {
    margin-top: var(--space-1);
}

/* Arah ditandai ikon + tanda, bukan warna saja. */
.perubahan-nilai {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.naik {
    color: var(--success-text);
}

.turun {
    color: var(--danger-text);
}
</style>
