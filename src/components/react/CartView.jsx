import { useState, useEffect, useRef } from 'react';
import {
  useCart,
  getCartItemQuantityLimit,
  MAX_CART_QTY_PER_ITEM,
  MAX_CART_DISTINCT_ITEMS,
} from '../../store/cartStore';
import { createInquiry, formatPrice, formatProductSize, getOptimizedImageUrl } from '../../services/api';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22500%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23F2F2F0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-size%3D%2214%22%20fill%3D%22%231D110D80%22%3ETHE%20OFFICE%20BA%3C%2Ftext%3E%3C%2Fsvg%3E';

function isValidWhatsappUrl(url) {
  return (
    typeof url === 'string' &&
    url.trim().length > 0 &&
    /^https?:\/\//i.test(url.trim())
  );
}

export default function CartView() {
  const {
    items,
    isHydrated,
    totalCount,
    estimatedTotal,
    isValidCart,
    hasUnavailableItems,
    hasInsufficientStockItems,
    updateQuantity,
    increment,
    decrement,
    remove,
    clear,
    refreshAvailability,
  } = useCart();

  const [contactName, setContactName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [inquiryError, setInquiryError] = useState(null);
  const [inquiryResult, setInquiryResult] = useState(null);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const hasInitialSyncRunRef = useRef(false);
  const lastClearedInquiryKeyRef = useRef(null);

  const handleRefreshStock = async () => {
    if (isCheckingStock || items.length === 0) return;
    setIsCheckingStock(true);
    try {
      await refreshAvailability();
    } finally {
      setIsCheckingStock(false);
    }
  };

  // Verify stock availability on initial cart open and when the tab regains focus
  useEffect(() => {
    if (!isHydrated) return;

    if (!hasInitialSyncRunRef.current && items.length > 0) {
      hasInitialSyncRunRef.current = true;
      handleRefreshStock();
    }

    const onWindowFocus = () => {
      if (items.length > 0 && !isSubmitting) {
        refreshAvailability();
      }
    };

    window.addEventListener('focus', onWindowFocus);
    return () => {
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [isHydrated, items.length, isSubmitting, refreshAvailability]);

  const handleDecrement = (item) => {
    if (item.quantity > 1) {
      decrement(item.variantId);
      setInquiryError(null);
    }
  };

  const handleIncrement = (item) => {
    if (
      item.isAvailable === false ||
      item.quantity >= getCartItemQuantityLimit(item.maxStock)
    ) {
      return;
    }
    increment(item.variantId);
    setInquiryError(null);
  };

  const handleAdjustToAvailable = (item) => {
    if (item.maxStock !== undefined && item.maxStock >= 1) {
      updateQuantity(item.variantId, getCartItemQuantityLimit(item.maxStock));
      setInquiryError(null);
    }
  };

  const handleRemove = (variantId) => {
    remove(variantId);
    setInquiryError(null);
  };

  const handleClearCart = () => {
    clear();
    setInquiryError(null);
  };

  const handleWhatsappInquiry = async (e) => {
    e.preventDefault();
    if (isSubmitting || items.length === 0) return;

    // 1. Validate local cart state before sending POST /api/inquiries
    if (!isValidCart) {
      setInquiryError({
        status: 400,
        title: 'Revisá la disponibilidad de tu carrito',
        message: hasUnavailableItems
          ? 'Uno o más artículos de tu carrito quedaron sin stock o ya no están disponibles. Eliminalos para continuar.'
          : 'Uno o más artículos superan el stock disponible actual. Ajustá las cantidades indicadas antes de enviar la consulta.',
      });
      return;
    }

    if (items.length > MAX_CART_DISTINCT_ITEMS) {
      setInquiryError({
        status: 400,
        title: 'Demasiados productos en el carrito',
        message: `Una consulta admite hasta ${MAX_CART_DISTINCT_ITEMS} productos distintos. Quitá algunos y volvé a intentar.`,
      });
      return;
    }

    setIsSubmitting(true);
    setInquiryError(null);
    setPopupBlocked(false);

    // Open a blank tab synchronously, inside the click gesture, so popup blockers allow it.
    // It is pointed to WhatsApp once the API responds (opening with 'noopener' would always return null).
    let waWindow = null;
    if (typeof window !== 'undefined') {
      try {
        waWindow = window.open('', '_blank');
      } catch {
        waWindow = null;
      }
    }
    const closeWaWindow = () => {
      try {
        if (waWindow && !waWindow.closed) waWindow.close();
      } catch {
        // ignore
      }
    };

    try {
      const response = await createInquiry({
        contactName: contactName.trim() || undefined,
        items: items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      });

      const validUrl = isValidWhatsappUrl(response?.whatsappUrl)
        ? response.whatsappUrl.trim()
        : null;

      if (!validUrl) {
        closeWaWindow();
        setInquiryError({
          status: 500,
          title: 'Respuesta incompleta del servidor',
          message:
            'La consulta fue procesada pero no se recibió un enlace válido de WhatsApp. Tu carrito fue conservado.',
        });
        return;
      }

      setInquiryResult(response);

      // Clear cart ONLY after successful response with a valid whatsappUrl, avoiding duplicate executions
      const inquiryUniqueKey =
        response.id ?? response.inquiryNumber ?? validUrl;
      if (lastClearedInquiryKeyRef.current !== inquiryUniqueKey) {
        lastClearedInquiryKeyRef.current = inquiryUniqueKey;
        clear();
      }

      if (waWindow && !waWindow.closed) {
        try {
          waWindow.opener = null;
          waWindow.location.href = validUrl;
        } catch {
          closeWaWindow();
          setPopupBlocked(true);
        }
      } else {
        // The browser really blocked the tab (or the user closed it): keep the manual fallback button
        setPopupBlocked(true);
      }
    } catch (err) {
      closeWaWindow();
      const status = Number(err?.status) || 0;
      let title = 'No se pudo completar el registro de la consulta';
      let message =
        err?.message ||
        'No se pudo registrar la consulta en este momento. Verificá los artículos e intentá nuevamente.';

      if (status === 409) {
        title = 'Stock insuficiente para completar la consulta';
        // Preserve exact backend ErrorResponse.message
        message =
          err?.message ||
          'Uno o más artículos superan el stock disponible en este momento.';
      } else if (status === 400) {
        title = 'Validación de artículos y cantidades';
        message =
          err?.message ||
          'Alguno de los artículos o cantidades seleccionadas no es válido o fue desactivado.';
      } else if (status === 429) {
        title = 'Demasiados intentos';
        message =
          err?.message ||
          'Demasiados intentos, esperá unos minutos y volvé a intentar.';
      } else if (status === 404) {
        title = 'Producto o variante no disponible';
        message =
          err?.message ||
          'Uno de los productos o variantes seleccionados ya no está disponible en el catálogo.';
      }

      setInquiryError({
        status,
        title,
        message,
      });

      // Synchronize cart items with the backend's current availability without clearing the cart
      if (status === 409 || status === 400 || status === 404) {
        refreshAvailability();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-14">
      {/* Breadcrumbs Navigation */}
      <nav className="mb-6 sm:mb-8" aria-label="Breadcrumb">
        <ol className="flex items-center flex-wrap gap-2 text-xs text-ink-muted">
          <li>
            <a
              href="/"
              className="hover:text-brand-dark transition-colors duration-150 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
            >
              Inicio
            </a>
          </li>
          <li aria-hidden="true" className="select-none text-brand-dark/30">
            /
          </li>
          <li className="font-medium text-brand-dark" aria-current="page">
            Tu carrito
          </li>
        </ol>
      </nav>

      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-dark/[0.08] pb-4 mb-8">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-brand-dark">
            Tu carrito
          </h1>
          <span className="text-xs font-mono tracking-widest text-ink-muted">
            [{!isHydrated ? '--' : totalCount.toString().padStart(2, '0')}]
          </span>
        </div>

        {isHydrated && items.length > 0 && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleRefreshStock}
              disabled={isCheckingStock}
              className="inline-flex min-h-11 items-center text-[13px] font-medium text-ink-muted hover:text-brand-dark underline underline-offset-4 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 rounded-ctl"
            >
              {isCheckingStock
                ? 'Verificando disponibilidad...'
                : 'Actualizar disponibilidad'}
            </button>
            <button
              type="button"
              onClick={handleClearCart}
              className="inline-flex min-h-11 items-center text-[13px] font-medium text-ink-muted hover:text-brand-dark underline underline-offset-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 rounded-ctl"
            >
              Vaciar carrito
            </button>
          </div>
        )}
      </div>

      {/* Loading Hydration State */}
      {!isHydrated && (
        <div className="py-16 space-y-6 animate-pulse">
          <div className="h-28 w-full bg-sunken rounded-card" />
          <div className="h-28 w-full bg-sunken rounded-card" />
        </div>
      )}

      {/* Registered Inquiry Reference Banner */}
      {isHydrated && inquiryResult && (
        <div
          className="mb-8 p-5 sm:p-6 bg-white shadow-card rounded-tile space-y-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Consulta comercial registrada
              </span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-brand-dark">
                Referencia:{' '}
                <span className="font-mono">{inquiryResult.inquiryNumber}</span>
              </h2>
            </div>
            {inquiryResult.totalAmount !== undefined && (
              <div className="text-right">
                <span className="block text-xs uppercase tracking-wider text-ink-muted">
                  Total estimado registrado
                </span>
                <span className="text-sm sm:text-base font-semibold text-brand-dark tabular-nums">
                  {formatPrice(Number(inquiryResult.totalAmount))}
                </span>
              </div>
            )}
          </div>

          <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed">
            Tu consulta fue registrada correctamente en el sistema y tu carrito
            fue vaciado.{' '}
            <strong className="font-semibold text-brand-dark">
              Importante: abrir WhatsApp no significa que el mensaje haya sido
              enviado ni que la compra esté confirmada.
            </strong>{' '}
            Enviá el mensaje pre-cargado en WhatsApp para que nuestro equipo te
            confirme disponibilidad y pasos a seguir.
          </p>

          {popupBlocked && (
            <p className="text-xs font-medium text-amber-800 bg-amber-50 px-3 py-2 rounded-card">
              Tu navegador bloqueó la apertura automática de la pestaña. Pulsá
              el botón a continuación para abrir WhatsApp manualmente.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-1">
            {inquiryResult.whatsappUrl && (
              <a
                href={inquiryResult.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 px-6 text-sm font-semibold text-brand-light bg-brand-dark hover:bg-ink-soft transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
              >
                Abrir conversación en WhatsApp ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Empty Cart State */}
      {isHydrated && items.length === 0 && (
        <div className="py-16 sm:py-24 px-6 text-center bg-white shadow-card rounded-tile space-y-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-dark/[0.04] text-brand-dark/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-brand-dark">
              Tu carrito está vacío
            </h2>
            <p className="text-xs sm:text-sm text-brand-dark/60 leading-relaxed">
              Explorá el catálogo de The Office BA, elegí tus prendas y
              seleccioná tu talle para armar tu consulta comercial.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/#catalogo"
              className="inline-flex h-12 items-center justify-center gap-2 px-7 text-[15px] font-semibold text-brand-light bg-brand-dark hover:bg-ink-soft transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
            >
              ← Explorar catálogo
            </a>
          </div>
        </div>
      )}

      {/* Cart Content: 2-Column Layout on Desktop */}
      {isHydrated && items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Items List */}
          <section
            className="lg:col-span-7 xl:col-span-8 space-y-3"
            aria-label="Artículos en el carrito"
          >
            {items.map((item) => {
              const itemSubtotal = item.unitPrice * item.quantity;
              const productUrl = item.productId
                ? `/products/${item.productId}`
                : null;
              const imgSrc =
                item.image && item.image.trim()
                  ? item.image
                  : PLACEHOLDER_IMAGE;

              const isUnavailable =
                item.isAvailable === false ||
                (item.maxStock !== undefined && item.maxStock <= 0);
              const isExceedingStock =
                !isUnavailable &&
                item.maxStock !== undefined &&
                item.quantity > item.maxStock;
              const isAtMaxStock =
                !isUnavailable &&
                item.maxStock !== undefined &&
                item.quantity >= item.maxStock;
              const isAtMaxPerOrder =
                !isUnavailable && item.quantity >= MAX_CART_QTY_PER_ITEM;
              const quantityAtLimit = isAtMaxStock || isAtMaxPerOrder;

              return (
                <article
                  key={item.variantId}
                  className={`p-3 sm:p-4 bg-white shadow-hairline rounded-card flex flex-row gap-4 sm:gap-6 items-start ${isUnavailable ? 'opacity-85' : ''
                    }`}
                >
                  {/* Product Thumbnail (4:5 ratio) */}
                  <div className="w-24 sm:w-28 aspect-[4/5] shrink-0 overflow-hidden rounded-ctl bg-sunken relative flex items-center justify-center">
                    {productUrl ? (
                      <a
                        href={productUrl}
                        className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 flex items-center justify-center"
                      >
                        <img
                          src={getOptimizedImageUrl(imgSrc, 'thumbnail')}
                          alt={item.title}
                          className={`w-full h-full object-contain object-center hover:scale-[1.03] transition-transform duration-300 ${isUnavailable ? 'grayscale' : ''
                            }`}
                        />
                      </a>
                    ) : (
                      <img
                        src={getOptimizedImageUrl(imgSrc, 'thumbnail')}
                        alt={item.title}
                        className={`w-full h-full object-contain object-center ${isUnavailable ? 'grayscale' : ''
                          }`}
                      />
                    )}
                  </div>

                  {/* Item Details & Controls */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {productUrl ? (
                            <a
                              href={productUrl}
                              className="text-sm sm:text-base font-semibold tracking-tight text-brand-dark hover:text-brand-dark/70 transition-colors line-clamp-2"
                            >
                              {item.title}
                            </a>
                          ) : (
                            <h2 className="text-sm sm:text-base font-semibold tracking-tight text-brand-dark line-clamp-2">
                              {item.title}
                            </h2>
                          )}
                          {isUnavailable && (
                            <span className="px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
                              No disponible
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-dark/60">
                          <span className="font-medium text-brand-dark/80">
                            Talle: {formatProductSize(item.size, item)}
                          </span>
                          <span aria-hidden="true">•</span>
                          <span className="tabular-nums">
                            {formatPrice(item.unitPrice)} c/u
                          </span>
                          {!isUnavailable && item.maxStock !== undefined && (
                            <>
                              <span aria-hidden="true">•</span>
                              <span
                                className={`tabular-nums ${isExceedingStock
                                    ? 'text-red-700 font-semibold'
                                    : 'text-brand-dark/55'
                                  }`}
                              >
                                Stock disponible: {item.maxStock} u.
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Remove Item Button */}
                      <button
                        type="button"
                        onClick={() => handleRemove(item.variantId)}
                        className="inline-flex min-h-11 items-center px-2 -mr-2 text-[13px] font-medium text-ink-muted hover:text-red-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 rounded-full"
                        aria-label={`Eliminar ${item.title} talle ${formatProductSize(item.size, item)}`}
                        title="Eliminar artículo"
                      >
                        Eliminar
                      </button>
                    </div>

                    {/* Availability / Insufficient Stock Alerts per Item */}
                    {isUnavailable && (
                      <div
                        className="p-3 bg-red-50 rounded-card flex flex-wrap items-center justify-between gap-2 text-xs text-red-800"
                        role="alert"
                      >
                        <span>
                          {item.unavailableReason === 'inactive'
                            ? 'Este producto o talle ya no se encuentra disponible en el catálogo.'
                            : `El talle ${formatProductSize(item.size, item)} quedó sin stock disponible (0 unidades).`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.variantId)}
                          className="font-semibold underline underline-offset-4 hover:text-red-950 cursor-pointer shrink-0"
                        >
                          Quitar del carrito
                        </button>
                      </div>
                    )}

                    {isExceedingStock && (
                      <div
                        className="p-3 bg-amber-50 rounded-card flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900"
                        role="alert"
                      >
                        <span>
                          Quedan{' '}
                          <strong className="font-semibold">
                            {item.maxStock}{' '}
                            {item.maxStock === 1
                              ? 'unidad disponible'
                              : 'unidades disponibles'}
                          </strong>{' '}
                          (tenés {item.quantity} en el carrito). Ajustá la
                          cantidad para continuar.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustToAvailable(item)}
                          className="font-semibold underline underline-offset-4 hover:text-amber-950 cursor-pointer shrink-0"
                        >
                          Ajustar a {item.maxStock} u.
                        </button>
                      </div>
                    )}

                    {/* Quantity Stepper & Line Subtotal */}
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pt-1">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div
                          className="inline-flex items-center bg-sunken rounded-full p-0.5"
                          role="group"
                          aria-label={`Cantidad de ${item.title} talle ${formatProductSize(item.size, item)}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleDecrement(item)}
                            disabled={item.quantity <= 1 || isUnavailable}
                            className={`size-11 rounded-full flex items-center justify-center text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark ${item.quantity <= 1 || isUnavailable
                                ? 'text-brand-dark/25 cursor-not-allowed'
                                : 'text-brand-dark hover:bg-white cursor-pointer'
                              }`}
                            aria-label="Reducir cantidad"
                          >
                            −
                          </button>
                          <span
                            className={`w-9 text-center text-xs font-semibold tabular-nums select-none ${isExceedingStock || isUnavailable
                                ? 'text-red-700'
                                : 'text-brand-dark'
                              }`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleIncrement(item)}
                            disabled={isUnavailable || quantityAtLimit}
                            className={`size-11 rounded-full flex items-center justify-center text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark ${isUnavailable || quantityAtLimit
                                ? 'text-brand-dark/25 cursor-not-allowed'
                                : 'text-brand-dark hover:bg-white cursor-pointer'
                              }`}
                            aria-label="Incrementar cantidad"
                          >
                            +
                          </button>
                        </div>

                        {!isUnavailable &&
                          !isExceedingStock &&
                          quantityAtLimit && (
                            <span className="text-xs text-ink-muted">
                              {isAtMaxStock
                                ? `Máx. disponible (${item.maxStock} u.)`
                                : `Máx. por pedido (${MAX_CART_QTY_PER_ITEM} u.)`}
                            </span>
                          )}
                      </div>

                      <div className="text-right">
                        <span className="block text-xs uppercase tracking-wider text-ink-muted">
                          Subtotal
                        </span>
                        <span className="text-sm sm:text-base font-semibold tracking-tight text-brand-dark tabular-nums">
                          {formatPrice(itemSubtotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          {/* Right Column: Summary & WhatsApp Inquiry CTA */}
          <aside
            className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 bg-white shadow-card p-6 sm:p-7 rounded-tile space-y-6"
            aria-label="Resumen de la consulta"
          >
            <div className="border-b border-brand-dark/[0.08] pb-4">
              <h2 className="text-headline text-brand-dark">
                Resumen de consulta
              </h2>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-center justify-between text-brand-dark/70">
                <span>
                  Artículos ({totalCount}{' '}
                  {totalCount === 1 ? 'unidad' : 'unidades'})
                </span>
                <span className="font-medium tabular-nums">
                  {formatPrice(estimatedTotal)}
                </span>
              </div>

              <div className="border-t border-brand-dark/[0.08] pt-3 flex items-baseline justify-between">
                <span className="text-[15px] font-semibold text-brand-dark">
                  Total estimado
                </span>
                <span className="text-lg sm:text-xl font-bold tracking-tight text-brand-dark tabular-nums">
                  {formatPrice(estimatedTotal)}
                </span>
              </div>

              <p className="text-xs text-ink-muted leading-relaxed pt-1">
                Los precios exhibidos son informativos. El monto definitivo y el
                stock se validan al registrar tu consulta comercial.
              </p>
            </div>

            {/* Cart Stock / Availability Blocking Warning */}
            {!isValidCart && (
              <div
                className="p-3.5 bg-amber-50 rounded-card space-y-1 text-xs text-amber-900"
                role="alert"
              >
                <p className="font-semibold">
                  Acción requerida antes de enviar la consulta
                </p>
                <p className="leading-relaxed">
                  {hasUnavailableItems
                    ? 'Hay artículos sin stock o desactivados en tu carrito. Eliminalos para habilitar el envío.'
                    : 'Uno o más artículos superan las unidades disponibles. Ajustá sus cantidades o eliminalos para continuar.'}
                </p>
              </div>
            )}

            {/* Inquiry Error Feedback (HTTP 409, 400, 404, etc.) */}
            {inquiryError && (
              <div
                className="p-3.5 bg-red-50 rounded-card space-y-1.5 text-xs text-red-800"
                role="alert"
              >
                <p className="font-semibold">
                  {inquiryError.title ||
                    'No se pudo completar el registro de la consulta'}
                </p>
                <p className="leading-relaxed">
                  {typeof inquiryError === 'string'
                    ? inquiryError
                    : inquiryError.message}
                </p>
                <p className="text-xs text-red-700 pt-0.5">
                  Tu carrito fue conservado. Podés ajustar las cantidades o
                  eliminar artículos sin disponibilidad y volver a intentarlo.
                </p>
              </div>
            )}

            {/* Optional Contact Name & WhatsApp Submit Form */}
            <form onSubmit={handleWhatsappInquiry} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label
                  htmlFor="inquiry-contact-name"
                  className="block text-[13px] font-semibold text-brand-dark"
                >
                  Tu nombre{' '}
                  <span className="font-normal text-ink-muted">
                    (opcional)
                  </span>
                </label>
                <input
                  id="inquiry-contact-name"
                  type="text"
                  maxLength={150}
                  disabled={isSubmitting}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ej. Juan"
                  className="form-input w-full h-12 px-4 text-base sm:text-sm !rounded-full"
                />
              </div>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isCheckingStock ||
                  items.length === 0 ||
                  !isValidCart
                }
                className={`w-full min-h-12 px-5 flex items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${isSubmitting ||
                    isCheckingStock ||
                    items.length === 0 ||
                    !isValidCart
                    ? 'bg-sunken text-ink-muted cursor-not-allowed'
                    : 'bg-brand-dark text-brand-sand shadow-float hover:bg-ink-soft active:scale-[0.98] cursor-pointer'
                  }`}
              >
                {isSubmitting ? (
                  <span>Registrando consulta...</span>
                ) : (
                  <>
                    <span>Consultar por WhatsApp</span>
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-hairline text-center">
              <a
                href="/#catalogo"
                className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-brand-dark transition-colors"
              >
                ← Seguir explorando el catálogo
              </a>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
