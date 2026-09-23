<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Transaction
 */
class TransactionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'no_struk' => $this->no_struk,
            'tanggal' => $this->tanggal,
            'status' => $this->status,
            'subtotal' => $this->subtotal,
            'diskon' => $this->diskon,
            'pajak' => $this->pajak,
            'total' => $this->total,
            'catatan' => $this->catatan,
            'shift' => ShiftResource::make($this->whenLoaded('shift')),
            'customer' => CustomerResource::make($this->whenLoaded('customer')),
            'items' => TransactionItemResource::collection($this->whenLoaded('items')),
            'payment' => PaymentResource::make($this->whenLoaded('payment')),
        ];
    }
}
