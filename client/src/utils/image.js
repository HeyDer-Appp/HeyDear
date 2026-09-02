// Reads a File into a raw data URL, with the same validation
// fileToResizedBase64 does — used to feed the crop UI (react-easy-crop
// needs a URL/data URL to display, not a File object) before the actual
// crop+resize happens in cropAndResizeImage below.
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('Image is too large (max 15MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// Takes a data URL plus a crop rect in the original image's pixel
// coordinates (react-easy-crop's onCropComplete gives exactly this shape:
// { x, y, width, height }) and produces a resized square JPEG data URL.
export function cropAndResizeImage(imageSrc, cropPixels, { maxSize = 480, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.onload = () => {
      const size = Math.min(maxSize, cropPixels.width);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(
        img,
        cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
        0, 0, size, size
      );
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = imageSrc;
  });
}

// Resizes an image file client-side and returns it as a base64 data URI.
// Firestore caps documents at 1MiB, and this string gets stored directly on
// the user's profile doc, so we keep it small (a few hundred px, JPEG,
// moderate quality — plenty for an avatar-sized photo).
export function fileToResizedBase64(file, { maxSize = 480, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('Image is too large (max 15MB).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
