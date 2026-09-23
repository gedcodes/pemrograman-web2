<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi beban operasional bulanan.
 */
class OperationalExpenseRequest extends FormRequest
{
    /**
     * Kewenangan ditegakkan middleware `role` pada definisi rute.
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
            'nama' => ['required', 'string', 'max:150'],
            'jumlah_bulanan' => ['required', 'integer', 'min:0'],
            'keterangan' => ['nullable', 'string', 'max:255'],
            'aktif' => ['nullable', 'boolean'],
        ];
    }
}
