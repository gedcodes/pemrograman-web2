<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi produk.
 *
 * Aturan `harga_jual >= harga_beli` sengaja ditegakkan di sini, bukan sebagai
 * CHECK basis data: constraint semacam itu akan memblokir penjualan cuci
 * gudang secara permanen dan mengubahnya menuntut migrasi baru.
 */
class ProductRequest extends FormRequest
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
        $terikat = $this->route('product');
        $id = $terikat instanceof Product ? $terikat->id : null;

        return [
            'barcode' => ['nullable', 'string', 'max:50', Rule::unique('products')->ignore($id)],
            'nama_produk' => ['required', 'string', 'max:180'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'unit_id' => ['required', 'integer', 'exists:units,id'],
            'harga_beli' => ['required', 'integer', 'min:0'],
            'harga_jual' => ['required', 'integer', 'min:0', 'gte:harga_beli'],
            // Stok awal hanya boleh diisi saat produk DIBUAT. Setelah itu stok
            // berubah lewat Barang Masuk, Stok Opname, atau penjualan, yaitu
            // jalur yang mencatat mutasinya. Menerima stok di sini akan
            // menimpa penjualan yang terjadi selama formulir terbuka.
            'stok' => $id === null ? ['nullable', 'integer', 'min:0'] : ['prohibited'],
            'stok_minimum' => ['nullable', 'integer', 'min:0'],
            'gambar' => ['nullable', 'string', 'max:255'],
            'aktif' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'harga_jual.gte' => 'Harga jual tidak boleh lebih kecil daripada harga beli.',
            'stok.prohibited' => 'Stok tidak dapat diubah dari sini. Gunakan Barang Masuk atau Stok Opname agar pergerakannya tercatat.',
        ];
    }
}
