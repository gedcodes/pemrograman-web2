<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Payment;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'transaction_id' => Transaction::factory(),
            'metode' => 'tunai',
            'order_id' => null,
            'payment_type' => null,
            'transaction_status' => null,
            'jumlah_bayar' => fake()->numberBetween(10_000, 500_000),
            'kembalian' => 0,
        ];
    }
}
