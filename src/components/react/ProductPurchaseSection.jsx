import { useState } from 'react';
import { useCart } from '../../store/cartStore';

export default function ProductPurchaseSection({ product }) {
  const { items, addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [addedFeedback, setAddedFeedback] = useState(null);

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const hasVariants = variants.length > 0;
  const hasAvailableStock = variants.some((v) => (v.stock ?? 0) > 0);

  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) || null;

  const handleVariantSelect = (variant) => {
    if ((variant.stock ?? 0) <= 0) return;
    setSelectedVariantId(variant.id);
    setValidationError(null);
    setAddedFeedback(null);
  };

  const handleAddToCart = () => {
    if (!hasVariants || !hasAvailableStock) {
      setValidationError(
        'Este producto no posee variantes con stock disponible en este momento.'
      );
      return;
    }

    if (!selectedVariant) {
      setValidationError('Por favor seleccioná un talle antes de continuar.');
      setAddedFeedback(null);
      return;
    }

    const existingInCart = items.find(
      (i) => i.variantId === selectedVariant.id
    );
    const currentQtyInCart = existingInCart ? existingInCart.quantity : 0;

    if (
      selectedVariant.stock !== undefined &&
      currentQtyInCart + 1 > selectedVariant.stock
    ) {
      setValidationError(
        `Alcanzaste el límite de stock disponible (${selectedVariant.stock} u.) para el talle ${selectedVariant.size}.`
      );
      return;
    }

    setValidationError(null);

    addItem(
      {
        productId: product?.id ? Number(product.id) : undefined,
        variantId: selectedVariant.id,
        title: product?.title || 'Producto',
        size: selectedVariant.size,
        unitPrice: Number(product?.price) || 0,
        image: product?.image || '',
        maxStock: selectedVariant.stock,
      },
      1
    );

    setAddedFeedback({
      size: selectedVariant.size,
      totalInCart: currentQtyInCart + 1,
    });
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Size / Variant Selector */}
      {hasVariants ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-brand-dark/50">
              Seleccioná tu talle
            </span>
            {selectedVariant && (
              <span className="font-medium text-brand-dark">
                Talle {selectedVariant.size}
                {selectedVariant.stock !== undefined && (
                  <span className="text-brand-dark/45 ml-1.5 font-normal">
                    ({selectedVariant.stock} disp.)
                  </span>
                )}
              </span>
            )}
          </div>
          <div
            className="grid grid-cols-4 sm:grid-cols-5 gap-2"
            role="radiogroup"
            aria-label="Selección de talle"
          >
            {variants.map((variant) => {
              const isSelected = selectedVariantId === variant.id;
              const isOutOfStock = (variant.stock ?? 0) <= 0;

              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isOutOfStock}
                  onClick={() => handleVariantSelect(variant)}
                  className={`min-h-[44px] flex items-center justify-center text-xs font-semibold uppercase tracking-wider rounded-xs border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark ${
                    isOutOfStock
                      ? 'bg-brand-dark/[0.03] text-brand-dark/30 border-brand-dark/10 line-through cursor-not-allowed'
                      : isSelected
                      ? 'bg-brand-dark text-[#FAFAFA] border-brand-dark shadow-xs cursor-pointer'
                      : 'bg-white/80 text-brand-dark border-brand-dark/15 hover:border-brand-dark hover:bg-white cursor-pointer'
                  }`}
                >
                  {variant.size}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-3 bg-brand-dark/[0.03] border border-brand-dark/[0.08] rounded-xs text-xs text-brand-dark/60">
          Este artículo no cuenta con variantes de talle habilitadas para consulta.
        </div>
      )}

      {/* Validation Feedback */}
      {validationError && (
        <p
          className="text-xs font-medium text-red-600 tracking-tight"
          role="alert"
        >
          {validationError}
        </p>
      )}

      {/* Main Add to Cart CTA */}
      <div className="space-y-3 pt-1">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!hasVariants || !hasAvailableStock}
          className={`w-full min-h-[48px] md:min-h-[52px] px-6 flex items-center justify-center gap-2 rounded-xs text-sm font-semibold tracking-wide uppercase transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${
            !hasVariants || !hasAvailableStock
              ? 'bg-brand-dark/20 text-brand-dark/50 cursor-not-allowed'
              : 'bg-brand-dark text-[#FAFAFA] hover:opacity-90 active:scale-[0.99] cursor-pointer'
          }`}
          aria-label="Agregar al carrito"
        >
          {!hasVariants || !hasAvailableStock
            ? 'Sin stock disponible'
            : 'Agregar al carrito'}
        </button>

        {/* Added to Cart Confirmation Notice */}
        {addedFeedback && (
          <div
            className="p-3.5 bg-brand-dark/[0.04] border border-brand-dark/[0.12] rounded-xs text-xs leading-relaxed text-brand-dark flex items-center justify-between gap-3 animate-fadeIn"
            role="status"
            aria-live="polite"
          >
            <div>
              <p className="font-semibold text-brand-dark">
                Agregado a tu bolsa — Talle {addedFeedback.size}
              </p>
              <p className="text-[11px] text-brand-dark/65">
                Cantidad en bolsa para este talle: {addedFeedback.totalInCart}{' '}
                {addedFeedback.totalInCart === 1 ? 'unidad' : 'unidades'}
              </p>
            </div>
            <a
              href="/cart"
              className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-brand-dark underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              Ver carrito →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
