<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ambil } from '../api/client';
import type { MidtransConfig } from '../api/types';
import KeadaanData from '../components/KeadaanData.vue';

const cfg = ref<MidtransConfig | null>(null);
const memuat = ref(true);

onMounted(async () => {
    cfg.value = await ambil<MidtransConfig>('/midtrans/config');
    memuat.value = false;
});
</script>

<template>
    <KeadaanData :memuat="memuat" :baris-skeleton="3">
        <div
            v-if="cfg"
            class="stack"
            style="gap: var(--space-5); max-width: 680px"
        >
            <div class="card stack">
                <h2>Tunai</h2>
                <span class="badge badge-success" style="align-self: flex-start"
                    >Selalu aktif</span
                >
                <p class="caption">
                    Pembayaran tunai langsung lunas dan stok berkurang seketika.
                </p>
            </div>

            <div class="card stack">
                <h2>Non-Tunai — Midtrans Snap</h2>
                <span
                    class="badge"
                    :class="cfg.siap ? 'badge-success' : 'badge-warning'"
                    style="align-self: flex-start"
                >
                    {{ cfg.siap ? 'Aktif' : 'Belum dikonfigurasi' }}
                </span>

                <dl class="info">
                    <dt>Mode</dt>
                    <dd>{{ cfg.is_production ? 'Production' : 'Sandbox' }}</dd>
                    <dt>Client Key</dt>
                    <dd>{{ cfg.client_key || '(belum diisi)' }}</dd>
                </dl>

                <p class="caption">
                    Server Key sengaja tidak pernah ditampilkan di sini maupun
                    dikirim ke browser. Kunci itu hanya hidup di berkas
                    <code>.env</code> pada server.
                </p>

                <div v-if="!cfg.siap" class="catatan">
                    <strong>Pembayaran non-tunai belum aktif.</strong>
                    <p>
                        Isi <code>MIDTRANS_SERVER_KEY</code>,
                        <code>MIDTRANS_CLIENT_KEY</code>, dan
                        <code>MIDTRANS_MERCHANT_ID</code> pada berkas
                        <code>.env</code>, lalu jalankan
                        <code>php artisan config:clear</code>. Panduannya ada di
                        <code>docs/DEPLOYMENT.md</code>.
                    </p>
                    <p>
                        Selama belum diisi, tombol Non-Tunai tetap menyimpan
                        transaksi sebagai menunggu pembayaran dan tidak
                        mengurangi stok.
                    </p>
                </div>
            </div>
        </div>
    </KeadaanData>
</template>

<style scoped>
.info {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: var(--space-2) var(--space-4);
    font: var(--text-small);
}

.info dt {
    color: var(--text-muted);
}

.catatan {
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--warning-bg);
    color: var(--warning-text);
    font: var(--text-small);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}
</style>
