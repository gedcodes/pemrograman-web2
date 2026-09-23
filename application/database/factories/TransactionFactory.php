<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Shift;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'no_struk' => 'TRX-'.fake()->unique()->numerify('########'),
            'tanggal' => now(),
            'shift_id' => Shift::factory(),
            'customer_id' => null,
            'subtotal' => $sub = fake()->numberBetween(10_000, 500_000),
            'diskon' => 0,
            'pajak' => $pajak = (int) round($sub * 0.11),
            'total' => $sub + $pajak,
            'status' => 'settlement',
        ];
    }
}
