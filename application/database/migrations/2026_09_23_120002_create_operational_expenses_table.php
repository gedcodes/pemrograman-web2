<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Beban operasional bulanan untuk Laporan Laba Rugi.
     *
     * Entitas ini tidak ada pada ERD PERANCANGAN Bagian 3, tetapi prototipe
     * memakainya lewat `MONTHLY_EXPENSES` di `docs/assets/js/data/master.js`.
     * Tanpa tabel ini laporan hanya dapat berhenti di laba kotor.
     *
     * Nilainya disimpan per BULAN, lalu diprorata sesuai panjang periode
     * laporan saat dihitung.
     */
    public function up(): void
    {
        Schema::create('operational_expenses', function (Blueprint $table): void {
            $table->id();
            $table->string('nama', 150);
            $table->unsignedBigInteger('jumlah_bulanan')->default(0);
            $table->string('keterangan', 255)->nullable();
            $table->boolean('aktif')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operational_expenses');
    }
};
