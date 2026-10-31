import { useState } from 'react';

export default function ProductGallery({ images = [], title = 'Producto' }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-[4/5] w-full bg-[#F2F2F0] rounded-xs flex items-center justify-center text-brand-dark/40 text-sm">
        No hay imagen disponible
      </div>
    );
  }

  const currentImage = images[selectedIndex] || images[0];
  const hasMultipleImages = images.length > 1;

  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full">
      {/* Main Image Frame (4:5 proportion, clean neutral backdrop) */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F2F2F0] rounded-xs">
        <img
          key={currentImage}
          src={currentImage}
          alt={`${title} — Vista ${selectedIndex + 1} de ${images.length}`}
          className="w-full h-full object-cover transition-opacity duration-300 ease-out select-none"
          loading="eager"
          decoding="async"
        />
        {hasMultipleImages && (
          <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-[#1D110D]/75 backdrop-blur-xs text-[#FAFAFA] text-[10px] font-mono tracking-wider tabular-nums pointer-events-none">
            {selectedIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails (Only rendered when there are multiple images) */}
      {hasMultipleImages && (
        <div
          className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Vistas del producto"
        >
          {images.map((img, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={img + idx}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`Ver imagen ${idx + 1} de ${title}`}
                onClick={() => setSelectedIndex(idx)}
                className={`relative aspect-[4/5] w-16 sm:w-20 shrink-0 overflow-hidden rounded-xs bg-[#F2F2F0] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark ${
                  isSelected
                    ? 'ring-2 ring-brand-dark opacity-100'
                    : 'opacity-60 hover:opacity-100 ring-1 ring-brand-dark/10'
                }`}
              >
                <img
                  src={img}
                  alt={`Miniatura ${idx + 1}`}
                  className="w-full h-full object-cover"
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
