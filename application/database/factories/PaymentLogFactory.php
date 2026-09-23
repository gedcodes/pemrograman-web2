<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Payment;
use App\Models\PaymentLog;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentLog>
 */
class PaymentLogFactory extends Factory
{
    protected $model = PaymentLog::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'payment_id' => Payment::factory(),
            'status_lama' => 'pending',
            'status_baru' => 'settlement',
            'waktu_perubahan' => now(),
            'dikonfirmasi_oleh' => 'midtrans-webhook',
            'raw_payload' => ['transaction_status' => 'settlement'],
            'idempotency_key' => fake()->unique()->sha256(),
        ];
    }
}
