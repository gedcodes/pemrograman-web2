<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table): void {
            $table->id();
            $table->string('barcode', 50)->nullable()->unique();
            $table->string('nama_produk', 180)->index();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->foreignId('unit_id')->constrained()->restrictOnDelete();
            // Rupiah disimpan sebagai bilangan bulat: tidak ada sen dalam praktik ritel,
            // dan bilangan bulat menghindarkan galat pembulatan pecahan sama sekali.
            $table->unsignedBigInteger('harga_beli')->default(0);
            $table->unsignedBigInteger('harga_jual')->default(0);
            $table->integer('stok')->default(0);
            $table->unsignedInteger('stok_minimum')->default(0);
            $table->string('gambar', 255)->nullable();
            $table->boolean('aktif')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
