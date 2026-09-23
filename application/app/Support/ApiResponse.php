<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Pembentuk response JSON yang seragam untuk seluruh API.
 *
 * Bentuknya selalu `{ data, message, meta }`. Kunci `meta` hanya muncul bila
 * memang ada isinya, supaya response sederhana tidak dipenuhi kunci kosong.
 *
 * Response galat tetap memakai bentuk bawaan Laravel (`{ message, errors }`)
 * karena itulah yang sudah dipahami klien HTTP dan pustaka validasi di sisi Vue.
 */
final class ApiResponse
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public static function ok(mixed $data = null, ?string $message = null, array $meta = []): JsonResponse
    {
        return self::build($data, $message, $meta, 200);
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    public static function created(mixed $data = null, ?string $message = null, array $meta = []): JsonResponse
    {
        return self::build($data, $message, $meta, 201);
    }

    /**
     * Response tanpa muatan data, misalnya setelah penghapusan.
     */
    public static function message(string $message): JsonResponse
    {
        return self::build(null, $message, [], 200);
    }

    /**
     * Bungkus hasil paginasi: barisnya masuk ke `data`, informasi halaman ke `meta`.
     *
     * @param  LengthAwarePaginator<int, mixed>  $paginator
     * @param  class-string<JsonResource>  $resource
     */
    public static function paginated(LengthAwarePaginator $paginator, string $resource, ?string $message = null): JsonResponse
    {
        return self::build(
            $resource::collection($paginator->items()),
            $message,
            [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
            200,
        );
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    private static function build(mixed $data, ?string $message, array $meta, int $status): JsonResponse
    {
        $payload = [
            // ResourceCollection sendiri merupakan turunan JsonResource,
            // sehingga satu pemeriksaan sudah mencakup keduanya.
            'data' => $data instanceof JsonResource ? $data->resolve() : $data,
            'message' => $message,
        ];

        if ($meta !== []) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }
}
