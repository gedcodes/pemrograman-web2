import { cleanup } from '@testing-library/vue';
import { afterEach } from 'vite-plus/test';

// Tanpa `globals: true`, Testing Library tidak bisa mendaftarkan pembersihan
// otomatis — komponen dari tes sebelumnya akan menumpuk di document.body.
afterEach(() => {
    cleanup();
    try {
        localStorage.clear();
    } catch {
        // abaikan: lingkungan tanpa storage
    }
});
