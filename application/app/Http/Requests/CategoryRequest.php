<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi kategori produk.
 */
class CategoryRequest extends FormRequest
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
        // route() bertipe object|string|null, jadi jenisnya dipastikan
        // lebih dulu alih-alih diakses begitu saja.
        $terikat = $this->route('category');
        $id = $terikat instanceof Category ? $terikat->id : null;

        return [
            'nama_kategori' => ['required', 'string', 'max:100', Rule::unique('categories')->ignore($id)],
            'slug' => ['nullable', 'string', 'max:120', Rule::unique('categories')->ignore($id)],
        ];
    }
}
