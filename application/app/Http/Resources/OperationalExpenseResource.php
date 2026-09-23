<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\OperationalExpense;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OperationalExpense
 */
class OperationalExpenseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'jumlah_bulanan' => $this->jumlah_bulanan,
            'keterangan' => $this->keterangan,
            'aktif' => $this->aktif,
        ];
    }
}
