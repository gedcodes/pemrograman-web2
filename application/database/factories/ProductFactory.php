<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'barcode' => fake()->unique()->ean13(),
            'nama_produk' => fake()->words(3, true),
            'category_id' => Category::factory(),
            'unit_id' => Unit::factory(),
            'harga_beli' => $beli = fake()->numberBetween(2_000, 80_000),
            'harga_jual' => (int) round($beli * fake()->randomFloat(2, 1.1, 1.4)),
            'stok' => fake()->numberBetween(0, 200),
            'stok_minimum' => fake()->numberBetween(5, 40),
            'aktif' => true,
        ];
    }
}
