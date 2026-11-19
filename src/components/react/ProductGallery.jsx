import { useState, useEffect, useCallback } from 'react';
import { getOptimizedImageUrl } from '../../utils/images';

export default function ProductGallery({ images = [], title = 'Producto' }) {
  const validImages = Array.isArray(images)
    ? images.filter((url) => typeof url === 'string' && url.trim().length > 0)
    : [];

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected image index whenever the product's image collection changes
  const imagesSignature = validImages.join('|');
  useEffect(() => {
    setSelectedIndex(0);
  }, [imagesSignature]);

  const totalImages = validImages.length;
  const hasMultipleImages = totalImages > 1;
  const safeIndex =
    selectedIndex >= 0 && selectedIndex < totalImages ? selectedIndex : 0;

  const handlePrevious = useCallback(() => {
    if (totalImages <= 1) return;
    setSelectedIndex((prev) => {
      const current = prev >= 0 && prev < totalImages ? prev : 0;
      return current <= 0 ? totalImages - 1 : current - 1;
    });
  }, [totalImages]);

  const handleNext = useCallback(() => {
    if (totalImages <= 1) return;
    setSelectedIndex((prev) => {
      const current = prev >= 0 && prev < totalImages ? prev : 0;
      return current >= totalImages - 1 ? 0 : current + 1;
    });
  }, [totalImages]);

  // Keyboard navigation (ArrowLeft / ArrowRight), scoped to the focused gallery container
  const handleKeyDown = (event) => {
    if (!hasMultipleImages) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handlePrevious();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleNext();
    }
  };

  if (totalImages === 0) {
    return (
      <div className="aspect-[4/3] max-h-[500px] w-full bg-brand-dark/5 border border-brand-dark/10 rounded-xs flex items-center justify-center text-brand-dark/40 text-sm">
        No hay imagen disponible
      </div>
    );
  }

  const currentImage = validImages[safeIndex] || validImages[0];

  return (
    <div
      className="flex flex-col gap-3 sm:gap-4 w-full focus-visible:outline-none"
      {...(hasMultipleImages
        ? {
            tabIndex: 0,
            role: 'group',
            'aria-label': `Galería de imágenes de ${title}. Usá las flechas izquierda y derecha para navegar.`,
            onKeyDown: handleKeyDown,
          }
        : {})}
    >
      {/* Main Image Frame (dynamically fits image proportions without forced 4:5 vertical margins) */}
      <div className="relative w-full overflow-hidden rounded-xs flex items-center justify-center">
        <img
          key={currentImage}
          src={getOptimizedImageUrl(currentImage, 'detail')}
          alt={`${title} — Vista ${safeIndex + 1} de ${totalImages}`}
          className="w-full h-auto max-h-[75vh] sm:max-h-[600px] object-contain object-center transition-opacity duration-300 ease-out select-none"
          loading="eager"
          decoding="async"
        />

        {/* Left & Right Arrow Controls (only when product has > 1 image) */}
        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={handlePrevious}
              aria-label="Imagen anterior"
              className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xs bg-[#FAFAFA]/85 hover:bg-brand-dark text-brand-dark hover:text-[#FAFAFA] border border-brand-dark/15 backdrop-blur-xs shadow-xs transition-all duration-150 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Imagen siguiente"
              className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xs bg-[#FAFAFA]/85 hover:bg-brand-dark text-brand-dark hover:text-[#FAFAFA] border border-brand-dark/15 backdrop-blur-xs shadow-xs transition-all duration-150 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-[#1D110D]/75 backdrop-blur-xs text-[#FAFAFA] text-[10px] font-mono tracking-wider tabular-nums pointer-events-none z-10">
              {safeIndex + 1} / {totalImages}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails (Only rendered when there are multiple images) */}
      {hasMultipleImages && (
        <div
          className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Vistas del producto"
        >
          {validImages.map((img, idx) => {
            const isSelected = idx === safeIndex;
            return (
              <button
                key={img + idx}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`Ver imagen ${idx + 1} de ${title}`}
                onClick={() => setSelectedIndex(idx)}
                className={`relative aspect-square w-16 sm:w-20 shrink-0 overflow-hidden rounded-xs transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark flex items-center justify-center p-0.5 ${
                  isSelected
                    ? 'ring-2 ring-brand-dark opacity-100'
                    : 'opacity-60 hover:opacity-100 ring-1 ring-brand-dark/15'
                }`}
              >
                <img
                  src={getOptimizedImageUrl(img, 'thumbnail')}
                  alt={`Miniatura ${idx + 1}`}
                  className="w-full h-full object-contain object-center select-none"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
