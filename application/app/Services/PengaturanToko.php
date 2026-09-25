<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Setting;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use RuntimeException;

/**
 * Satu-satunya pintu untuk membaca dan mengubah pengaturan toko.
 *
 * Nilai tersimpan di tabel `settings` (kunci-nilai). Kunci yang belum pernah
 * disimpan memakai nilai bawaan dari `config/pos.php`, sehingga aplikasi tetap
 * berjalan normal meski tabelnya masih kosong.
 *
 * Sengaja TIDAK di-cache: tabelnya hanya belasan baris dan dibaca beberapa kali
 * per permintaan, sedangkan cache yang basi pada tarif pajak berarti kasir
 * menagih angka yang salah.
 *
 * Menambah pengaturan baru cukup dengan menambah satu baris di `skema()`,
 * aturan validasinya di `PengaturanRequest`, dan isiannya di halaman SPA.
 */
final class PengaturanToko
{
    /** Folder logo di disk `public` (storage/app/public/toko). */
    public const FOLDER_LOGO = 'toko';

    /**
     * Daftar pengaturan beserta tipe dan nilai bawaannya.
     *
     * Tipe berakhiran `?` boleh kosong (null).
     *
     * @return array<string, array{tipe: 'string'|'string?'|'bool'|'float'|'int', bawaan: mixed}>
     */
    private function skema(): array
    {
        $toko = (array) config('pos.toko', []);

        return [
            // ---- identitas
            'nama_toko' => ['tipe' => 'string', 'bawaan' => config('pos.nama_toko')],
            'slogan' => ['tipe' => 'string?', 'bawaan' => $toko['slogan'] ?? null],
            'logo' => ['tipe' => 'string?', 'bawaan' => null],

            // ---- alamat, kontak, legalitas
            'alamat' => ['tipe' => 'string', 'bawaan' => $toko['alamat'] ?? ''],
            'telepon' => ['tipe' => 'string', 'bawaan' => $toko['telepon'] ?? ''],
            'email' => ['tipe' => 'string?', 'bawaan' => $toko['email'] ?? null],
            'npwp' => ['tipe' => 'string?', 'bawaan' => $toko['npwp'] ?? null],
            'nib' => ['tipe' => 'string?', 'bawaan' => $toko['nib'] ?? null],
            'jam_buka' => ['tipe' => 'string', 'bawaan' => $toko['jam_buka'] ?? '08:00'],
            'jam_tutup' => ['tipe' => 'string', 'bawaan' => $toko['jam_tutup'] ?? '21:00'],

            // ---- struk
            'struk_footer_1' => ['tipe' => 'string?', 'bawaan' => $toko['struk_footer_1'] ?? null],
            'struk_footer_2' => ['tipe' => 'string?', 'bawaan' => $toko['struk_footer_2'] ?? null],
            'struk_tampilkan_logo' => ['tipe' => 'bool', 'bawaan' => true],

            // ---- pajak & diskon (pecahan: 0.11 = 11%)
            'pkp' => ['tipe' => 'bool', 'bawaan' => true],
            'tarif_pajak' => ['tipe' => 'float', 'bawaan' => config('pos.tarif_pajak')],
            'tarif_diskon_member' => ['tipe' => 'float', 'bawaan' => config('pos.tarif_diskon_member')],

            // ---- pembayaran non-tunai
            'tarif_mdr' => ['tipe' => 'float', 'bawaan' => config('pos.tarif_mdr')],
            'batas_bayar_menit' => ['tipe' => 'int', 'bawaan' => config('midtrans.expiry_duration', 30)],
        ];
    }

    /**
     * Seluruh pengaturan, bawaan ditimpa nilai tersimpan, bertipe benar.
     *
     * @return array<string, mixed>
     */
    public function semua(): array
    {
        $skema = $this->skema();

        /** @var array<string, mixed> $tersimpan */
        $tersimpan = Setting::query()
            ->whereIn('kunci', array_keys($skema))
            ->pluck('nilai', 'kunci')
            ->all();

        $hasil = [];
        foreach ($skema as $kunci => $s) {
            $nilai = array_key_exists($kunci, $tersimpan) ? $tersimpan[$kunci] : $s['bawaan'];
            $hasil[$kunci] = $this->ketik($s['tipe'], $nilai);
        }

        return $hasil;
    }

    /**
     * Bentuk yang dikirim ke SPA: path logo diganti URL-nya.
     *
     * @return array<string, mixed>
     */
    public function untukApi(): array
    {
        $semua = $this->semua();
        $semua['logo_url'] = $this->urlLogo($semua['logo']);
        $semua['inisial'] = self::inisial((string) $semua['nama_toko']);
        unset($semua['logo']);

        return $semua;
    }

    /**
     * Identitas yang boleh dilihat SIAPA PUN, termasuk tamu di halaman masuk.
     * Disisipkan ke `spa.blade.php`, jadi jangan tambahkan data internal.
     *
     * @return array{nama_toko: string, slogan: string|null, logo_url: string|null, inisial: string}
     */
    public function publik(): array
    {
        $semua = $this->semua();

        return [
            'nama_toko' => (string) $semua['nama_toko'],
            'slogan' => is_string($semua['slogan']) ? $semua['slogan'] : null,
            'logo_url' => $this->urlLogo($semua['logo']),
            'inisial' => self::inisial((string) $semua['nama_toko']),
        ];
    }

    /**
     * Dua huruf pengganti logo: "Toko Sari Amerta" → "SA".
     *
     * Kata "toko"/"warung" dilewati karena tidak membedakan satu toko dari yang
     * lain. Dihitung di sini saja, supaya layar pembuka (Blade) dan SPA tidak
     * pernah berbeda pendapat.
     */
    public static function inisial(string $nama): string
    {
        $kata = array_values(array_filter(
            preg_split('/\s+/u', trim($nama)) ?: [],
            fn (string $k) => $k !== '' && ! in_array(mb_strtolower($k), ['toko', 'warung'], true),
        ));

        if ($kata === []) {
            return mb_strtoupper(mb_substr(trim($nama), 0, 2)) ?: 'POS';
        }

        $huruf = count($kata) === 1
            ? mb_substr($kata[0], 0, 2)
            : mb_substr($kata[0], 0, 1).mb_substr($kata[1], 0, 1);

        return mb_strtoupper($huruf);
    }

    /**
     * Simpan sebagian atau seluruh pengaturan. Kunci yang tidak dikenal ditolak,
     * dan logo tidak dapat diubah lewat sini (pakai `gantiLogo`).
     *
     * @param  array<string, mixed>  $data
     */
    public function perbarui(array $data): void
    {
        $skema = $this->skema();

        foreach (array_keys($data) as $kunci) {
            if (! isset($skema[$kunci]) || $kunci === 'logo') {
                throw new InvalidArgumentException("Pengaturan [{$kunci}] tidak dikenal.");
            }
        }

        DB::transaction(function () use ($data, $skema) {
            foreach ($data as $kunci => $nilai) {
                $this->tulis($kunci, $this->ketik($skema[$kunci]['tipe'], $nilai));
            }
        });
    }

    /**
     * Ganti logo toko. Berkas lama dihapus SETELAH yang baru tersimpan, supaya
     * kegagalan di tengah jalan tidak meninggalkan toko tanpa logo.
     *
     * Nama berkas dibangkitkan acak (hashName), jadi setiap logo baru punya URL
     * baru dan browser tidak menampilkan logo lama dari cache.
     */
    public function gantiLogo(UploadedFile $berkas): string
    {
        $lama = $this->semua()['logo'];

        $path = Storage::disk('public')->putFile(self::FOLDER_LOGO, $berkas);
        if ($path === false) {
            throw new RuntimeException('Logo gagal disimpan.');
        }

        $this->tulis('logo', $path);
        $this->hapusBerkas($lama);

        return (string) $this->urlLogo($path);
    }

    public function hapusLogo(): void
    {
        $lama = $this->semua()['logo'];
        $this->tulis('logo', null);
        $this->hapusBerkas($lama);
    }

    /* ------------------------------------------------ nilai siap pakai */

    /**
     * Tarif PPN yang benar-benar dikenakan: nol bila toko bukan PKP.
     */
    public function tarifPajakBerlaku(): float
    {
        $semua = $this->semua();

        return $semua['pkp'] ? (float) $semua['tarif_pajak'] : 0.0;
    }

    public function tarifDiskonMember(): float
    {
        return (float) $this->semua()['tarif_diskon_member'];
    }

    public function tarifMdr(): float
    {
        return (float) $this->semua()['tarif_mdr'];
    }

    public function batasBayarMenit(): int
    {
        return (int) $this->semua()['batas_bayar_menit'];
    }

    /* ------------------------------------------------------- internal */

    private function tulis(string $kunci, mixed $nilai): void
    {
        Setting::query()->updateOrCreate(['kunci' => $kunci], ['nilai' => $nilai]);
    }

    /**
     * URL relatif, bukan `Storage::url()` yang absolut berdasarkan APP_URL:
     * bila APP_URL tidak persis sama dengan alamat yang dibuka (localhost vs
     * 127.0.0.1, http vs https di balik proxy), URL absolut akan rusak.
     */
    private function urlLogo(mixed $path): ?string
    {
        return is_string($path) && $path !== '' ? '/storage/'.$path : null;
    }

    private function hapusBerkas(mixed $path): void
    {
        if (is_string($path) && $path !== '') {
            Storage::disk('public')->delete($path);
        }
    }

    private function ketik(string $tipe, mixed $nilai): mixed
    {
        if ($tipe === 'string?') {
            $teks = is_scalar($nilai) ? trim((string) $nilai) : '';

            return $teks === '' ? null : $teks;
        }

        return match ($tipe) {
            'string' => is_scalar($nilai) ? trim((string) $nilai) : '',
            'bool' => filter_var($nilai, FILTER_VALIDATE_BOOL),
            'float' => is_numeric($nilai) ? (float) $nilai : 0.0,
            'int' => is_numeric($nilai) ? (int) $nilai : 0,
            default => throw new InvalidArgumentException("Tipe [{$tipe}] tidak dikenal."),
        };
    }
}
