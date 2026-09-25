<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi Pengaturan Toko.
 *
 * Batas panjang teks mengikuti prototipe `docs/pages/profil-toko.html`, yang
 * disesuaikan dengan lebar struk thermal 58 mm (±32 karakter per baris untuk
 * nama, 48 untuk kaki struk). Tarif dikirim sebagai PECAHAN (0.11 = 11%),
 * sama seperti cara menyimpannya.
 */
class PengaturanRequest extends FormRequest
{
    /**
     * Kewenangan ditegakkan middleware `role:admin` pada definisi rute.
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
            // ---- identitas
            'nama_toko' => ['required', 'string', 'max:32'],
            'slogan' => ['nullable', 'string', 'max:40'],

            // ---- alamat, kontak, legalitas
            'alamat' => ['required', 'string', 'max:64'],
            'telepon' => ['required', 'string', 'max:20', 'regex:/^[0-9+()\-\s]{6,20}$/'],
            'email' => ['nullable', 'email', 'max:100'],
            'npwp' => ['nullable', 'string', 'max:20', $this->jumlahDigit([15, 16], 'NPWP harus terdiri dari 15 atau 16 digit.')],
            'nib' => ['nullable', 'string', 'regex:/^\d{13}$/'],
            'jam_buka' => ['required', 'date_format:H:i'],
            'jam_tutup' => ['required', 'date_format:H:i', 'different:jam_buka'],

            // ---- struk
            'struk_footer_1' => ['nullable', 'string', 'max:48'],
            'struk_footer_2' => ['nullable', 'string', 'max:48'],
            'struk_tampilkan_logo' => ['required', 'boolean'],

            // ---- pajak & diskon
            'pkp' => ['required', 'boolean'],
            'tarif_pajak' => ['required', 'numeric', 'between:0,0.2'],
            'tarif_diskon_member' => ['required', 'numeric', 'between:0,0.3'],

            // ---- pembayaran non-tunai
            'tarif_mdr' => ['required', 'numeric', 'between:0,0.05'],
            'batas_bayar_menit' => ['required', 'integer', 'between:5,1440'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'telepon.regex' => 'Nomor telepon hanya boleh berisi angka, spasi, tanda +, -, dan kurung.',
            'nib.regex' => 'NIB harus terdiri dari tepat 13 digit.',
            'jam_tutup.different' => 'Jam tutup tidak boleh sama dengan jam buka.',
            'tarif_pajak.between' => 'Tarif PPN harus di antara 0% dan 20%.',
            'tarif_diskon_member.between' => 'Diskon member harus di antara 0% dan 30%.',
            'tarif_mdr.between' => 'Tarif MDR harus di antara 0% dan 5%.',
            'batas_bayar_menit.between' => 'Batas waktu bayar harus di antara 5 menit dan 24 jam (1.440 menit).',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'nama_toko' => 'nama toko',
            'jam_buka' => 'jam buka',
            'jam_tutup' => 'jam tutup',
            'struk_footer_1' => 'kaki struk baris 1',
            'struk_footer_2' => 'kaki struk baris 2',
            'tarif_pajak' => 'tarif PPN',
            'tarif_diskon_member' => 'diskon member',
            'tarif_mdr' => 'tarif MDR',
            'batas_bayar_menit' => 'batas waktu bayar',
        ];
    }

    /**
     * NPWP boleh ditulis dengan titik dan tanda hubung; yang dihitung digitnya.
     *
     * @param  list<int>  $diizinkan
     */
    private function jumlahDigit(array $diizinkan, string $pesan): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($diizinkan, $pesan): void {
            $teks = is_scalar($value) ? (string) $value : '';

            if (preg_match('/^[\d.\-\s]+$/', $teks) !== 1
                || ! in_array(strlen((string) preg_replace('/\D/', '', $teks)), $diizinkan, true)) {
                $fail($pesan);
            }
        };
    }
}
