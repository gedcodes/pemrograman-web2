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
            // Dinilai pada harga beli SAAT INI: opname lama tidak memotret harga.
            'nilai_selisih' => $this->whenLoaded('product', fn () => $this->selisih * $this->product->harga_beli),
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'nama_produk' => $this->product->nama_produk,
                'barcode' => $this->product->barcode,
                'gambar_url' => $this->product->gambar_url,
                'harga_beli' => $this->product->harga_beli,
                'satuan' => $this->product->unit->simbol,
                'dihapus' => $this->product->trashed(),
            ]),
        ];
    }
}
