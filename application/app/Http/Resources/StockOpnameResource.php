<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\StockOpname;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StockOpname
 */
class StockOpnameResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'no_dokumen' => $this->no_dokumen,
            'user' => UserResource::make($this->whenLoaded('user')),
            'tanggal' => $this->tanggal,
            'status' => $this->status,
            'catatan' => $this->catatan,
            'items' => OpnameItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
