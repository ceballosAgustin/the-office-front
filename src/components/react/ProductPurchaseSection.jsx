import { useState, useEffect, useRef } from 'react';
import { useCart, getCartItemQuantityLimit } from '../../store/cartStore';
import { formatProductSize, sortProductVariants } from '../../services/api';

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
  // Mobile sticky buy bar: shown while the main CTA is scrolled out of view
  const [showStickyBar, setShowStickyBar] = useState(false);
  const ctaRef = useRef(null);
  const sizeSelectorRef = useRef(null);

  // Reset purchase state whenever the displayed product changes
  useEffect(() => {
    setSelectedVariantId(null);
    setQuantity(1);
    setValidationError(null);
    setAddedFeedback(null);
  }, [product?.id]);

  const rawVariants = Array.isArray(product?.variants)
    ? product.variants.filter((v) => v && v.isActive !== false && v.id != null)
    : [];
  const variants = sortProductVariants(rawVariants);
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
  // Quantity selector limit: min(stock, 99 per variant allowed by the backend)
  const selectedLimit = getCartItemQuantityLimit(selectedStock);

  const existingInCart = selectedVariant
    ? items.find((i) => i.variantId === selectedVariant.id)
    : null;
  const currentQtyInCart = existingInCart ? existingInCart.quantity : 0;

  // Ensure quantity always stays within [1, selectedLimit] if product/variant stock updates
  useEffect(() => {
    if (!selectedVariant || selectedStock <= 0) {
      setQuantity(1);
      return;
    }
    setQuantity((prev) => Math.max(1, Math.min(prev, selectedLimit)));
  }, [selectedVariant?.id, selectedLimit]);

  const handleVariantSelect = (variant) => {
    const newStock = Math.max(0, Math.floor(Number(variant.stock ?? 0)));
    setSelectedVariantId(variant.id);
    setAddedFeedback(null);

    if (newStock <= 0) {
      setQuantity(1);
      setValidationError(
        `El talle ${formatProductSize(variant.size, product)} se encuentra agotado (0 unidades disponibles).`
      );
      return;
    }

    // Clamp quantity to remain valid for the newly selected variant
    setQuantity((prev) => Math.max(1, Math.min(prev, getCartItemQuantityLimit(newStock))));
    setValidationError(null);
  };

  const handleDecrementQuantity = () => {
    if (!selectedVariant || selectedStock <= 0 || quantity <= 1) return;
    setQuantity((prev) => Math.max(1, prev - 1));
    setValidationError(null);
  };

  const handleIncrementQuantity = () => {
    if (!selectedVariant || selectedStock <= 0 || quantity >= selectedLimit) return;
    setQuantity((prev) => Math.min(selectedLimit, prev + 1));
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
          : `El talle ${formatProductSize(selectedVariant.size, product)} se encuentra agotado (0 unidades disponibles).`
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
      const displaySize = formatProductSize(selectedVariant.size, product);
      setValidationError(
        currentQtyInCart > 0
          ? remaining > 0
            ? `No se puede superar el stock disponible (${selectedStock} ${selectedStock === 1 ? 'unidad' : 'unidades'
            } en ${isSingleSizeProduct ? 'total' : `talle ${displaySize}`
            }). Ya tenés ${currentQtyInCart} en tu carrito; podés agregar hasta ${remaining} más.`
            : `Alcanzaste el límite de stock disponible (${selectedStock} ${selectedStock === 1 ? 'unidad' : 'unidades'
            } en ${isSingleSizeProduct ? 'total' : `talle ${displaySize}`
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
          category: product?.category || undefined,
          categorySlug: product?.categorySlug || undefined,
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
      const nextRemaining = Math.max(1, selectedLimit - accumulatedQty);
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
    selectedVariant && selectedStock > 0 && quantity < selectedLimit
  );
  const isAddDisabled =
    !hasVariants || !hasAvailableStock || isSelectedOutOfStock;

  // Show the sticky bar when the main CTA leaves the viewport
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setShowStickyBar(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasVariants]);

  // Reserve room at the bottom of the page (phones only) so the fixed bar never hides content
  useEffect(() => {
    if (!showStickyBar || typeof window === 'undefined') return undefined;
    if (!window.matchMedia('(max-width: 1023px)').matches) return undefined;
    const previous = document.body.style.paddingBottom;
    document.body.style.paddingBottom = 'calc(5rem + env(safe-area-inset-bottom))';
    return () => {
      document.body.style.paddingBottom = previous;
    };
  }, [showStickyBar]);

  // Sticky bar action: same add-to-cart logic; when a size is still needed, also bring the selector into view
  const handleStickyAdd = () => {
    handleAddToCart();
    if (!selectedVariant && !isSingleSizeProduct && sizeSelectorRef.current) {
      sizeSelectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const stickyPrice = (selectedVariant && selectedVariant.formattedPrice) || product?.formattedPrice;

  return (
    <div className="space-y-6 pt-2">
      {/* Size / Variant Selector */}
      {!hasVariants ? (
        <div className="p-4 bg-sunken rounded-card text-sm text-ink-muted">
          Este artículo no cuenta con variantes activas habilitadas para consulta.
        </div>
      ) : isSingleSizeProduct ? (
        <div className="p-4 bg-white shadow-hairline rounded-card flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold text-brand-dark">
            Talle {formatProductSize(variants[0].size, product)}
          </span>
          <span
            className={`px-3 py-1 text-xs font-semibold rounded-full ${selectedStock > 0
                ? 'bg-sunken text-brand-dark'
                : 'bg-red-50 text-red-800'
              }`}
          >
            {selectedStock > 0 ? `Quedan ${selectedStock}` : 'Agotado'}
          </span>
        </div>
      ) : (
        <div ref={sizeSelectorRef} className="space-y-3 scroll-mt-24">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-brand-dark">
              Elegí tu talle
            </span>
            {selectedVariant && (
              <span className="font-medium text-brand-dark">
                Talle {formatProductSize(selectedVariant.size, product)}
                {isSelectedOutOfStock ? (
                  <span className="text-red-700 ml-1.5 font-semibold text-xs">
                    (Agotado)
                  </span>
                ) : (
                  <span className="text-ink-muted ml-1.5 font-normal">
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
                  className={`min-h-12 px-2 py-1 flex flex-col items-center justify-center text-sm font-semibold rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 cursor-pointer ${isOutOfStock
                      ? isSelected
                        ? 'bg-red-50 text-red-900 ring-1 ring-red-300'
                        : 'bg-sunken text-ink-muted line-through hover:bg-brand-dark/10'
                      : isSelected
                        ? 'bg-brand-dark text-brand-light shadow-float'
                        : 'bg-white text-brand-dark shadow-hairline hover:shadow-card'
                    }`}
                >
                  <span>{formatProductSize(variant.size, product)}</span>
                  {isOutOfStock ? (
                    <span className="text-xs font-normal tracking-normal leading-none mt-0.5 no-underline">
                      Agotado
                    </span>
                  ) : product?.hasVariantPriceRange && variant.formattedPrice ? (
                    <span className="text-xs font-normal tracking-normal leading-none mt-0.5 opacity-80 tabular-nums">
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
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-brand-dark">
              Cantidad
            </span>
            <span className="text-xs text-ink-muted tabular-nums text-right">
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

          <div className="flex items-center justify-between gap-4">
            <div
              className="inline-flex items-center bg-sunken rounded-full p-1"
              role="group"
              aria-label="Selector de cantidad"
            >
              <button
                type="button"
                onClick={handleDecrementQuantity}
                disabled={!canDecrease}
                className={`size-11 rounded-full flex items-center justify-center text-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark ${!canDecrease
                    ? 'text-brand-dark/30 cursor-not-allowed'
                    : 'text-brand-dark hover:bg-white active:bg-white cursor-pointer'
                  }`}
                aria-label="Reducir cantidad"
              >
                −
              </button>
              <span
                className={`w-12 text-center text-sm font-semibold tabular-nums select-none ${!selectedVariant || isSelectedOutOfStock
                    ? 'text-ink-muted'
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
                className={`size-11 rounded-full flex items-center justify-center text-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark ${!canIncrease
                    ? 'text-brand-dark/30 cursor-not-allowed'
                    : 'text-brand-dark hover:bg-white active:bg-white cursor-pointer'
                  }`}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>

            <div className="text-right text-xs text-ink-muted leading-tight">
              {selectedVariant && !isSelectedOutOfStock && quantity >= selectedLimit ? (
                <span className="font-medium text-brand-dark">
                  {selectedLimit < selectedStock
                    ? `Máximo por pedido (${selectedLimit} u.)`
                    : `Máximo disponible (${selectedStock} u.)`}
                </span>
              ) : selectedVariant && isSelectedOutOfStock ? (
                <span className="font-semibold text-red-700">
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
          className="p-4 bg-red-50 rounded-card text-sm font-medium text-red-800 leading-relaxed"
          role="alert"
        >
          {validationError}
        </div>
      )}

      {/* Main Add to Cart CTA */}
      <div ref={ctaRef} className="space-y-3 pt-1">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isAddDisabled}
          className={`w-full h-12 md:h-[52px] px-6 flex items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${isAddDisabled
              ? 'bg-sunken text-ink-muted cursor-not-allowed'
              : 'bg-brand-dark text-brand-light shadow-float hover:bg-ink-soft active:scale-[0.98] cursor-pointer'
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
            className="p-4 bg-white shadow-hairline rounded-card text-sm leading-relaxed text-brand-dark flex items-center justify-between gap-3 animate-fadeIn"
            role="status"
            aria-live="polite"
          >
            <div>
              <p className="font-semibold text-brand-dark">
                {addedFeedback.isSingleSize
                  ? `Agregado a tu bolsa (${addedFeedback.size})`
                  : `Agregado a tu bolsa — Talle ${formatProductSize(addedFeedback.size, product)}`}
              </p>
              <p className="text-xs text-ink-muted">
                Sumaste {addedFeedback.addedQuantity}{' '}
                {addedFeedback.addedQuantity === 1 ? 'unidad' : 'unidades'} •
                Total en bolsa: {addedFeedback.totalInCart}{' '}
                {addedFeedback.totalInCart === 1 ? 'unidad' : 'unidades'}
              </p>
            </div>
            <a
              href="/cart"
              className="shrink-0 inline-flex min-h-11 items-center text-[13px] font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              Ver carrito →
            </a>
          </div>
        )}
      </div>

      {/* Mobile sticky buy bar (phones/tablets only; appears when the main CTA is out of view) */}
      {hasVariants && showStickyBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 bg-brand-light/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-0.5px_0_rgb(29_17_13/0.12)] backdrop-blur-md lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink-muted">
              {addedFeedback ? 'Agregado a tu bolsa' : product?.title}
            </p>
            <p className="truncate text-[17px] font-semibold tabular-nums text-brand-dark">{stickyPrice}</p>
          </div>
          <button
            type="button"
            onClick={handleStickyAdd}
            disabled={isAddDisabled}
            className={`h-12 shrink-0 rounded-full px-6 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark ${isAddDisabled
                ? 'bg-sunken text-ink-muted cursor-not-allowed'
                : 'bg-brand-dark text-brand-sand active:scale-[0.97] cursor-pointer'
              }`}
          >
            {!hasAvailableStock ? 'Sin stock' : isSelectedOutOfStock ? 'Talle agotado' : 'Agregar al carrito'}
          </button>
        </div>
      )}
    </div>
  );
}
