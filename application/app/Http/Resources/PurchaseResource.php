<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Purchase;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Purchase
 */
class PurchaseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'no_dokumen' => $this->no_dokumen,
            'supplier_id' => $this->supplier_id,
            'supplier' => SupplierResource::make($this->whenLoaded('supplier')),
            'tanggal_masuk' => $this->tanggal_masuk,
            'total_biaya' => $this->total_biaya,
            'catatan' => $this->catatan,
            'items' => PurchaseItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
