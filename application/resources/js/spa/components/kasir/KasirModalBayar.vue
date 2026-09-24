<script setup lang="ts">
import { QrCode, RefreshCw } from '@lucide/vue';
import { angka, jam, rupiah } from '../../composables/format';
import { useKasirInduk } from '../../composables/useKasir';
import BaseModal from '../BaseModal.vue';
import InputAngka from '../InputAngka.vue';
import KeypadAngka from '../KeypadAngka.vue';

/**
 * Modal pembayaran dua metode (DESIGN.md Bagian 8.3), dipakai bersama oleh
 * Kasir desktop dan mode tablet.
 *
 * `sentuh` (mode tablet): nominal tunai diisi lewat papan angka layar di
 * sebelah kanan, papan ketik sistem ditahan supaya tidak menutupi total dan
 * kembalian, dan seluruh tombol dibuat lebih besar.
 */
defineProps<{ sentuh?: boolean }>();

const kasir = useKasirInduk();
</script>

<template>
    <BaseModal
        v-if="kasir.modalBayar"
        judul="Pembayaran"
        :lebar="sentuh && kasir.metode === 'tunai' ? '820px' : '560px'"
        formulir
        :terkunci="kasir.memproses"
        @tutup="kasir.modalBayar = false"
    >
        <form
            id="form-bayar"
            class="bayar"
            :class="{ 'bayar-sentuh': sentuh && kasir.metode === 'tunai' }"
            novalidate
            @submit.prevent="kasir.bayar()"
        >
            <div class="stack">
                <div
                    class="metode-pilih"
                    role="radiogroup"
                    aria-label="Metode pembayaran"
                >
                    <button
                        type="button"
                        role="radio"
                        class="btn"
                        :class="[
                            kasir.metode === 'tunai'
                                ? 'btn-primary'
                                : 'btn-soft',
                            { 'btn-lg': sentuh },
                        ]"
                        :aria-checked="kasir.metode === 'tunai'"
                        :disabled="kasir.tagihan !== null"
                        :title="
                            kasir.tagihan
                                ? 'Tagihan non-tunai untuk keranjang ini sudah dibuat'
                                : undefined
                        "
                        @click="kasir.metode = 'tunai'"
                    >
                        Tunai
                    </button>
                    <button
                        type="button"
                        role="radio"
                        class="btn"
                        :class="[
                            kasir.metode === 'non_tunai'
                                ? 'btn-primary'
                                : 'btn-soft',
                            { 'btn-lg': sentuh },
                        ]"
                        :aria-checked="kasir.metode === 'non_tunai'"
                        @click="kasir.metode = 'non_tunai'"
                    >
                        Non-Tunai
                        <small class="metode-sub">QRIS · GoPay · VA</small>
                    </button>
                </div>

                <div class="total-modal">
                    <span class="overline">Total belanja</span>
                    <span class="num-hero"
                        ><span class="rp">Rp</span
                        >{{ angka(kasir.total) }}</span
                    >
                </div>

                <template v-if="kasir.metode === 'tunai'">
                    <div class="field">
                        <label for="uang">Uang diterima</label>
                        <InputAngka
                            id="uang"
                            v-model="kasir.uangDiterima"
                            awalan="Rp"
                            :langkah="1000"
                            :invalid="!kasir.cukup"
                            :mode-input="sentuh ? 'none' : 'numeric'"
                            aria-describedby="uang-keterangan"
                            data-fokus-awal
                        />
                        <p
                            v-if="!kasir.cukup"
                            id="uang-keterangan"
                            class="field-error"
                            role="alert"
                        >
                            Nominal kurang
                            {{
                                rupiah(kasir.total - (kasir.uangDiterima ?? 0))
                            }}
                            dari total belanja.
                        </p>
                    </div>

                    <div
                        class="pecahan"
                        :class="{ 'pecahan-sentuh': sentuh }"
                        aria-label="Pecahan cepat"
                    >
                        <button
                            v-for="n in kasir.pecahan"
                            :key="n"
                            type="button"
                            class="btn btn-soft"
                            :class="sentuh ? '' : 'btn-sm'"
                            :aria-pressed="kasir.uangDiterima === n"
                            @click="kasir.uangDiterima = n"
                        >
                            {{ n === kasir.total ? 'Uang pas' : angka(n) }}
                        </button>
                    </div>

                    <div class="row kembali">
                        <span>Kembalian</span><span class="spacer" />
                        <span class="num kembali-nilai">{{
                            angka(kasir.kembalian)
                        }}</span>
                    </div>
                </template>

                <template v-else>
                    <!-- Tagihan sudah dibuat; popup mungkin sempat ditutup. -->
                    <div
                        v-if="kasir.tagihan"
                        class="panel-tagihan"
                        role="status"
                    >
                        <div class="panel-tagihan-kepala">
                            <QrCode
                                :size="22"
                                :stroke-width="1.75"
                                aria-hidden="true"
                            />
                            <div>
                                <strong class="mono">{{
                                    kasir.tagihan.trx.no_struk
                                }}</strong>
                                <p class="caption">
                                    Menunggu pembayaran
                                    <template
                                        v-if="kasir.tagihan.berlakuSampai"
                                    >
                                        · berlaku sampai
                                        {{ jam(kasir.tagihan.berlakuSampai) }}
                                    </template>
                                </p>
                            </div>
                        </div>
                        <p class="caption">
                            Popup tertutup? "Buka Pembayaran Lagi" menampilkan
                            QRIS atau nomor VA yang <strong>sama</strong>, tanpa
                            membuat tagihan baru.
                        </p>
                        <button
                            type="button"
                            class="btn btn-ghost btn-sm"
                            :disabled="kasir.memeriksa"
                            :aria-busy="kasir.memeriksa"
                            @click="
                                kasir.pastikanLunas(
                                    kasir.tagihan.trx,
                                    'keranjang',
                                    false,
                                )
                            "
                        >
                            <RefreshCw
                                v-if="!kasir.memeriksa"
                                :size="15"
                                :stroke-width="1.75"
                                aria-hidden="true"
                            />
                            Periksa status pembayaran
                        </button>
                    </div>

                    <p v-else class="muted">
                        Popup Midtrans akan terbuka. Pelanggan memilih sendiri
                        QRIS, GoPay, Virtual Account, atau kartu. Status lunas
                        dipastikan server ke Midtrans, bukan oleh tampilan di
                        layar ini.
                    </p>
                </template>
            </div>

            <KeypadAngka
                v-if="sentuh && kasir.metode === 'tunai'"
                v-model="kasir.uangDiterima"
            />
        </form>

        <template #aksi>
            <button
                v-if="kasir.tagihan && kasir.metode === 'non_tunai'"
                class="btn btn-soft"
                :class="{ 'btn-lg': sentuh }"
                :disabled="kasir.memproses"
                title="Tagihan tetap tersimpan di daftar Menunggu bayar"
                @click="kasir.layaniBerikutnya()"
            >
                Layani berikutnya
            </button>
            <button
                v-else
                class="btn btn-soft"
                :class="{ 'btn-lg': sentuh }"
                :disabled="kasir.memproses"
                @click="kasir.modalBayar = false"
            >
                Batal
            </button>
            <button
                type="submit"
                form="form-bayar"
                class="btn btn-success"
                :class="{ 'btn-lg': sentuh }"
                :disabled="!kasir.cukup || kasir.memproses"
                :aria-busy="kasir.memproses"
            >
                {{
                    kasir.memproses
                        ? 'Memproses…'
                        : kasir.metode === 'non_tunai' && kasir.tagihan
                          ? 'Buka Pembayaran Lagi'
                          : 'Konfirmasi'
                }}
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.bayar-sentuh {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: var(--space-6);
    align-items: start;
}

.metode-pilih {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
}

.metode-pilih .btn {
    flex-direction: column;
    gap: 0;
    line-height: 1.2;
}

.metode-sub {
    font: var(--text-caption);
    opacity: 0.8;
}

.total-modal {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    background: var(--surface-base);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-inset-sm);
}

.pecahan {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
}

.pecahan-sentuh {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
}

.kembali {
    padding-top: var(--space-2);
    border-top: 1px solid var(--divider);
    font: var(--text-body-strong);
}

.kembali-nilai {
    color: var(--success-text);
    font: var(--text-h3);
    font-variant-numeric: tabular-nums;
}

.mono {
    font: var(--text-numeric);
}

/* Panel tagihan yang sedang menunggu. */
.panel-tagihan {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--warning-bg);
    color: var(--warning-text);
}

.panel-tagihan .caption {
    color: inherit;
}

.panel-tagihan-kepala {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

/* Tablet tegak: papan angka pindah ke bawah. */
@media (max-width: 767px) {
    .bayar-sentuh {
        grid-template-columns: 1fr;
    }
}
</style>
