import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import InquiryStatusBadge from './InquiryStatusBadge';
import OrderStatusBadge from './OrderStatusBadge';
import Button from './ui/Button';
import Card from './ui/Card';
import Field, { inputClass } from './ui/Field';
import Menu from './ui/Menu';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import { toast } from './ui/Toast';
import {
  fetchAdminInquiryById,
  updateAdminInquiryStatus,
  confirmAdminInquiry,
  formatPrice,
  getOptimizedImageUrl,
  parsePositiveIntId,
  safeDecodeURIComponent,
} from '../../../services/api';
import { formatArgentinaDateTime } from '../../../utils/date';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22500%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23F2F2F0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-size%3D%2212%22%20fill%3D%22%231D110D80%22%3ESIN%20IMAGEN%3C%2Ftext%3E%3C%2Fsvg%3E';

/**
 * @param {Object} [props]
 * @param {string|number} [props.inquiryId]
 */
export default function AdminInquiryDetailView({ inquiryId: propInquiryId = null } = {}) {
  const [resolvedId, setResolvedId] = useState(parsePositiveIntId(propInquiryId));
  // False until the URL was inspected on the client (avoids flashing the "invalid id" state)
  const [hasResolvedUrl, setHasResolvedUrl] = useState(false);

  useEffect(() => {
    if (propInquiryId) {
      setResolvedId(parsePositiveIntId(propInquiryId));
    } else if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryId = parsePositiveIntId(params.get('id'));
      const match = window.location.pathname.match(/\/admin\/inquiries\/([^/?#]+)/);
      const pathId =
        match && match[1] && match[1].toLowerCase() !== 'fallback'
          ? parsePositiveIntId(safeDecodeURIComponent(match[1]))
          : null;
      setResolvedId(pathId ?? queryId ?? null);
    }
    setHasResolvedUrl(true);
  }, [propInquiryId]);

  const [inquiry, setInquiry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Action states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showConfirmSaleModal, setShowConfirmSaleModal] = useState(false);
  const [isConfirmingSale, setIsConfirmingSale] = useState(false);

  // Confirm sale form fields
  const [confirmContactName, setConfirmContactName] = useState('');
  const [confirmContactPhone, setConfirmContactPhone] = useState('');
  const [confirmFormError, setConfirmFormError] = useState(null);
  const [confirmFieldErrors, setConfirmFieldErrors] = useState({});

  const [createdOrder, setCreatedOrder] = useState(null);

  const loadInquiry = useCallback(async () => {
    if (!hasResolvedUrl) return;

    if (!resolvedId) {
      setIsLoading(false);
      setLoadError({
        message: 'No se especificó un identificador de consulta válido en la dirección.',
        isNotFound: true,
      });
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchAdminInquiryById(resolvedId);
      setInquiry(data);
      setConfirmContactName(data?.contactName ? data.contactName.trim() : '');
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      setLoadError({
        message: err?.message || 'No se pudo cargar el detalle de la consulta.',
        isNotFound: err?.status === 404 || err?.isNotFound,
      });
    } finally {
      setIsLoading(false);
    }
  }, [hasResolvedUrl, resolvedId]);

  useEffect(() => {
    loadInquiry();
  }, [loadInquiry]);

  const handleMarkInProgress = async () => {
    if (!inquiry || isUpdatingStatus) return;
    setIsUpdatingStatus(true);

    try {
      const updated = await updateAdminInquiryStatus(inquiry.id, 'IN_PROGRESS');
      setInquiry(updated);
      toast.success(`La consulta ${updated.inquiryNumber} quedó en seguimiento.`);
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      toast.error(err?.message || 'No se pudo actualizar el estado de la consulta.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // La confirmación de "No concretada" es en línea (menú de acciones)
  const handleConfirmNotConverted = async () => {
    if (!inquiry || isUpdatingStatus) return;
    setIsUpdatingStatus(true);

    try {
      const updated = await updateAdminInquiryStatus(inquiry.id, 'NOT_CONVERTED');
      setInquiry(updated);
      toast.success(`La consulta ${updated.inquiryNumber} se cerró como no concretada.`);
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      toast.error(err?.message || 'No se pudo cerrar la consulta como no concretada.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const openConfirmModal = () => {
    setConfirmFormError(null);
    setConfirmFieldErrors({});
    setConfirmContactName(inquiry?.contactName ? inquiry.contactName.trim() : '');
    setShowConfirmSaleModal(true);
  };

  const handleConfirmSaleSubmit = async (e) => {
    e.preventDefault();
    if (!inquiry || isConfirmingSale) return;

    setConfirmFormError(null);
    setConfirmFieldErrors({});

    const trimmedName = confirmContactName.trim();
    const trimmedPhone = confirmContactPhone.trim();

    if (!trimmedName) {
      const msg = 'Ingresá el nombre de contacto del cliente para registrar el pedido.';
      setConfirmFieldErrors({ contactName: msg });
      setConfirmFormError(msg);
      return;
    }

    if (trimmedName.length > 150) {
      const msg = 'El nombre de contacto del cliente no puede superar los 150 caracteres.';
      setConfirmFieldErrors({ contactName: msg });
      setConfirmFormError(msg);
      return;
    }

    if (!trimmedPhone) {
      const msg = 'El teléfono de contacto es obligatorio para generar el pedido.';
      setConfirmFieldErrors({ contactPhone: msg });
      setConfirmFormError(msg);
      return;
    }

    if (trimmedPhone.length > 50) {
      const msg = 'El teléfono de contacto no puede superar los 50 caracteres.';
      setConfirmFieldErrors({ contactPhone: msg });
      setConfirmFormError(msg);
      return;
    }

    setIsConfirmingSale(true);

    try {
      const confirmation = await confirmAdminInquiry(inquiry.id, {
        contactName: trimmedName,
        contactPhone: trimmedPhone,
      });

      setInquiry((prev) =>
        prev
          ? {
              ...prev,
              status: confirmation.status || 'CONVERTED',
              orderId: confirmation.orderId,
              orderNumber: confirmation.orderNumber,
            }
          : prev
      );

      const resolvedOrder = confirmation.order || {
        id: confirmation.orderId,
        orderNumber: confirmation.orderNumber,
        status: 'PENDING',
        contactName: trimmedName,
        contactPhone: trimmedPhone,
        totalAmount: inquiry.totalAmount,
      };
      setCreatedOrder(resolvedOrder);

      setShowConfirmSaleModal(false);
      toast.success(`Pedido ${confirmation.orderNumber} creado (${resolvedOrder.status || 'PENDING'}).`, {
        title: 'Venta confirmada',
      });
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        setConfirmFieldErrors(err.fieldErrors);
      }
      setConfirmFormError(
        err?.message ||
          'No se pudo confirmar la venta. Verificá la disponibilidad de stock de los artículos.'
      );
    } finally {
      setIsConfirmingSale(false);
    }
  };

  const isClosed = inquiry?.status === 'CONVERTED' || inquiry?.status === 'NOT_CONVERTED';
  const totalUnits = Array.isArray(inquiry?.items)
    ? inquiry.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
    : 0;
  const busy = isUpdatingStatus || isConfirmingSale;

  const moreItems = inquiry
    ? [
        inquiry.status === 'NEW' && {
          key: 'progress',
          label: 'Marcar en seguimiento',
          disabled: busy,
          onSelect: handleMarkInProgress,
        },
        {
          key: 'closed',
          label: 'Cerrar como no concretada…',
          danger: true,
          disabled: busy,
          confirm: {
            message: `Se cierra ${inquiry.inquiryNumber} como no concretada. Una vez cerrada no se puede reabrir ni convertir en pedido.`,
            confirmLabel: 'Cerrar consulta',
          },
          onSelect: handleConfirmNotConverted,
        },
      ].filter(Boolean)
    : [];

  const actionButtons = (direction) => (
    <>
      <Button onClick={openConfirmModal} disabled={busy} className="flex-1 lg:w-full">
        Confirmar venta
      </Button>
      <Menu
        label="Marcar como…"
        items={moreItems}
        direction={direction}
        trigger={({ props }) => (
          <Button variant="secondary" {...props} className="px-4">
            Marcar como…
          </Button>
        )}
      />
    </>
  );

  return (
    <AdminShell activeSection="inquiries">
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
          icon="chat"
          title="Consulta no encontrada"
          description={loadError.message}
          action={<Button href="/admin/inquiries">Volver a consultas</Button>}
        />
      )}

      {!isLoading && loadError && !loadError.isNotFound && (
        <ErrorState
          title={`No pudimos cargar la consulta ${resolvedId ? `#${resolvedId}` : ''}`}
          message={loadError.message}
          onRetry={loadInquiry}
        />
      )}

      {!isLoading && !loadError && inquiry && (
        <div className="space-y-5">
          {/* Cabecera */}
          <div>
            <nav aria-label="Ruta" className="flex items-center gap-1.5 text-[13px] text-ink-muted">
              <a href="/admin/inquiries" className="inline-flex min-h-6 items-center hover:text-brand-dark">
                Consultas
              </a>
              <span aria-hidden="true">/</span>
              <span className="text-brand-dark">{inquiry.inquiryNumber}</span>
            </nav>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-[-0.025em] text-brand-dark lg:text-[1.75rem]">
                  {inquiry.inquiryNumber}
                </h1>
                <InquiryStatusBadge status={inquiry.status} />
              </div>
              <p className="text-sm text-ink-muted tabular-nums">
                Creada el {formatArgentinaDateTime(inquiry.createdAt)}
              </p>
            </div>
          </div>

          {/* Pedido asociado (consulta convertida) */}
          {(inquiry.status === 'CONVERTED' || createdOrder) && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-ink-muted">Venta confirmada · pedido asociado</p>
                  <p className="mt-0.5 text-lg font-semibold text-brand-dark">
                    {createdOrder?.orderNumber ||
                      inquiry.orderNumber ||
                      (inquiry.orderId != null ? `Pedido #${inquiry.orderId}` : 'Pedido registrado')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {createdOrder?.status && <OrderStatusBadge status={createdOrder.status} />}
                  {(createdOrder?.id || inquiry.orderId != null) && (
                    <Button
                      href={`/admin/orders/detail?id=${createdOrder?.id ?? inquiry.orderId}`}
                      size="sm"
                      variant="secondary"
                    >
                      Ver pedido
                    </Button>
                  )}
                </div>
              </div>
              {createdOrder && (
                <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-brand-dark/[0.07] pt-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-[13px] text-ink-muted">Cliente en el pedido</dt>
                    <dd className="font-medium text-brand-dark">{createdOrder.contactName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-muted">Teléfono</dt>
                    <dd className="font-medium text-brand-dark">{createdOrder.contactPhone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-muted">Monto</dt>
                    <dd className="font-semibold tabular-nums text-brand-dark">
                      {formatPrice(Number(createdOrder.totalAmount) || 0)}
                    </dd>
                  </div>
                </dl>
              )}
            </Card>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
            {/* Artículos */}
            <Card
              className="lg:col-span-8"
              padded={false}
              aria-label="Artículos de la consulta"
            >
              <div className="flex items-baseline justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
                <h2 className="text-base font-semibold text-brand-dark">Artículos</h2>
                <span className="text-sm text-ink-muted tabular-nums">
                  {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
                </span>
              </div>

              <ul className="mt-2 divide-y divide-brand-dark/[0.07]">
                {Array.isArray(inquiry.items) && inquiry.items.length > 0 ? (
                  inquiry.items.map((item, idx) => {
                    const imgSrc = item.imageUrl && item.imageUrl.trim() ? item.imageUrl : PLACEHOLDER_IMAGE;
                    return (
                      <li
                        key={item.id ?? `${item.variantId ?? idx}-${item.size ?? idx}`}
                        className="flex items-start gap-3 px-4 py-3 sm:px-6"
                      >
                        <span className="flex h-[72px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-ctl bg-sunken">
                          <img
                            src={getOptimizedImageUrl(imgSrc, 'thumbnail')}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = PLACEHOLDER_IMAGE;
                            }}
                            className="h-full w-full object-contain object-center mix-blend-multiply"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-brand-dark">
                            {item.productTitle || 'Producto'}
                          </p>
                          <p className="mt-0.5 text-[13px] text-ink-muted">
                            Talle {item.size || 'Único'} · {formatPrice(Number(item.unitPrice) || 0)} c/u
                          </p>
                          <div className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                            <span className="text-ink-muted tabular-nums">× {item.quantity}</span>
                            <span className="font-semibold tabular-nums text-brand-dark">
                              {formatPrice(Number(item.subtotal) || 0)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <li className="p-8 text-center text-sm text-ink-muted">No hay artículos detallados en esta consulta.</li>
                )}
              </ul>

              <div className="flex items-center justify-between rounded-b-card bg-sunken px-4 py-3.5 sm:px-6">
                <span className="text-sm font-medium text-brand-dark">Total estimado</span>
                <span className="text-lg font-semibold tabular-nums text-brand-dark">
                  {formatPrice(Number(inquiry.totalAmount) || 0)}
                </span>
              </div>
            </Card>

            {/* Datos + acciones */}
            <aside className="space-y-5 lg:sticky lg:top-6 lg:col-span-4">
              <Card title="Datos de la consulta">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-[13px] text-ink-muted">Nombre informado por el cliente</dt>
                    <dd className="font-medium text-brand-dark">
                      {inquiry.contactName && inquiry.contactName.trim() ? (
                        inquiry.contactName
                      ) : (
                        <span className="font-normal italic text-ink-muted">No informado</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-muted">Estado</dt>
                    <dd className="mt-1">
                      <InquiryStatusBadge status={inquiry.status} />
                    </dd>
                  </div>
                  {inquiry.orderNumber && (
                    <div>
                      <dt className="text-[13px] text-ink-muted">Pedido generado</dt>
                      <dd className="font-medium text-brand-dark">{inquiry.orderNumber}</dd>
                    </div>
                  )}
                </dl>
              </Card>

              <Card title="Gestión" className="hidden lg:block">
                {isClosed ? (
                  <p className="text-sm text-ink-muted">
                    {inquiry.status === 'CONVERTED'
                      ? 'Esta consulta ya se convirtió en venta.'
                      : 'Esta consulta se cerró como no concretada.'}{' '}
                    Las consultas cerradas conservan su registro y no admiten cambios de estado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2">{actionButtons('down')}</div>
                    <p className="text-[13px] text-ink-muted">
                      Confirmar la venta valida el stock actual, lo descuenta y crea un pedido pendiente.
                    </p>
                  </div>
                )}
              </Card>
            </aside>
          </div>

          {/* Barra de acciones fija (celu / tablet) */}
          {!isClosed && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-dark/[0.08] bg-brand-light px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
              <div className="mx-auto flex max-w-[1180px] items-center gap-2">{actionButtons('up')}</div>
            </div>
          )}
        </div>
      )}

      {/* Confirmar venta y crear pedido */}
      <Modal
        open={showConfirmSaleModal && Boolean(inquiry)}
        onClose={() => setShowConfirmSaleModal(false)}
        busy={isConfirmingSale}
        title={inquiry ? `Confirmar venta · ${inquiry.inquiryNumber}` : 'Confirmar venta'}
        description="Se crea el pedido en estado pendiente, se descuenta el stock y la consulta pasa a convertida."
        footer={
          <>
            <Button variant="ghost" disabled={isConfirmingSale} onClick={() => setShowConfirmSaleModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="confirm-sale-form" loading={isConfirmingSale} loadingText="Confirmando…">
              Confirmar venta
            </Button>
          </>
        }
      >
        {inquiry && (
          <>
            <p className="text-[13px] font-medium text-ink-muted">Se descuenta del inventario ({totalUnits} u.)</p>
            <ul className="mt-1.5 max-h-44 divide-y divide-brand-dark/[0.07] overflow-y-auto rounded-ctl ring-1 ring-brand-dark/[0.08]">
              {inquiry.items?.map((item, idx) => (
                <li
                  key={item.id ?? `${item.variantId ?? idx}-${item.size ?? idx}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-brand-dark">{item.productTitle || 'Producto'}</span>
                    <span className="block text-[13px] text-ink-muted">
                      Talle {item.size || 'Único'} · {item.quantity ?? 0} u.
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-brand-dark">
                    {formatPrice(Number(item.subtotal) || 0)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center justify-between text-sm font-semibold text-brand-dark">
              <span>Total del pedido</span>
              <span className="tabular-nums">{formatPrice(Number(inquiry.totalAmount) || 0)}</span>
            </p>

            {confirmFormError && (
              <p role="alert" className="mt-4 rounded-card bg-red-50 p-3.5 text-sm text-red-900">
                {confirmFormError}
              </p>
            )}

            <form id="confirm-sale-form" onSubmit={handleConfirmSaleSubmit} className="mt-4 space-y-4" noValidate>
              <Field label="Nombre del cliente" required error={confirmFieldErrors.contactName} id="confirm-contact-name">
                <input
                  type="text"
                  maxLength={150}
                  required
                  disabled={isConfirmingSale}
                  value={confirmContactName}
                  onChange={(e) => {
                    setConfirmContactName(e.target.value);
                    if (confirmFieldErrors.contactName) {
                      setConfirmFieldErrors((prev) => ({ ...prev, contactName: undefined }));
                      setConfirmFormError(null);
                    }
                  }}
                  placeholder="Ej. Juan Pérez"
                  className={inputClass}
                />
              </Field>
              <Field label="Teléfono / WhatsApp" required error={confirmFieldErrors.contactPhone} id="confirm-contact-phone">
                <input
                  type="tel"
                  maxLength={50}
                  required
                  disabled={isConfirmingSale}
                  value={confirmContactPhone}
                  onChange={(e) => {
                    setConfirmContactPhone(e.target.value);
                    if (confirmFieldErrors.contactPhone) {
                      setConfirmFieldErrors((prev) => ({ ...prev, contactPhone: undefined }));
                      setConfirmFormError(null);
                    }
                  }}
                  placeholder="Ej. 1122334455"
                  className={inputClass}
                />
              </Field>
            </form>
          </>
        )}
      </Modal>
    </AdminShell>
  );
}
