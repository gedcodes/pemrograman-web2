<script setup lang="ts">
import { QrCode, RefreshCw } from '@lucide/vue';
import { jam, rupiah } from '../../composables/format';
import { useKasirInduk } from '../../composables/useKasir';
import BaseModal from '../BaseModal.vue';

/** Daftar tagihan non-tunai hari ini yang belum lunas. */
const kasir = useKasirInduk();
</script>

<template>
    <BaseModal
        v-if="kasir.daftarMenungguTerbuka"
        judul="Menunggu pembayaran"
        deskripsi="Tagihan non-tunai hari ini yang belum lunas. Buka lagi untuk menampilkan QRIS / VA yang sama kepada pelanggan."
        lebar="640px"
        @tutup="kasir.daftarMenungguTerbuka = false"
    >
        <p v-if="kasir.menunggu.length === 0" class="muted">
            Tidak ada tagihan yang menunggu.
        </p>
        <ul v-else class="daftar-menunggu">
            <li v-for="t in kasir.menunggu" :key="t.id" class="baris-menunggu">
                <div class="baris-menunggu-info">
                    <strong class="mono">{{ t.no_struk }}</strong>
                    <span class="caption">
                        {{ jam(t.tanggal) }} ·
                        {{ t.customer?.nama ?? 'Umum' }}
                        <template v-if="t.payment?.payment_type">
                            · {{ t.payment.payment_type }}
                        </template>
                    </span>
                    <span
                        class="badge"
                        :class="
                            kasir.masihBerlaku(t)
                                ? 'badge-info'
                                : 'badge-warning'
                        "
                    >
                        {{
                            kasir.masihBerlaku(t)
                                ? `Berlaku sampai ${jam(t.payment?.snap_kedaluwarsa)}`
                                : 'Tagihan lama: periksa dulu sebelum membuka'
                        }}
                    </span>
                </div>
                <span class="num baris-menunggu-total">{{
                    rupiah(t.total)
                }}</span>
                <div class="row aksi-baris">
                    <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        :disabled="kasir.memeriksaBaris !== null"
                        :aria-busy="kasir.memeriksaBaris === t.id"
                        @click="kasir.periksaDariDaftar(t)"
                    >
                        <RefreshCw
                            v-if="kasir.memeriksaBaris !== t.id"
                            :size="15"
                            :stroke-width="1.75"
                            aria-hidden="true"
                        />
                        Periksa
                    </button>
                    <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        :disabled="kasir.memeriksaBaris !== null"
                        @click="kasir.bukaDariDaftar(t)"
                    >
                        <QrCode
                            :size="15"
                            :stroke-width="1.75"
                            aria-hidden="true"
                        />
                        Buka lagi
                    </button>
                </div>
            </li>
        </ul>
    </BaseModal>
</template>

<style scoped>
.mono {
    font: var(--text-numeric);
}

.daftar-menunggu {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
}

.baris-menunggu {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--divider);
}

.baris-menunggu:last-child {
    border-bottom: 0;
}

.baris-menunggu-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
}

.baris-menunggu-total {
    font: var(--text-body-strong);
}

@media (max-width: 599px) {
    .baris-menunggu {
        grid-template-columns: 1fr auto;
    }

    .baris-menunggu .aksi-baris {
        grid-column: 1 / -1;
    }
}
</style>
