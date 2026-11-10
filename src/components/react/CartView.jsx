import { useState, useEffect, useRef } from 'react';
import { useCart } from '../../store/cartStore';
import { createInquiry, formatPrice } from '../../services/api';

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
      (item.maxStock !== undefined && item.quantity >= item.maxStock)
    ) {
      return;
    }
    increment(item.variantId);
    setInquiryError(null);
  };

  const handleAdjustToAvailable = (item) => {
    if (item.maxStock !== undefined && item.maxStock >= 1) {
      updateQuantity(item.variantId, item.maxStock);
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

    setIsSubmitting(true);
    setInquiryError(null);
    setPopupBlocked(false);

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

      if (typeof window !== 'undefined') {
        const openedWindow = window.open(
          validUrl,
          '_blank',
          'noopener,noreferrer'
        );
        if (
          !openedWindow ||
          openedWindow.closed ||
          typeof openedWindow.closed === 'undefined'
        ) {
          setPopupBlocked(true);
        }
      }
    } catch (err) {
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
        <ol className="flex items-center flex-wrap gap-2 text-xs text-brand-dark/50">
          <li>
            <a
              href="/"
              className="hover:text-brand-dark transition-colors duration-150 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
            >
              Home
            </a>
          </li>
          <li aria-hidden="true" className="select-none text-brand-dark/30">
            /
          </li>
          <li className="font-medium text-brand-dark" aria-current="page">
            Shopping Bag
          </li>
        </ol>
      </nav>

      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-dark/[0.08] pb-4 mb-8">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-brand-dark uppercase">
            Shopping Bag
          </h1>
          <span className="text-xs font-mono tracking-widest text-brand-dark/40">
            [{!isHydrated ? '--' : totalCount.toString().padStart(2, '0')}]
          </span>
        </div>

        {isHydrated && items.length > 0 && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleRefreshStock}
              disabled={isCheckingStock}
              className="text-xs font-medium text-brand-dark/65 hover:text-brand-dark underline underline-offset-4 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs py-1"
            >
              {isCheckingStock
                ? 'Verificando disponibilidad...'
                : 'Actualizar disponibilidad'}
            </button>
            <button
              type="button"
              onClick={handleClearCart}
              className="text-xs font-medium text-brand-dark/55 hover:text-brand-dark underline underline-offset-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs py-1"
            >
              Vaciar carrito
            </button>
          </div>
        )}
      </div>

      {/* Loading Hydration State */}
      {!isHydrated && (
        <div className="py-16 space-y-6 animate-pulse">
          <div className="h-28 w-full bg-[#F2F2F0] rounded-xs" />
          <div className="h-28 w-full bg-[#F2F2F0] rounded-xs" />
        </div>
      )}

      {/* Registered Inquiry Reference Banner */}
      {isHydrated && inquiryResult && (
        <div
          className="mb-8 p-5 sm:p-6 bg-[#FAF9F6] border border-brand-dark/15 rounded-xs space-y-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-dark/50">
                Consulta comercial registrada
              </span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-brand-dark">
                Referencia:{' '}
                <span className="font-mono">{inquiryResult.inquiryNumber}</span>
              </h2>
            </div>
            {inquiryResult.totalAmount !== undefined && (
              <div className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-brand-dark/45">
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
            <p className="text-xs font-medium text-amber-800 bg-amber-50/80 border border-amber-200/80 px-3 py-2 rounded-xs">
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
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark hover:opacity-90 transition-opacity rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
              >
                Abrir conversación en WhatsApp ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Empty Cart State */}
      {isHydrated && items.length === 0 && (
        <div className="py-16 sm:py-24 px-6 text-center border border-brand-dark/[0.08] bg-[#FAF9F6]/70 backdrop-blur-xs rounded-xs space-y-5">
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
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark hover:opacity-85 transition-opacity rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
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
            className="lg:col-span-7 xl:col-span-8 divide-y divide-brand-dark/[0.08] border-b border-brand-dark/[0.08]"
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

              return (
                <article
                  key={item.variantId}
                  className={`py-6 first:pt-0 flex flex-row gap-4 sm:gap-6 items-start ${isUnavailable ? 'opacity-85' : ''
                    }`}
                >
                  {/* Product Thumbnail (4:5 ratio, neutral backdrop) */}
                  <div className="w-24 sm:w-28 aspect-[4/5] shrink-0 overflow-hidden bg-[#F2F2F0] rounded-xs relative">
                    {productUrl ? (
                      <a
                        href={productUrl}
                        className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
                      >
                        <img
                          src={imgSrc}
                          alt={item.title}
                          className={`w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300 ${isUnavailable ? 'grayscale' : ''
                            }`}
                        />
                      </a>
                    ) : (
                      <img
                        src={imgSrc}
                        alt={item.title}
                        className={`w-full h-full object-cover ${isUnavailable ? 'grayscale' : ''
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
                            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200 rounded-xs">
                              No disponible
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-dark/60">
                          <span className="font-medium text-brand-dark/80">
                            Talle: {item.size}
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
                        className="text-xs font-medium text-brand-dark/55 hover:text-red-700 transition-colors p-1 -mr-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
                        aria-label={`Eliminar ${item.title} talle ${item.size}`}
                        title="Eliminar artículo"
                      >
                        Eliminar
                      </button>
                    </div>

                    {/* Availability / Insufficient Stock Alerts per Item */}
                    {isUnavailable && (
                      <div
                        className="p-3 bg-red-50/90 border border-red-200 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs text-red-800"
                        role="alert"
                      >
                        <span>
                          {item.unavailableReason === 'inactive'
                            ? 'Este producto o talle ya no se encuentra disponible en el catálogo.'
                            : `El talle ${item.size} quedó sin stock disponible (0 unidades).`}
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
                        className="p-3 bg-amber-50/90 border border-amber-200 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900"
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
                          className="inline-flex items-center border border-brand-dark/15 bg-white/80 rounded-xs"
                          role="group"
                          aria-label={`Cantidad de ${item.title} talle ${item.size}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleDecrement(item)}
                            disabled={item.quantity <= 1 || isUnavailable}
                            className={`w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark ${item.quantity <= 1 || isUnavailable
                                ? 'text-brand-dark/25 cursor-not-allowed'
                                : 'text-brand-dark hover:bg-brand-dark/[0.05] cursor-pointer'
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
                            aria-live="polite"
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleIncrement(item)}
                            disabled={isUnavailable || isAtMaxStock}
                            className={`w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark ${isUnavailable || isAtMaxStock
                                ? 'text-brand-dark/25 cursor-not-allowed'
                                : 'text-brand-dark hover:bg-brand-dark/[0.05] cursor-pointer'
                              }`}
                            aria-label="Incrementar cantidad"
                          >
                            +
                          </button>
                        </div>

                        {!isUnavailable &&
                          !isExceedingStock &&
                          isAtMaxStock && (
                            <span className="text-[11px] text-brand-dark/50">
                              Máx. disponible ({item.maxStock} u.)
                            </span>
                          )}
                      </div>

                      <div className="text-right">
                        <span className="block text-[10px] uppercase tracking-wider text-brand-dark/40">
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
            className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 bg-[#FAF9F6]/85 backdrop-blur-sm border border-brand-dark/[0.08] p-6 sm:p-7 rounded-xs space-y-6"
            aria-label="Resumen de la consulta"
          >
            <div className="border-b border-brand-dark/[0.08] pb-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">
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
                <span className="text-sm font-semibold text-brand-dark uppercase tracking-wide">
                  Total estimado
                </span>
                <span className="text-lg sm:text-xl font-bold tracking-tight text-brand-dark tabular-nums">
                  {formatPrice(estimatedTotal)}
                </span>
              </div>

              <p className="text-[11px] text-brand-dark/50 leading-relaxed pt-1">
                Los precios exhibidos son informativos. El monto definitivo y el
                stock se validan al registrar tu consulta comercial.
              </p>
            </div>

            {/* Cart Stock / Availability Blocking Warning */}
            {!isValidCart && (
              <div
                className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xs space-y-1 text-xs text-amber-900"
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
                className="p-3.5 bg-red-50/90 border border-red-200 rounded-xs space-y-1.5 text-xs text-red-800"
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
                <p className="text-[11px] text-red-700/80 pt-0.5">
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
                  className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/60"
                >
                  Tu nombre{' '}
                  <span className="font-normal text-brand-dark/40 lowercase">
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
                  className="form-input w-full h-10 px-3 text-base sm:text-sm"
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
                className={`w-full min-h-[48px] px-5 flex items-center justify-center gap-2.5 rounded-xs text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${isSubmitting ||
                    isCheckingStock ||
                    items.length === 0 ||
                    !isValidCart
                    ? 'bg-brand-dark/35 text-[#FAFAFA]/80 cursor-not-allowed'
                    : 'bg-brand-dark text-[#FAFAFA] hover:opacity-90 active:scale-[0.99] cursor-pointer'
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

            <div className="pt-2 border-t border-brand-dark/[0.06] text-center">
              <a
                href="/#catalogo"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-dark/60 hover:text-brand-dark transition-colors"
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
