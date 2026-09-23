<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\TransactionItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TransactionItem
 */
class TransactionItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'nama_produk' => $this->nama_produk,
            'qty' => $this->qty,
            'harga_satuan' => $this->harga_satuan,
            // Harga modal saat penjualan terjadi, bukan harga modal saat ini.
            'harga_beli' => $this->harga_beli,
            'subtotal' => $this->subtotal,
        ];
    }
}
