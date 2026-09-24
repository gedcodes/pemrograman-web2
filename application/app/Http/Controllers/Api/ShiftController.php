<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CloseShiftRequest;
use App\Http\Requests\OpenShiftRequest;
use App\Http\Resources\ShiftResource;
use App\Models\Shift;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Buka dan tutup shift kasir (alur PERANCANGAN Bagian 4.1, langkah B dan C).
 */
class ShiftController extends Controller
{
    /**
     * Shift milik kasir yang sedang masuk dan belum ditutup.
     */
    public function aktif(Request $request): JsonResponse
    {
        $shift = $this->shiftTerbuka($request);

        return ApiResponse::ok($shift !== null ? $this->denganRingkasan($shift) : null);
    }

    /**
     * Data shift ditambah rekap kasnya (lihat Shift::ringkasan()).
     *
     * @return array<string, mixed>
     */
    private function denganRingkasan(Shift $shift): array
    {
        return [
            ...ShiftResource::make($shift->load('user'))->resolve(),
            'ringkasan' => $shift->ringkasan(),
        ];
    }

    public function buka(OpenShiftRequest $request): JsonResponse
    {
        if ($this->shiftTerbuka($request) !== null) {
            return response()->json([
                'message' => 'Masih ada shift yang belum ditutup. Tutup dahulu sebelum membuka yang baru.',
            ], 409);
        }

        $shift = Shift::create([
            'user_id' => $request->user()?->id,
            'waktu_buka' => now(),
            'modal_awal' => $request->integer('modal_awal'),
            'catatan' => $request->string('catatan')->value() ?: null,
        ]);

        return ApiResponse::created(ShiftResource::make($shift->load('user')), 'Shift dibuka.');
    }

    public function tutup(CloseShiftRequest $request): JsonResponse
    {
        $shift = $this->shiftTerbuka($request);

        if ($shift === null) {
            return response()->json([
                'message' => 'Tidak ada shift terbuka yang bisa ditutup.',
            ], 409);
        }

        $shift->update([
            'waktu_tutup' => now(),
            'kas_akhir' => $request->integer('kas_akhir'),
            'catatan' => $request->string('catatan')->value() ?: $shift->catatan,
        ]);

        $ringkasan = $shift->ringkasan();
        $pesan = match (true) {
            $ringkasan['selisih'] === 0 => 'Shift ditutup. Kas cocok.',
            $ringkasan['selisih'] > 0 => 'Shift ditutup. Kas lebih dari seharusnya.',
            default => 'Shift ditutup. Kas kurang dari seharusnya.',
        };

        return ApiResponse::ok($this->denganRingkasan($shift), $pesan);
    }

    private function shiftTerbuka(Request $request): ?Shift
    {
        return Shift::query()
            ->where('user_id', $request->user()?->id)
            ->whereNull('waktu_tutup')
            ->latest('waktu_buka')
            ->first();
    }
}
