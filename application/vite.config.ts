import vue from '@vitejs/plugin-vue';
import laravel from 'laravel-vite-plugin';
import { defineConfig, lazyPlugins } from 'vite-plus';

/* Saat `vp test` berjalan, plugin Laravel tidak dipasang:
   komponen yang diuji hanya butuh Vue, dan plugin Laravel akan menulis
   `public/hot` (yang membuat halaman kosong bila tertinggal). */
const sedangMenguji = process.env.VITEST !== undefined;

const pluginVue = () =>
    vue({
        template: {
            transformAssetUrls: {
                base: null,
                includeAbsolute: false,
            },
        },
    });

const pluginAplikasi = () => [
    laravel({
        input: ['resources/js/spa/main.ts'],
        refresh: true,
    }),
    pluginVue(),
];

export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['resources/js/spa/**/*.test.ts'],
        restoreMocks: true,
        setupFiles: ['resources/js/spa/uji/persiapan.ts'],
    },
    plugins: lazyPlugins(() =>
        sedangMenguji ? [pluginVue()] : pluginAplikasi(),
    ),
    server: {
        watch: {
            ignored: [
                '**/.agents/**',
                '**/.claude/**',
                '**/.cursor/**',
                '**/.junie/**',
                '**/vendor/**',
            ],
        },
    },
    lint: {
        ignorePatterns: ['vendor/**', 'node_modules/**', 'public/**'],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        ignorePatterns: ['.github/**', 'composer.json'],
    },
});
