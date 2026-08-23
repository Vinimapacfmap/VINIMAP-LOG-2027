/**
 * Utility to compress and downsample images before saving or uploading
 * Uses URL.createObjectURL and immediate canvas/image memory cleanup
 * to prevent 'out of memory' exceptions on mobile webviews and browsers.
 */
export async function compressImage(
  source: string | File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve) => {
    let objectUrlToClean: string | null = null;

    const cleanup = (img?: HTMLImageElement, canvas?: HTMLCanvasElement) => {
      if (objectUrlToClean) {
        try {
          URL.revokeObjectURL(objectUrlToClean);
        } catch (_) {}
        objectUrlToClean = null;
      }
      if (img) {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      }
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };

    const processImg = (img: HTMLImageElement, originalSizeLabel?: string) => {
      try {
        let width = img.width || 800;
        let height = img.height || 600;

        // Downsample to stay within maxWidth and maxHeight bounds
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup(img, canvas);
          resolve(typeof source === 'string' ? source : '');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        const compressedSizeKB = Math.round((compressedDataUrl.length * 0.75) / 1024);
        console.log(`[ImageCompressor] Compressed photo safely:`, {
          originalDimensions: `${img.width}x${img.height}`,
          compressedDimensions: `${width}x${height}`,
          originalSize: originalSizeLabel || 'N/A',
          compressedSize: `${compressedSizeKB} KB`
        });

        cleanup(img, canvas);
        resolve(compressedDataUrl);
      } catch (err) {
        console.warn('[ImageCompressor] Memory warning during canvas compress, attempting fallback:', err);
        cleanup(img);
        // Fallback: try ultra-light 400x300 downsample if memory is constrained
        try {
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = 400;
          fallbackCanvas.height = 300;
          const fallbackCtx = fallbackCanvas.getContext('2d');
          if (fallbackCtx && img) {
            fallbackCtx.drawImage(img, 0, 0, 400, 300);
            const fallbackUrl = fallbackCanvas.toDataURL('image/jpeg', 0.5);
            fallbackCanvas.width = 0;
            fallbackCanvas.height = 0;
            resolve(fallbackUrl);
            return;
          }
        } catch (_) {}
        resolve(typeof source === 'string' ? source : '');
      }
    };

    if (typeof source === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => processImg(img, `${Math.round((source.length * 0.75) / 1024)} KB`);
      img.onerror = (err) => {
        cleanup(img);
        console.warn('[ImageCompressor] Error loading image string, returning original:', err);
        resolve(source);
      };
      img.src = source;
    } else if (source instanceof File) {
      const originalSizeLabel = `${Math.round(source.size / 1024)} KB`;
      try {
        objectUrlToClean = URL.createObjectURL(source);
        const img = new Image();
        img.onload = () => processImg(img, originalSizeLabel);
        img.onerror = () => {
          cleanup(img);
          resolve('');
        };
        img.src = objectUrlToClean;
      } catch (err) {
        console.warn('[ImageCompressor] createObjectURL failed, falling back to FileReader:', err);
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => processImg(img, originalSizeLabel);
          img.onerror = () => {
            cleanup(img);
            resolve((e.target?.result as string) || '');
          };
          img.src = (e.target?.result as string) || '';
        };
        reader.onerror = () => {
          cleanup();
          resolve('');
        };
        reader.readAsDataURL(source);
      }
    } else {
      resolve('');
    }
  });
}

