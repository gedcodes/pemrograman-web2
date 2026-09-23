<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table): void {
            $table->id();
            // ERD Bagian 3: TRANSAKSI ||--|| PEMBAYARAN, jadi satu pembayaran per transaksi.
            $table->foreignId('transaction_id')->unique()->constrained()->cascadeOnDelete();
            $table->enum('metode', ['tunai', 'non_tunai']);
            $table->string('order_id', 64)->nullable()->unique();
            $table->string('payment_type', 32)->nullable();
            $table->string('transaction_status', 32)->nullable();
            $table->string('snap_token', 255)->nullable();
            $table->unsignedBigInteger('jumlah_bayar')->default(0);
            $table->unsignedBigInteger('kembalian')->default(0);
            $table->dateTime('waktu_settlement')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
