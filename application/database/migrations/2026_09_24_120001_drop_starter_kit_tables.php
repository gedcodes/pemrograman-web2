<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Melepas sisa skema starter kit Laravel (Teams, passkey, 2FA).
 *
 * Aplikasi POS hanya memakai SPA Vue dengan login email + kata sandi, sehingga
 * tabel dan kolom ini tidak lagi punya kode yang membacanya. Empat migrasi
 * pembuatnya ikut dihapus dari repositori, jadi pada instalasi baru seluruh
 * penjagaan `hasTable`/`hasColumn` di bawah bernilai salah dan migrasi ini
 * tidak melakukan apa pun. Yang dibersihkan hanya basis data yang sudah
 * sempat menjalankan migrasi lama itu (misalnya `db_pos` lokal).
 *
 * Data POS tidak tersentuh: tidak ada tabel POS yang memiliki foreign key ke
 * tabel-tabel ini.
 */
return new class extends Migration
{
    /** Migrasi starter kit yang berkasnya sudah dihapus. */
    private const MIGRASI_LAMA = [
        '2024_01_01_000000_create_passkeys_table',
        '2025_08_14_170933_add_two_factor_columns_to_users_table',
        '2026_01_27_000001_create_teams_table',
        '2026_01_27_000002_add_current_team_id_to_users_table',
    ];

    public function up(): void
    {
        // Foreign key users.current_team_id -> teams harus dilepas lebih dulu.
        if (Schema::hasColumn('users', 'current_team_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropConstrainedForeignId('current_team_id');
            });
        }

        $kolom2fa = array_values(array_filter(
            ['two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at'],
            fn (string $kolom) => Schema::hasColumn('users', $kolom),
        ));

        if ($kolom2fa !== []) {
            Schema::table('users', function (Blueprint $table) use ($kolom2fa) {
                $table->dropColumn($kolom2fa);
            });
        }

        Schema::dropIfExists('team_invitations');
        Schema::dropIfExists('team_members');
        Schema::dropIfExists('teams');
        Schema::dropIfExists('passkeys');

        // Tanpa ini, catatan migrasi yang berkasnya sudah tiada tetap tertinggal
        // dan `migrate:rollback` akan melaporkannya sebagai "Migration not found".
        DB::table(config('database.migrations.table', 'migrations'))
            ->whereIn('migration', self::MIGRASI_LAMA)
            ->delete();
    }

    /**
     * Tidak dibalik: kode yang memakai tabel-tabel ini sudah dihapus, sehingga
     * membangunnya kembali tidak berguna. Untuk memulihkan, pakai riwayat git
     * (migrasi lama) atau dump basis data sebelum migrasi ini dijalankan.
     */
    public function down(): void
    {
        //
    }
};
