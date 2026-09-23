/**
 * Data awal entitas PENGGUNA (ER-D PERANCANGAN.md §3).
 * peran: 'admin' (Admin / Pemilik) atau 'kasir' — hak akses di PERANCANGAN.md §2.2.
 *
 * PIN hanya untuk login tiruan (tanpa back-end). Jangan meniru pola ini di
 * aplikasi sungguhan: kredensial harus diverifikasi dan di-hash di server.
 */

export const USER_SEED = [
  {
    id: 'USR-001',
    nama: 'I Wayan Surya Adnyana',
    username: 'surya.owner',
    pin: '240918',
    peran: 'admin',
    keterangan: 'Pemilik Toko',
    no_hp: '0812-3890-1122',
    avatar: null,
    aktif: true,
    terakhir_login: null,
  },
  {
    id: 'USR-003',
    nama: 'Ni Luh Putu Ratna',
    username: 'luh.ratna',
    pin: '150326',
    peran: 'admin',
    keterangan: 'Supervisor Toko',
    no_hp: '0819-2231-6604',
    avatar: 'avatars/ni-luh-putu-ratna.webp',
    aktif: true,
    terakhir_login: null,
  },
  {
    id: 'USR-008',
    nama: 'Ni Kadek Ayu Pramesti',
    username: 'kadek.ayu',
    pin: '081126',
    peran: 'kasir',
    keterangan: 'Kasir · Shift Pagi',
    no_hp: '0857-3310-4478',
    avatar: 'avatars/ni-kadek-ayu-pramesti.webp',
    aktif: true,
    terakhir_login: null,
  },
  {
    id: 'USR-009',
    nama: 'I Made Dwi Antara',
    username: 'made.dwi',
    pin: '190327',
    peran: 'kasir',
    keterangan: 'Kasir · Shift Siang',
    no_hp: '0878-5102-9936',
    avatar: null,
    aktif: true,
    terakhir_login: null,
  },
  {
    id: 'USR-012',
    nama: 'Ni Wayan Sari Dewi',
    username: 'sari.kasir',
    pin: '220427',
    peran: 'kasir',
    keterangan: 'Kasir Cadangan',
    no_hp: '0821-6648-0915',
    avatar: null,
    aktif: false,
    terakhir_login: null,
  },
];

export const ROLE_LABELS = {
  admin: 'Admin / Pemilik',
  kasir: 'Kasir',
};
