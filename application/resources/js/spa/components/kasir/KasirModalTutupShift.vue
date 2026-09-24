<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue';
import { computed } from 'vue';
import { angka, jam, rupiah } from '../../composables/format';
import { useKasirInduk } from '../../composables/useKasir';
import BaseModal from '../BaseModal.vue';
import InputAngka from '../InputAngka.vue';
import KeypadAngka from '../KeypadAngka.vue';

/**
 * Tutup shift: kasir menghitung uang di laci, sistem membandingkannya
 * dengan kas seharusnya (modal awal + penjualan tunai), lalu menampilkan
 * selisihnya sebelum dan sesudah shift ditutup.
 */
defineProps<{ sentuh?: boolean }>();

const kasir = useKasirInduk();

const ringkasan = computed(() => kasir.shift?.ringkasan ?? null);
const rekap = computed(() => kasir.rekapTutup?.ringkasan ?? null);

function nadaSelisih(n: number | null): string {
    if (n === null) return '';
    if (n === 0) return 'cocok';
    return n > 0 ? 'lebih' : 'kurang';
}

function teksSelisih(n: number): string {
    if (n === 0) return 'Kas cocok';
    return n > 0 ? `Lebih ${rupiah(n)}` : `Kurang ${rupiah(-n)}`;
}
</script>

<template>
    <BaseModal
        v-if="kasir.modalTutupShift"
        :judul="kasir.rekapTutup ? 'Shift ditutup' : 'Tutup Shift'"
        :lebar="sentuh && !kasir.rekapTutup ? '820px' : '560px'"
        formulir
        :terkunci="kasir.menutupShift"
        @tutup="
            kasir.rekapTutup
                ? kasir.selesaiTutupShift()
                : (kasir.modalTutupShift = false)
        "
    >
        <!-- Setelah ditutup: rekap akhir untuk dicocokkan kasir / admin. -->
        <div v-if="kasir.rekapTutup && rekap" class="stack">
            <div class="hasil" :class="nadaSelisih(rekap.selisih)">
                <span class="overline">Selisih kas</span>
                <strong class="hasil-nilai">{{
                    teksSelisih(rekap.selisih ?? 0)
                }}</strong>
            </div>
            <dl class="rincian">
                <div>
                    <dt>Dibuka</dt>
                    <dd>{{ jam(kasir.rekapTutup.waktu_buka) }}</dd>
                </div>
                <div>
                    <dt>Ditutup</dt>
                    <dd>{{ jam(kasir.rekapTutup.waktu_tutup) }}</dd>
                </div>
                <div>
                    <dt>Transaksi lunas</dt>
                    <dd class="num">{{ angka(rekap.jumlah_transaksi) }}</dd>
                </div>
                <div>
                    <dt>Kas seharusnya</dt>
                    <dd class="num">{{ rupiah(rekap.kas_seharusnya) }}</dd>
                </div>
                <div>
                    <dt>Kas dihitung</dt>
                    <dd class="num">
                        {{ rupiah(kasir.rekapTutup.kas_akhir ?? 0) }}
                    </dd>
                </div>
            </dl>
        </div>

        <!-- Sebelum ditutup. -->
        <form
            v-else
            id="form-tutup-shift"
            :class="{ 'tutup-sentuh': sentuh }"
            novalidate
            @submit.prevent="kasir.tutupShift()"
        >
            <div class="stack">
                <div v-if="kasir.memuatRingkasan && !ringkasan" class="stack">
                    <div
                        v-for="i in 4"
                        :key="i"
                        class="skeleton"
                        style="height: 22px"
                    />
                </div>

                <template v-else-if="ringkasan">
                    <dl class="rincian">
                        <div>
                            <dt>Modal awal</dt>
                            <dd class="num">
                                {{ rupiah(kasir.shift?.modal_awal ?? 0) }}
                            </dd>
                        </div>
                        <div>
                            <dt>Penjualan tunai</dt>
                            <dd class="num">
                                + {{ rupiah(ringkasan.penjualan_tunai) }}
                            </dd>
                        </div>
                        <div class="baris-utama">
                            <dt>Kas seharusnya di laci</dt>
                            <dd class="num">
                                {{ rupiah(ringkasan.kas_seharusnya) }}
                            </dd>
                        </div>
                        <div class="baris-info">
                            <dt>Penjualan non-tunai</dt>
                            <dd class="num">
                                {{ rupiah(ringkasan.penjualan_non_tunai) }}
                            </dd>
                        </div>
                        <div class="baris-info">
                            <dt>Transaksi lunas</dt>
                            <dd class="num">
                                {{ angka(ringkasan.jumlah_transaksi) }}
                            </dd>
                        </div>
                    </dl>

                    <p
                        v-if="ringkasan.tagihan_menunggu > 0"
                        class="peringatan"
                        role="status"
                    >
                        <TriangleAlert
                            :size="18"
                            :stroke-width="1.75"
                            aria-hidden="true"
                        />
                        {{ ringkasan.tagihan_menunggu }} tagihan non-tunai masih
                        menunggu pembayaran. Tagihan itu tetap tercatat di shift
                        ini dan dapat diperiksa dari Riwayat Transaksi.
                    </p>
                </template>

                <div class="field">
                    <label for="kas-akhir">Uang di laci saat ini</label>
                    <InputAngka
                        id="kas-akhir"
                        v-model="kasir.kasAkhir"
                        awalan="Rp"
                        placeholder="Hitung lalu isi"
                        :langkah="1000"
                        :mode-input="sentuh ? 'none' : 'numeric'"
                        aria-describedby="selisih-kas"
                        data-fokus-awal
                    />
                    <p
                        v-if="kasir.selisihKas !== null"
                        id="selisih-kas"
                        class="selisih"
                        :class="nadaSelisih(kasir.selisihKas)"
                        aria-live="polite"
                    >
                        {{ teksSelisih(kasir.selisihKas) }}
                    </p>
                </div>

                <div class="field">
                    <label for="catatan-tutup">
                        Catatan
                        <span v-if="kasir.selisihKas" class="caption"
                            >(jelaskan penyebab selisih)</span
                        >
                    </label>
                    <textarea
                        id="catatan-tutup"
                        v-model="kasir.catatanTutup"
                        class="textarea"
                        rows="2"
                        maxlength="500"
                    />
                </div>
            </div>

            <KeypadAngka v-if="sentuh" v-model="kasir.kasAkhir" />
        </form>

        <template #aksi>
            <button
                v-if="kasir.rekapTutup"
                class="btn btn-primary"
                :class="{ 'btn-lg': sentuh }"
                @click="kasir.selesaiTutupShift()"
            >
                Selesai
            </button>
            <template v-else>
                <button
                    class="btn btn-soft"
                    :class="{ 'btn-lg': sentuh }"
                    :disabled="kasir.menutupShift"
                    @click="kasir.modalTutupShift = false"
                >
                    Batal
                </button>
                <button
                    type="submit"
                    form="form-tutup-shift"
                    class="btn btn-danger"
                    :class="{ 'btn-lg': sentuh }"
                    :disabled="kasir.menutupShift || kasir.kasAkhir === null"
                    :aria-busy="kasir.menutupShift"
                >
                    {{ kasir.menutupShift ? 'Menutup…' : 'Tutup Shift' }}
                </button>
            </template>
        </template>
    </BaseModal>
</template>

<style scoped>
.tutup-sentuh {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: var(--space-6);
    align-items: start;
}

.rincian {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--surface-base);
    box-shadow: var(--shadow-inset-sm);
}

.rincian > div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
}

.rincian dd {
    margin: 0;
}

.baris-utama {
    padding-top: var(--space-2);
    border-top: 1px solid var(--divider);
    font: var(--text-body-strong);
}

.baris-info {
    color: var(--text-secondary);
    font: var(--text-small);
}

.peringatan {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--warning-bg);
    color: var(--warning-text);
    font: var(--text-small);
}

.selisih {
    font: var(--text-body-strong);
}

.cocok {
    color: var(--success-text);
}

.lebih {
    color: var(--info-text);
}

.kurang {
    color: var(--danger-text);
}

.hasil {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-5);
    border-radius: var(--radius-md);
    background: var(--surface-base);
    text-align: center;
}

.hasil.cocok {
    background: var(--success-bg);
}

.hasil.kurang {
    background: var(--danger-bg);
}

.hasil.lebih {
    background: var(--info-bg);
}

.hasil-nilai {
    font: var(--text-h2);
}

@media (max-width: 767px) {
    .tutup-sentuh {
        grid-template-columns: 1fr;
    }
}
</style>
