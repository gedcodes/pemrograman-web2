<script setup lang="ts">
import { Printer } from '@lucide/vue';
import { onMounted, ref } from 'vue';
import { ambil, ApiError } from '../api/client';
import type { LaporanLabaRugi } from '../api/types';
import {
    angka,
    hariLalu,
    kunciTanggal,
    persen,
    rupiah,
    tanggal,
} from '../composables/format';
import FilterPeriode from '../components/FilterPeriode.vue';
import KeadaanData from '../components/KeadaanData.vue';

// Diselaraskan dengan bawaan API dan Laporan Penjualan (7 hari), supaya
// periode beban dan periode penjualan tidak timpang.
const dari = ref(hariLalu(6));
const sampai = ref(kunciTanggal());
const data = ref<LaporanLabaRugi | null>(null);
const memuat = ref(true);
const galat = ref<string | null>(null);

let urutan = 0;

async function muat() {
    const ke = ++urutan;
    memuat.value = true;
    galat.value = null;
    try {
        const hasil = await ambil<LaporanLabaRugi>('/reports/profit-loss', {
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

/** Rugi harus terbaca sebagai rugi, bukan diwarnai hijau seperti laba. */
function nada(nilai: number): string {
    return nilai < 0 ? 'rugi' : 'untung';
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
        <template #aksi>
            <button class="btn btn-soft" @click="muat">Coba lagi</button>
        </template>

        <div v-if="data" class="stack" style="gap: var(--space-5)">
            <div class="kop">
                <h2>Laporan Laba Rugi</h2>
                <p class="caption">
                    Toko Sari Amerta &middot;
                    {{ tanggal(data.periode.dari) }} &ndash;
                    {{ tanggal(data.periode.sampai) }} ({{
                        data.periode.jumlah_hari
                    }}
                    hari)
                </p>
            </div>

            <div class="card stack">
                <p class="overline">Penjualan</p>
                <div class="baris">
                    <span>Pendapatan kotor</span><span class="spacer" />
                    <span class="num">{{ angka(data.pendapatan_kotor) }}</span>
                </div>
                <div class="baris">
                    <span>Diskon member</span><span class="spacer" />
                    <span class="num">&minus;{{ angka(data.diskon) }}</span>
                </div>
                <div class="baris tebal">
                    <span>Penjualan bersih</span><span class="spacer" />
                    <span class="num">{{ angka(data.penjualan_bersih) }}</span>
                </div>

                <p class="overline" style="margin-top: var(--space-4)">
                    Harga pokok penjualan
                </p>
                <div class="baris">
                    <span
                        >HPP ({{ angka(data.unit_terjual) }} unit terjual)</span
                    >
                    <span class="spacer" />
                    <span class="num"
                        >&minus;{{ angka(data.harga_pokok_penjualan) }}</span
                    >
                </div>
                <div class="baris sorot" :class="nada(data.laba_kotor)">
                    <span>Laba kotor</span><span class="spacer" />
                    <span class="num">{{ rupiah(data.laba_kotor) }}</span>
                    <span class="caption pinggir">{{
                        persen(data.margin_kotor)
                    }}</span>
                </div>

                <p class="overline" style="margin-top: var(--space-4)">Beban</p>
                <div
                    v-for="b in data.beban.rincian"
                    :key="b.nama"
                    class="baris rincian"
                >
                    <span>{{ b.nama }}</span
                    ><span class="spacer" />
                    <span class="caption pinggir">
                        {{ angka(b.jumlah_bulanan) }}/bln
                    </span>
                    <span class="num"
                        >&minus;{{ angka(b.jumlah_periode) }}</span
                    >
                </div>
                <div class="baris rincian">
                    <span
                        >Biaya MDR
                        {{ persen(data.beban.tarif_mdr * 100) }}</span
                    >
                    <span class="spacer" />
                    <span class="caption pinggir">
                        dari non-tunai {{ angka(data.beban.nilai_non_tunai) }}
                    </span>
                    <span class="num">&minus;{{ angka(data.beban.mdr) }}</span>
                </div>
                <div class="baris tebal">
                    <span>Total beban</span><span class="spacer" />
                    <span class="num"
                        >&minus;{{ angka(data.beban.total) }}</span
                    >
                </div>

                <div class="baris laba" :class="nada(data.laba_bersih)">
                    <span>{{
                        data.laba_bersih < 0 ? 'RUGI BERSIH' : 'LABA BERSIH'
                    }}</span
                    ><span class="spacer" />
                    <span class="num">{{ rupiah(data.laba_bersih) }}</span>
                    <span class="caption pinggir">{{
                        persen(data.margin_bersih)
                    }}</span>
                </div>
            </div>

            <p class="caption">
                Beban operasional disimpan per bulan lalu diprorata terhadap
                {{ data.periode.jumlah_hari }} hari periode ini. Harga pokok
                memakai harga modal <strong>saat penjualan terjadi</strong>,
                sehingga mengubah harga beli produk tidak menggeser laba periode
                yang sudah lewat. PPN {{ angka(data.pajak_dipungut) }} dipungut
                untuk negara dan bukan pendapatan toko, jadi tidak masuk
                perhitungan.
            </p>
        </div>
    </KeadaanData>
</template>

<style scoped>
.kop {
    display: none;
}

.baris {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--divider);
}

.baris:last-child {
    border-bottom: 0;
}

.rincian {
    padding-left: var(--space-4);
    color: var(--text-secondary);
    font: var(--text-small);
}

.pinggir {
    white-space: nowrap;
}

.tebal {
    font: var(--text-body-strong);
}

.sorot {
    font: var(--text-h3);
    border-top: 1px solid var(--divider);
    padding-top: var(--space-3);
}

.untung {
    color: var(--success-text);
}

.rugi {
    color: var(--danger-text);
}

.laba {
    font: var(--text-h2);
    letter-spacing: var(--tracking-h2);
    border-top: 2px solid var(--divider);
    padding-top: var(--space-4);
    margin-top: var(--space-2);
}

@media print {
    .kop {
        display: block;
        margin-bottom: var(--space-4);
    }

    .card {
        box-shadow: none;
        border: 1px solid var(--divider);
    }
}
</style>
