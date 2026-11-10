import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import InquiryStatusBadge from './InquiryStatusBadge';
import {
  fetchAdminInquiryById,
  updateAdminInquiryStatus,
  confirmAdminInquiry,
  formatPrice,
} from '../../../services/api';
import { formatArgentinaDateTime } from '../../../utils/date';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22500%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23F2F2F0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-size%3D%2212%22%20fill%3D%22%231D110D80%22%3ESIN%20IMAGEN%3C%2Ftext%3E%3C%2Fsvg%3E';

export default function AdminInquiryDetailView({ inquiryId }) {
  const [inquiry, setInquiry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Action states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showNotConvertedModal, setShowNotConvertedModal] = useState(false);
  const [showConfirmSaleModal, setShowConfirmSaleModal] = useState(false);
  const [isConfirmingSale, setIsConfirmingSale] = useState(false);

  // Confirm sale form fields
  const [confirmContactName, setConfirmContactName] = useState('');
  const [confirmContactPhone, setConfirmContactPhone] = useState('');
  const [confirmFormError, setConfirmFormError] = useState(null);
  const [confirmFieldErrors, setConfirmFieldErrors] = useState({});

  // Operation feedback
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);

  const loadInquiry = useCallback(async () => {
    if (!inquiryId) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchAdminInquiryById(inquiryId);
      setInquiry(data);
      setConfirmContactName(data?.contactName ? data.contactName.trim() : '');
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
        message: err?.message || 'No se pudo cargar el detalle de la consulta.',
        isNotFound: err?.status === 404 || err?.isNotFound,
      });
    } finally {
      setIsLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    loadInquiry();
  }, [loadInquiry]);

  const handleMarkInProgress = async () => {
    if (!inquiry || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updated = await updateAdminInquiryStatus(inquiry.id, 'IN_PROGRESS');
      setInquiry(updated);
      setActionSuccess(
        `El estado de la consulta ${updated.inquiryNumber} se actualizó a En seguimiento (IN_PROGRESS).`
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
        err?.message || 'No se pudo actualizar el estado de la consulta.'
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmNotConverted = async () => {
    if (!inquiry || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updated = await updateAdminInquiryStatus(
        inquiry.id,
        'NOT_CONVERTED'
      );
      setInquiry(updated);
      setShowNotConvertedModal(false);
      setActionSuccess(
        `La consulta ${updated.inquiryNumber} fue marcada como No concretada (NOT_CONVERTED).`
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
        err?.message || 'No se pudo cerrar la consulta como no concretada.'
      );
      setShowNotConvertedModal(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const openConfirmModal = () => {
    setActionError(null);
    setConfirmFormError(null);
    setConfirmFieldErrors({});
    setConfirmContactName(
      inquiry?.contactName ? inquiry.contactName.trim() : ''
    );
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
      const msg =
        'Ingresá el nombre de contacto del cliente para registrar el pedido.';
      setConfirmFieldErrors({ contactName: msg });
      setConfirmFormError(msg);
      return;
    }

    if (trimmedName.length > 150) {
      const msg =
        'El nombre de contacto del cliente no puede superar los 150 caracteres.';
      setConfirmFieldErrors({ contactName: msg });
      setConfirmFormError(msg);
      return;
    }

    if (!trimmedPhone) {
      const msg =
        'El teléfono de contacto es obligatorio para generar el pedido (Order).';
      setConfirmFieldErrors({ contactPhone: msg });
      setConfirmFormError(msg);
      return;
    }

    if (trimmedPhone.length > 50) {
      const msg =
        'El teléfono de contacto no puede superar los 50 caracteres.';
      setConfirmFieldErrors({ contactPhone: msg });
      setConfirmFormError(msg);
      return;
    }

    setIsConfirmingSale(true);
    setActionError(null);
    setActionSuccess(null);

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
      setActionSuccess(
        `Venta confirmada exitosamente. Pedido asociado: ${confirmation.orderNumber} (estado ${resolvedOrder.status || 'PENDING'}).`
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

  const isClosed =
    inquiry?.status === 'CONVERTED' || inquiry?.status === 'NOT_CONVERTED';
  const totalUnits = Array.isArray(inquiry?.items)
    ? inquiry.items.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      )
    : 0;

  return (
    <AdminShell activeSection="inquiries">
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
              href="/admin/inquiries"
              className="hover:text-brand-dark transition-colors"
            >
              Consultas
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-mono font-semibold text-brand-dark">
            {inquiry?.inquiryNumber || `#${inquiryId}`}
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
            Consulta comercial no encontrada
          </h1>
          <p className="text-xs sm:text-sm text-brand-dark/65 max-w-md mx-auto">
            {loadError.message}
          </p>
          <div className="pt-2">
            <a
              href="/admin/inquiries"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs"
            >
              ← Volver al listado de consultas
            </a>
          </div>
        </div>
      )}

      {/* 3. General Error State */}
      {!isLoading && loadError && !loadError.isNotFound && (
        <div className="p-6 bg-red-50/90 border border-red-200 rounded-xs text-xs text-red-800 space-y-3">
          <p className="text-sm font-bold">
            No se pudo cargar la consulta #{inquiryId}
          </p>
          <p>{loadError.message}</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={loadInquiry}
              className="px-4 py-2 font-semibold uppercase tracking-wider bg-red-800 text-white rounded-xs cursor-pointer"
            >
              Reintentar
            </button>
            <a
              href="/admin/inquiries"
              className="font-semibold underline underline-offset-4"
            >
              Volver al listado
            </a>
          </div>
        </div>
      )}

      {/* 4. Loaded Inquiry Detail */}
      {!isLoading && !loadError && inquiry && (
        <div className="space-y-8">
          {/* Header Summary Card */}
          <div className="bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/12 p-5 sm:p-7 rounded-xs flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-mono font-bold tracking-tight text-brand-dark">
                  {inquiry.inquiryNumber}
                </h1>
                <InquiryStatusBadge status={inquiry.status} />
                {isClosed && (
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 bg-brand-dark/[0.06] text-brand-dark/65 rounded-xs">
                    Consulta cerrada
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-dark/60">
                Creada el{' '}
                <strong className="font-medium text-brand-dark tabular-nums">
                  {formatArgentinaDateTime(inquiry.createdAt)}
                </strong>{' '}
                • ID interno: <span className="font-mono">#{inquiry.id}</span>
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-dark/45">
                Total estimado de la consulta
              </span>
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark tabular-nums">
                {formatPrice(Number(inquiry.totalAmount) || 0)}
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

          {/* Created / Associated Order Banner when CONVERTED */}
          {(inquiry.status === 'CONVERTED' || createdOrder) && (
            <div className="p-5 sm:p-6 bg-emerald-50/70 border border-emerald-300/80 rounded-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                    Venta Confirmada — Pedido Asociado
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-emerald-950 font-mono">
                    {createdOrder?.orderNumber ||
                      inquiry.orderNumber ||
                      (inquiry.orderId != null
                        ? `Pedido #${inquiry.orderId}`
                        : 'Pedido registrado')}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {createdOrder?.status ? (
                    <span className="px-2.5 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider bg-emerald-800 text-white rounded-xs">
                      Estado: {createdOrder.status}
                    </span>
                  ) : inquiry.orderId != null ? (
                    <span className="px-2.5 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider bg-emerald-800/15 text-emerald-900 rounded-xs">
                      ID Pedido: #{inquiry.orderId}
                    </span>
                  ) : null}
                  {(createdOrder?.id || inquiry.orderId != null) && (
                    <a
                      href={`/admin/orders/detail?id=${createdOrder?.id ?? inquiry.orderId}`}
                      className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] hover:opacity-90 rounded-xs transition-opacity"
                    >
                      Ver pedido →
                    </a>
                  )}
                </div>
              </div>

              {createdOrder && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-emerald-200/80 text-xs text-emerald-900">
                  <div>
                    <span className="block text-[10px] uppercase text-emerald-700">
                      Cliente registrado en pedido
                    </span>
                    <span className="font-semibold">
                      {createdOrder.contactName || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-emerald-700">
                      Teléfono de contacto
                    </span>
                    <span className="font-mono font-semibold">
                      {createdOrder.contactPhone || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-emerald-700">
                      Monto de la orden
                    </span>
                    <span className="font-bold tabular-nums">
                      {formatPrice(Number(createdOrder.totalAmount) || 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (8 cols): Items List */}
            <section
              className="lg:col-span-8 space-y-4"
              aria-label="Artículos solicitados en la consulta"
            >
              <div className="flex items-center justify-between border-b border-brand-dark/[0.08] pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-brand-dark">
                  Prendas Solicitadas ({totalUnits}{' '}
                  {totalUnits === 1 ? 'unidad' : 'unidades'})
                </h2>
                <span className="text-xs text-brand-dark/50">
                  {Array.isArray(inquiry.items) ? inquiry.items.length : 0}{' '}
                  {inquiry.items?.length === 1 ? 'línea' : 'líneas'}
                </span>
              </div>

              <div className="bg-[#FAF9F6]/90 border border-brand-dark/10 rounded-xs divide-y divide-brand-dark/[0.08]">
                {Array.isArray(inquiry.items) && inquiry.items.length > 0 ? (
                  inquiry.items.map((item, idx) => {
                    const imgSrc =
                      item.imageUrl && item.imageUrl.trim()
                        ? item.imageUrl
                        : PLACEHOLDER_IMAGE;

                    return (
                      <article
                        key={item.id ?? `${item.variantId ?? idx}-${item.size ?? idx}`}
                        className="p-4 sm:p-5 flex flex-row items-start gap-4 sm:gap-5"
                      >
                        <div className="w-20 sm:w-24 aspect-[4/5] shrink-0 overflow-hidden bg-[#F2F2F0] rounded-xs border border-brand-dark/[0.06]">
                          <img
                            src={imgSrc}
                            alt={item.productTitle || 'Prenda solicitada'}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = PLACEHOLDER_IMAGE;
                            }}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1.5 min-w-0">
                            <h3 className="text-sm sm:text-base font-semibold text-brand-dark">
                              {item.productTitle || 'Producto'}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-dark/65">
                              <span className="px-2 py-0.5 bg-brand-dark/[0.06] font-semibold text-brand-dark rounded-xs">
                                Talle: {item.size || 'Único'}
                              </span>
                              {item.variantId != null && (
                                <span className="font-mono text-[11px] text-brand-dark/45">
                                  Variante #{item.variantId}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-brand-dark/60 tabular-nums">
                              Precio unitario ref.:{' '}
                              <strong className="font-medium text-brand-dark">
                                {formatPrice(Number(item.unitPrice) || 0)}
                              </strong>
                            </p>
                          </div>

                          <div className="flex sm:flex-col items-baseline sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-brand-dark/[0.06] shrink-0">
                            <span className="text-xs font-semibold text-brand-dark/70 tabular-nums">
                              Cantidad: {item.quantity} u.
                            </span>
                            <div className="text-right">
                              <span className="block text-[10px] uppercase tracking-wider text-brand-dark/40">
                                Subtotal
                              </span>
                              <span className="text-sm sm:text-base font-bold text-brand-dark tabular-nums">
                                {formatPrice(Number(item.subtotal) || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-brand-dark/50">
                    No hay artículos detallados en esta consulta.
                  </div>
                )}

                {/* Total Footer Row */}
                <div className="p-4 sm:p-5 bg-brand-dark/[0.02] flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-dark">
                    Total estimado de la consulta
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-brand-dark tabular-nums">
                    {formatPrice(Number(inquiry.totalAmount) || 0)}
                  </span>
                </div>
              </div>
            </section>

            {/* Right Column (4 cols): Client Info & State Management Actions */}
            <aside className="lg:col-span-4 space-y-6">
              {/* Customer Data Card */}
              <div className="bg-[#FAF9F6]/90 border border-brand-dark/10 p-5 sm:p-6 rounded-xs space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-dark border-b border-brand-dark/[0.08] pb-3">
                  Datos de la Consulta
                </h2>
                <dl className="space-y-3 text-xs">
                  <div>
                    <dt className="text-brand-dark/50 uppercase tracking-wider text-[10px]">
                      Nombre informado por el cliente
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-brand-dark">
                      {inquiry.contactName && inquiry.contactName.trim() ? (
                        inquiry.contactName
                      ) : (
                        <span className="text-brand-dark/45 font-normal italic">
                          No informado en la consulta pública
                        </span>
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-brand-dark/50 uppercase tracking-wider text-[10px]">
                      Estado actual
                    </dt>
                    <dd className="mt-1">
                      <InquiryStatusBadge status={inquiry.status} />
                    </dd>
                  </div>

                  {inquiry.orderNumber && (
                    <div>
                      <dt className="text-brand-dark/50 uppercase tracking-wider text-[10px]">
                        Número de pedido generado
                      </dt>
                      <dd className="mt-0.5 font-mono text-sm font-bold text-emerald-800">
                        {inquiry.orderNumber}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Operations & Status Control Card */}
              <div className="bg-[#FAF9F6]/90 border border-brand-dark/12 p-5 sm:p-6 rounded-xs space-y-5">
                <div className="border-b border-brand-dark/[0.08] pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-dark">
                    Gestión de la Consulta
                  </h2>
                </div>

                {isClosed ? (
                  <div className="p-4 bg-brand-dark/[0.03] border border-brand-dark/10 rounded-xs space-y-2 text-xs text-brand-dark/70">
                    <p className="font-semibold text-brand-dark">
                      {inquiry.status === 'CONVERTED'
                        ? 'Esta consulta ya fue convertida en venta.'
                        : 'Esta consulta fue cerrada como no concretada.'}
                    </p>
                    <p className="leading-relaxed">
                      Las consultas cerradas mantienen su registro histórico y
                      no admiten cambios manuales de estado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Primary Action: Confirm Sale */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={openConfirmModal}
                        disabled={isUpdatingStatus || isConfirmingSale}
                        className="w-full min-h-[46px] px-4 flex items-center justify-center gap-2 bg-brand-dark text-[#FAFAFA] text-xs font-semibold uppercase tracking-wider rounded-xs hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark"
                      >
                        <span>Confirmar venta y crear pedido</span>
                      </button>
                      <p className="text-[11px] text-brand-dark/50 leading-relaxed">
                        Valida disponibilidad actual, descuenta el stock de las
                        variantes y genera una orden en estado PENDING.
                      </p>
                    </div>

                    <div className="border-t border-brand-dark/[0.08] pt-4 space-y-2.5">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-dark/50">
                        Actualizar estado de seguimiento
                      </span>

                      {inquiry.status === 'NEW' && (
                        <button
                          type="button"
                          onClick={handleMarkInProgress}
                          disabled={isUpdatingStatus || isConfirmingSale}
                          className="w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-sky-900 bg-sky-50 border border-sky-200 hover:bg-sky-100/80 rounded-xs transition-colors cursor-pointer"
                        >
                          {isUpdatingStatus
                            ? 'Actualizando...'
                            : 'Marcar En seguimiento (IN_PROGRESS)'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowNotConvertedModal(true)}
                        disabled={isUpdatingStatus || isConfirmingSale}
                        className="w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-red-800 bg-white border border-red-200 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                      >
                        Cerrar como No concretada
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Modal 1: Confirmation Dialog for NOT_CONVERTED */}
      {showNotConvertedModal && inquiry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-not-converted-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 sm:p-7 rounded-xs shadow-lg space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700">
                Confirmación requerida
              </span>
              <h3
                id="modal-not-converted-title"
                className="text-lg font-bold tracking-tight text-brand-dark"
              >
                ¿Cerrar consulta como no concretada?
              </h3>
              <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed">
                Estás por marcar la consulta{' '}
                <strong className="font-mono font-semibold text-brand-dark">
                  {inquiry.inquiryNumber}
                </strong>{' '}
                como <strong>NOT_CONVERTED</strong>. Una vez cerrada, la
                consulta no podrá reabrirse ni convertirse en pedido.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setShowNotConvertedModal(false)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white hover:bg-brand-dark/[0.04] rounded-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleConfirmNotConverted}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-red-700 hover:bg-red-800 rounded-xs cursor-pointer"
              >
                {isUpdatingStatus
                  ? 'Cerrando...'
                  : 'Sí, cerrar como no concretada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Confirm Sale & Create Order Dialog */}
      {showConfirmSaleModal && inquiry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-confirm-sale-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-lg w-full p-6 sm:p-7 rounded-xs shadow-lg space-y-5 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-dark/50">
                  Conversión de Consulta a Venta
                </span>
                <h3
                  id="modal-confirm-sale-title"
                  className="text-lg sm:text-xl font-bold tracking-tight text-brand-dark"
                >
                  Confirmar Venta — {inquiry.inquiryNumber}
                </h3>
              </div>
              <button
                type="button"
                disabled={isConfirmingSale}
                onClick={() => setShowConfirmSaleModal(false)}
                className="text-xs font-semibold text-brand-dark/50 hover:text-brand-dark p-1 cursor-pointer"
                aria-label="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {/* Summary of Articles */}
            <div className="space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/60">
                Resumen de artículos a descontar de inventario ({totalUnits} u.)
              </span>
              <div className="max-h-44 overflow-y-auto border border-brand-dark/10 bg-white/80 rounded-xs divide-y divide-brand-dark/[0.06] text-xs">
                {inquiry.items?.map((item, idx) => (
                  <div
                    key={item.id ?? `${item.variantId ?? idx}-${item.size ?? idx}`}
                    className="py-2.5 px-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-dark truncate">
                        {item.productTitle || 'Producto'}
                      </p>
                      <p className="text-[11px] text-brand-dark/55">
                        Talle {item.size || 'Único'} • Cant.: {item.quantity ?? 0} u.
                      </p>
                    </div>
                    <span className="font-semibold text-brand-dark tabular-nums shrink-0">
                      {formatPrice(Number(item.subtotal) || 0)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1 text-xs sm:text-sm font-bold text-brand-dark">
                <span>Total del pedido a generar</span>
                <span className="tabular-nums">
                  {formatPrice(Number(inquiry.totalAmount) || 0)}
                </span>
              </div>
            </div>

            {/* Error inside Modal (e.g. Insufficient Stock) */}
            {confirmFormError && (
              <div
                className="p-3.5 bg-red-50 border border-red-200 rounded-xs text-xs text-red-800 space-y-1"
                role="alert"
              >
                <p className="font-semibold">
                  No se pudo confirmar la operación
                </p>
                <p>{confirmFormError}</p>
              </div>
            )}

            {/* Contact Form for Order Creation */}
            <form
              onSubmit={handleConfirmSaleSubmit}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-contact-name"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75"
                >
                  Nombre del cliente <span className="text-red-600">*</span>
                </label>
                <input
                  id="confirm-contact-name"
                  type="text"
                  maxLength={150}
                  required
                  disabled={isConfirmingSale}
                  value={confirmContactName}
                  onChange={(e) => {
                    setConfirmContactName(e.target.value);
                    if (confirmFieldErrors.contactName) {
                      setConfirmFieldErrors((prev) => ({
                        ...prev,
                        contactName: undefined,
                      }));
                      setConfirmFormError(null);
                    }
                  }}
                  placeholder="Ej. Juan Pérez"
                  aria-invalid={
                    confirmFieldErrors.contactName ? 'true' : undefined
                  }
                  className={`form-input w-full h-10 px-3 text-base sm:text-sm ${
                    confirmFieldErrors.contactName ? 'form-input-error' : ''
                  }`}
                />
                {confirmFieldErrors.contactName && (
                  <p className="text-xs text-red-600">
                    {confirmFieldErrors.contactName}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-contact-phone"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/75"
                >
                  Teléfono / WhatsApp del cliente{' '}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="confirm-contact-phone"
                  type="tel"
                  maxLength={50}
                  required
                  disabled={isConfirmingSale}
                  value={confirmContactPhone}
                  onChange={(e) => {
                    setConfirmContactPhone(e.target.value);
                    if (confirmFieldErrors.contactPhone) {
                      setConfirmFieldErrors((prev) => ({
                        ...prev,
                        contactPhone: undefined,
                      }));
                      setConfirmFormError(null);
                    }
                  }}
                  placeholder="Ej. 1122334455"
                  aria-invalid={
                    confirmFieldErrors.contactPhone ? 'true' : undefined
                  }
                  className={`form-input w-full h-10 px-3 text-base sm:text-sm ${
                    confirmFieldErrors.contactPhone ? 'form-input-error' : ''
                  }`}
                />
                {confirmFieldErrors.contactPhone && (
                  <p className="text-xs text-red-600">
                    {confirmFieldErrors.contactPhone}
                  </p>
                )}
              </div>

              <p className="text-[11px] text-brand-dark/55 leading-relaxed">
                Al confirmar, el sistema creará la orden en estado{' '}
                <strong>PENDING</strong>, descontará el stock correspondiente y
                marcará la consulta como <strong>CONVERTED</strong>.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isConfirmingSale}
                  onClick={() => setShowConfirmSaleModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white hover:bg-brand-dark/[0.04] rounded-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isConfirmingSale}
                  className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] rounded-xs transition-opacity ${
                    isConfirmingSale
                      ? 'bg-brand-dark/40 cursor-not-allowed'
                      : 'bg-brand-dark hover:opacity-90 cursor-pointer'
                  }`}
                >
                  {isConfirmingSale
                    ? 'Confirmando venta...'
                    : 'Confirmar venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

