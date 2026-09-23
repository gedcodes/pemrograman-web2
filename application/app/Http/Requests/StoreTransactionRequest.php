<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi transaksi kasir.
 *
 * Harga tidak diterima dari klien: server membacanya sendiri dari basis data
 * dan menghitung ulang seluruh total, sesuai aturan keamanan Bagian 5.4.
 */
class StoreTransactionRequest extends FormRequest
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
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'metode' => ['required', Rule::in(['tunai', 'non_tunai'])],
            'jumlah_bayar' => ['nullable', 'integer', 'min:0'],
            'catatan' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
        ];
    }
}
