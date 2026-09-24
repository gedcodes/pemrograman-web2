<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Batas berlaku Snap Token yang tersimpan.
 *
 * Selama belum lewat, token yang sama dipakai ulang, sehingga kasir yang
 * tidak sengaja menutup popup dapat membukanya lagi dan pelanggan melihat
 * QRIS / nomor VA yang SAMA, bukan tagihan baru dengan order_id baru.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dateTime('snap_kedaluwarsa')->nullable()->after('snap_token');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropColumn('snap_kedaluwarsa');
        });
    }
};
