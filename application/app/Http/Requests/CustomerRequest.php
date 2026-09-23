<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Customer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pelanggan.
 */
class CustomerRequest extends FormRequest
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
        $terikat = $this->route('customer');
        $id = $terikat instanceof Customer ? $terikat->id : null;

        return [
            'nama' => ['required', 'string', 'max:150'],
            'no_hp' => ['nullable', 'string', 'max:30', Rule::unique('customers')->ignore($id)],
            'poin_loyalti' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
