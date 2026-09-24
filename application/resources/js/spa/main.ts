import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import '../../css/spa.css';

const app = createApp(App).use(router);

// Dipasang setelah navigasi pertama (termasuk pemeriksaan sesi) selesai.
// Sampai saat itu layar pembuka dari spa.blade.php tetap tampil, bukan
// halaman kosong yang hanya berisi batang progres.
void router.isReady().finally(() => app.mount('#spa'));
