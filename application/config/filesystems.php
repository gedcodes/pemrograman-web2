<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim((string) env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        /*
         * Berkas unggahan pengguna: foto produk dan logo toko.
         *
         * Root-nya langsung di dalam `public/`, bukan `storage/app/public`,
         * supaya berkas tersaji apa adanya oleh web server tanpa perlu
         * `php artisan storage:link`. Symlink itu mudah terlupakan -- dan di
         * hosting bersama atau Windows tanpa hak admin kadang tidak dapat
         * dibuat sama sekali -- sedangkan akibatnya fatal: SETIAP foto
         * unggahan dijawab 404 meski berkasnya ada di disk.
         *
         * Foldernya bernama `unggahan`, BUKAN `produk`: `/produk` adalah rute
         * SPA, dan public/.htaccess hanya meneruskan permintaan ke index.php
         * bila path-nya bukan folder yang benar-benar ada. Folder
         * `public/produk` justru akan membuat halaman Produk dijawab 403.
         *
         * Yang tersimpan di basis data tetap path relatif (mis.
         * `produk/abc.jpg`), bukan URL, supaya pindah lokasi cukup satu ubahan
         * di sini plus pembentuk URL-nya.
         */
        'unggahan' => [
            'driver' => 'local',
            'root' => public_path('unggahan'),
            'url' => '/unggahan',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
