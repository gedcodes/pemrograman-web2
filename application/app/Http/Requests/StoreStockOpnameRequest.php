<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi sesi stok opname.
 */
class StoreStockOpnameRequest extends FormRequest
{
    /**
     * Kewenangan ditegakkan middleware `role` pada definisi rute,
     * sehingga di sini cukup mengizinkan.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'tanggal' => ['nullable', 'date'],
            'catatan' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            // `distinct`: satu produk dihitung sekali per sesi.
            'items.*.product_id' => ['required', 'integer', 'exists:products,id', 'distinct'],
            'items.*.stok_fisik' => ['required', 'integer', 'min:0'],
            // Stok buku yang dilihat petugas saat lembar hitung dibuka.
            'items.*.stok_sistem' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
