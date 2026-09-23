<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TransactionItem>
 */
class TransactionItemFactory extends Factory
{
    protected $model = TransactionItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'transaction_id' => Transaction::factory(),
            'product_id' => Product::factory(),
            'nama_produk' => fake()->words(3, true),
            'qty' => $qty = fake()->numberBetween(1, 5),
            'harga_satuan' => $harga = fake()->numberBetween(2_000, 80_000),
            'harga_beli' => (int) round($harga * 0.8),
            'subtotal' => $qty * $harga,
        ];
    }
}
