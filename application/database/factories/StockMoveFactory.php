<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\StockMove;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockMove>
 */
class StockMoveFactory extends Factory
{
    protected $model = StockMove::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'tipe' => 'keluar',
            'qty' => $qty = -fake()->numberBetween(1, 10),
            'stok_sebelum' => $sebelum = fake()->numberBetween(20, 200),
            'stok_sesudah' => $sebelum + $qty,
            'referensi_tipe' => null,
            'referensi_id' => null,
            'user_id' => null,
        ];
    }
}
