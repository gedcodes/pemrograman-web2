<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\StockMove;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StockMove
 */
class StockMoveResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => ProductResource::make($this->whenLoaded('product')),
            'tipe' => $this->tipe,
            'qty' => $this->qty,
            'stok_sebelum' => $this->stok_sebelum,
            'stok_sesudah' => $this->stok_sesudah,
            'referensi_tipe' => $this->referensi_tipe,
            'referensi_id' => $this->referensi_id,
            'keterangan' => $this->keterangan,
            'created_at' => $this->created_at,
        ];
    }
}
