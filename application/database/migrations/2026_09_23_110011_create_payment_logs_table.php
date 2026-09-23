<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->string('status_lama', 32)->nullable();
            $table->string('status_baru', 32);
            $table->dateTime('waktu_perubahan');
            $table->string('dikonfirmasi_oleh', 64)->nullable();
            $table->json('raw_payload')->nullable();
            // Midtrans mengirim notifikasi yang sama berkali-kali. Kunci unik ini
            // membuat penolakan duplikat ditegakkan basis data, bukan hanya kode.
            $table->string('idempotency_key', 64)->nullable()->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_logs');
    }
};
