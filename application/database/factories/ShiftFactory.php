<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Shift;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Shift>
 */
class ShiftFactory extends Factory
{
    protected $model = Shift::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'waktu_buka' => now()->subHours(6),
            'waktu_tutup' => null,
            'modal_awal' => 200_000,
        ];
    }
}
