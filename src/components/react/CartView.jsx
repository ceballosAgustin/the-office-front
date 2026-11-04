import { useState } from 'react';
import { useCart } from '../../store/cartStore';
import { createInquiry, formatPrice } from '../../services/api';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22500%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23F2F2F0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-size%3D%2214%22%20fill%3D%22%231D110D80%22%3ETHE%20OFFICE%20BA%3C%2Ftext%3E%3C%2Fsvg%3E';

export default function CartView() {
  const {
    items,
    isHydrated,
    totalCount,
    estimatedTotal,
    updateQuantity,
    increment,
    remove,
    clear,
  } = useCart();

  const [contactName, setContactName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inquiryError, setInquiryError] = useState(null);
  const [inquiryResult, setInquiryResult] = useState(null);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const handleDecrement = (item) => {
    if (item.quantity > 1) {
      updateQuantity(item.variantId, item.quantity - 1);
      setInquiryError(null);
    }
  };

  const handleIncrement = (item) => {
    increment(item.variantId);
    setInquiryError(null);
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

      setInquiryResult(response);

      if (response.whatsappUrl && typeof window !== 'undefined') {
        const openedWindow = window.open(
          response.whatsappUrl,
          '_blank',
          'noopener,noreferrer'
        );
        if (!openedWindow || openedWindow.closed || typeof openedWindow.closed === 'undefined') {
          setPopupBlocked(true);
        }
      }
    } catch (err) {
      setInquiryError(
        err?.message ||
          'No se pudo registrar la consulta en este momento. Verificá los artículos e intentá nuevamente.'
      );
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
          <button
            type="button"
            onClick={handleClearCart}
            className="text-xs font-medium text-brand-dark/55 hover:text-brand-dark underline underline-offset-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs py-1"
          >
            Vaciar carrito
          </button>
        )}
      </div>

      {/* Loading Hydration State */}
      {!isHydrated && (
        <div className="py-16 space-y-6 animate-pulse">
          <div className="h-28 w-full bg-[#F2F2F0] rounded-xs" />
          <div className="h-28 w-full bg-[#F2F2F0] rounded-xs" />
        </div>
      )}

      {/* Registered Inquiry Reference Banner (persists even if user manually clears cart afterwards) */}
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
            Tu consulta fue registrada correctamente en el sistema.{' '}
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
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-xs font-medium text-brand-dark/60 hover:text-brand-dark underline underline-offset-4 transition-colors cursor-pointer py-2"
              >
                Vaciar carrito manualmente
              </button>
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

              return (
                <article
                  key={item.variantId}
                  className="py-6 first:pt-0 flex flex-row gap-4 sm:gap-6 items-start"
                >
                  {/* Product Thumbnail (4:5 ratio, neutral backdrop) */}
                  <div className="w-24 sm:w-28 aspect-[4/5] shrink-0 overflow-hidden bg-[#F2F2F0] rounded-xs">
                    {productUrl ? (
                      <a
                        href={productUrl}
                        className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
                      >
                        <img
                          src={imgSrc}
                          alt={item.title}
                          className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                        />
                      </a>
                    ) : (
                      <img
                        src={imgSrc}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Item Details & Controls */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
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
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-dark/60">
                          <span className="font-medium text-brand-dark/80">
                            Talle: {item.size}
                          </span>
                          <span aria-hidden="true">•</span>
                          <span className="tabular-nums">
                            {formatPrice(item.unitPrice)} c/u
                          </span>
                        </div>
                      </div>

                      {/* Remove Item Button */}
                      <button
                        type="button"
                        onClick={() => handleRemove(item.variantId)}
                        className="text-xs font-medium text-brand-dark/45 hover:text-red-700 transition-colors p-1 -mr-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
                        aria-label={`Eliminar ${item.title} talle ${item.size}`}
                        title="Eliminar artículo"
                      >
                        Eliminar
                      </button>
                    </div>

                    {/* Quantity Stepper & Line Subtotal */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div
                        className="inline-flex items-center border border-brand-dark/15 bg-white/80 rounded-xs"
                        role="group"
                        aria-label={`Cantidad de ${item.title} talle ${item.size}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleDecrement(item)}
                          disabled={item.quantity <= 1}
                          className={`w-8 h-8 flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark ${
                            item.quantity <= 1
                              ? 'text-brand-dark/25 cursor-not-allowed'
                              : 'text-brand-dark hover:bg-brand-dark/[0.05] cursor-pointer'
                          }`}
                          aria-label="Reducir cantidad"
                        >
                          −
                        </button>
                        <span
                          className="w-9 text-center text-xs font-semibold text-brand-dark tabular-nums select-none"
                          aria-live="polite"
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrement(item)}
                          className="w-8 h-8 flex items-center justify-center text-sm font-medium text-brand-dark hover:bg-brand-dark/[0.05] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark"
                          aria-label="Incrementar cantidad"
                        >
                          +
                        </button>
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

            {/* Inquiry Error Feedback */}
            {inquiryError && (
              <div
                className="p-3.5 bg-red-50/90 border border-red-200 rounded-xs space-y-1.5 text-xs text-red-800"
                role="alert"
              >
                <p className="font-semibold">
                  No se pudo completar el registro de la consulta
                </p>
                <p className="leading-relaxed">{inquiryError}</p>
                <p className="text-[11px] text-red-700/80 pt-0.5">
                  Podés ajustar las cantidades o eliminar artículos sin
                  disponibilidad y volver a intentarlo.
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
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ej. Juan"
                  className="w-full h-10 px-3 text-xs sm:text-sm text-brand-dark bg-white border border-brand-dark/15 rounded-xs placeholder:text-brand-dark/30 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className={`w-full min-h-[48px] px-5 flex items-center justify-center gap-2.5 rounded-xs text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${
                  isSubmitting || items.length === 0
                    ? 'bg-brand-dark/40 text-[#FAFAFA]/80 cursor-not-allowed'
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

