<script setup lang="ts">
import { ImageUp, Trash2 } from '@lucide/vue';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ambil, ApiError, hapus, perbarui, simpan } from '../api/client';
import type { Pengaturan, Transaction } from '../api/types';
import { persen, rupiah } from '../composables/format';
import { terapkanPengaturan } from '../stores/toko';
import { toast } from '../stores/toast';
import BaseModal from '../components/BaseModal.vue';
import BaseSwitch from '../components/BaseSwitch.vue';
import FieldForm from '../components/FieldForm.vue';
import InputAngka from '../components/InputAngka.vue';
import InputPersen from '../components/InputPersen.vue';
import MerekToko from '../components/MerekToko.vue';
import StrukCetak from '../components/StrukCetak.vue';

/**
 * Pengaturan Toko: satu halaman untuk semua yang dapat diatur admin --
 * identitas & logo, kontak, legalitas, struk, pajak & diskon, dan pembayaran
 * non-tunai. Rancangannya menggabungkan halaman Profil Toko dan Pajak & Diskon
 * pada prototipe (`docs/pages/profil-toko.html`, `pajak-diskon.html`).
 *
 * Tarif ditampilkan dalam PERSEN tetapi dikirim sebagai PECAHAN (11 → 0.11),
 * sama seperti cara server menyimpannya.
 */

interface FormPengaturan {
    nama_toko: string;
    slogan: string;
    alamat: string;
    telepon: string;
    email: string;
    npwp: string;
    nib: string;
    jam_buka: string;
    jam_tutup: string;
    struk_footer_1: string;
    struk_footer_2: string;
    struk_tampilkan_logo: boolean;
    pkp: boolean;
    tarif_pajak: number | null;
    tarif_diskon_member: number | null;
    tarif_mdr: number | null;
    batas_bayar_menit: number | null;
}

/** Batas panjang, sama dengan PengaturanRequest di server. */
const MAKS = {
    nama_toko: 32,
    slogan: 40,
    alamat: 64,
    struk_footer: 48,
} as const;

const keSeratus = (pecahan: number) => Math.round(pecahan * 10_000) / 100;
const kePecahan = (persenan: number) => Math.round(persenan * 100) / 10_000;

function dariServer(p: Pengaturan): FormPengaturan {
    return {
        nama_toko: p.nama_toko,
        slogan: p.slogan ?? '',
        alamat: p.alamat,
        telepon: p.telepon,
        email: p.email ?? '',
        npwp: p.npwp ?? '',
        nib: p.nib ?? '',
        jam_buka: p.jam_buka,
        jam_tutup: p.jam_tutup,
        struk_footer_1: p.struk_footer_1 ?? '',
        struk_footer_2: p.struk_footer_2 ?? '',
        struk_tampilkan_logo: p.struk_tampilkan_logo,
        pkp: p.pkp,
        tarif_pajak: keSeratus(p.tarif_pajak),
        tarif_diskon_member: keSeratus(p.tarif_diskon_member),
        tarif_mdr: keSeratus(p.tarif_mdr),
        batas_bayar_menit: p.batas_bayar_menit,
    };
}

const form = ref<FormPengaturan | null>(null);
const logoUrl = ref<string | null>(null);

/* Potret isian saat dimuat, untuk mendeteksi perubahan yang belum disimpan.
   Logo tidak ikut: logo langsung tersimpan begitu diunggah. */
const awal = ref('');
const kotor = computed(
    () => form.value !== null && JSON.stringify(form.value) !== awal.value,
);

const memuat = ref(true);
const galatMuat = ref<string | null>(null);
const mengirim = ref(false);
const galatServer = ref<Record<string, string>>({});

/* Galat baru tampil setelah isian disentuh atau tombol simpan ditekan. */
const dicoba = ref(false);
const disentuh = ref(new Set<string>());
const sentuh = (field: string) => disentuh.value.add(field);

/* --------------------------------------------------- validasi sisi klien */

/* Aturannya sama dengan PengaturanRequest; ini hanya untuk umpan balik cepat.
   Urutannya mengikuti urutan isian di layar. */
const galatLokal = computed(() => {
    const f = form.value;
    const e: Record<string, string> = {};
    if (!f) return e;

    const digit = (t: string) => t.replace(/\D/g, '').length;

    if (f.nama_toko.trim() === '') e.nama_toko = 'Nama toko wajib diisi.';
    else if (f.nama_toko.length > MAKS.nama_toko)
        e.nama_toko = `Nama toko paling panjang ${MAKS.nama_toko} karakter.`;
    if (f.slogan.length > MAKS.slogan)
        e.slogan = `Slogan paling panjang ${MAKS.slogan} karakter.`;

    if (f.alamat.trim() === '') e.alamat = 'Alamat toko wajib diisi.';
    else if (f.alamat.length > MAKS.alamat)
        e.alamat = `Alamat paling panjang ${MAKS.alamat} karakter.`;
    if (f.telepon.trim() === '') e.telepon = 'Nomor telepon wajib diisi.';
    else if (!/^[0-9+()\-\s]{6,20}$/.test(f.telepon.trim()))
        e.telepon =
            'Nomor telepon hanya boleh berisi angka, spasi, tanda +, -, dan kurung.';
    if (f.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))
        e.email = 'Format email tidak valid.';
    if (f.jam_buka === '') e.jam_buka = 'Jam buka wajib diisi.';
    if (f.jam_tutup === '') e.jam_tutup = 'Jam tutup wajib diisi.';
    else if (f.jam_tutup === f.jam_buka)
        e.jam_tutup = 'Jam tutup tidak boleh sama dengan jam buka.';

    if (
        f.npwp.trim() !== '' &&
        (!/^[\d.\-\s]+$/.test(f.npwp) || ![15, 16].includes(digit(f.npwp)))
    )
        e.npwp = 'NPWP harus terdiri dari 15 atau 16 digit.';
    if (f.nib.trim() !== '' && !/^\d{13}$/.test(f.nib.trim()))
        e.nib = 'NIB harus terdiri dari tepat 13 digit.';

    if (f.struk_footer_1.length > MAKS.struk_footer)
        e.struk_footer_1 = `Paling panjang ${MAKS.struk_footer} karakter.`;
    if (f.struk_footer_2.length > MAKS.struk_footer)
        e.struk_footer_2 = `Paling panjang ${MAKS.struk_footer} karakter.`;

    if (f.tarif_pajak === null) e.tarif_pajak = 'Tarif PPN wajib diisi.';
    else if (f.tarif_pajak < 0 || f.tarif_pajak > 20)
        e.tarif_pajak = 'Tarif PPN harus di antara 0% dan 20%.';
    if (f.tarif_diskon_member === null)
        e.tarif_diskon_member = 'Diskon member wajib diisi.';
    else if (f.tarif_diskon_member < 0 || f.tarif_diskon_member > 30)
        e.tarif_diskon_member = 'Diskon member harus di antara 0% dan 30%.';

    if (f.tarif_mdr === null) e.tarif_mdr = 'Tarif MDR wajib diisi.';
    else if (f.tarif_mdr < 0 || f.tarif_mdr > 5)
        e.tarif_mdr = 'Tarif MDR harus di antara 0% dan 5%.';
    if (f.batas_bayar_menit === null)
        e.batas_bayar_menit = 'Batas waktu bayar wajib diisi.';
    else if (f.batas_bayar_menit < 5 || f.batas_bayar_menit > 1440)
        e.batas_bayar_menit =
            'Batas waktu bayar harus di antara 5 dan 1.440 menit.';

    return e;
});

function pesanGalat(field: string): string | undefined {
    if (galatServer.value[field]) return galatServer.value[field];
    if (dicoba.value || disentuh.value.has(field))
        return galatLokal.value[field];
    return undefined;
}

/** Penghitung karakter sebagai teks bantuan, seperti pada prototipe. */
const hitung = (teks: string, maks: number) => `${teks.length}/${maks}`;

async function fokusGalatPertama(daftar: string[]) {
    await nextTick();
    const pertama = daftar.find((f) => document.getElementById(`isian-${f}`));
    if (pertama) document.getElementById(`isian-${pertama}`)?.focus();
}

/* ------------------------------------------------------------ simpan */

let tersimpan = false;

async function kirim() {
    const f = form.value;
    if (!f || mengirim.value) return;

    dicoba.value = true;
    galatServer.value = {};

    const kunciGalat = Object.keys(galatLokal.value);
    if (kunciGalat.length > 0) {
        toast.peringatan('Periksa kembali isian yang ditandai.');
        await fokusGalatPertama(kunciGalat);
        return;
    }

    mengirim.value = true;
    try {
        const r = await perbarui<Pengaturan>('/pengaturan', {
            nama_toko: f.nama_toko.trim(),
            slogan: f.slogan.trim() || null,
            alamat: f.alamat.trim(),
            telepon: f.telepon.trim(),
            email: f.email.trim() || null,
            npwp: f.npwp.trim() || null,
            nib: f.nib.trim() || null,
            jam_buka: f.jam_buka,
            jam_tutup: f.jam_tutup,
            struk_footer_1: f.struk_footer_1.trim() || null,
            struk_footer_2: f.struk_footer_2.trim() || null,
            struk_tampilkan_logo: f.struk_tampilkan_logo,
            pkp: f.pkp,
            tarif_pajak: kePecahan(f.tarif_pajak ?? 0),
            tarif_diskon_member: kePecahan(f.tarif_diskon_member ?? 0),
            tarif_mdr: kePecahan(f.tarif_mdr ?? 0),
            batas_bayar_menit: f.batas_bayar_menit,
        });

        // Sidebar, judul tab, dan tarif Kasir langsung ikut berubah.
        terapkanPengaturan(r.data);
        form.value = dariServer(r.data);
        awal.value = JSON.stringify(form.value);
        dicoba.value = false;
        disentuh.value.clear();
        toast.sukses('Pengaturan toko disimpan.');
    } catch (e) {
        if (e instanceof ApiError) {
            galatServer.value = Object.fromEntries(
                Object.entries(e.errors).map(([k, v]) => [k, v[0]]),
            );
            toast.galat(e.message);
            await fokusGalatPertama(Object.keys(galatServer.value));
        } else {
            toast.galat('Gagal menyimpan pengaturan.');
        }
    } finally {
        mengirim.value = false;
    }
}

async function muat() {
    memuat.value = true;
    galatMuat.value = null;
    try {
        const p = await ambil<Pengaturan>('/pengaturan');
        form.value = dariServer(p);
        logoUrl.value = p.logo_url;
        awal.value = JSON.stringify(form.value);
    } catch (e) {
        galatMuat.value =
            e instanceof ApiError ? e.message : 'Gagal memuat pengaturan.';
    } finally {
        memuat.value = false;
    }
}

/* -------------------------------------------------------------- logo */

const pemilihLogo = ref<HTMLInputElement | null>(null);
const mengunggah = ref(false);
const galatLogo = ref<string | null>(null);

const JENIS_LOGO = ['image/png', 'image/jpeg', 'image/webp'];

async function pilihLogo(e: Event) {
    const input = e.target as HTMLInputElement;
    const berkas = input.files?.[0];
    input.value = ''; // supaya berkas yang sama dapat dipilih lagi
    if (!berkas) return;

    galatLogo.value = null;
    if (!JENIS_LOGO.includes(berkas.type)) {
        galatLogo.value = 'Logo harus berupa gambar PNG, JPG, atau WebP.';
        return;
    }
    if (berkas.size > 1024 * 1024) {
        galatLogo.value = 'Ukuran logo paling besar 1 MB.';
        return;
    }

    const data = new FormData();
    data.append('logo', berkas);

    mengunggah.value = true;
    try {
        const r = await simpan<Pengaturan>('/pengaturan/logo', data);
        logoUrl.value = r.data.logo_url;
        terapkanPengaturan(r.data);
        toast.sukses('Logo toko diperbarui.');
    } catch (err) {
        galatLogo.value =
            err instanceof ApiError
                ? (err.field('logo') ?? err.message)
                : 'Gagal mengunggah logo.';
    } finally {
        mengunggah.value = false;
    }
}

const konfirmasiHapusLogo = ref(false);

async function hapusLogo() {
    mengunggah.value = true;
    try {
        const r = await hapus<Pengaturan>('/pengaturan/logo');
        logoUrl.value = null;
        terapkanPengaturan(r.data);
        toast.sukses('Logo toko dihapus.');
    } catch (err) {
        toast.galat(
            err instanceof ApiError ? err.message : 'Gagal menghapus logo.',
        );
    } finally {
        mengunggah.value = false;
        konfirmasiHapusLogo.value = false;
    }
}

/* ------------------------------------------------------ pratinjau struk */

const contohMember = ref(true);

/* Keranjang contoh, dihitung dengan tarif di formulir memakai rumus yang
   sama dengan PricingService: diskon dulu, baru PPN di atas DPP. */
const contohStruk = computed<Transaction>(() => {
    const f = form.value;
    const barang = [
        { nama: 'Beras Premium 5 kg', qty: 1, harga: 72_000 },
        { nama: 'Minyak Goreng 2 L', qty: 2, harga: 38_500 },
        { nama: 'Gula Pasir 1 kg', qty: 1, harga: 17_500 },
    ];
    const subtotal = barang.reduce((s, b) => s + b.qty * b.harga, 0);
    const diskon = contohMember.value
        ? Math.round((subtotal * (f?.tarif_diskon_member ?? 0)) / 100)
        : 0;
    const tarifPajak = f?.pkp ? (f.tarif_pajak ?? 0) : 0;
    const pajak = Math.round(((subtotal - diskon) * tarifPajak) / 100);
    const total = subtotal - diskon + pajak;

    return {
        id: 0,
        no_struk: 'TRX-CONTOH-0001',
        tanggal: new Date().toISOString(),
        status: 'settlement',
        subtotal,
        diskon,
        pajak,
        total,
        catatan: null,
        customer: contohMember.value
            ? { id: 0, nama: 'Pelanggan Member', no_hp: null, poin_loyalti: 0 }
            : null,
        items: barang.map((b, i) => ({
            id: i,
            product_id: i,
            nama_produk: b.nama,
            qty: b.qty,
            harga_satuan: b.harga,
            harga_beli: 0,
            subtotal: b.qty * b.harga,
        })),
        payment: {
            id: 0,
            metode: 'tunai',
            order_id: null,
            payment_type: null,
            transaction_status: null,
            snap_kedaluwarsa: null,
            jumlah_bayar: Math.ceil(total / 50_000) * 50_000,
            kembalian: Math.ceil(total / 50_000) * 50_000 - total,
            waktu_settlement: null,
        },
    };
});

const identitasPratinjau = computed(() => {
    const f = form.value;
    return {
        nama_toko: f?.nama_toko || '(nama toko)',
        slogan: f?.slogan || null,
        alamat: f?.alamat ?? '',
        telepon: f?.telepon ?? '',
        npwp: f?.npwp || null,
        logo_url: logoUrl.value,
        struk_tampilkan_logo: f?.struk_tampilkan_logo ?? true,
        struk_footer_1: f?.struk_footer_1 || null,
        struk_footer_2: f?.struk_footer_2 || null,
    };
});

/* Contoh biaya MDR, supaya angka persen terasa nyata bagi pemilik toko. */
const contohMdr = computed(() =>
    Math.round((100_000 * (form.value?.tarif_mdr ?? 0)) / 100),
);

/* ---------------------------------------------- perubahan belum disimpan */

const jawabTinggalkan = ref<((ya: boolean) => void) | null>(null);

onBeforeRouteLeave(() => {
    if (tersimpan || !kotor.value) return true;
    return new Promise<boolean>((selesai) => {
        jawabTinggalkan.value = selesai;
    });
});

function jawab(ya: boolean) {
    if (ya) tersimpan = true;
    jawabTinggalkan.value?.(ya);
    jawabTinggalkan.value = null;
}

function sebelumTutup(e: BeforeUnloadEvent) {
    if (kotor.value) e.preventDefault();
}

/* Ctrl/⌘ + S menyimpan, seperti formulir lain. */
function pintasan(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void kirim();
    }
}

onMounted(() => {
    window.addEventListener('beforeunload', sebelumTutup);
    document.addEventListener('keydown', pintasan);
    void muat();
});

onUnmounted(() => {
    window.removeEventListener('beforeunload', sebelumTutup);
    document.removeEventListener('keydown', pintasan);
});
</script>

<template>
    <div v-if="memuat" class="form-grid" aria-busy="true">
        <div class="stack" style="gap: var(--space-5)">
            <div v-for="k in 3" :key="k" class="card stack">
                <div class="skeleton" style="width: 35%; height: 22px" />
                <div
                    v-for="i in 3"
                    :key="i"
                    class="skeleton"
                    style="height: 48px"
                />
            </div>
        </div>
        <div class="card stack">
            <div class="skeleton" style="width: 55%; height: 18px" />
            <div class="skeleton" style="height: 320px" />
        </div>
    </div>

    <div v-else-if="galatMuat || !form" class="card keadaan-galat">
        <p>{{ galatMuat ?? 'Gagal memuat pengaturan.' }}</p>
        <button class="btn btn-soft" @click="muat">Coba lagi</button>
    </div>

    <form v-else class="form-grid" novalidate @submit.prevent="kirim">
        <div class="stack" style="gap: var(--space-5)">
            <!-- ======================================== identitas & logo -->
            <section class="card stack">
                <div class="kepala-bagian">
                    <h2>Identitas toko</h2>
                    <p class="caption">
                        Tampil di sidebar, halaman masuk, kop laporan, dan
                        kepala struk.
                    </p>
                </div>

                <div class="logo-baris">
                    <MerekToko :ukuran="80" sudut="md" :logo-url="logoUrl" />
                    <div class="stack logo-aksi">
                        <strong>Logo toko</strong>
                        <p class="caption">
                            PNG, JPG, atau WebP, maks. 1 MB. Sebaiknya persegi,
                            minimal 256 × 256 piksel. Tanpa logo, inisial nama
                            toko yang tampil.
                        </p>
                        <div class="row" style="gap: var(--space-2)">
                            <button
                                type="button"
                                class="btn btn-soft"
                                :disabled="mengunggah"
                                :aria-busy="mengunggah"
                                @click="pemilihLogo?.click()"
                            >
                                <ImageUp :size="18" aria-hidden="true" />
                                {{
                                    mengunggah
                                        ? 'Memproses…'
                                        : logoUrl
                                          ? 'Ganti logo'
                                          : 'Unggah logo'
                                }}
                            </button>
                            <button
                                v-if="logoUrl"
                                type="button"
                                class="btn btn-ghost btn-bahaya"
                                :disabled="mengunggah"
                                @click="konfirmasiHapusLogo = true"
                            >
                                <Trash2 :size="18" aria-hidden="true" />
                                Hapus
                            </button>
                        </div>
                        <p v-if="galatLogo" class="field-error" role="alert">
                            {{ galatLogo }}
                        </p>
                        <input
                            ref="pemilihLogo"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            class="sr-only"
                            tabindex="-1"
                            aria-hidden="true"
                            @change="pilihLogo"
                        />
                    </div>
                </div>

                <FieldForm
                    v-slot="{ id: i, invalid, describedby }"
                    label="Nama toko"
                    untuk="isian-nama_toko"
                    wajib
                    :bantuan="hitung(form.nama_toko, MAKS.nama_toko)"
                    :galat="pesanGalat('nama_toko')"
                >
                    <input
                        :id="i"
                        v-model="form.nama_toko"
                        class="input"
                        :class="{ 'is-error': invalid }"
                        :aria-invalid="invalid || undefined"
                        :aria-describedby="describedby"
                        :maxlength="MAKS.nama_toko"
                        placeholder="mis. Toko Sari Amerta"
                        @blur="sentuh('nama_toko')"
                    />
                </FieldForm>

                <FieldForm
                    v-slot="{ id: i, invalid, describedby }"
                    label="Slogan / jenis usaha"
                    untuk="isian-slogan"
                    :bantuan="hitung(form.slogan, MAKS.slogan)"
                    :galat="pesanGalat('slogan')"
                >
                    <input
                        :id="i"
                        v-model="form.slogan"
                        class="input"
                        :class="{ 'is-error': invalid }"
                        :aria-invalid="invalid || undefined"
                        :aria-describedby="describedby"
                        :maxlength="MAKS.slogan"
                        placeholder="mis. Sembako & Kebutuhan Harian"
                        @blur="sentuh('slogan')"
                    />
                </FieldForm>
            </section>

            <!-- ======================================== alamat & kontak -->
            <section class="card stack">
                <div class="kepala-bagian">
                    <h2>Alamat, kontak &amp; jam buka</h2>
                </div>

                <FieldForm
                    v-slot="{ id: i, invalid, describedby }"
                    label="Alamat toko"
                    untuk="isian-alamat"
                    wajib
                    :bantuan="hitung(form.alamat, MAKS.alamat)"
                    :galat="pesanGalat('alamat')"
                >
                    <input
                        :id="i"
                        v-model="form.alamat"
                        class="input"
                        :class="{ 'is-error': invalid }"
                        :aria-invalid="invalid || undefined"
                        :aria-describedby="describedby"
                        :maxlength="MAKS.alamat"
                        autocomplete="street-address"
                        @blur="sentuh('alamat')"
                    />
                </FieldForm>

                <div class="dua-kolom">
                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Telepon"
                        untuk="isian-telepon"
                        wajib
                        :galat="pesanGalat('telepon')"
                    >
                        <input
                            :id="i"
                            v-model="form.telepon"
                            class="input"
                            :class="{ 'is-error': invalid }"
                            :aria-invalid="invalid || undefined"
                            :aria-describedby="describedby"
                            type="tel"
                            maxlength="20"
                            autocomplete="tel"
                            @blur="sentuh('telepon')"
                        />
                    </FieldForm>

                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Email"
                        untuk="isian-email"
                        :galat="pesanGalat('email')"
                    >
                        <input
                            :id="i"
                            v-model="form.email"
                            class="input"
                            :class="{ 'is-error': invalid }"
                            :aria-invalid="invalid || undefined"
                            :aria-describedby="describedby"
                            type="email"
                            maxlength="100"
                            autocomplete="email"
                            @blur="sentuh('email')"
                        />
                    </FieldForm>
                </div>

                <div class="dua-kolom">
                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Jam buka"
                        untuk="isian-jam_buka"
                        wajib
                        :galat="pesanGalat('jam_buka')"
                    >
                        <input
                            :id="i"
                            v-model="form.jam_buka"
                            class="input"
                            :class="{ 'is-error': invalid }"
                            :aria-invalid="invalid || undefined"
                            :aria-describedby="describedby"
                            type="time"
                            @blur="sentuh('jam_buka')"
                        />
                    </FieldForm>

                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Jam tutup"
                        untuk="isian-jam_tutup"
                        wajib
                        :galat="pesanGalat('jam_tutup')"
                    >
                        <input
                            :id="i"
                            v-model="form.jam_tutup"
                            class="input"
                            :class="{ 'is-error': invalid }"
                            :aria-invalid="invalid || undefined"
                            :aria-describedby="describedby"
                            type="time"
                            @blur="sentuh('jam_tutup')"
                        />
                    </FieldForm>
                </div>
            </section>

            <!-- ================================================ legalitas -->
            <section class="card stack">
                <div class="kepala-bagian">
                    <h2>Legalitas</h2>
                    <p class="caption">
                        NPWP tercetak di struk bila diisi. Keduanya boleh
                        dikosongkan.
                    </p>
                </div>

                <div class="dua-kolom">
                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="NPWP"
                        untuk="isian-npwp"
                        bantuan="15 atau 16 digit; titik dan tanda hubung boleh."
                        :galat="pesanGalat('npwp')"
                    >
                        <input
                            :id="i"
                            v-model="form.npwp"
                            class="input input-mono"
                            :class="{ 'is-error': invalid }"
                            :aria-invalid="invalid || undefined"
                            :aria-describedby="describedby"
                            inputmode="numeric"
                            maxlength="20"
                            placeholder="08.214.590.2-905.000"
                            @blur="sentuh('npwp')"
                        />
                    </FieldForm>

                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="NIB (Nomor Induk Berusaha)"
                        untuk="isian-nib"
                        bantuan="13 digit."
                        :galat="pesanGalat('nib')"
                    >
                        <input
                            :id="i"
                            v-model="form.nib"
                            class="input input-mono"
                            :class="{ 'is-error': invalid }"
                            :aria-invalid="invalid || undefined"
                            :aria-describedby="describedby"
                            inputmode="numeric"
                            maxlength="13"
                            @blur="sentuh('nib')"
                        />
                    </FieldForm>
                </div>
            </section>

            <!-- ==================================================== struk -->
            <section class="card stack">
                <div class="kepala-bagian">
                    <h2>Struk</h2>
                    <p class="caption">
                        Kaki struk tampil di bawah setiap struk. Baris yang
                        kosong tidak dicetak.
                    </p>
                </div>

                <BaseSwitch v-model="form.struk_tampilkan_logo">
                    Cetak logo di kepala struk
                </BaseSwitch>

                <FieldForm
                    v-slot="{ id: i, invalid, describedby }"
                    label="Kaki struk — baris 1"
                    untuk="isian-struk_footer_1"
                    :bantuan="hitung(form.struk_footer_1, MAKS.struk_footer)"
                    :galat="pesanGalat('struk_footer_1')"
                >
                    <input
                        :id="i"
                        v-model="form.struk_footer_1"
                        class="input"
                        :class="{ 'is-error': invalid }"
                        :aria-invalid="invalid || undefined"
                        :aria-describedby="describedby"
                        :maxlength="MAKS.struk_footer"
                        @blur="sentuh('struk_footer_1')"
                    />
                </FieldForm>

                <FieldForm
                    v-slot="{ id: i, invalid, describedby }"
                    label="Kaki struk — baris 2"
                    untuk="isian-struk_footer_2"
                    :bantuan="hitung(form.struk_footer_2, MAKS.struk_footer)"
                    :galat="pesanGalat('struk_footer_2')"
                >
                    <input
                        :id="i"
                        v-model="form.struk_footer_2"
                        class="input"
                        :class="{ 'is-error': invalid }"
                        :aria-invalid="invalid || undefined"
                        :aria-describedby="describedby"
                        :maxlength="MAKS.struk_footer"
                        @blur="sentuh('struk_footer_2')"
                    />
                </FieldForm>
            </section>

            <!-- =========================================== pajak & diskon -->
            <section class="card stack">
                <div class="kepala-bagian">
                    <h2>Pajak &amp; diskon</h2>
                    <p class="caption">
                        Berlaku untuk transaksi BARU. Struk dan laporan yang
                        sudah ada tidak berubah, karena nominal pajak dan diskon
                        disimpan pada setiap transaksi.
                    </p>
                </div>

                <BaseSwitch v-model="form.pkp">
                    Toko berstatus PKP — kenakan PPN pada setiap transaksi
                </BaseSwitch>

                <div class="dua-kolom">
                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Tarif PPN"
                        untuk="isian-tarif_pajak"
                        wajib
                        :bantuan="
                            form.pkp
                                ? 'Dikenakan setelah diskon: (subtotal − diskon) × PPN. 0–20%.'
                                : 'Tidak dikenakan selama toko bukan PKP.'
                        "
                        :galat="pesanGalat('tarif_pajak')"
                    >
                        <InputPersen
                            :id="i"
                            v-model="form.tarif_pajak"
                            :disabled="!form.pkp"
                            :invalid="invalid"
                            :aria-describedby="describedby"
                            @blur="sentuh('tarif_pajak')"
                        />
                    </FieldForm>

                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Diskon member"
                        untuk="isian-tarif_diskon_member"
                        wajib
                        bantuan="Dipotong otomatis saat kasir memilih pelanggan terdaftar. 0–30%."
                        :galat="pesanGalat('tarif_diskon_member')"
                    >
                        <InputPersen
                            :id="i"
                            v-model="form.tarif_diskon_member"
                            :invalid="invalid"
                            :aria-describedby="describedby"
                            @blur="sentuh('tarif_diskon_member')"
                        />
                    </FieldForm>
                </div>
            </section>

            <!-- ================================== pembayaran non-tunai -->
            <section class="card stack">
                <div class="kepala-bagian">
                    <h2>Pembayaran non-tunai</h2>
                    <p class="caption">
                        Kredensial Midtrans diatur di berkas
                        <code>.env</code> server, lihat
                        <RouterLink :to="{ name: 'metode-pembayaran' }"
                            >Metode Pembayaran</RouterLink
                        >.
                    </p>
                </div>

                <div class="dua-kolom">
                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Tarif MDR"
                        untuk="isian-tarif_mdr"
                        wajib
                        :bantuan="`Potongan penyedia pembayaran, dicatat sebagai beban di Laporan Laba Rugi. Contoh: ${rupiah(contohMdr)} per Rp100.000.`"
                        :galat="pesanGalat('tarif_mdr')"
                    >
                        <InputPersen
                            :id="i"
                            v-model="form.tarif_mdr"
                            :desimal="3"
                            :invalid="invalid"
                            :aria-describedby="describedby"
                            @blur="sentuh('tarif_mdr')"
                        />
                    </FieldForm>

                    <FieldForm
                        v-slot="{ id: i, invalid, describedby }"
                        label="Batas waktu bayar"
                        untuk="isian-batas_bayar_menit"
                        wajib
                        bantuan="Setelah ini tagihan QRIS / VA kedaluwarsa. Pendek lebih baik karena pelanggan menunggu di kasir."
                        :galat="pesanGalat('batas_bayar_menit')"
                    >
                        <InputAngka
                            :id="i"
                            v-model="form.batas_bayar_menit"
                            akhiran="menit"
                            :langkah="5"
                            :invalid="invalid"
                            :aria-describedby="describedby"
                            @blur="sentuh('batas_bayar_menit')"
                        />
                    </FieldForm>
                </div>
            </section>
        </div>

        <!-- ============================================ samping: pratinjau -->
        <aside class="stack samping">
            <div class="card stack">
                <div class="row">
                    <h3>Pratinjau struk</h3>
                    <span class="spacer" />
                    <span v-if="kotor" class="badge badge-warning"
                        >Belum disimpan</span
                    >
                </div>
                <div class="kertas">
                    <StrukCetak
                        :transaksi="contohStruk"
                        :identitas="identitasPratinjau"
                    />
                </div>
                <BaseSwitch v-model="contohMember">
                    Contoh pelanggan member
                </BaseSwitch>
                <p class="caption">
                    Tarif berlaku: PPN
                    {{ form.pkp ? persen(form.tarif_pajak) : '0%' }} · diskon
                    member {{ persen(form.tarif_diskon_member) }}
                </p>
            </div>

            <div class="card stack">
                <button
                    class="btn btn-primary btn-block"
                    type="submit"
                    :disabled="mengirim"
                    :aria-busy="mengirim"
                >
                    {{ mengirim ? 'Menyimpan…' : 'Simpan Pengaturan' }}
                </button>
                <p class="caption pintasan">
                    <kbd>Ctrl</kbd> + <kbd>S</kbd> untuk menyimpan
                </p>
            </div>
        </aside>
    </form>

    <BaseModal
        v-if="jawabTinggalkan"
        judul="Tinggalkan pengaturan?"
        deskripsi="Perubahan pengaturan toko belum disimpan dan akan hilang."
        @tutup="jawab(false)"
    >
        <template #aksi>
            <button class="btn btn-soft" @click="jawab(false)">
                Kembali ke pengaturan
            </button>
            <button class="btn btn-danger" @click="jawab(true)">
                Buang perubahan
            </button>
        </template>
    </BaseModal>

    <BaseModal
        v-if="konfirmasiHapusLogo"
        judul="Hapus logo toko?"
        deskripsi="Inisial nama toko akan tampil sebagai gantinya di sidebar, halaman masuk, dan struk."
        :terkunci="mengunggah"
        @tutup="konfirmasiHapusLogo = false"
    >
        <template #aksi>
            <button
                class="btn btn-soft"
                :disabled="mengunggah"
                @click="konfirmasiHapusLogo = false"
            >
                Batal
            </button>
            <button
                class="btn btn-danger"
                :disabled="mengunggah"
                @click="hapusLogo"
            >
                Hapus logo
            </button>
        </template>
    </BaseModal>
</template>

<style scoped>
.form-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-5);
    align-items: start;
}

.samping {
    position: sticky;
    top: calc(var(--topbar-h) + var(--space-4));
}

.dua-kolom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
}

.kepala-bagian {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.logo-baris {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
}

.logo-aksi {
    gap: var(--space-2);
    min-width: 0;
}

.input-mono {
    font: var(--text-numeric);
}

/* Kertas struk: lebar mendekati thermal 58 mm, latar putih. */
.kertas {
    max-width: 300px;
    width: 100%;
    margin-inline: auto;
    padding: var(--space-4);
    background: #fff;
    border-radius: var(--radius-sm);
    box-shadow: 0 0 0 1px var(--divider);
    color: var(--text-primary);
}

.btn-bahaya {
    color: var(--danger-text);
}

.keadaan-galat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    color: var(--danger-text);
}

.pintasan {
    text-align: center;
}

kbd {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--surface-base);
    box-shadow: var(--shadow-inset-sm);
    font: var(--text-caption);
}

/* Runtuh jadi satu kolom di bawah 1024px: pratinjau pindah ke bawah. */
@media (max-width: 1023px) {
    .form-grid {
        grid-template-columns: 1fr;
    }

    .samping {
        position: static;
    }
}

@media (max-width: 767px) {
    .dua-kolom {
        grid-template-columns: 1fr;
    }

    .logo-baris {
        flex-direction: column;
    }
}
</style>
