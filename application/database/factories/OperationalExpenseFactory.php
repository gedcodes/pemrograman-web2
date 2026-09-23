<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\OperationalExpense;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OperationalExpense>
 */
class OperationalExpenseFactory extends Factory
{
    protected $model = OperationalExpense::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama' => fake()->words(3, true),
            'jumlah_bulanan' => fake()->numberBetween(100_000, 5_000_000),
            'keterangan' => null,
            'aktif' => true,
        ];
    }
}
