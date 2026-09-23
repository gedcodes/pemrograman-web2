<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Shift;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Shift
 */
class ShiftResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user' => UserResource::make($this->whenLoaded('user')),
            'waktu_buka' => $this->waktu_buka,
            'waktu_tutup' => $this->waktu_tutup,
            'terbuka' => $this->waktu_tutup === null,
            'modal_awal' => $this->modal_awal,
            'kas_akhir' => $this->kas_akhir,
            'catatan' => $this->catatan,
        ];
    }
}
