<?php

declare(strict_types=1);

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Dilempar ketika penjualan meminta qty melebihi stok yang tersedia
 * (alur PERANCANGAN Bagian 4.1, cabang "Stok mencukupi?").
 */
class StokTidakCukupException extends RuntimeException
{
    public function __construct(
        public readonly string $namaProduk,
        public readonly int $diminta,
        public readonly int $tersedia,
    ) {
        parent::__construct(sprintf(
            'Stok %s tidak mencukupi: diminta %d, tersedia %d.',
            $namaProduk,
            $diminta,
            $tersedia,
        ));
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'errors' => [
                'items' => [$this->getMessage()],
            ],
        ], 422);
    }
}
