<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'barcode' => $this->barcode,
            'nama_produk' => $this->nama_produk,
            'category_id' => $this->category_id,
            'unit_id' => $this->unit_id,
            'category' => CategoryResource::make($this->whenLoaded('category')),
            'unit' => UnitResource::make($this->whenLoaded('unit')),
            'harga_beli' => $this->harga_beli,
            'harga_jual' => $this->harga_jual,
            'margin' => $this->margin,
            'stok' => $this->stok,
            'stok_minimum' => $this->stok_minimum,
            // Dihitung di sini supaya seluruh halaman memakai ambang yang sama.
            'stok_menipis' => $this->stok <= $this->stok_minimum,
            'gambar' => $this->gambar,
            'aktif' => $this->aktif,
        ];
    }
}
