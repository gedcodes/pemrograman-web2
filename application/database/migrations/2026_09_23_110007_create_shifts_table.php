<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shifts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->dateTime('waktu_buka');
            $table->dateTime('waktu_tutup')->nullable();
            $table->unsignedBigInteger('modal_awal')->default(0);
            $table->unsignedBigInteger('kas_akhir')->nullable();
            $table->text('catatan')->nullable();
            $table->timestamps();

            // Mencari shift yang masih terbuka milik seorang kasir.
            $table->index(['user_id', 'waktu_tutup']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shifts');
    }
};
