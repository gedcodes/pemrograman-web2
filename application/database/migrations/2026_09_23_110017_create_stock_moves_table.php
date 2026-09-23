<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Buku besar setiap pergerakan stok, sehingga selisih inventori dapat
        // ditelusuri kembali ke dokumen sumbernya.
        Schema::create('stock_moves', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->enum('tipe', ['masuk', 'keluar', 'opname', 'retur'])->index();
            // Bertanda: positif menambah stok, negatif mengurangi.
            $table->integer('qty');
            $table->integer('stok_sebelum');
            $table->integer('stok_sesudah');
            $table->string('referensi_tipe', 40)->nullable();
            $table->unsignedBigInteger('referensi_id')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('keterangan', 255)->nullable();
            $table->timestamps();

            $table->index(['product_id', 'created_at']);
            $table->index(['referensi_tipe', 'referensi_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_moves');
    }
};
