<?php

declare(strict_types=1);

use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\MidtransNotificationController;
use App\Http\Controllers\Api\OperationalExpenseController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PengaturanController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SalesReturnController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\StockOpnameController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\UserController;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rute API POS
|--------------------------------------------------------------------------
|
| Hak akses PERANCANGAN Bagian 2.2 ditegakkan di sini lewat middleware `role`,
| bukan sekadar disembunyikan di antarmuka.
|
| Satu penafsiran yang perlu dicatat: Bagian 2.2 menandai Master Data sebagai
| terlarang bagi kasir, tetapi halaman Kasir jelas membutuhkan daftar produk,
| satuan, kategori, dan pelanggan untuk dapat berjualan. Yang dilarang karena
| itu dibaca sebagai PENGELOLAANNYA: kasir boleh MEMBACA master data, sedangkan
| menambah, mengubah, dan menghapus hanya untuk admin. Supplier tidak dipakai
| di halaman Kasir sehingga tetap tertutup sepenuhnya.
|
*/

/*
|--------------------------------------------------------------------------
| Webhook Midtrans -- TANPA autentikasi
|--------------------------------------------------------------------------
|
| Midtrans memanggil endpoint ini dari luar dan tidak membawa sesi apa pun,
| sehingga tidak dapat ditempatkan di balik `auth:sanctum`. Penjaganya adalah
| verifikasi `signature_key` di dalam controller -- lihat PERANCANGAN Bagian 5.4.
|
*/
Route::post('midtrans/notification', MidtransNotificationController::class);

Route::middleware(['auth:sanctum', 'role'])->group(function (): void {

    Route::get('/user', fn (Request $request) => UserResource::make($request->user()));

    // ---- Dashboard: admin penuh, kasir versi ringkas (Bagian 2.2).
    Route::get('/dashboard', DashboardController::class);

    // ---- Pengaturan toko: kasir perlu tarif dan identitas toko untuk
    //      pratinjau keranjang dan struk, jadi membacanya boleh semua peran.
    Route::get('pengaturan', [PengaturanController::class, 'show']);

    // ---- Master data: dibaca semua peran, diubah hanya admin.
    Route::get('categories', [CategoryController::class, 'index']);
    Route::get('categories/{category}', [CategoryController::class, 'show']);
    Route::get('units', [UnitController::class, 'index']);
    Route::get('units/{unit}', [UnitController::class, 'show']);
    Route::get('customers', [CustomerController::class, 'index']);
    Route::get('customers/{customer}', [CustomerController::class, 'show']);

    Route::get('products', [ProductController::class, 'index']);
    Route::get('products/barcode/{kode}', [ProductController::class, 'barcode']);
    // Harus di atas products/{product}, atau "barcode-baru" dianggap id produk.
    Route::get('products/barcode-baru', [ProductController::class, 'barcodeBaru'])->middleware('role:admin');
    Route::get('products/{product}', [ProductController::class, 'show']);

    // ---- Pembayaran non-tunai (Midtrans Snap).
    Route::get('midtrans/config', [PaymentController::class, 'konfigurasi']);
    Route::post('transactions/{transaction}/snap-token', [PaymentController::class, 'snapToken']);
    Route::get('transactions/{transaction}/status', [PaymentController::class, 'status']);

    // ---- Shift kasir.
    Route::get('shifts/aktif', [ShiftController::class, 'aktif']);
    Route::post('shifts/open', [ShiftController::class, 'buka']);
    Route::post('shifts/close', [ShiftController::class, 'tutup']);

    // ---- Transaksi: kasir hanya melihat shift sendiri (disaring di controller).
    Route::get('transactions', [TransactionController::class, 'index']);
    Route::post('transactions', [TransactionController::class, 'store']);
    Route::get('transactions/{transaction}', [TransactionController::class, 'show']);

    // ---- Retur: kasir boleh mengajukan, keputusannya milik admin.
    Route::get('returns', [SalesReturnController::class, 'index']);
    Route::post('returns', [SalesReturnController::class, 'store']);
    Route::get('returns/{retur}', [SalesReturnController::class, 'show']);

    // ---- Inventori: kasir hanya boleh melihat (Bagian 2.2).
    Route::get('purchases', [PurchaseController::class, 'index']);
    Route::get('purchases/{purchase}', [PurchaseController::class, 'show']);
    Route::get('opnames', [StockOpnameController::class, 'index']);
    Route::get('opnames/{opname}', [StockOpnameController::class, 'show']);

    /*
    |----------------------------------------------------------------------
    | Khusus admin
    |----------------------------------------------------------------------
    */
    Route::middleware('role:admin')->group(function (): void {

        Route::apiResource('categories', CategoryController::class)->except(['index', 'show']);
        Route::apiResource('units', UnitController::class)->except(['index', 'show']);
        Route::apiResource('customers', CustomerController::class)->except(['index', 'show']);
        Route::apiResource('products', ProductController::class)->except(['index', 'show']);
        Route::post('products/barcode-otomatis', [ProductController::class, 'barcodeOtomatis']);
        Route::post('products/{product}/gambar', [ProductController::class, 'unggahGambar']);
        Route::delete('products/{product}/gambar', [ProductController::class, 'hapusGambar']);
        Route::apiResource('suppliers', SupplierController::class);
        Route::apiResource('users', UserController::class);

        Route::post('purchases', [PurchaseController::class, 'store']);
        Route::post('opnames', [StockOpnameController::class, 'store']);

        Route::post('returns/{retur}/approve', [SalesReturnController::class, 'setujui']);
        Route::post('returns/{retur}/reject', [SalesReturnController::class, 'tolak']);

        Route::apiResource('expenses', OperationalExpenseController::class)
            ->parameters(['expenses' => 'beban']);

        Route::put('pengaturan', [PengaturanController::class, 'update']);
        Route::post('pengaturan/logo', [PengaturanController::class, 'unggahLogo']);
        Route::delete('pengaturan/logo', [PengaturanController::class, 'hapusLogo']);

        Route::get('reports/sales', [ReportController::class, 'sales']);
        Route::get('reports/profit-loss', [ReportController::class, 'profitLoss']);
        Route::get('reports/stock', [ReportController::class, 'stock']);

        // Unduhan PDF / Excel (?format=pdf|xlsx), isi sama dengan versi JSON.
        Route::get('reports/sales/unduh', [ReportController::class, 'unduhPenjualan']);
        Route::get('reports/profit-loss/unduh', [ReportController::class, 'unduhLabaRugi']);
        Route::get('reports/stock/unduh', [ReportController::class, 'unduhStok']);
    });
});
