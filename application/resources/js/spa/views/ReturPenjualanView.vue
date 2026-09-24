<script setup lang="ts">
import { Check, Plus, X } from '@lucide/vue';
import { computed, nextTick, ref } from 'vue';
import { ambil, ApiError, simpan } from '../api/client';
import type { SalesReturn, Transaction } from '../api/types';
import { angka, rupiah, tanggal, tanggalJam } from '../composables/format';
import type { OpsiPilihan } from '../composables/pilihan';
import { useDaftarServer } from '../composables/useDaftarServer';
import { adalahAdmin } from '../stores/auth';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import BaseSelect from '../components/BaseSelect.vue';
import FieldForm from '../components/FieldForm.vue';
import InputAngka from '../components/InputAngka.vue';
import KeadaanData from '../components/KeadaanData.vue';
import KepalaUrut from '../components/KepalaUrut.vue';
import PagePagination from '../components/PagePagination.vue';

type StatusRetur = SalesReturn['status_approval'];

const LABEL: Record<StatusRetur, { teks: string; kelas: string }> = {
    pending: { teks: 'Menunggu', kelas: 'badge-warning' },
    approved: { teks: 'Disetujui', kelas: 'badge-success' },
    rejected: { teks: 'Ditolak', kelas: 'badge-danger' },
};

const OPSI_STATUS: OpsiPilihan<StatusRetur>[] = [
    { nilai: 'pending', label: 'Menunggu' },
    { nilai: 'approved', label: 'Disetujui' },
    { nilai: 'rejected', label: 'Ditolak' },
];

const status = ref<StatusRetur | null>(null);

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
} = useDaftarServer<SalesReturn>(
    '/returns',
    () => ({ status_approval: status.value ?? undefined }),
    { tunda: 0 },
);

/* ---------------------------------------------------------------- formulir */

const formTerbuka = ref(false);
/* Transaksi yang pernah muncul di hasil pencarian: sumber total struk
   untuk batas refund. */
const transaksiDikenal = ref(new Map<number, Transaction>());
const form = ref({
    transaction_id: null as number | null,
    alasan: '',
    jumlah_refund: null as number | null,
});
const galatServer = ref<Record<string, string>>({});
const dicoba = ref(false);
const mengirim = ref(false);

/**
 * Pencarian transaksi lunas di server menurut nomor struk. Dulu hanya 100
 * transaksi terbaru yang dimuat, sehingga struk yang lebih lama tidak
 * dapat diretur sama sekali.
 */
async function cariTransaksi(kata: string): Promise<OpsiPilihan<number>[]> {
    const hasil = await ambil<Transaction[]>('/transactions', {
        status: 'settlement',
        q: kata || undefined,
        per_page: 20,
    });
    for (const t of hasil) transaksiDikenal.value.set(t.id, t);
    return hasil.map((t) => ({
        nilai: t.id,
        label: `${t.no_struk} · ${rupiah(t.total)}`,
        keterangan: `${tanggalJam(t.tanggal)} · ${t.customer?.nama ?? 'Umum'}`,
    }));
}

const trxTerpilih = computed(() =>
    form.value.transaction_id === null
        ? null
        : (transaksiDikenal.value.get(form.value.transaction_id) ?? null),
);

function bukaForm() {
    form.value = { transaction_id: null, alasan: '', jumlah_refund: null };
    galatServer.value = {};
    dicoba.value = false;
    formTerbuka.value = true;
}

const galatLokal = computed(() => {
    const e: Record<string, string> = {};
    const f = form.value;
    if (f.transaction_id === null)
        e.transaction_id = 'Pilih transaksi yang diretur.';
    if (f.alasan.trim() === '') e.alasan = 'Alasan wajib diisi.';
    if (f.jumlah_refund === null)
        e.jumlah_refund = 'Jumlah refund wajib diisi.';
    else if (trxTerpilih.value && f.jumlah_refund > trxTerpilih.value.total)
        e.jumlah_refund = `Tidak boleh melebihi total struk (${rupiah(trxTerpilih.value.total)}).`;
    return e;
});

function pesanGalat(kunci: string): string | undefined {
    return (
        galatServer.value[kunci] ??
        (dicoba.value ? galatLokal.value[kunci] : undefined)
    );
}

async function kirim() {
    if (mengirim.value) return;
    dicoba.value = true;
    galatServer.value = {};
    if (Object.keys(galatLokal.value).length > 0) {
        await nextTick();
        document
            .querySelector<HTMLElement>('.modal [aria-invalid="true"]')
            ?.focus();
        return;
    }

    mengirim.value = true;
    try {
        const r = await simpan<SalesReturn>('/returns', {
            ...form.value,
            alasan: form.value.alasan.trim(),
        });
        toast.sukses(r.message ?? 'Retur diajukan.');
        formTerbuka.value = false;
        await muat();
    } catch (e) {
        if (e instanceof ApiError) {
            galatServer.value = Object.fromEntries(
                Object.entries(e.errors).map(([k, v]) => [k, v[0]]),
            );
            toast.galat(e.message);
        } else {
            toast.galat('Gagal mengajukan retur.');
        }
    } finally {
        mengirim.value = false;
    }
}

/* ------------------------------------------------------------- keputusan */

/** Id retur yang sedang diputuskan, supaya tombolnya tidak ditekan dua kali. */
const memutus = ref<number | null>(null);

async function putuskan(r: SalesReturn, aksi: 'approve' | 'reject') {
    if (memutus.value !== null) return;
    memutus.value = r.id;
    try {
        const res = await simpan(`/returns/${r.id}/${aksi}`);
        toast.sukses(res.message ?? 'Retur diproses.');
        await muat();
    } catch (e) {
        toast.galat(
            e instanceof ApiError ? e.message : 'Gagal memproses retur.',
        );
    } finally {
        memutus.value = null;
    }
}
</script>

<template>
    <div class="page-head">
        <div class="penyaring">
            <BaseSelect
                v-model="status"
                :opsi="OPSI_STATUS"
                label-kosong="Semua status"
                aria-label="Saring status retur"
            />
        </div>
        <button class="btn btn-primary" @click="bukaForm">
            <Plus :size="18" :stroke-width="2" aria-hidden="true" />
            Ajukan Retur
        </button>
    </div>

    <div class="table-wrap">
        <KeadaanData
            :memuat="memuat"
            :galat="galat"
            :kosong="daftar.length === 0"
            pesan-kosong="Belum ada retur."
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
                                label="No. Dokumen"
                                kolom="no_dokumen"
                                :urut="urut"
                                :arah="arah"
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <KepalaUrut
                                label="Tanggal"
                                kolom="tanggal_retur"
                                :urut="urut"
                                :arah="arah"
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <th>Struk</th>
                            <th>Alasan</th>
                            <KepalaUrut
                                label="Refund"
                                kolom="jumlah_refund"
                                :urut="urut"
                                :arah="arah"
                                num
                                arah-awal="desc"
                                @urutkan="urutkan"
                            />
                            <KepalaUrut
                                label="Status"
                                kolom="status_approval"
                                :urut="urut"
                                :arah="arah"
                                @urutkan="urutkan"
                            />
                            <th class="kolom-aksi">
                                <span class="sr-only">Aksi</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in daftar" :key="r.id">
                            <td>{{ r.no_dokumen }}</td>
                            <td>{{ tanggal(r.tanggal_retur) }}</td>
                            <td>{{ r.transaction?.no_struk ?? '-' }}</td>
                            <td class="alasan">{{ r.alasan }}</td>
                            <td class="num">{{ angka(r.jumlah_refund) }}</td>
                            <td>
                                <span
                                    class="badge"
                                    :class="LABEL[r.status_approval].kelas"
                                >
                                    {{ LABEL[r.status_approval].teks }}
                                </span>
                            </td>
                            <td class="kolom-aksi">
                                <div
                                    v-if="
                                        adalahAdmin &&
                                        r.status_approval === 'pending'
                                    "
                                    class="row aksi-baris"
                                >
                                    <button
                                        class="btn btn-soft btn-sm"
                                        :disabled="memutus !== null"
                                        :aria-busy="memutus === r.id"
                                        @click="putuskan(r, 'approve')"
                                    >
                                        <Check
                                            v-if="memutus !== r.id"
                                            :size="15"
                                            :stroke-width="2"
                                            aria-hidden="true"
                                        />
                                        Setujui
                                    </button>
                                    <button
                                        class="btn btn-ghost btn-sm"
                                        :disabled="memutus !== null"
                                        @click="putuskan(r, 'reject')"
                                    >
                                        <X
                                            :size="15"
                                            :stroke-width="2"
                                            aria-hidden="true"
                                        />
                                        Tolak
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
        judul="Ajukan Retur Penjualan"
        formulir
        :terkunci="mengirim"
        @tutup="formTerbuka = false"
    >
        <form id="form-retur" class="stack" novalidate @submit.prevent="kirim">
            <FieldForm
                v-slot="{ id, invalid, describedby }"
                label="Transaksi"
                wajib
                bantuan="Ketik nomor struk, mis. TRX-20260923."
                :galat="pesanGalat('transaction_id')"
            >
                <BaseSelect
                    :id="id"
                    v-model="form.transaction_id"
                    :opsi="[]"
                    :cari-server="cariTransaksi"
                    :cari="true"
                    placeholder="Cari transaksi lunas…"
                    :invalid="invalid"
                    :aria-describedby="describedby"
                />
            </FieldForm>

            <FieldForm
                v-slot="{ id, invalid, describedby }"
                label="Alasan"
                wajib
                :galat="pesanGalat('alasan')"
            >
                <textarea
                    :id="id"
                    v-model="form.alasan"
                    class="textarea"
                    :class="{ 'is-error': invalid }"
                    :aria-invalid="invalid || undefined"
                    :aria-describedby="describedby"
                    maxlength="500"
                    rows="3"
                    placeholder="mis. kemasan rusak saat dibuka"
                />
            </FieldForm>

            <FieldForm
                v-slot="{ id, invalid, describedby }"
                label="Jumlah refund"
                wajib
                :bantuan="
                    trxTerpilih
                        ? `Maksimal ${rupiah(trxTerpilih.total)} (total struk).`
                        : undefined
                "
                :galat="pesanGalat('jumlah_refund')"
            >
                <div class="row">
                    <InputAngka
                        :id="id"
                        v-model="form.jumlah_refund"
                        awalan="Rp"
                        placeholder="0"
                        :invalid="invalid"
                        :aria-describedby="describedby"
                    />
                    <button
                        v-if="trxTerpilih"
                        type="button"
                        class="btn btn-soft btn-sm"
                        @click="form.jumlah_refund = trxTerpilih.total"
                    >
                        Isi penuh
                    </button>
                </div>
            </FieldForm>

            <p class="caption">
                Retur yang diajukan kasir menunggu persetujuan admin. Retur saat
                ini merupakan catatan keuangan dan belum mengembalikan stok.
            </p>
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
                form="form-retur"
                :disabled="mengirim"
                :aria-busy="mengirim"
            >
                {{ mengirim ? 'Mengirim…' : 'Ajukan' }}
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.alasan {
    max-width: 28ch;
    white-space: normal;
}
</style>
