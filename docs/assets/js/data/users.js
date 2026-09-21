/**
 * Mock data entitas PENGGUNA (ER-D PERANCANGAN.md §3).
 * peran: 'admin' (Admin / Pemilik) atau 'kasir' — hak akses di PERANCANGAN.md §2.2.
 */

export const USERS = [
  {
    id: 'USR-001',
    nama: 'I Wayan Surya Adnyana',
    username: 'surya.owner',
    peran: 'admin',
    keterangan: 'Pemilik Toko',
    avatar: null,
  },
  {
    id: 'USR-008',
    nama: 'Ni Kadek Ayu Pramesti',
    username: 'kadek.ayu',
    peran: 'kasir',
    keterangan: 'Kasir · Shift Pagi',
    avatar: 'avatars/ni-kadek-ayu-pramesti.webp',
  },
];

export const ROLE_LABELS = {
  admin: 'Admin / Pemilik',
  kasir: 'Kasir',
};
