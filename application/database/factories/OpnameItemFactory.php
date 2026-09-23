<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\OpnameItem;
use App\Models\Product;
use App\Models\StockOpname;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OpnameItem>
 */
class OpnameItemFactory extends Factory
{
    protected $model = OpnameItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'stock_opname_id' => StockOpname::factory(),
            'product_id' => Product::factory(),
            'stok_sistem' => $sistem = fake()->numberBetween(0, 100),
            'stok_fisik' => $fisik = $sistem + fake()->numberBetween(-3, 3),
            'selisih' => $fisik - $sistem,
        ];
    }
}
