<script setup lang="ts">
import { Printer, QrCode, RefreshCw, Search } from '@lucide/vue';
import { ref } from 'vue';
import { ambil, ApiError } from '../api/client';
import { bayarDenganSnap, periksaStatus } from '../api/snap';
import type { StatusTransaksi, Transaction } from '../api/types';
import {
    angka,
    hariLalu,
    kunciTanggal,
    statusTransaksi,
    tanggalJam,
} from '../composables/format';
import type { OpsiPilihan } from '../composables/pilihan';
import { useDaftarServer } from '../composables/useDaftarServer';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import BaseSelect from '../components/BaseSelect.vue';
import KeadaanData from '../components/KeadaanData.vue';
import KepalaUrut from '../components/KepalaUrut.vue';
import PagePagination from '../components/PagePagination.vue';
import StatusBadge from '../components/StatusBadge.vue';
import StrukCetak from '../components/StrukCetak.vue';

const OPSI_STATUS: OpsiPilihan<StatusTransaksi>[] = [
    { nilai: 'settlement', label: 'Lunas' },
    { nilai: 'pending', label: 'Menunggu' },
    { nilai: 'expire', label: 'Kedaluwarsa' },
    { nilai: 'cancel', label: 'Dibatalkan' },
    { nilai: 'deny', label: 'Ditolak' },
];

type Periode = 'hari-ini' | '7' | '30';

const OPSI_PERIODE: OpsiPilihan<Periode>[] = [
    { nilai: 'hari-ini', label: 'Hari ini' },
    { nilai: '7', label: '7 hari terakhir' },
    { nilai: '30', label: '30 hari terakhir' },
];

const cari = ref('');
const status = ref<StatusTransaksi | null>(null);
const periode = ref<Periode | null>(null);

function dariPeriode(p: Periode | null): string | undefined {
    if (p === 'hari-ini') return kunciTanggal();
    if (p === '7') return hariLalu(6);
    if (p === '30') return hariLalu(29);
    return undefined;
}

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
} = useDaftarServer<Transaction>(
    '/transactions',
    () => ({
        q: cari.value || undefined,
        status: status.value ?? undefined,
        dari: dariPeriode(periode.value),
    }),
    { urut: { kolom: 'tanggal', arah: 'desc' } },
);

/* ------------------------------------------------------------------ detail */

/* Modal dibuka seketika dengan kerangka, lalu isinya menyusul. Menunggu
   respons dulu baru membuka modal terasa seperti tombol yang tidak bekerja. */
const detailTerbuka = ref(false);
const detail = ref<Transaction | null>(null);
const judulDetail = ref('');

async function bukaDetail(t: Transaction) {
    judulDetail.value = t.no_struk;
    detail.value = null;
    detailTerbuka.value = true;
    try {
        detail.value = await ambil<Transaction>(`/transactions/${t.id}`);
    } catch (e) {
        detailTerbuka.value = false;
        toast.galat(e instanceof ApiError ? e.message : 'Gagal memuat detail.');
    }
}

/* Cetak ulang struk (PERANCANGAN §9: "Cetak Ulang Struk"). BaseModal ber-prop
   `cetak` memastikan hanya struknya yang keluar di kertas. */
function cetakUlang() {
    window.print();
}

/* ------------------------------------------------------------ cek status */

/**
 * Server mencocokkan transaksi pending ke Midtrans sebelum menjawab, jadi
 * tombol ini berguna walau webhook terlambat atau tidak dapat masuk.
 */
const memeriksa = ref<number | null>(null);

async function periksa(t: Transaction, dariPopup = false) {
    memeriksa.value = t.id;
    try {
        const r = await periksaStatus(t.id);
        const berubah = r.status !== t.status;
        t.status = r.status;
        if (r.payment) t.payment = r.payment;

        if (r.status === 'settlement') {
            toast.sukses(`${t.no_struk} lunas.`);
        } else if (berubah) {
            toast.peringatan(
                `${t.no_struk} ${statusTransaksi(r.status).label.toLowerCase()}.`,
            );
        } else {
            toast.info(
                dariPopup
                    ? `Pembayaran ${t.no_struk} sedang dikonfirmasi Midtrans. Periksa lagi sebentar.`
                    : `${t.no_struk} belum dibayar.`,
            );
        }
    } catch (e) {
        toast.galat(e instanceof ApiError ? e.message : 'Gagal memeriksa.');
    } finally {
        memeriksa.value = null;
    }
}

/* ------------------------------------------------------ lanjutkan bayar */

/**
 * Membuka lagi popup pembayaran transaksi non-tunai yang masih menunggu.
 *
 * Selama tagihannya masih berlaku, server menyerahkan token yang SAMA,
 * sehingga pelanggan melihat QRIS / nomor VA yang tadi, bukan tagihan baru.
 */
const melanjutkan = ref<number | null>(null);

function bisaDilanjutkan(t: Transaction): boolean {
    return t.status === 'pending' && t.payment?.metode === 'non_tunai';
}

async function lanjutkanBayar(t: Transaction) {
    melanjutkan.value = t.id;
    try {
        const token = await bayarDenganSnap(t.id, {
            sukses: () => void periksa(t, true),
            menunggu: () => void periksa(t, true),
            galat: () => toast.galat('Pembayaran gagal. Coba lagi.'),
            tutup: () =>
                toast.info(
                    `${t.no_struk} masih menunggu. Tombol "Lanjutkan bayar" dapat dipakai lagi.`,
                ),
        });
        if (!token.dipakai_ulang) {
            toast.info('Tagihan lama sudah habis, jadi dibuat tagihan baru.');
        }
    } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
            toast.peringatan(e.message);
            await periksa(t);
        } else {
            toast.galat(
                e instanceof ApiError ? e.message : 'Gagal membuka pembayaran.',
            );
        }
    } finally {
        melanjutkan.value = null;
    }
}
</script>

<template>
    <div class="page-head">
        <div class="penyaring">
            <label class="kotak-cari">
                <Search :size="18" :stroke-width="1.75" aria-hidden="true" />
                <span class="sr-only">Cari nomor struk</span>
                <input
                    v-model="cari"
                    type="search"
                    placeholder="Cari no. struk…"
                />
            </label>
            <BaseSelect
                v-model="periode"
                :opsi="OPSI_PERIODE"
                label-kosong="Semua waktu"
                aria-label="Saring periode"
            />
            <BaseSelect
                v-model="status"
                :opsi="OPSI_STATUS"
                label-kosong="Semua status"
                aria-label="Saring status"
            />
        </div>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            :pesan-kosong="
                cari || status || periode
                    ? 'Tidak ada transaksi yang cocok dengan penyaring.'
                    : 'Belum ada transaksi.'
            "
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
                                label="No. Struk"
                                kolom="no_struk"
                                :urut="urut"
                                :arah="arah"
                                @urutkan="urutkan"
                            />
                            <KepalaUrut
                                label="Waktu"
                                kolom="tanggal"
                                :urut="urut"
                                :arah="arah"
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <th>Kasir</th>
                            <th>Pelanggan</th>
                            <th>Metode</th>
                            <KepalaUrut
                                label="Status"
                                kolom="status"
                                :urut="urut"
                                :arah="arah"
                                @urutkan="urutkan"
                            />
                            <KepalaUrut
                                label="Total"
                                kolom="total"
                                :urut="urut"
                                :arah="arah"
                                num
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <th class="kolom-aksi">
                                <span class="sr-only">Aksi</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="t in daftar" :key="t.id">
                            <td class="mono">{{ t.no_struk }}</td>
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
                            <td class="kolom-aksi">
                                <div class="row aksi-baris">
                                    <button
                                        v-if="bisaDilanjutkan(t)"
                                        class="btn btn-primary btn-sm"
                                        :disabled="melanjutkan !== null"
                                        :aria-busy="melanjutkan === t.id"
                                        @click="lanjutkanBayar(t)"
                                    >
                                        <QrCode
                                            v-if="melanjutkan !== t.id"
                                            :size="15"
                                            :stroke-width="1.75"
                                            aria-hidden="true"
                                        />
                                        Lanjutkan bayar
                                    </button>
                                    <button
                                        v-if="t.status === 'pending'"
                                        class="btn btn-ghost btn-sm"
                                        :disabled="memeriksa === t.id"
                                        :aria-busy="memeriksa === t.id"
                                        @click="periksa(t)"
                                    >
                                        <RefreshCw
                                            v-if="memeriksa !== t.id"
                                            :size="15"
                                            :stroke-width="1.75"
                                            aria-hidden="true"
                                        />
                                        Periksa
                                    </button>
                                    <button
                                        class="btn btn-soft btn-sm"
                                        @click="bukaDetail(t)"
                                    >
                                        Detail
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
        v-if="detailTerbuka"
        :judul="judulDetail"
        lebar="400px"
        cetak
        @tutup="detailTerbuka = false"
    >
        <div v-if="!detail" class="stack" aria-busy="true">
            <div class="skeleton" style="width: 40%; height: 14px" />
            <div
                v-for="i in 4"
                :key="i"
                class="skeleton"
                style="height: 20px"
            />
            <div class="skeleton" style="width: 60%; height: 20px" />
        </div>

        <div v-else class="stack">
            <div class="row no-print">
                <StatusBadge :status="detail.status" />
                <span class="spacer" />
                <span v-if="detail.status !== 'settlement'" class="caption">
                    Struk hanya dapat dicetak untuk transaksi lunas.
                </span>
            </div>
            <StrukCetak :transaksi="detail" cetak-ulang />
        </div>

        <template v-if="detail?.status === 'settlement'" #aksi>
            <button class="btn btn-soft" @click="detailTerbuka = false">
                Tutup
            </button>
            <button class="btn btn-neutral" @click="cetakUlang">
                <Printer :size="18" :stroke-width="1.75" aria-hidden="true" />
                Cetak ulang
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.mono {
    font: var(--text-numeric);
}
</style>
