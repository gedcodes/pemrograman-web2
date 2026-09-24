/** Bentuk data yang dikirim API. Cerminan dari App\Http\Resources. */

export type Peran = 'admin' | 'kasir';

export type StatusTransaksi =
    | 'draft'
    | 'pending'
    | 'settlement'
    | 'expire'
    | 'cancel'
    | 'deny';

export interface User {
    id: number;
    name: string;
    email: string;
    peran: Peran;
    aktif: boolean;
}

export interface Category {
    id: number;
    nama_kategori: string;
    slug: string;
}

export interface Unit {
    id: number;
    nama_satuan: string;
    simbol: string;
}

export interface Supplier {
    id: number;
    nama_supplier: string;
    kontak: string | null;
    alamat: string | null;
}

export interface Customer {
    id: number;
    nama: string;
    no_hp: string | null;
    poin_loyalti: number;
}

export interface Product {
    id: number;
    barcode: string | null;
    nama_produk: string;
    category_id: number;
    unit_id: number;
    category?: Category;
    unit?: Unit;
    harga_beli: number;
    harga_jual: number;
    margin: number;
    stok: number;
    stok_minimum: number;
    stok_menipis: boolean;
    gambar: string | null;
    aktif: boolean;
}

export interface Shift {
    id: number;
    user?: User;
    waktu_buka: string;
    waktu_tutup: string | null;
    terbuka: boolean;
    modal_awal: number;
    kas_akhir: number | null;
    catatan: string | null;
    /** Rekap kas; hanya ada pada jawaban /shifts/aktif dan /shifts/close. */
    ringkasan?: RingkasanShift;
}

export interface RingkasanShift {
    jumlah_transaksi: number;
    penjualan_tunai: number;
    penjualan_non_tunai: number;
    tagihan_menunggu: number;
    /** Modal awal + penjualan tunai lunas. */
    kas_seharusnya: number;
    /** Kas akhir − kas seharusnya; null selama shift masih terbuka. */
    selisih: number | null;
}

export interface TransactionItem {
    id: number;
    product_id: number;
    nama_produk: string;
    qty: number;
    harga_satuan: number;
    /** Harga modal saat penjualan terjadi, bukan harga modal saat ini. */
    harga_beli: number;
    subtotal: number;
}

export interface Payment {
    id: number;
    metode: 'tunai' | 'non_tunai';
    order_id: string | null;
    payment_type: string | null;
    transaction_status: string | null;
    /** Batas berlaku tagihan non-tunai yang sedang terbuka (QRIS / VA). */
    snap_kedaluwarsa: string | null;
    jumlah_bayar: number;
    kembalian: number;
    waktu_settlement: string | null;
}

export interface Transaction {
    id: number;
    no_struk: string;
    tanggal: string;
    status: StatusTransaksi;
    subtotal: number;
    diskon: number;
    pajak: number;
    total: number;
    catatan: string | null;
    shift?: Shift;
    customer?: Customer | null;
    items?: TransactionItem[];
    payment?: Payment | null;
}

export interface SalesReturn {
    id: number;
    no_dokumen: string;
    transaction_id: number;
    transaction?: Transaction;
    tanggal_retur: string;
    alasan: string;
    jumlah_refund: number;
    status_approval: 'pending' | 'approved' | 'rejected';
    pengaju?: User | null;
    penyetuju?: User | null;
}

export interface PurchaseItem {
    id: number;
    product_id: number;
    qty: number;
    harga_beli: number;
    subtotal: number;
}

export interface Purchase {
    id: number;
    no_dokumen: string;
    supplier_id: number;
    supplier?: Supplier;
    tanggal_masuk: string;
    total_biaya: number;
    catatan: string | null;
    items?: PurchaseItem[];
}

export interface OpnameItem {
    id: number;
    product_id: number;
    stok_sistem: number;
    stok_fisik: number;
    selisih: number;
}

export interface StockOpname {
    id: number;
    no_dokumen: string;
    user?: User;
    tanggal: string;
    status: 'draft' | 'selesai';
    catatan: string | null;
    items?: OpnameItem[];
}

export interface DashboardData {
    /** true untuk kasir: angka milik kasir sendiri, tanpa grafik omzet toko. */
    ringkas: boolean;
    kartu: {
        omzet_hari_ini: number;
        jumlah_transaksi: number;
        produk_terjual: number;
        stok_menipis: number;
    };
    grafik_7_hari: Array<{
        tanggal: string;
        jumlah_transaksi: number;
        omzet: number;
    }>;
    transaksi_terakhir: Transaction[];
}

export interface LaporanPenjualan {
    periode: { dari: string; sampai: string };
    ringkasan: {
        jumlah_transaksi: number;
        subtotal: number;
        diskon: number;
        pajak: number;
        total: number;
    };
    harian: Array<{
        /** Dinamai tanggal_str di server agar tidak tertimpa cast datetime model. */
        tanggal_str: string;
        jumlah_transaksi: number;
        subtotal: number;
        diskon: number;
        pajak: number;
        total: number;
    }>;
}

export interface BebanRincian {
    nama: string;
    jumlah_bulanan: number;
    jumlah_periode: number;
}

export interface LaporanLabaRugi {
    periode: { dari: string; sampai: string; jumlah_hari: number };
    unit_terjual: number;
    pendapatan_kotor: number;
    diskon: number;
    penjualan_bersih: number;
    harga_pokok_penjualan: number;
    laba_kotor: number;
    margin_kotor: number;
    beban: {
        operasional: number;
        mdr: number;
        total: number;
        rincian: BebanRincian[];
        nilai_non_tunai: number;
        tarif_mdr: number;
    };
    laba_bersih: number;
    margin_bersih: number;
    pajak_dipungut: number;
}

export interface OperationalExpense {
    id: number;
    nama: string;
    jumlah_bulanan: number;
    keterangan: string | null;
    aktif: boolean;
}

export interface LaporanStok {
    jumlah_produk: number;
    total_unit: number;
    nilai_persediaan: number;
    produk_habis: number;
    produk_stok_menipis: number;
    daftar_stok_menipis: Product[];
}

export interface MidtransConfig {
    client_key: string;
    is_production: boolean;
    siap: boolean;
    snap_url: string;
}

/** Baris keranjang di halaman Kasir (hanya hidup di browser). */
export interface BarisKeranjang {
    product: Product;
    qty: number;
}
