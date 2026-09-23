<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Purchase;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Purchase>
 */
class PurchaseFactory extends Factory
{
    protected $model = Purchase::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'no_dokumen' => 'BM-'.fake()->unique()->numerify('########'),
            'supplier_id' => Supplier::factory(),
            'user_id' => null,
            'tanggal_masuk' => now()->toDateString(),
            'total_biaya' => fake()->numberBetween(100_000, 5_000_000),
        ];
    }
}
