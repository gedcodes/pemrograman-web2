<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Potret harga beli pada saat penjualan terjadi.
     *
     * Tanpa kolom ini laporan laba rugi terpaksa membaca `products.harga_beli`
     * yang berlaku SEKARANG, sehingga menaikkan harga modal sebuah produk akan
     * menggeser laba periode-periode yang sudah lewat. Harga jual dan nama
     * produk sudah dipotret sejak awal; ini melengkapinya.
     */
    public function up(): void
    {
        Schema::table('transaction_items', function (Blueprint $table): void {
            $table->unsignedBigInteger('harga_beli')->default(0)->after('harga_satuan');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_items', function (Blueprint $table): void {
            $table->dropColumn('harga_beli');
        });
    }
};
