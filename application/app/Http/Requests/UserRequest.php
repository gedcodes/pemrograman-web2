<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pengguna. Kata sandi wajib saat membuat, opsional saat mengubah.
 */
class UserRequest extends FormRequest
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
        $terikat = $this->route('user');
        $id = $terikat instanceof User ? $terikat->id : null;
        $membuat = $this->isMethod('POST');

        return [
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($id)],
            'peran' => ['required', Rule::in(['admin', 'kasir'])],
            'aktif' => ['nullable', 'boolean'],
            'password' => [$membuat ? 'required' : 'nullable', 'string', 'min:8'],
        ];
    }
}
