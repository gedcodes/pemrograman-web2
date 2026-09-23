<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opname_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('stock_opname_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->integer('stok_sistem');
            $table->integer('stok_fisik');
            // Bertanda: negatif berarti stok fisik kurang dari catatan sistem.
            $table->integer('selisih');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opname_items');
    }
};
