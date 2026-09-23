<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\OpnameItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OpnameItem
 */
class OpnameItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'stok_sistem' => $this->stok_sistem,
            'stok_fisik' => $this->stok_fisik,
            'selisih' => $this->selisih,
        ];
    }
}
