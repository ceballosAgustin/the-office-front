import { useState } from 'react';
import { useCart } from '../../store/cartStore';

const SINGLE_SIZE_LABELS = new Set([
  'unico',
  'único',
  'one size',
  'onesize',
  'u',
  'sin talle',
  'talle unico',
  'talle único',
]);

function isSingleSizeVariantName(size) {
  if (!size || typeof size !== 'string') return false;
  return SINGLE_SIZE_LABELS.has(size.trim().toLowerCase());
}

export default function ProductPurchaseSection({ product }) {
  const { items, addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [addedFeedback, setAddedFeedback] = useState(null);

  const variants = Array.isArray(product?.variants)
    ? product.variants.filter((v) => v && v.isActive !== false && v.id != null)
    : [];
  const hasVariants = variants.length > 0;
  const hasAvailableStock = variants.some((v) => (v.stock ?? 0) > 0);

  // Detect products that do not use physical apparel sizes (single 'Único' or 'One Size' variant)
  const isSingleSizeProduct =
    variants.length === 1 && isSingleSizeVariantName(variants[0].size);

  const selectedVariant = isSingleSizeProduct
    ? (variants[0].stock ?? 0) > 0
      ? variants[0]
      : null
    : variants.find((v) => v.id === selectedVariantId) || null;

  const handleVariantSelect = (variant) => {
    if ((variant.stock ?? 0) <= 0) return;
    setSelectedVariantId(variant.id);
    setValidationError(null);
    setAddedFeedback(null);
  };

  const handleAddToCart = () => {
    if (!hasVariants || !hasAvailableStock) {
      setValidationError(
        'Este producto no posee variantes activas con stock disponible en este momento.'
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
        isSingleSizeProduct
          ? `Alcanzaste el límite de stock disponible (${selectedVariant.stock} u.) para este artículo.`
          : `Alcanzaste el límite de stock disponible (${selectedVariant.stock} u.) para el talle ${selectedVariant.size}.`
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
      isSingleSize: isSingleSizeProduct,
      totalInCart: currentQtyInCart + 1,
    });
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Size / Variant Selector */}
      {!hasVariants ? (
        <div className="p-3 bg-brand-dark/[0.03] border border-brand-dark/[0.08] rounded-xs text-xs text-brand-dark/60">
          Este artículo no cuenta con variantes activas habilitadas para consulta.
        </div>
      ) : isSingleSizeProduct ? (
        <div className="p-3.5 bg-white/75 border border-brand-dark/12 rounded-xs flex items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-dark/45">
              Presentación del artículo
            </span>
            <span className="font-semibold text-brand-dark uppercase tracking-wide">
              Talle {variants[0].size} (Sin selección de talle requerida)
            </span>
          </div>
          <span
            className={`px-2.5 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider rounded-xs ${
              (variants[0].stock ?? 0) > 0
                ? 'bg-brand-dark/[0.06] text-brand-dark'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {(variants[0].stock ?? 0) > 0
              ? `${variants[0].stock} disp.`
              : 'Agotado'}
          </span>
        </div>
      ) : (
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
                {addedFeedback.isSingleSize
                  ? `Agregado a tu bolsa (${addedFeedback.size})`
                  : `Agregado a tu bolsa — Talle ${addedFeedback.size}`}
              </p>
              <p className="text-[11px] text-brand-dark/65">
                Cantidad en bolsa:{' '}
                {addedFeedback.totalInCart}{' '}
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
