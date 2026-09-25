<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pengaturan toko (menu Pengaturan → Pengaturan Toko).
 *
 * Berbentuk kunci-nilai, bukan satu baris berkolom tetap, supaya pengaturan
 * baru cukup didaftarkan di `App\Services\PengaturanToko` tanpa migrasi.
 * Kunci yang belum pernah disimpan memakai nilai bawaan dari `config/pos.php`,
 * sehingga tabel kosong pun sudah menghasilkan aplikasi yang berjalan normal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('kunci', 64)->unique();
            $table->json('nilai')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
