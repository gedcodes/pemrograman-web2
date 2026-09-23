<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\SalesReturn;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SalesReturn>
 */
class SalesReturnFactory extends Factory
{
    protected $model = SalesReturn::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'no_dokumen' => 'RTR-'.fake()->unique()->numerify('########'),
            'transaction_id' => Transaction::factory(),
            'tanggal_retur' => now()->toDateString(),
            'alasan' => fake()->sentence(),
            'jumlah_refund' => fake()->numberBetween(5_000, 100_000),
            'status_approval' => 'pending',
        ];
    }
}
