<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table): void {
            $table->id();
            $table->string('no_struk', 40)->unique();
            $table->dateTime('tanggal');
            $table->foreignId('shift_id')->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('subtotal')->default(0);
            $table->unsignedBigInteger('diskon')->default(0);
            $table->unsignedBigInteger('pajak')->default(0);
            $table->unsignedBigInteger('total')->default(0);
            $table->enum('status', [
                'draft', 'pending', 'settlement', 'expire', 'cancel', 'deny',
            ])->default('draft');
            $table->text('catatan')->nullable();
            $table->timestamps();

            // Laporan selalu menyaring berdasarkan rentang tanggal lalu status.
            $table->index(['tanggal', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
