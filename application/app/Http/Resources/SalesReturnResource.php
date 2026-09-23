<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\SalesReturn;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalesReturn
 */
class SalesReturnResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'no_dokumen' => $this->no_dokumen,
            'transaction_id' => $this->transaction_id,
            'transaction' => TransactionResource::make($this->whenLoaded('transaction')),
            'tanggal_retur' => $this->tanggal_retur,
            'alasan' => $this->alasan,
            'jumlah_refund' => $this->jumlah_refund,
            'status_approval' => $this->status_approval,
            'pengaju' => UserResource::make($this->whenLoaded('pengaju')),
            'penyetuju' => UserResource::make($this->whenLoaded('penyetuju')),
        ];
    }
}
