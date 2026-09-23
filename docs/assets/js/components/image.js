/**
 * Perkecil gambar unggahan menjadi persegi (crop tengah) sebelum disimpan.
 * Foto 2 MB menjadi ±15 KB, sehingga muat di localStorage.
 */

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Berkas bukan gambar yang valid.'));
    };
    image.src = url;
  });
}

/** @returns {Promise<string>} data URL WebP berukuran size × size */
export async function resizeImageFile(file, size = 256) {
  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  return canvas.toDataURL('image/webp', 0.85);
}
