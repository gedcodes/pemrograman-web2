<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Unit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi satuan jual.
 */
class UnitRequest extends FormRequest
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
        $terikat = $this->route('unit');
        $id = $terikat instanceof Unit ? $terikat->id : null;

        return [
            'nama_satuan' => ['required', 'string', 'max:50', Rule::unique('units')->ignore($id)],
            'simbol' => ['required', 'string', 'max:10'],
        ];
    }
}
