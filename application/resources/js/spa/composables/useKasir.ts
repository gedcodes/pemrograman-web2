import { watchDebounced } from '@vueuse/core';
import {
    computed,
    inject,
    provide,
    reactive,
    ref,
    watch,
    type InjectionKey,
    type Reactive,
} from 'vue';
import { ambil, ambilPenuh, ApiError, simpan } from '../api/client';
import { bayarDenganSnap, periksaStatus, snapSiap } from '../api/snap';
import type {
    BarisKeranjang,
    Category,
    Customer,
    Product,
    Shift,
    StatusTransaksi,
    Transaction,
} from '../api/types';
import { tarifDiskonMember, tarifPajakBerlaku } from '../stores/toko';
import { kunciTanggal, persen, statusTransaksi } from './format';
import { keOpsi, type OpsiPilihan } from './pilihan';
import { bunyiBerhasil, bunyiGagal } from './useBunyi';

/**
 * Cara komponen menampilkan pesan kepada kasir (toast, di halaman ini).
 *
 * Komposabel ini tidak mengimpor komponen UI apa pun; pemberitahuan
 * dititipkan oleh halaman yang memakainya.
 */
export interface Pemberitahu {
    sukses: (pesan: string) => void;
    galat: (pesan: string) => void;
    info: (pesan: string) => void;
    peringatan: (pesan: string) => void;
}

/**
 * Seluruh logika halaman Kasir, dipakai bersama oleh mode desktop dan mode
 * tablet. Tampilannya boleh berbeda, aturan berjualannya tidak: shift,
 * keranjang, total, pembayaran tunai dan non-tunai, tagihan yang dibuka lagi,
 * serta struk berasal dari satu tempat ini, sehingga kedua mode tidak
 * lambat laun menyimpang.
 */
function buatKasir(beritahu: Pemberitahu) {
    /* -------------------------------------------------------------- shift */

    const shift = ref<Shift | null>(null);
    const memuatShift = ref(true);
    const modalAwal = ref<number | null>(300000);
    const membukaShift = ref(false);

    async function muatShift() {
        try {
            shift.value = await ambil<Shift | null>('/shifts/aktif');
        } finally {
            memuatShift.value = false;
        }
    }

    async function bukaShift() {
        if (membukaShift.value) return;
        if (modalAwal.value === null) {
            beritahu.peringatan('Isi modal awal laci kas, boleh 0.');
            return;
        }
        membukaShift.value = true;
        try {
            const r = await simpan<Shift>('/shifts/open', {
                modal_awal: modalAwal.value,
            });
            shift.value = r.data;
            beritahu.sukses('Shift dibuka.');
        } catch (e) {
            beritahu.galat(
                e instanceof ApiError ? e.message : 'Gagal membuka shift.',
            );
        } finally {
            membukaShift.value = false;
        }
    }

    /* -------------------------------------------------------- tutup shift */

    const modalTutupShift = ref(false);
    const memuatRingkasan = ref(false);
    const kasAkhir = ref<number | null>(null);
    const catatanTutup = ref('');
    const menutupShift = ref(false);
    /** Rekap shift yang baru ditutup, ditampilkan sebelum kembali ke gerbang. */
    const rekapTutup = ref<Shift | null>(null);

    /** Kas akhir − kas seharusnya, dihitung langsung selagi kasir mengetik. */
    const selisihKas = computed(() => {
        const seharusnya = shift.value?.ringkasan?.kas_seharusnya;
        if (kasAkhir.value === null || seharusnya === undefined) return null;
        return kasAkhir.value - seharusnya;
    });

    async function bukaTutupShift() {
        kasAkhir.value = null;
        catatanTutup.value = '';
        rekapTutup.value = null;
        modalTutupShift.value = true;

        // Ringkasan diambil ulang: penjualan terakhir harus ikut terhitung.
        memuatRingkasan.value = true;
        try {
            shift.value = await ambil<Shift | null>('/shifts/aktif');
        } catch (e) {
            beritahu.galat(
                e instanceof ApiError
                    ? e.message
                    : 'Gagal memuat ringkasan shift.',
            );
        } finally {
            memuatRingkasan.value = false;
        }
    }

    async function tutupShift() {
        if (menutupShift.value) return;
        if (kasAkhir.value === null) {
            beritahu.peringatan('Isi jumlah uang yang ada di laci, boleh 0.');
            return;
        }
        if (keranjang.value.length > 0) {
            beritahu.peringatan(
                'Keranjang masih berisi barang. Selesaikan atau kosongkan dahulu.',
            );
            return;
        }

        menutupShift.value = true;
        try {
            const r = await simpan<Shift>('/shifts/close', {
                kas_akhir: kasAkhir.value,
                catatan: catatanTutup.value.trim() || null,
            });
            rekapTutup.value = r.data;
            beritahu.sukses(r.message ?? 'Shift ditutup.');
        } catch (e) {
            beritahu.galat(
                e instanceof ApiError ? e.message : 'Gagal menutup shift.',
            );
        } finally {
            menutupShift.value = false;
        }
    }

    /** Selesai membaca rekap: kembali ke gerbang "Buka shift". */
    function selesaiTutupShift() {
        modalTutupShift.value = false;
        rekapTutup.value = null;
        shift.value = null;
        menunggu.value = [];
    }

    /* ------------------------------------------------------------- produk */

    const produk = ref<Product[]>([]);
    const cari = ref('');
    const memuatProduk = ref(true);

    const kategori = ref<Category[]>([]);
    const memuatKategori = ref(true);
    /** Penyaring kategori (tab kategori di mode tablet). */
    const kategoriAktif = ref<number | null>(null);

    /* Nomor urut permintaan: hasil pencarian lama yang tiba belakangan
       dibuang, supaya grid tidak menampilkan hasil ketikan sebelumnya. */
    let urutCari = 0;

    async function muatProduk() {
        const ke = ++urutCari;
        memuatProduk.value = true;
        try {
            const hasil = await ambil<Product[]>('/products', {
                per_page: 100,
                aktif: 1,
                q: cari.value || undefined,
                category_id: kategoriAktif.value ?? undefined,
            });
            if (ke === urutCari) produk.value = hasil;
        } catch (e) {
            if (ke === urutCari)
                beritahu.galat(
                    e instanceof ApiError ? e.message : 'Gagal memuat produk.',
                );
        } finally {
            if (ke === urutCari) memuatProduk.value = false;
        }
    }

    async function muatKategori() {
        try {
            kategori.value = (
                await ambilPenuh<Category[]>('/categories', { per_page: 100 })
            ).data;
        } catch {
            // Tanpa kategori, tab hanya berisi "Semua".
        } finally {
            memuatKategori.value = false;
        }
    }

    /* Mengetik nama produk menunggu jeda singkat sebelum mencari; pemindaian
       barcode (diakhiri Enter) langsung ditangani `padaEnter`. */
    watchDebounced(cari, () => void muatProduk(), { debounce: 250 });
    watch(kategoriAktif, () => void muatProduk());

    /**
     * Pemindaian barcode.
     *
     * Pemindai barcode berperilaku seperti papan ketik lalu menekan Enter,
     * jadi Enter pada kotak cari diperlakukan sebagai hasil pindaian: cari
     * persis dulu lewat endpoint barcode, baru jatuh ke pencarian biasa.
     */
    async function padaEnter() {
        const kode = cari.value.trim();
        if (kode === '') return;

        let hasil: Product | null = null;
        try {
            hasil = await ambil<Product>(
                `/products/barcode/${encodeURIComponent(kode)}`,
            );
        } catch {
            // Bukan barcode yang dikenal: coba sebagai kata pencarian.
            await muatProduk();
            if (produk.value.length === 1) hasil = produk.value[0];
        }

        if (hasil !== null) {
            if (tambah(hasil)) {
                beriTandaPindai('berhasil');
                cari.value = '';
            } else {
                beriTandaPindai('gagal');
            }
            return;
        }

        if (produk.value.length === 0) {
            beriTandaPindai('gagal');
            beritahu.peringatan(`Produk "${kode}" tidak ditemukan.`);
        }
    }

    /* ------------------------------------------------ umpan balik pindai */

    /**
     * Tanda sesaat setelah memindai: kotak cari menyala hijau / merah dan
     * baris keranjang yang bertambah berkedip, disertai bunyi bip. Kasir
     * sering memindai tanpa melihat layar, jadi keberhasilan harus terdengar.
     */
    const statusPindai = ref<'berhasil' | 'gagal' | null>(null);
    /** Produk yang baru saja bertambah di keranjang (untuk kilatan baris). */
    const kilatProdukId = ref<number | null>(null);
    let tundaPindai: ReturnType<typeof setTimeout> | undefined;
    let tundaKilat: ReturnType<typeof setTimeout> | undefined;

    function beriTandaPindai(hasil: 'berhasil' | 'gagal') {
        if (hasil === 'berhasil') bunyiBerhasil();
        else bunyiGagal();

        // Dikosongkan dulu supaya animasi berulang pada pindaian beruntun.
        statusPindai.value = null;
        clearTimeout(tundaPindai);
        requestAnimationFrame(() => {
            statusPindai.value = hasil;
            tundaPindai = setTimeout(() => (statusPindai.value = null), 700);
        });
    }

    /* ---------------------------------------------------------- keranjang */

    const keranjang = ref<BarisKeranjang[]>([]);
    const pelangganId = ref<number | null>(null);

    /**
     * Pencarian pelanggan di server, dipakai BaseSelect mode `cariServer`.
     * Daftar pelanggan tidak lagi dimuat seluruhnya di awal: toko dengan
     * ribuan member tetap cepat, dan yang terpilih selalu yang terbaru.
     */
    async function cariPelanggan(kata: string): Promise<OpsiPilihan<number>[]> {
        const hasil = await ambil<Customer[]>('/customers', {
            q: kata || undefined,
            per_page: 20,
        });
        return keOpsi(
            hasil,
            (c) => c.id,
            (c) => c.nama,
            (c) => c.no_hp ?? undefined,
        );
    }

    /** @returns true bila barang benar-benar bertambah. */
    function tambah(p: Product): boolean {
        const ada = keranjang.value.find((b) => b.product.id === p.id);
        const qtyBaru = (ada?.qty ?? 0) + 1;

        if (qtyBaru > p.stok) {
            beritahu.peringatan(`Stok ${p.nama_produk} hanya ${p.stok}.`);
            return false;
        }

        if (ada) ada.qty = qtyBaru;
        else keranjang.value.push({ product: p, qty: 1 });

        kilatProdukId.value = null;
        clearTimeout(tundaKilat);
        requestAnimationFrame(() => {
            kilatProdukId.value = p.id;
            tundaKilat = setTimeout(() => (kilatProdukId.value = null), 700);
        });
        return true;
    }

    /**
     * Ubah jumlah sebuah baris, dari tombol −/+ maupun diketik langsung.
     * 0 menghapus baris; melebihi stok dibatasi ke sisa stok.
     */
    function ubahQty(baris: BarisKeranjang, qty: number) {
        if (!Number.isFinite(qty) || qty <= 0) {
            hapusBaris(baris);
            return;
        }
        if (qty > baris.product.stok) {
            beritahu.peringatan(
                `Stok ${baris.product.nama_produk} hanya ${baris.product.stok}.`,
            );
            baris.qty = baris.product.stok;
            return;
        }
        baris.qty = Math.floor(qty);
    }

    function hapusBaris(baris: BarisKeranjang) {
        keranjang.value = keranjang.value.filter(
            (b) => b.product.id !== baris.product.id,
        );
    }

    function kosongkan() {
        keranjang.value = [];
        pelangganId.value = null;
    }

    /** Jumlah unit sebuah produk di keranjang, untuk badge pada kartu produk. */
    function qtyDiKeranjang(productId: number): number {
        return (
            keranjang.value.find((b) => b.product.id === productId)?.qty ?? 0
        );
    }

    const jumlahItem = computed(() =>
        keranjang.value.reduce((s, b) => s + b.qty, 0),
    );

    /* Total dihitung ulang di server; angka di sini hanya pratinjau bagi kasir.
       Tarifnya dari Pengaturan Toko (stores/toko), rumusnya sama dengan
       PricingService: diskon dulu, baru PPN di atas DPP. */
    const subtotal = computed(() =>
        keranjang.value.reduce((s, b) => s + b.qty * b.product.harga_jual, 0),
    );
    const diskon = computed(() =>
        pelangganId.value !== null
            ? Math.round(subtotal.value * tarifDiskonMember.value)
            : 0,
    );
    const pajak = computed(() =>
        Math.round((subtotal.value - diskon.value) * tarifPajakBerlaku.value),
    );
    /** Baris PPN disembunyikan bila toko bukan PKP (tarif nol). */
    const adaPajak = computed(() => tarifPajakBerlaku.value > 0);
    const labelDiskon = computed(
        () => `Diskon member ${persen(tarifDiskonMember.value * 100)}`,
    );
    const labelPajak = computed(
        () => `PPN ${persen(tarifPajakBerlaku.value * 100)}`,
    );
    const total = computed(() => subtotal.value - diskon.value + pajak.value);

    /* --------------------------------------------------------- pembayaran */

    const modalBayar = ref(false);
    const metode = ref<'tunai' | 'non_tunai'>('tunai');
    const uangDiterima = ref<number | null>(0);
    const memproses = ref(false);
    const strukTerakhir = ref<Transaction | null>(null);

    const kembalian = computed(() =>
        Math.max(0, (uangDiterima.value ?? 0) - total.value),
    );
    const cukup = computed(
        () =>
            metode.value !== 'tunai' ||
            (uangDiterima.value ?? 0) >= total.value,
    );

    /**
     * Tagihan non-tunai yang dibuat dari isi keranjang saat ini.
     *
     * Setelah popup Midtrans ditutup (sengaja atau tidak), tagihan ini tetap
     * dipegang: "Buka Pembayaran Lagi" meminta token untuk transaksi YANG
     * SAMA, dan server menyerahkan token yang sama pula, sehingga pelanggan
     * melihat QRIS / nomor VA yang tadi. Tagihan gugur begitu keranjang atau
     * pelanggan berubah, karena totalnya tidak lagi sama.
     */
    const tagihan = ref<{
        trx: Transaction;
        berlakuSampai: string | null;
    } | null>(null);

    watch([keranjang, pelangganId], () => (tagihan.value = null), {
        deep: true,
    });

    const memeriksa = ref(false);

    /* Tagihan non-tunai hari ini yang belum lunas. Diambil dari server, jadi
       tetap ada walau halaman dimuat ulang atau kasir sempat pindah halaman. */
    const menunggu = ref<Transaction[]>([]);
    const daftarMenungguTerbuka = ref(false);
    const memeriksaBaris = ref<number | null>(null);

    async function muatMenunggu() {
        try {
            const hasil = await ambil<Transaction[]>('/transactions', {
                status: 'pending',
                dari: kunciTanggal(),
                per_page: 50,
            });
            menunggu.value = hasil.filter(
                (t) => t.payment?.metode === 'non_tunai',
            );
        } catch {
            // Daftar ini pelengkap; kegagalannya tidak boleh mengganggu penjualan.
        }
    }

    function masihBerlaku(t: Transaction): boolean {
        const batas = t.payment?.snap_kedaluwarsa;
        return (
            batas !== null &&
            batas !== undefined &&
            new Date(batas) > new Date()
        );
    }

    /** Pecahan uang yang sering diserahkan pelanggan. */
    const pecahan = computed(() => {
        const t = total.value;
        const bulat = (n: number) => Math.ceil(t / n) * n;
        return [
            ...new Set([
                t,
                bulat(5000),
                bulat(10000),
                bulat(50000),
                bulat(100000),
            ]),
        ];
    });

    function bukaBayar() {
        if (keranjang.value.length === 0) {
            beritahu.peringatan('Keranjang masih kosong.');
            return;
        }
        if (shift.value === null) {
            beritahu.peringatan('Buka shift terlebih dahulu.');
            return;
        }
        uangDiterima.value = total.value;
        modalBayar.value = true;
    }

    async function buatTransaksi(): Promise<Transaction> {
        const r = await simpan<Transaction>('/transactions', {
            metode: metode.value,
            customer_id: pelangganId.value,
            jumlah_bayar:
                metode.value === 'tunai' ? uangDiterima.value : undefined,
            items: keranjang.value.map((b) => ({
                product_id: b.product.id,
                qty: b.qty,
            })),
        });
        return r.data;
    }

    async function bayar() {
        if (memproses.value || !cukup.value) return;

        memproses.value = true;
        try {
            if (metode.value === 'tunai') {
                selesai(await buatTransaksi(), 'Transaksi tersimpan.');
                return;
            }

            // Non-tunai: tagihan untuk keranjang ini hanya dibuat SEKALI.
            // Menekan tombol lagi membuka tagihan yang sama.
            let trx = tagihan.value?.trx ?? null;
            if (trx === null) {
                trx = await buatTransaksi();
                tagihan.value = { trx, berlakuSampai: null };
                void muatMenunggu();

                if (!(await snapSiap())) {
                    beritahu.peringatan(
                        'Pembayaran non-tunai belum aktif. Transaksi tersimpan sebagai menunggu pembayaran.',
                    );
                    layaniBerikutnya();
                    return;
                }
            }

            await bukaTagihan(trx, 'keranjang');
        } catch (e) {
            beritahu.galat(
                e instanceof ApiError
                    ? e.message
                    : 'Gagal menyimpan transaksi.',
            );
        } finally {
            memproses.value = false;
        }
    }

    /**
     * Buka popup Midtrans untuk sebuah tagihan.
     *
     * `asal` membedakan tagihan dari keranjang yang sedang dilayani dengan
     * tagihan lama dari daftar "Menunggu bayar". Yang kedua tidak boleh
     * menyentuh keranjang, karena kasir mungkin sedang melayani pelanggan lain.
     */
    async function bukaTagihan(trx: Transaction, asal: 'keranjang' | 'daftar') {
        try {
            const token = await bayarDenganSnap(trx.id, {
                sukses: () => void pastikanLunas(trx, asal, true),
                menunggu: () => void pastikanLunas(trx, asal, false),
                galat: () =>
                    beritahu.galat(
                        'Pembayaran gagal. Coba lagi atau pilih metode lain.',
                    ),
                tutup: () => {
                    void muatMenunggu();
                    beritahu.info(
                        asal === 'keranjang'
                            ? 'Popup ditutup. Tekan "Buka Pembayaran Lagi" untuk menampilkan QRIS / VA yang sama.'
                            : `${trx.no_struk} masih menunggu. Buka lagi kapan saja dari "Menunggu bayar".`,
                    );
                },
            });

            if (asal === 'keranjang') {
                tagihan.value = { trx, berlakuSampai: token.berlaku_sampai };
            }
            void muatMenunggu();
        } catch (e) {
            // 409: tagihan ternyata sudah lunas, atau sudah kedaluwarsa.
            if (e instanceof ApiError && e.status === 409) {
                await pastikanLunas(trx, asal, false, e.message);
                return;
            }
            beritahu.galat(
                e instanceof ApiError ? e.message : 'Gagal membuka pembayaran.',
            );
        }
    }

    /**
     * Callback popup hanyalah aba-aba. Status sebenarnya ditanyakan ke server,
     * dan server yang mencocokkannya ke Midtrans sebelum menandai lunas.
     */
    async function pastikanLunas(
        trx: Transaction,
        asal: 'keranjang' | 'daftar',
        dariSukses: boolean,
        pesanPenolakan?: string,
    ) {
        memeriksa.value = true;
        let status: StatusTransaksi = 'pending';
        try {
            status = (await periksaStatus(trx.id)).status;
        } catch {
            // Tetap dianggap menunggu; kasir dapat memeriksa ulang.
        } finally {
            memeriksa.value = false;
        }
        void muatMenunggu();

        if (status === 'settlement') {
            await tampilkanLunas(trx, asal);
            return;
        }

        if (status !== 'pending') {
            if (asal === 'keranjang') tagihan.value = null;
            beritahu.peringatan(
                pesanPenolakan ??
                    `${trx.no_struk} ${statusTransaksi(status).label.toLowerCase()}. Buat transaksi baru bila pelanggan tetap ingin membayar.`,
            );
            return;
        }

        beritahu.info(
            dariSukses
                ? 'Pembayaran sedang dikonfirmasi Midtrans. Tekan "Periksa status" sebentar lagi.'
                : `${trx.no_struk} belum dibayar.`,
        );
    }

    async function tampilkanLunas(
        trx: Transaction,
        asal: 'keranjang' | 'daftar',
    ) {
        let rinci = trx;
        try {
            rinci = await ambil<Transaction>(`/transactions/${trx.id}`);
        } catch {
            // Struk tetap ditampilkan dengan data yang sudah ada.
        }

        if (asal === 'keranjang') {
            selesai(rinci, 'Pembayaran lunas.');
        } else {
            strukTerakhir.value = rinci;
            void muatProduk();
            beritahu.sukses(`${trx.no_struk} lunas.`);
        }
    }

    /**
     * Tagihan dibiarkan menunggu (mis. pelanggan membayar VA nanti), dan kasir
     * lanjut melayani pelanggan berikutnya. Tagihannya tetap dapat dibuka lagi
     * dari "Menunggu bayar".
     */
    function layaniBerikutnya() {
        const noStruk = tagihan.value?.trx.no_struk;
        modalBayar.value = false;
        kosongkan();
        void muatMenunggu();
        if (noStruk) beritahu.info(`${noStruk} disimpan di "Menunggu bayar".`);
    }

    async function periksaDariDaftar(t: Transaction) {
        memeriksaBaris.value = t.id;
        try {
            await pastikanLunas(t, 'daftar', false);
        } finally {
            memeriksaBaris.value = null;
        }
    }

    async function bukaDariDaftar(t: Transaction) {
        daftarMenungguTerbuka.value = false;
        await bukaTagihan(t, 'daftar');
    }

    function selesai(trx: Transaction, pesan: string | null) {
        strukTerakhir.value = trx;
        modalBayar.value = false;
        kosongkan();
        tagihan.value = null;
        void muatProduk();
        if (pesan) beritahu.sukses(pesan);
    }

    /* Semuanya dimuat bersamaan, bukan berurutan. Pelanggan tidak termasuk:
       daftarnya dicari ke server saat kotak pelanggan dibuka. */
    function mulai() {
        void Promise.all([
            muatShift(),
            muatProduk(),
            muatMenunggu(),
            muatKategori(),
        ]);
    }

    return {
        // shift
        shift,
        memuatShift,
        modalAwal,
        membukaShift,
        bukaShift,
        // tutup shift
        modalTutupShift,
        memuatRingkasan,
        kasAkhir,
        catatanTutup,
        menutupShift,
        rekapTutup,
        selisihKas,
        bukaTutupShift,
        tutupShift,
        selesaiTutupShift,
        // produk
        produk,
        cari,
        memuatProduk,
        kategori,
        memuatKategori,
        kategoriAktif,
        padaEnter,
        statusPindai,
        kilatProdukId,
        // keranjang
        keranjang,
        pelangganId,
        cariPelanggan,
        tambah,
        ubahQty,
        hapusBaris,
        kosongkan,
        qtyDiKeranjang,
        jumlahItem,
        subtotal,
        diskon,
        pajak,
        total,
        adaPajak,
        labelDiskon,
        labelPajak,
        // pembayaran
        modalBayar,
        metode,
        uangDiterima,
        memproses,
        strukTerakhir,
        kembalian,
        cukup,
        tagihan,
        memeriksa,
        pecahan,
        bukaBayar,
        bayar,
        pastikanLunas,
        layaniBerikutnya,
        // tagihan menunggu
        menunggu,
        daftarMenungguTerbuka,
        memeriksaBaris,
        masihBerlaku,
        periksaDariDaftar,
        bukaDariDaftar,
        // siklus
        mulai,
    };
}

export type Kasir = Reactive<ReturnType<typeof buatKasir>>;

const KUNCI_KASIR: InjectionKey<Kasir> = Symbol('kasir');

/**
 * Dipanggil halaman Kasir (desktop maupun tablet): membuat keadaan kasir dan
 * menyediakannya bagi komponen di bawahnya (modal bayar, struk, dan lainnya).
 */
export function useKasir(beritahu: Pemberitahu): Kasir {
    const kasir = reactive(buatKasir(beritahu));
    provide(KUNCI_KASIR, kasir);
    return kasir;
}

/** Dipakai komponen di dalam halaman Kasir untuk mengambil keadaan bersama. */
export function useKasirInduk(): Kasir {
    const kasir = inject(KUNCI_KASIR);
    if (!kasir) {
        throw new Error(
            'useKasirInduk() hanya dapat dipakai di halaman Kasir.',
        );
    }
    return kasir;
}
