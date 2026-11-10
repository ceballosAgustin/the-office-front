import { useState, useEffect } from 'react';
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

export default function ProductPurchaseSection({ product, onVariantChange }) {
  const { items, addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState(null);
  const [addedFeedback, setAddedFeedback] = useState(null);

  // Reset purchase state whenever the displayed product changes
  useEffect(() => {
    setSelectedVariantId(null);
    setQuantity(1);
    setValidationError(null);
    setAddedFeedback(null);
  }, [product?.id]);

  const variants = Array.isArray(product?.variants)
    ? product.variants.filter((v) => v && v.isActive !== false && v.id != null)
    : [];
  const hasVariants = variants.length > 0;
  const hasAvailableStock = variants.some((v) => Number(v.stock ?? 0) > 0);

  // Detect products that do not use physical apparel sizes (single 'Único' or 'One Size' variant)
  const isSingleSizeProduct =
    variants.length === 1 && isSingleSizeVariantName(variants[0].size);

  const selectedVariant = isSingleSizeProduct
    ? variants[0] || null
    : variants.find((v) => v.id === selectedVariantId) || null;

  useEffect(() => {
    if (typeof onVariantChange === 'function') {
      onVariantChange(selectedVariant);
    }
  }, [selectedVariant, onVariantChange]);

  const selectedStock = selectedVariant
    ? Math.max(0, Math.floor(Number(selectedVariant.stock ?? 0)))
    : 0;
  const isSelectedOutOfStock = Boolean(selectedVariant && selectedStock <= 0);

  const existingInCart = selectedVariant
    ? items.find((i) => i.variantId === selectedVariant.id)
    : null;
  const currentQtyInCart = existingInCart ? existingInCart.quantity : 0;

  // Ensure quantity always stays within [1, selectedStock] if product/variant stock updates
  useEffect(() => {
    if (!selectedVariant || selectedStock <= 0) {
      setQuantity(1);
      return;
    }
    setQuantity((prev) => Math.max(1, Math.min(prev, selectedStock)));
  }, [selectedVariant?.id, selectedStock]);

  const handleVariantSelect = (variant) => {
    const newStock = Math.max(0, Math.floor(Number(variant.stock ?? 0)));
    setSelectedVariantId(variant.id);
    setAddedFeedback(null);

    if (newStock <= 0) {
      setQuantity(1);
      setValidationError(
        `El talle ${variant.size} se encuentra agotado (0 unidades disponibles).`
      );
      return;
    }

    // Clamp quantity to remain valid for the newly selected variant
    setQuantity((prev) => Math.max(1, Math.min(prev, newStock)));
    setValidationError(null);
  };

  const handleDecrementQuantity = () => {
    if (!selectedVariant || selectedStock <= 0 || quantity <= 1) return;
    setQuantity((prev) => Math.max(1, prev - 1));
    setValidationError(null);
  };

  const handleIncrementQuantity = () => {
    if (!selectedVariant || selectedStock <= 0 || quantity >= selectedStock) return;
    setQuantity((prev) => Math.min(selectedStock, prev + 1));
    setValidationError(null);
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

    if (selectedStock <= 0) {
      setValidationError(
        isSingleSizeProduct
          ? 'Este artículo se encuentra agotado (0 unidades disponibles).'
          : `El talle ${selectedVariant.size} se encuentra agotado (0 unidades disponibles).`
      );
      setAddedFeedback(null);
      return;
    }

    const safeQty = Math.floor(Number(quantity));
    if (!Number.isFinite(safeQty) || safeQty < 1) {
      setValidationError('La cantidad mínima para agregar al carrito es 1 unidad.');
      return;
    }

    if (safeQty > selectedStock) {
      setValidationError(
        `No podés agregar ${safeQty} unidades. Stock disponible: ${selectedStock} ${selectedStock === 1 ? 'unidad' : 'unidades'
        }.`
      );
      return;
    }

    const accumulatedQty = currentQtyInCart + safeQty;
    if (accumulatedQty > selectedStock) {
      const remaining = Math.max(0, selectedStock - currentQtyInCart);
      setValidationError(
        currentQtyInCart > 0
          ? remaining > 0
            ? `No se puede superar el stock disponible (${selectedStock} ${selectedStock === 1 ? 'unidad' : 'unidades'
            } en ${isSingleSizeProduct ? 'total' : `talle ${selectedVariant.size}`
            }). Ya tenés ${currentQtyInCart} en tu carrito; podés agregar hasta ${remaining} más.`
            : `Alcanzaste el límite de stock disponible (${selectedStock} ${selectedStock === 1 ? 'unidad' : 'unidades'
            } en ${isSingleSizeProduct ? 'total' : `talle ${selectedVariant.size}`
            }). Ya tenés el total disponible en tu carrito.`
          : `La cantidad seleccionada (${safeQty}) supera el stock disponible (${selectedStock} ${selectedStock === 1 ? 'unidad' : 'unidades'
          }).`
      );
      setAddedFeedback(null);
      return;
    }

    try {
      const effectiveUnitPrice =
        selectedVariant?.price != null && Number(selectedVariant.price) > 0
          ? Number(selectedVariant.price)
          : Number(product?.price) || 0;

      addItem(
        {
          productId: product?.id ? Number(product.id) : undefined,
          variantId: selectedVariant.id,
          title: product?.title || 'Producto',
          size: selectedVariant.size,
          unitPrice: effectiveUnitPrice,
          image: product?.image || '',
          maxStock: selectedStock,
        },
        safeQty
      );

      setValidationError(null);
      setAddedFeedback({
        size: selectedVariant.size,
        isSingleSize: isSingleSizeProduct,
        addedQuantity: safeQty,
        totalInCart: accumulatedQty,
      });

      // Adjust selector quantity to remaining available or 1
      const nextRemaining = Math.max(1, selectedStock - accumulatedQty);
      setQuantity((prev) => Math.min(prev, nextRemaining));
    } catch (err) {
      setValidationError(
        err?.message || 'No se pudo agregar el producto al carrito.'
      );
      setAddedFeedback(null);
    }
  };

  const canDecrease = Boolean(
    selectedVariant && selectedStock > 0 && quantity > 1
  );
  const canIncrease = Boolean(
    selectedVariant && selectedStock > 0 && quantity < selectedStock
  );
  const isAddDisabled =
    !hasVariants || !hasAvailableStock || isSelectedOutOfStock;

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
            className={`px-2.5 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider rounded-xs ${selectedStock > 0
                ? 'bg-brand-dark/[0.06] text-brand-dark'
                : 'bg-red-50 text-red-800 border border-red-200'
              }`}
          >
            {selectedStock > 0 ? `${selectedStock} disp.` : 'Agotado'}
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
                {isSelectedOutOfStock ? (
                  <span className="text-red-700 ml-1.5 font-semibold uppercase text-[11px]">
                    (Agotado)
                  </span>
                ) : (
                  <span className="text-brand-dark/45 ml-1.5 font-normal">
                    ({selectedStock} disp.)
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
              const isOutOfStock = Number(variant.stock ?? 0) <= 0;

              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleVariantSelect(variant)}
                  className={`min-h-[44px] px-2 flex flex-col items-center justify-center text-xs font-semibold uppercase tracking-wider rounded-xs border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark cursor-pointer ${isOutOfStock
                      ? isSelected
                        ? 'bg-red-50/90 text-red-900 border-red-400 ring-1 ring-red-300'
                        : 'bg-brand-dark/[0.03] text-brand-dark/35 border-brand-dark/10 line-through hover:border-brand-dark/30'
                      : isSelected
                        ? 'bg-brand-dark text-[#FAFAFA] border-brand-dark shadow-xs'
                        : 'bg-white/80 text-brand-dark border-brand-dark/15 hover:border-brand-dark hover:bg-white'
                    }`}
                >
                  <span>{variant.size}</span>
                  {isOutOfStock ? (
                    <span className="text-[9px] font-normal tracking-normal leading-none mt-0.5 no-underline">
                      Agotado
                    </span>
                  ) : product?.hasVariantPriceRange && variant.formattedPrice ? (
                    <span className="text-[9px] font-normal tracking-normal leading-none mt-0.5 opacity-80 tabular-nums">
                      {variant.formattedPrice}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity Selector (- / +) */}
      {hasVariants && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-brand-dark/50">
              Cantidad
            </span>
            <span className="text-[11px] text-brand-dark/55 tabular-nums">
              {!selectedVariant ? (
                'Elegí un talle para definir cantidad'
              ) : isSelectedOutOfStock ? (
                <span className="text-red-700 font-medium">
                  Sin stock disponible (0 u.)
                </span>
              ) : (
                <>
                  Disponible: {selectedStock}{' '}
                  {selectedStock === 1 ? 'unidad' : 'unidades'}
                  {currentQtyInCart > 0 && (
                    <span className="ml-1.5 text-brand-dark font-medium">
                      • En carrito: {currentQtyInCart}
                    </span>
                  )}
                </>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 p-2.5 bg-white/80 border border-brand-dark/15 rounded-xs">
            <div
              className="inline-flex items-center border border-brand-dark/15 bg-white rounded-xs"
              role="group"
              aria-label="Selector de cantidad"
            >
              <button
                type="button"
                onClick={handleDecrementQuantity}
                disabled={!canDecrease}
                className={`w-10 h-10 flex items-center justify-center text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark ${!canDecrease
                    ? 'text-brand-dark/25 cursor-not-allowed'
                    : 'text-brand-dark hover:bg-brand-dark/[0.06] active:bg-brand-dark/[0.1] cursor-pointer'
                  }`}
                aria-label="Reducir cantidad"
              >
                −
              </button>
              <span
                className={`w-12 text-center text-sm font-semibold tabular-nums select-none ${!selectedVariant || isSelectedOutOfStock
                    ? 'text-brand-dark/35'
                    : 'text-brand-dark'
                  }`}
                aria-live="polite"
              >
                {isSelectedOutOfStock ? 0 : quantity}
              </span>
              <button
                type="button"
                onClick={handleIncrementQuantity}
                disabled={!canIncrease}
                className={`w-10 h-10 flex items-center justify-center text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark ${!canIncrease
                    ? 'text-brand-dark/25 cursor-not-allowed'
                    : 'text-brand-dark hover:bg-brand-dark/[0.06] active:bg-brand-dark/[0.1] cursor-pointer'
                  }`}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>

            <div className="text-right text-[11px] text-brand-dark/55 leading-tight">
              {selectedVariant && !isSelectedOutOfStock && quantity >= selectedStock ? (
                <span className="font-medium text-brand-dark/80">
                  Máximo disponible ({selectedStock} u.)
                </span>
              ) : selectedVariant && isSelectedOutOfStock ? (
                <span className="font-semibold text-red-700 uppercase tracking-wider">
                  Talle agotado
                </span>
              ) : (
                <span>Mín. 1 u.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Validation Feedback */}
      {validationError && (
        <div
          className="p-3 bg-red-50/90 border border-red-200 rounded-xs text-xs font-medium text-red-800 leading-relaxed"
          role="alert"
        >
          {validationError}
        </div>
      )}

      {/* Main Add to Cart CTA */}
      <div className="space-y-3 pt-1">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isAddDisabled}
          className={`w-full min-h-[48px] md:min-h-[52px] px-6 flex items-center justify-center gap-2 rounded-xs text-sm font-semibold tracking-wide uppercase transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${isAddDisabled
              ? 'bg-brand-dark/20 text-brand-dark/50 cursor-not-allowed'
              : 'bg-brand-dark text-[#FAFAFA] hover:opacity-90 active:scale-[0.99] cursor-pointer'
            }`}
          aria-label="Agregar al carrito"
        >
          {!hasVariants || !hasAvailableStock
            ? 'Sin stock disponible'
            : isSelectedOutOfStock
              ? 'Talle agotado — Sin stock'
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
                Sumaste {addedFeedback.addedQuantity}{' '}
                {addedFeedback.addedQuantity === 1 ? 'unidad' : 'unidades'} •
                Total en bolsa: {addedFeedback.totalInCart}{' '}
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
