import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import OrderStatusBadge, { getOrderStatusLabel } from './OrderStatusBadge';
import {
  fetchAdminOrderById,
  updateAdminOrderStatus,
  formatPrice,
} from '../../../services/api';
import { formatArgentinaDateTime } from '../../../utils/date';

function resolveClientOrderId(propOrderId) {
  if (propOrderId !== undefined && propOrderId !== null && String(propOrderId).trim() !== '') {
    return String(propOrderId).trim();
  }
  if (typeof window === 'undefined') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('id');
  if (queryId && queryId.trim()) {
    return queryId.trim();
  }
  const pathMatch = window.location.pathname.match(/^\/admin\/orders\/([^/?#]+)\/?$/);
  if (pathMatch && pathMatch[1] && pathMatch[1].toLowerCase() !== 'detail') {
    return decodeURIComponent(pathMatch[1].trim());
  }
  return null;
}

export default function AdminOrderDetailView({ orderId: propOrderId }) {
  const [resolvedOrderId, setResolvedOrderId] = useState(() =>
    resolveClientOrderId(propOrderId)
  );
  const [hasResolvedUrl, setHasResolvedUrl] = useState(false);
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Status update / cancellation state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    const idFromUrl = resolveClientOrderId(propOrderId);
    setResolvedOrderId(idFromUrl);
    setHasResolvedUrl(true);

    const onPopState = () => {
      setResolvedOrderId(resolveClientOrderId(propOrderId));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [propOrderId]);

  const loadOrder = useCallback(async () => {
    if (!hasResolvedUrl) return;

    if (!resolvedOrderId) {
      setIsLoading(false);
      setLoadError({
        message: 'No se especificó un identificador de pedido válido en la dirección.',
        isNotFound: true,
      });
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchAdminOrderById(resolvedOrderId);
      setOrder(data);
      if (typeof document !== 'undefined' && data?.orderNumber) {
        document.title = `Pedido ${data.orderNumber} — Admin The Office BA`;
      }
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setLoadError({
        message: err?.message || 'No se pudo cargar el detalle del pedido.',
        isNotFound: err?.status === 404 || err?.isNotFound,
      });
    } finally {
      setIsLoading(false);
    }
  }, [hasResolvedUrl, resolvedOrderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleConfirmCompleteOrder = async () => {
    if (!order || isUpdatingStatus || order.status !== 'PENDING') return;
    setIsUpdatingStatus(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updated = await updateAdminOrderStatus(order.id, 'COMPLETED');
      setOrder(updated);
      setShowCompleteModal(false);
      setActionSuccess(
        `El pedido ${updated.orderNumber} fue marcado como Completado (${getOrderStatusLabel(updated.status)}).`
      );
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setActionError(
        err?.message || 'No se pudo actualizar el estado del pedido a COMPLETED.'
      );
      setShowCompleteModal(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmCancelOrder = async () => {
    if (!order || isUpdatingStatus || order.status === 'CANCELLED') return;
    setIsUpdatingStatus(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updated = await updateAdminOrderStatus(order.id, 'CANCELLED');
      setOrder(updated);
      setShowCancelModal(false);
      setActionSuccess(
        `El pedido ${updated.orderNumber} fue cancelado correctamente y el backend restauró el stock de las variantes asociadas.`
      );
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setActionError(
        err?.message ||
          'No se pudo cancelar el pedido. Verificá el estado de la orden e intentá nuevamente.'
      );
      setShowCancelModal(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const isCancelled = order?.status === 'CANCELLED';
  const isCompleted = order?.status === 'COMPLETED';
  const isPending = order?.status === 'PENDING';

  const totalUnits = Array.isArray(order?.items)
    ? order.items.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      )
    : 0;

  return (
    <AdminShell activeSection="orders">
      {/* Top Breadcrumb */}
      <nav className="mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center flex-wrap gap-2 text-xs text-brand-dark/55">
          <li>
            <a
              href="/admin"
              className="hover:text-brand-dark transition-colors"
            >
              Dashboard
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <a
              href="/admin/orders"
              className="hover:text-brand-dark transition-colors"
            >
              Pedidos
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-mono font-semibold text-brand-dark">
            {order?.orderNumber || (resolvedOrderId ? `#${resolvedOrderId}` : 'Detalle')}
          </li>
        </ol>
      </nav>

      {/* 1. Loading State */}
      {isLoading && (
        <div className="space-y-6 animate-pulse">
          <div className="h-24 w-full bg-[#F2F2F0] rounded-xs" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 h-64 bg-[#F2F2F0] rounded-xs" />
            <div className="lg:col-span-4 h-64 bg-[#F2F2F0] rounded-xs" />
          </div>
        </div>
      )}

      {/* 2. 404 Not Found State */}
      {!isLoading && loadError?.isNotFound && (
        <div className="py-16 px-6 text-center bg-[#FAF9F6]/90 border border-brand-dark/12 rounded-xs space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-brand-dark/45">
            Error 404
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-brand-dark">
            Pedido no encontrado
          </h1>
          <p className="text-xs sm:text-sm text-brand-dark/65 max-w-md mx-auto">
            {loadError.message}
          </p>
          <div className="pt-2">
            <a
              href="/admin/orders"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs"
            >
              ← Volver al listado de pedidos
            </a>
          </div>
        </div>
      )}

      {/* 3. General Error State */}
      {!isLoading && loadError && !loadError.isNotFound && (
        <div className="p-6 bg-red-50/90 border border-red-200 rounded-xs text-xs text-red-800 space-y-3">
          <p className="text-sm font-bold">
            No se pudo cargar el pedido #{resolvedOrderId}
          </p>
          <p>{loadError.message}</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={loadOrder}
              className="px-4 py-2 font-semibold uppercase tracking-wider bg-red-800 text-white rounded-xs cursor-pointer"
            >
              Reintentar
            </button>
            <a
              href="/admin/orders"
              className="font-semibold underline underline-offset-4"
            >
              Volver al listado
            </a>
          </div>
        </div>
      )}

      {/* 4. Loaded Order Detail */}
      {!isLoading && !loadError && order && (
        <div className="space-y-8">
          {/* Header Summary Card */}
          <div className="bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/12 p-5 sm:p-7 rounded-xs flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-mono font-bold tracking-tight text-brand-dark">
                  {order.orderNumber}
                </h1>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="text-xs text-brand-dark/60">
                Fecha de creación:{' '}
                <strong className="font-medium text-brand-dark tabular-nums">
                  {formatArgentinaDateTime(order.createdAt)}
                </strong>{' '}
                • ID interno: <span className="font-mono">#{order.id}</span>
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-dark/45">
                Importe total del pedido
              </span>
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark tabular-nums">
                {formatPrice(Number(order.totalAmount) || 0)}
              </span>
            </div>
          </div>

          {/* Action Success Banner */}
          {actionSuccess && (
            <div
              className="p-4 bg-emerald-50/95 border border-emerald-200 rounded-xs text-xs sm:text-sm text-emerald-900 space-y-1"
              role="status"
            >
              <p className="font-semibold">{actionSuccess}</p>
            </div>
          )}

          {/* Action Error Banner */}
          {actionError && (
            <div
              className="p-4 bg-red-50/95 border border-red-200 rounded-xs text-xs sm:text-sm text-red-800 space-y-1"
              role="alert"
            >
              <p className="font-semibold">No se pudo ejecutar la operación</p>
              <p>{actionError}</p>
            </div>
          )}

          {/* Main 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (8 cols): Historical Order Items */}
            <section
              className="lg:col-span-8 space-y-4"
              aria-label="Productos incluidos en el pedido"
            >
              <div className="flex items-center justify-between border-b border-brand-dark/[0.08] pb-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-brand-dark">
                    Productos Incluidos ({totalUnits}{' '}
                    {totalUnits === 1 ? 'unidad' : 'unidades'})
                  </h2>
                  <p className="text-[11px] text-brand-dark/50 mt-0.5">
                    Registro histórico capturado al momento de generar la orden.
                  </p>
                </div>
                <span className="text-xs text-brand-dark/50">
                  {Array.isArray(order.items) ? order.items.length : 0}{' '}
                  {order.items?.length === 1 ? 'línea' : 'líneas'}
                </span>
              </div>

              <div className="bg-[#FAF9F6]/90 border border-brand-dark/10 rounded-xs overflow-hidden">
                {Array.isArray(order.items) && order.items.length > 0 ? (
                  <>
                    {/* Desktop Historical Table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-brand-dark/10 bg-brand-dark/[0.03] text-[11px] font-semibold uppercase tracking-wider text-brand-dark/55">
                            <th className="py-3 px-4">Producto</th>
                            <th className="py-3 px-4">Talle / Variante</th>
                            <th className="py-3 px-4 text-right">
                              Precio unitario
                            </th>
                            <th className="py-3 px-4 text-center">Cantidad</th>
                            <th className="py-3 px-4 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-dark/[0.08] text-xs sm:text-sm">
                          {order.items.map((item, idx) => {
                            const unitPrice = Number(item.priceAtPurchase) || 0;
                            const qty = Number(item.quantity) || 0;
                            const subtotal =
                              item.subtotal !== undefined
                                ? Number(item.subtotal)
                                : unitPrice * qty;

                            return (
                              <tr
                                key={
                                  item.id ??
                                  `${item.variantId ?? idx}-${item.size ?? idx}`
                                }
                              >
                                <td className="py-4 px-4 font-semibold text-brand-dark">
                                  {item.productTitle || 'Producto'}
                                </td>
                                <td className="py-4 px-4 whitespace-nowrap">
                                  <span className="inline-block px-2 py-0.5 bg-brand-dark/[0.06] text-xs font-semibold text-brand-dark rounded-xs">
                                    Talle {item.size || 'Único'}
                                  </span>
                                  {item.variantId != null && (
                                    <span className="ml-2 font-mono text-[11px] text-brand-dark/45">
                                      (Var. #{item.variantId})
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-right tabular-nums text-brand-dark/80 whitespace-nowrap">
                                  {formatPrice(unitPrice)}
                                </td>
                                <td className="py-4 px-4 text-center font-semibold tabular-nums text-brand-dark whitespace-nowrap">
                                  {qty} u.
                                </td>
                                <td className="py-4 px-4 text-right font-bold tabular-nums text-brand-dark whitespace-nowrap">
                                  {formatPrice(subtotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Historical Cards */}
                    <div className="sm:hidden divide-y divide-brand-dark/[0.08]">
                      {order.items.map((item, idx) => {
                        const unitPrice = Number(item.priceAtPurchase) || 0;
                        const qty = Number(item.quantity) || 0;
                        const subtotal =
                          item.subtotal !== undefined
                            ? Number(item.subtotal)
                            : unitPrice * qty;

                        return (
                          <article
                            key={
                              item.id ??
                              `${item.variantId ?? idx}-${item.size ?? idx}`
                            }
                            className="p-4 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-semibold text-brand-dark">
                                {item.productTitle || 'Producto'}
                              </h3>
                              <span className="text-sm font-bold text-brand-dark tabular-nums shrink-0">
                                {formatPrice(subtotal)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-dark/65">
                              <div>
                                <span className="px-2 py-0.5 bg-brand-dark/[0.06] font-semibold text-brand-dark rounded-xs">
                                  Talle {item.size || 'Único'}
                                </span>
                                {item.variantId != null && (
                                  <span className="ml-1.5 font-mono text-[11px] text-brand-dark/45">
                                    #{item.variantId}
                                  </span>
                                )}
                              </div>
                              <span className="tabular-nums">
                                {qty} u. × {formatPrice(unitPrice)}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-xs text-brand-dark/50">
                    No hay artículos registrados en este pedido.
                  </div>
                )}

                {/* Total Footer Row */}
                <div className="p-4 sm:p-5 bg-brand-dark/[0.03] border-t border-brand-dark/10 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-dark">
                    Importe total del pedido
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-brand-dark tabular-nums">
                    {formatPrice(Number(order.totalAmount) || 0)}
                  </span>
                </div>
              </div>
            </section>

            {/* Right Column (4 cols): Contact Info & State Management Actions */}
            <aside className="lg:col-span-4 space-y-6">
              {/* Contact Information Card */}
              <div className="bg-[#FAF9F6]/90 border border-brand-dark/10 p-5 sm:p-6 rounded-xs space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-dark border-b border-brand-dark/[0.08] pb-3">
                  Información de Contacto
                </h2>
                <dl className="space-y-3 text-xs">
                  <div>
                    <dt className="text-brand-dark/50 uppercase tracking-wider text-[10px]">
                      Nombre del cliente
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-brand-dark">
                      {order.contactName && order.contactName.trim() ? (
                        order.contactName
                      ) : (
                        <span className="text-brand-dark/45 font-normal italic">
                          No especificado
                        </span>
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-brand-dark/50 uppercase tracking-wider text-[10px]">
                      Teléfono de contacto
                    </dt>
                    <dd className="mt-0.5 text-sm font-mono font-semibold text-brand-dark">
                      {order.contactPhone && order.contactPhone.trim() ? (
                        order.contactPhone
                      ) : (
                        <span className="font-sans text-brand-dark/45 font-normal italic">
                          No especificado
                        </span>
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-brand-dark/50 uppercase tracking-wider text-[10px]">
                      Estado actual
                    </dt>
                    <dd className="mt-1">
                      <OrderStatusBadge status={order.status} />
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Order Status & Cancellation Controls */}
              <div className="bg-[#FAF9F6]/90 border border-brand-dark/12 p-5 sm:p-6 rounded-xs space-y-5">
                <div className="border-b border-brand-dark/[0.08] pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-dark">
                    Gestión de Estado del Pedido
                  </h2>
                </div>

                {isCancelled ? (
                  <div className="p-4 bg-red-50/70 border border-red-200 rounded-xs space-y-2 text-xs text-red-900">
                    <p className="font-semibold">
                      Este pedido se encuentra CANCELADO.
                    </p>
                    <p className="leading-relaxed text-red-800/85">
                      El stock correspondiente a los artículos de esta orden fue
                      restaurado en el inventario por el sistema al momento de la
                      cancelación. No es posible volver a cancelar este pedido.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isPending && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setShowCompleteModal(true);
                          }}
                          disabled={isUpdatingStatus}
                          className="w-full min-h-[44px] px-4 flex items-center justify-center gap-2 bg-brand-dark text-[#FAFAFA] text-xs font-semibold uppercase tracking-wider rounded-xs hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                        >
                          <span>Marcar como Completado (COMPLETED)</span>
                        </button>
                        <p className="text-[11px] text-brand-dark/50 leading-relaxed">
                          Registra que el pago y la entrega del pedido fueron
                          concretados.
                        </p>
                      </div>
                    )}

                    {isCompleted && (
                      <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xs text-xs text-emerald-900 space-y-1">
                        <p className="font-semibold">
                          Pedido marcado como COMPLETADO.
                        </p>
                        <p className="text-[11px] text-emerald-800/85">
                          El inventario ya fue descontado al momento de crear la
                          orden.
                        </p>
                      </div>
                    )}

                    {/* Cancel Order Action */}
                    <div
                      className={`${
                        isPending ? 'border-t border-brand-dark/[0.08] pt-4' : ''
                      } space-y-2`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          setShowCancelModal(true);
                        }}
                        disabled={isUpdatingStatus}
                        className="w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-red-800 bg-white border border-red-200 hover:bg-red-50 rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isUpdatingStatus
                          ? 'Procesando...'
                          : 'Cancelar pedido (CANCELLED)'}
                      </button>
                      <p className="text-[11px] text-brand-dark/50 leading-relaxed">
                        Al cancelar el pedido, el backend restaurará
                        automáticamente las unidades de cada variante al stock
                        disponible.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <a
                  href="/admin/orders"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-dark/65 hover:text-brand-dark transition-colors"
                >
                  ← Volver al listado de pedidos
                </a>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Modal 1: Confirmation Dialog for COMPLETED */}
      {showCompleteModal && order && isPending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-complete-order-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 sm:p-7 rounded-xs shadow-lg space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
                Confirmar estado
              </span>
              <h3
                id="modal-complete-order-title"
                className="text-lg font-bold tracking-tight text-brand-dark"
              >
                ¿Marcar pedido como completado?
              </h3>
              <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed">
                Estás por actualizar el pedido{' '}
                <strong className="font-mono font-semibold text-brand-dark">
                  {order.orderNumber}
                </strong>{' '}
                al estado <strong>COMPLETED</strong> por un total de{' '}
                <strong className="text-brand-dark">
                  {formatPrice(Number(order.totalAmount) || 0)}
                </strong>
                .
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white hover:bg-brand-dark/[0.04] rounded-xs cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleConfirmCompleteOrder}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-emerald-800 hover:bg-emerald-900 rounded-xs cursor-pointer disabled:opacity-50"
              >
                {isUpdatingStatus
                  ? 'Actualizando...'
                  : 'Sí, marcar como completado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Confirmation Dialog for CANCELLED */}
      {showCancelModal && order && !isCancelled && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cancel-order-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 sm:p-7 rounded-xs shadow-lg space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700">
                Confirmación de cancelación
              </span>
              <h3
                id="modal-cancel-order-title"
                className="text-lg font-bold tracking-tight text-brand-dark"
              >
                ¿Cancelar el pedido {order.orderNumber}?
              </h3>
              <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed">
                El pedido pasará al estado <strong>CANCELLED</strong> y el
                backend restaurará automáticamente las{' '}
                <strong className="text-brand-dark">
                  {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
                </strong>{' '}
                al inventario de sus variantes correspondientes.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white hover:bg-brand-dark/[0.04] rounded-xs cursor-pointer"
              >
                No cancelar
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleConfirmCancelOrder}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-red-700 hover:bg-red-800 rounded-xs cursor-pointer disabled:opacity-50"
              >
                {isUpdatingStatus
                  ? 'Cancelando pedido...'
                  : 'Sí, cancelar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
