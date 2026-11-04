import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import InquiryStatusBadge from './InquiryStatusBadge';
import {
  fetchAdminInquiries,
  formatPrice,
  formatDateTime,
} from '../../../services/api';

const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'NEW', label: 'Nuevas' },
  { value: 'IN_PROGRESS', label: 'En seguimiento' },
  { value: 'CONVERTED', label: 'Convertidas' },
  { value: 'NOT_CONVERTED', label: 'No concretadas' },
];

const VALID_STATUSES = new Set([
  'NEW',
  'IN_PROGRESS',
  'CONVERTED',
  'NOT_CONVERTED',
]);

function getTotalUnits(inquiry) {
  if (!Array.isArray(inquiry?.items)) return 0;
  return inquiry.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
}

export default function AdminInquiriesListView() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(12);
  const [pageData, setPageData] = useState({
    content: [],
    totalPages: 0,
    totalElements: 0,
    number: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [initializedFilter, setInitializedFilter] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qStatus = params.get('status')?.toUpperCase() || '';
      if (VALID_STATUSES.has(qStatus)) {
        setStatusFilter(qStatus);
      }
    }
    setInitializedFilter(true);
  }, []);

  const loadInquiries = useCallback(
    async (targetStatus, targetPage) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetchAdminInquiries({
          status: targetStatus || undefined,
          page: targetPage,
          size: pageSize,
          sort: 'createdAt,desc',
        });

        setPageData({
          content: Array.isArray(res?.content) ? res.content : [],
          totalPages: Number(res?.totalPages) || 0,
          totalElements: Number(res?.totalElements) || 0,
          number: Number(res?.number) || 0,
        });
      } catch (err) {
        if (err?.status === 401) {
          window.location.replace('/admin/login?reason=expired');
          return;
        }
        if (err?.status === 403) {
          window.location.replace('/admin/login?reason=forbidden');
          return;
        }
        setErrorMessage(
          err?.message || 'No se pudo cargar el listado de consultas.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    if (!initializedFilter) return;
    loadInquiries(statusFilter, page);
  }, [initializedFilter, statusFilter, page, loadInquiries]);

  const handleFilterChange = (nextStatus) => {
    setStatusFilter(nextStatus);
    setPage(0);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (nextStatus) {
        url.searchParams.set('status', nextStatus);
      } else {
        url.searchParams.delete('status');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const inquiries = pageData.content;

  return (
    <AdminShell activeSection="inquiries">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
              Gestión Comercial
            </span>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark">
                Consultas de Clientes
              </h1>
              <span className="text-xs font-mono text-brand-dark/45">
                [{isLoading ? '--' : pageData.totalElements}]
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadInquiries(statusFilter, page)}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark bg-white/85 border border-brand-dark/15 hover:border-brand-dark rounded-xs transition-colors cursor-pointer"
          >
            Actualizar listado
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Filtrar consultas por estado"
        >
          {STATUS_FILTERS.map((tab) => {
            const isSelected = statusFilter === tab.value;
            return (
              <button
                key={tab.value || 'ALL'}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleFilterChange(tab.value)}
                className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-brand-dark text-[#FAFAFA] border-brand-dark'
                    : 'bg-[#FAF9F6]/90 text-brand-dark/70 border-brand-dark/15 hover:border-brand-dark hover:text-brand-dark'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Error State */}
        {errorMessage && (
          <div
            className="p-4 bg-red-50/90 border border-red-200 rounded-xs text-xs text-red-800 flex flex-wrap items-center justify-between gap-3"
            role="alert"
          >
            <div>
              <p className="font-semibold">Error al obtener las consultas</p>
              <p>{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => loadInquiries(statusFilter, page)}
              className="px-3 py-1.5 font-semibold uppercase tracking-wider bg-red-800 text-white rounded-xs cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-2.5 animate-pulse">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-14 w-full bg-[#F2F2F0] rounded-xs"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !errorMessage && inquiries.length === 0 && (
          <div className="py-16 px-6 text-center bg-[#FAF9F6]/85 border border-brand-dark/10 rounded-xs space-y-3">
            <p className="text-sm sm:text-base font-semibold text-brand-dark">
              No se encontraron consultas comerciales
            </p>
            <p className="text-xs text-brand-dark/60 max-w-md mx-auto">
              {statusFilter
                ? 'No hay consultas registradas con el estado seleccionado en este momento.'
                : 'Aún no se han registrado consultas desde el carrito de la tienda.'}
            </p>
            {statusFilter && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleFilterChange('')}
                  className="text-xs font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 cursor-pointer"
                >
                  Mostrar todas las consultas
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inquiries Table (Desktop) & Cards (Mobile) */}
        {!isLoading && !errorMessage && inquiries.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/10 rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-dark/10 bg-brand-dark/[0.03] text-[11px] font-semibold uppercase tracking-wider text-brand-dark/55">
                      <th className="py-3.5 px-4">Nº Consulta</th>
                      <th className="py-3.5 px-4">Fecha de creación</th>
                      <th className="py-3.5 px-4">Cliente</th>
                      <th className="py-3.5 px-4 text-center">Artículos</th>
                      <th className="py-3.5 px-4 text-right">
                        Total referencia
                      </th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4 text-right">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/[0.06] text-xs sm:text-sm">
                    {inquiries.map((inq) => {
                      const totalUnits = getTotalUnits(inq);
                      const lineCount = Array.isArray(inq.items)
                        ? inq.items.length
                        : 0;
                      const isNeedsAttention =
                        inq.status === 'NEW' || inq.status === 'IN_PROGRESS';

                      return (
                        <tr
                          key={inq.id}
                          className={`transition-colors hover:bg-brand-dark/[0.03] ${
                            inq.status === 'NEW' ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-4 px-4 font-mono font-semibold text-brand-dark whitespace-nowrap">
                            <a
                              href={`/admin/inquiries/${inq.id}`}
                              className="hover:underline underline-offset-2"
                            >
                              {inq.inquiryNumber}
                            </a>
                            {inq.orderNumber && (
                              <span className="block text-[10px] font-mono text-emerald-800 mt-0.5">
                                Pedido: {inq.orderNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-xs text-brand-dark/65 whitespace-nowrap tabular-nums">
                            {formatDateTime(inq.createdAt)}
                          </td>
                          <td className="py-4 px-4 text-brand-dark">
                            {inq.contactName && inq.contactName.trim() ? (
                              <span className="font-medium">
                                {inq.contactName}
                              </span>
                            ) : (
                              <span className="text-brand-dark/40 italic text-xs">
                                Sin especificar
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center tabular-nums text-brand-dark/80 whitespace-nowrap">
                            <span className="font-semibold">{totalUnits}</span>{' '}
                            <span className="text-xs text-brand-dark/50">
                              ({lineCount}{' '}
                              {lineCount === 1 ? 'prenda' : 'prendas'})
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-brand-dark tabular-nums whitespace-nowrap">
                            {formatPrice(Number(inq.totalAmount) || 0)}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <InquiryStatusBadge status={inq.status} />
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <a
                              href={`/admin/inquiries/${inq.id}`}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs transition-colors ${
                                isNeedsAttention
                                  ? 'bg-brand-dark text-[#FAFAFA] hover:opacity-90'
                                  : 'border border-brand-dark/20 text-brand-dark hover:bg-brand-dark hover:text-[#FAFAFA]'
                              }`}
                            >
                              <span>Ver detalle</span>
                              <span aria-hidden="true">→</span>
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Scannable Cards */}
            <div className="md:hidden space-y-3">
              {inquiries.map((inq) => {
                const totalUnits = getTotalUnits(inq);
                return (
                  <a
                    key={inq.id}
                    href={`/admin/inquiries/${inq.id}`}
                    className="block bg-[#FAF9F6]/90 border border-brand-dark/12 p-4 rounded-xs space-y-3 hover:border-brand-dark/35 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-bold text-brand-dark">
                          {inq.inquiryNumber}
                        </span>
                        <span className="block text-[11px] text-brand-dark/55 tabular-nums">
                          {formatDateTime(inq.createdAt)}
                        </span>
                      </div>
                      <InquiryStatusBadge status={inq.status} />
                    </div>

                    <div className="flex items-center justify-between text-xs border-t border-brand-dark/[0.06] pt-2.5">
                      <div className="text-brand-dark/75">
                        <span className="font-medium text-brand-dark">
                          {inq.contactName && inq.contactName.trim()
                            ? inq.contactName
                            : 'Cliente sin nombre'}
                        </span>
                        <span className="mx-1.5 text-brand-dark/30">•</span>
                        <span>
                          {totalUnits}{' '}
                          {totalUnits === 1 ? 'artículo' : 'artículos'}
                        </span>
                      </div>
                      <span className="font-bold text-brand-dark tabular-nums">
                        {formatPrice(Number(inq.totalAmount) || 0)}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pageData.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-brand-dark/[0.08] text-xs">
                <span className="text-brand-dark/60">
                  Página{' '}
                  <strong className="font-semibold text-brand-dark">
                    {pageData.number + 1}
                  </strong>{' '}
                  de{' '}
                  <strong className="font-semibold text-brand-dark">
                    {pageData.totalPages}
                  </strong>{' '}
                  ({pageData.totalElements} consultas en total)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pageData.number <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className={`px-3.5 py-1.5 font-semibold uppercase tracking-wider border rounded-xs transition-colors ${
                      pageData.number <= 0
                        ? 'border-brand-dark/10 text-brand-dark/30 cursor-not-allowed'
                        : 'border-brand-dark/20 text-brand-dark bg-white hover:border-brand-dark cursor-pointer'
                    }`}
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    disabled={pageData.number + 1 >= pageData.totalPages}
                    onClick={() =>
                      setPage((p) =>
                        p + 1 < pageData.totalPages ? p + 1 : p
                      )
                    }
                    className={`px-3.5 py-1.5 font-semibold uppercase tracking-wider border rounded-xs transition-colors ${
                      pageData.number + 1 >= pageData.totalPages
                        ? 'border-brand-dark/10 text-brand-dark/30 cursor-not-allowed'
                        : 'border-brand-dark/20 text-brand-dark bg-white hover:border-brand-dark cursor-pointer'
                    }`}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

