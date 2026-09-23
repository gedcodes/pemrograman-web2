<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\StockOpname;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockOpname>
 */
class StockOpnameFactory extends Factory
{
    protected $model = StockOpname::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'no_dokumen' => 'OPN-'.fake()->unique()->numerify('########'),
            'user_id' => User::factory(),
            'tanggal' => now()->toDateString(),
            'status' => 'draft',
        ];
    }
}
