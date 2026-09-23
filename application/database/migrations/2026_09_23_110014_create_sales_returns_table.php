<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Dinamai 'sales_returns', bukan 'returns', karena PHP melarang kelas bernama
        // Return sehingga konvensi model Laravel tidak dapat diikuti.
        Schema::create('sales_returns', function (Blueprint $table): void {
            $table->id();
            $table->string('no_dokumen', 40)->unique();
            $table->foreignId('transaction_id')->constrained()->restrictOnDelete();
            $table->date('tanggal_retur');
            $table->text('alasan');
            $table->unsignedBigInteger('jumlah_refund')->default(0);
            // PERANCANGAN Bagian 2.2: retur dari kasir menunggu persetujuan admin.
            $table->enum('status_approval', ['pending', 'approved', 'rejected'])
                ->default('pending')
                ->index();
            $table->foreignId('diajukan_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('disetujui_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_returns');
    }
};
