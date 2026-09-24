<script setup lang="ts">
import type { Transaction } from '../api/types';
import { angka, tanggalJam } from '../composables/format';

/**
 * Isi struk, dipakai bersama oleh Kasir (struk baru) dan Riwayat Transaksi
 * (cetak ulang). Dibungkus BaseModal ber-prop `cetak`, sehingga saat dicetak
 * hanya struk ini yang keluar di kertas.
 *
 * Struk cetak ulang diberi tanda "CETAK ULANG" beserta waktu cetaknya,
 * supaya salinan tidak dapat disangka struk asli untuk klaim ganda.
 */
const props = defineProps<{
    transaksi: Transaction;
    cetakUlang?: boolean;
}>();

const waktuCetak = new Date().toISOString();

function metode(t: Transaction): string {
    if (t.payment?.metode !== 'non_tunai') return 'Tunai';
    return t.payment.payment_type
        ? `Non-tunai (${t.payment.payment_type.toUpperCase()})`
        : 'Non-tunai';
}
</script>

<template>
    <div class="struk">
        <div class="struk-kepala">
            <strong>Toko Sari Amerta</strong>
            <p class="caption">{{ props.transaksi.no_struk }}</p>
            <p class="caption">{{ tanggalJam(props.transaksi.tanggal) }}</p>
            <p v-if="props.transaksi.shift?.user" class="caption">
                Kasir: {{ props.transaksi.shift.user.name }}
            </p>
            <p v-if="props.transaksi.customer" class="caption">
                Pelanggan: {{ props.transaksi.customer.nama }}
            </p>
            <p v-if="props.cetakUlang" class="tanda-ulang">
                CETAK ULANG · {{ tanggalJam(waktuCetak) }}
            </p>
        </div>

        <table class="struk-item">
            <tbody>
                <tr v-for="i in props.transaksi.items ?? []" :key="i.id">
                    <td>
                        {{ i.nama_produk }}<br /><span class="caption"
                            >{{ i.qty }} × {{ angka(i.harga_satuan) }}</span
                        >
                    </td>
                    <td class="num">{{ angka(i.subtotal) }}</td>
                </tr>
            </tbody>
        </table>

        <div class="struk-total">
            <div class="row">
                <span>Subtotal</span><span class="spacer" /><span class="num">{{
                    angka(props.transaksi.subtotal)
                }}</span>
            </div>
            <div v-if="props.transaksi.diskon > 0" class="row">
                <span>Diskon member</span><span class="spacer" /><span
                    class="num"
                    >−{{ angka(props.transaksi.diskon) }}</span
                >
            </div>
            <div class="row">
                <span>PPN</span><span class="spacer" /><span class="num">{{
                    angka(props.transaksi.pajak)
                }}</span>
            </div>
            <div class="row total-baris">
                <span>Total</span><span class="spacer" /><span class="num">{{
                    angka(props.transaksi.total)
                }}</span>
            </div>
            <div class="row">
                <span>Metode</span><span class="spacer" /><span>{{
                    metode(props.transaksi)
                }}</span>
            </div>
            <template v-if="props.transaksi.payment?.metode === 'tunai'">
                <div class="row">
                    <span>Dibayar</span><span class="spacer" /><span
                        class="num"
                        >{{ angka(props.transaksi.payment.jumlah_bayar) }}</span
                    >
                </div>
                <div class="row">
                    <span>Kembalian</span><span class="spacer" /><span
                        class="num"
                        >{{ angka(props.transaksi.payment.kembalian) }}</span
                    >
                </div>
            </template>
        </div>

        <p class="struk-kaki caption">Terima kasih atas kunjungan Anda.</p>
    </div>
</template>

<style scoped>
.struk {
    font: var(--text-small);
}

.struk-kepala {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
    padding-bottom: var(--space-3);
    border-bottom: 1px dashed var(--divider);
}

.tanda-ulang {
    margin-top: var(--space-2);
    padding: 2px var(--space-2);
    border: 1px solid currentColor;
    border-radius: var(--radius-xs);
    font: var(--text-caption);
    letter-spacing: 0.06em;
}

.struk-item {
    width: 100%;
    margin: var(--space-3) 0;
}

.struk-item td {
    padding: var(--space-1) 0;
    vertical-align: top;
}

.struk-total {
    padding-top: var(--space-3);
    border-top: 1px dashed var(--divider);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.total-baris {
    font: var(--text-body-strong);
    padding-top: var(--space-2);
}

.struk-kaki {
    margin-top: var(--space-4);
    text-align: center;
}
</style>
