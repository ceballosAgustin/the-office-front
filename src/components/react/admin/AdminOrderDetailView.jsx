import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import OrderStatusBadge, { getOrderStatusLabel } from './OrderStatusBadge';
import Button from './ui/Button';
import Card from './ui/Card';
import Menu from './ui/Menu';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import { toast } from './ui/Toast';
import {
  fetchAdminOrderById,
  updateAdminOrderStatus,
  formatPrice,
  parsePositiveIntId,
  safeDecodeURIComponent,
} from '../../../services/api';
import { formatArgentinaDateTime } from '../../../utils/date';

// Returns the numeric order id as a string, or null when missing/invalid.
function resolveClientOrderId(propOrderId) {
  if (propOrderId !== undefined && propOrderId !== null && String(propOrderId).trim() !== '') {
    const propId = parsePositiveIntId(String(propOrderId));
    return propId !== null ? String(propId) : null;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const queryId = parsePositiveIntId(params.get('id'));
  if (queryId !== null) {
    return String(queryId);
  }
  const pathMatch = window.location.pathname.match(/^\/admin\/orders\/([^/?#]+)\/?$/);
  if (pathMatch && pathMatch[1] && pathMatch[1].toLowerCase() !== 'detail') {
    const pathId = parsePositiveIntId(safeDecodeURIComponent(pathMatch[1].trim()));
    return pathId !== null ? String(pathId) : null;
  }
  return null;
}

/**
 * @param {Object} [props]
 * @param {string|number} [props.orderId]
 */
export default function AdminOrderDetailView({ orderId: propOrderId = null } = {}) {
  const [resolvedOrderId, setResolvedOrderId] = useState(() =>
    resolveClientOrderId(propOrderId)
  );
  const [hasResolvedUrl, setHasResolvedUrl] = useState(false);
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Status update / cancellation state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

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

    try {
      const updated = await updateAdminOrderStatus(order.id, 'COMPLETED');
      setOrder(updated);
      setShowCompleteModal(false);
      toast.success(`El pedido ${updated.orderNumber} quedó ${getOrderStatusLabel(updated.status).toLowerCase()}.`);
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      toast.error(err?.message || 'No se pudo marcar el pedido como completado.');
      setShowCompleteModal(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // La confirmación de cancelar es en línea (menú de acciones)
  const handleConfirmCancelOrder = async () => {
    if (!order || isUpdatingStatus || order.status === 'CANCELLED') return;
    setIsUpdatingStatus(true);

    try {
      const updated = await updateAdminOrderStatus(order.id, 'CANCELLED');
      setOrder(updated);
      toast.success(`El pedido ${updated.orderNumber} se canceló y el stock de sus variantes se restauró.`, {
        title: 'Pedido cancelado',
      });
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      toast.error(
        err?.message ||
          'No se pudo cancelar el pedido. Verificá el estado de la orden e intentá nuevamente.'
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const isCancelled = order?.status === 'CANCELLED';
  const isCompleted = order?.status === 'COMPLETED';
  const isPending = order?.status === 'PENDING';

  const totalUnits = Array.isArray(order?.items)
    ? order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
    : 0;

  const cancelItems = [
    {
      key: 'cancel',
      label: 'Cancelar pedido…',
      danger: true,
      disabled: isUpdatingStatus,
      confirm: {
        message:
          'Se cancela el pedido y el sistema devuelve al stock las unidades de cada variante. No se puede deshacer.',
        confirmLabel: 'Cancelar pedido',
        cancelLabel: 'Volver',
      },
      onSelect: handleConfirmCancelOrder,
    },
  ];

  const actionButtons = (direction) => (
    <>
      {isPending && (
        <Button onClick={() => setShowCompleteModal(true)} disabled={isUpdatingStatus} className="flex-1 lg:w-full">
          Marcar como completado
        </Button>
      )}
      <Menu
        label="Más acciones"
        items={cancelItems}
        direction={direction}
        trigger={({ props }) => (
          <Button variant="secondary" {...props} className={isPending ? 'px-4' : 'flex-1 lg:w-full'}>
            {isPending ? 'Más…' : 'Cancelar pedido…'}
          </Button>
        )}
      />
    </>
  );

  const lineSubtotal = (item) => {
    const unitPrice = Number(item.priceAtPurchase) || 0;
    const qty = Number(item.quantity) || 0;
    return { unitPrice, qty, subtotal: item.subtotal !== undefined ? Number(item.subtotal) : unitPrice * qty };
  };

  return (
    <AdminShell activeSection="orders">
      {isLoading && (
        <div className="animate-pulse space-y-5" role="status" aria-label="Cargando">
          <div className="h-20 rounded-card bg-white shadow-hairline" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="h-64 rounded-card bg-white shadow-hairline lg:col-span-8" />
            <div className="h-48 rounded-card bg-white shadow-hairline lg:col-span-4" />
          </div>
        </div>
      )}

      {!isLoading && loadError?.isNotFound && (
        <EmptyState
          icon="bag"
          title="Pedido no encontrado"
          description={loadError.message}
          action={<Button href="/admin/orders">Volver a pedidos</Button>}
        />
      )}

      {!isLoading && loadError && !loadError.isNotFound && (
        <ErrorState
          title={`No pudimos cargar el pedido #${resolvedOrderId}`}
          message={loadError.message}
          onRetry={loadOrder}
        />
      )}

      {!isLoading && !loadError && order && (
        <div className="space-y-5">
          {/* Cabecera */}
          <div>
            <nav aria-label="Ruta" className="flex items-center gap-1.5 text-[13px] text-ink-muted">
              <a href="/admin/orders" className="inline-flex min-h-6 items-center hover:text-brand-dark">
                Pedidos
              </a>
              <span aria-hidden="true">/</span>
              <span className="text-brand-dark">{order.orderNumber}</span>
            </nav>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="break-all text-2xl font-semibold tracking-[-0.025em] text-brand-dark lg:text-[1.75rem]">
                  {order.orderNumber}
                </h1>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="text-sm text-ink-muted tabular-nums">Creado el {formatArgentinaDateTime(order.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
            {/* Productos */}
            <Card className="lg:col-span-8" padded={false} aria-label="Productos incluidos en el pedido">
              <div className="flex items-baseline justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
                <h2 className="text-base font-semibold text-brand-dark">Productos</h2>
                <span className="text-sm text-ink-muted tabular-nums">
                  {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
                </span>
              </div>
              <p className="px-4 text-[13px] text-ink-muted sm:px-6">
                Registro histórico capturado al generar el pedido.
              </p>

              <ul className="mt-2 divide-y divide-brand-dark/[0.07]">
                {Array.isArray(order.items) && order.items.length > 0 ? (
                  order.items.map((item, idx) => {
                    const { unitPrice, qty, subtotal } = lineSubtotal(item);
                    return (
                      <li
                        key={item.id ?? `${item.variantId ?? idx}-${item.size ?? idx}`}
                        className="flex items-start justify-between gap-3 px-4 py-3 sm:px-6"
                      >
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold leading-snug text-brand-dark">
                            {item.productTitle || 'Producto'}
                          </p>
                          <p className="mt-0.5 text-[13px] text-ink-muted tabular-nums">
                            Talle {item.size || 'Único'} · {formatPrice(unitPrice)} c/u · × {qty}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-dark">
                          {formatPrice(subtotal)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="p-8 text-center text-sm text-ink-muted">No hay productos registrados en este pedido.</li>
                )}
              </ul>

              <div className="flex items-center justify-between rounded-b-card bg-sunken px-4 py-3.5 sm:px-6">
                <span className="text-sm font-medium text-brand-dark">Importe total</span>
                <span className="text-lg font-semibold tabular-nums text-brand-dark">
                  {formatPrice(Number(order.totalAmount) || 0)}
                </span>
              </div>
            </Card>

            <aside className="space-y-5 lg:sticky lg:top-6 lg:col-span-4">
              <Card title="Contacto">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-[13px] text-ink-muted">Nombre</dt>
                    <dd className="font-medium text-brand-dark">
                      {order.contactName && order.contactName.trim() ? (
                        order.contactName
                      ) : (
                        <span className="font-normal italic text-ink-muted">No especificado</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-muted">Teléfono</dt>
                    <dd className="font-medium text-brand-dark">
                      {order.contactPhone && order.contactPhone.trim() ? (
                        order.contactPhone
                      ) : (
                        <span className="font-normal italic text-ink-muted">No especificado</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-muted">Estado</dt>
                    <dd className="mt-1">
                      <OrderStatusBadge status={order.status} />
                    </dd>
                  </div>
                </dl>
              </Card>

              <Card title="Gestión" className="hidden lg:block">
                {isCancelled ? (
                  <p className="text-sm text-ink-muted">
                    Este pedido está cancelado. El stock de sus artículos ya se restauró y no se puede volver a cancelar.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {isCompleted && (
                      <p className="text-sm text-ink-muted">
                        Pedido completado. El inventario se descontó al crearlo.
                      </p>
                    )}
                    <div className="flex flex-col gap-2">{actionButtons('down')}</div>
                    <p className="text-[13px] text-ink-muted">
                      {isPending
                        ? 'Completar registra que el pago y la entrega se concretaron. Cancelar devuelve el stock.'
                        : 'Cancelar el pedido devuelve el stock de cada variante.'}
                    </p>
                  </div>
                )}
              </Card>

              <a
                href="/admin/orders"
                className="hidden min-h-11 items-center text-sm font-medium text-ink-muted hover:text-brand-dark lg:inline-flex"
              >
                ← Volver a pedidos
              </a>
            </aside>
          </div>

          {/* Barra de acciones fija (celu / tablet) */}
          {!isCancelled && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-dark/[0.08] bg-brand-light px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
              <div className="mx-auto flex max-w-[1180px] items-center gap-2">{actionButtons('up')}</div>
            </div>
          )}
        </div>
      )}

      {/* Confirmar "completado" */}
      <Modal
        open={showCompleteModal && Boolean(order) && isPending}
        onClose={() => setShowCompleteModal(false)}
        busy={isUpdatingStatus}
        size="sm"
        title="¿Marcar como completado?"
        description={
          order
            ? `El pedido ${order.orderNumber} pasa a completado, por un total de ${formatPrice(Number(order.totalAmount) || 0)}.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" disabled={isUpdatingStatus} onClick={() => setShowCompleteModal(false)}>
              Volver
            </Button>
            <Button loading={isUpdatingStatus} loadingText="Actualizando…" onClick={handleConfirmCompleteOrder}>
              Sí, completar
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Registra que el pago y la entrega del pedido se concretaron.</p>
      </Modal>
    </AdminShell>
  );
}
