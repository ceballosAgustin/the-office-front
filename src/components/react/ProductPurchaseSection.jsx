import { useState } from 'react';

export default function ProductPurchaseSection({ availableSizes, colors }) {
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(
    colors && colors.length > 0 ? colors[0].name : null
  );
  const [validationError, setValidationError] = useState(null);
  const [provisionalNotice, setProvisionalNotice] = useState(null);

  const hasSizes = availableSizes && availableSizes.length > 0;
  const hasColors = colors && colors.length > 0;

  const handleSizeClick = (size) => {
    setSelectedSize(size);
    setValidationError(null);
    setProvisionalNotice(null);
  };

  const handleColorClick = (colorName) => {
    setSelectedColor(colorName);
    setProvisionalNotice(null);
  };

  const handleAddToCart = () => {
    if (hasSizes && !selectedSize) {
      setValidationError('Por favor seleccioná un talle antes de continuar.');
      setProvisionalNotice(null);
      return;
    }

    setValidationError(null);
    // Explicitly document provisional state without simulating false purchase or modifying cart count
    const sizeInfo = selectedSize ? `Talle ${selectedSize}` : '';
    const colorInfo = selectedColor ? `Color ${selectedColor}` : '';
    const variantInfo = [sizeInfo, colorInfo].filter(Boolean).join(' • ');

    setProvisionalNotice(
      `Opción seleccionada: ${variantInfo || 'Estándar'}. Botón preparado para la integración del carrito en la próxima etapa.`
    );
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Color Selector (Rendered only when product has color variants) */}
      {hasColors && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-brand-dark/50">
              Color
            </span>
            <span className="font-medium text-brand-dark">
              {selectedColor}
            </span>
          </div>
          <div className="flex items-center gap-2.5" role="group" aria-label="Selección de color">
            {colors.map((color) => {
              const isSelected = selectedColor === color.name;
              return (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => handleColorClick(color.name)}
                  aria-pressed={isSelected}
                  aria-label={`Color ${color.name}`}
                  className={`w-8 h-8 rounded-full transition-transform duration-150 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark ${
                    isSelected ? 'ring-2 ring-brand-dark ring-offset-2 scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100 ring-1 ring-black/10'
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Size Selector (Rendered only when product has available sizes) */}
      {hasSizes && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-brand-dark/50">
              Seleccioná tu talle
            </span>
            {selectedSize && (
              <span className="font-medium text-brand-dark">
                Seleccionado: {selectedSize}
              </span>
            )}
          </div>
          <div
            className="grid grid-cols-4 sm:grid-cols-5 gap-2"
            role="radiogroup"
            aria-label="Selección de talle"
          >
            {availableSizes.map((size) => {
              const isSelected = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSizeClick(size)}
                  className={`min-h-[44px] flex items-center justify-center text-xs font-semibold uppercase tracking-wider rounded-xs border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark ${
                    isSelected
                      ? 'bg-brand-dark text-[#FAFAFA] border-brand-dark shadow-xs'
                      : 'bg-white/80 text-brand-dark border-brand-dark/15 hover:border-brand-dark hover:bg-white'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation Feedback */}
      {validationError && (
        <p className="text-xs font-medium text-red-600 tracking-tight" role="alert">
          {validationError}
        </p>
      )}

      {/* Main Add to Cart CTA */}
      <div className="space-y-3 pt-1">
        <button
          type="button"
          onClick={handleAddToCart}
          className="w-full min-h-[48px] md:min-h-[52px] px-6 flex items-center justify-center gap-2 rounded-xs bg-brand-dark text-[#FAFAFA] text-sm font-semibold tracking-wide uppercase transition-all duration-150 hover:opacity-90 active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2"
          aria-label="Agregar al carrito"
        >
          Agregar al carrito
        </button>

        {/* Provisional Note / Integration Hook Message */}
        {provisionalNotice && (
          <div
            className="p-3 bg-brand-dark/[0.04] border border-brand-dark/[0.08] rounded-xs text-[11px] leading-relaxed text-brand-dark/70 animate-fadeIn"
            role="status"
            aria-live="polite"
          >
            <p className="font-semibold text-brand-dark/90">
              Estado de compra (provisional):
            </p>
            <p>{provisionalNotice}</p>
          </div>
        )}
      </div>
    </div>
  );
}
