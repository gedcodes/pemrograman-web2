<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi pengajuan retur penjualan.
 */
class StoreSalesReturnRequest extends FormRequest
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
            'transaction_id' => ['required', 'integer', 'exists:transactions,id'],
            'tanggal_retur' => ['nullable', 'date'],
            'alasan' => ['required', 'string', 'max:500'],
            'jumlah_refund' => ['required', 'integer', 'min:0'],
        ];
    }
}
