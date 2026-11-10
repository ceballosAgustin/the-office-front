import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import OrderStatusBadge from './OrderStatusBadge';
import AdminOrderDetailView from './AdminOrderDetailView';
import {
  fetchAdminOrders,
  fetchAdminOrderByNumber,
  formatPrice,
} from '../../../services/api';
import { formatArgentinaDateTime } from '../../../utils/date';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'COMPLETED', label: 'Completados' },
  { value: 'CANCELLED', label: 'Cancelados' },
];

const VALID_STATUSES = new Set(['PENDING', 'COMPLETED', 'CANCELLED']);

function getTotalUnits(order) {
  if (!Array.isArray(order?.items)) return 0;
  return order.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
}

export default function AdminOrdersListView() {
  const [detailOrderId, setDetailOrderId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [exactSearchResult, setExactSearchResult] = useState(null);
  const [isSearchingExact, setIsSearchingExact] = useState(false);
  const [searchNotFoundMsg, setSearchNotFoundMsg] = useState(null);

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
      const qId = params.get('id')?.trim() || null;
      if (qId) {
        setDetailOrderId(qId);
      }
      const qStatus = params.get('status')?.toUpperCase() || '';
      if (VALID_STATUSES.has(qStatus)) {
        setStatusFilter(qStatus);
      }
    }
    setInitializedFilter(true);
  }, []);

  const loadOrders = useCallback(
    async (targetStatus, targetPage) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetchAdminOrders({
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
          err?.message || 'No se pudo cargar el listado de pedidos.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    if (!initializedFilter || detailOrderId) return;
    loadOrders(statusFilter, page);
  }, [initializedFilter, detailOrderId, statusFilter, page, loadOrders]);

  if (detailOrderId) {
    return <AdminOrderDetailView orderId={detailOrderId} />;
  }

  const handleFilterChange = (nextStatus) => {
    setStatusFilter(nextStatus);
    setPage(0);
    setExactSearchResult(null);
    setSearchNotFoundMsg(null);
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

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const query = searchInput.trim().toUpperCase();
    setSearchNotFoundMsg(null);

    if (!query) {
      setExactSearchResult(null);
      return;
    }

    // Check if already present in current page
    const inCurrentPage = pageData.content.find(
      (o) => o.orderNumber?.toUpperCase() === query
    );
    if (inCurrentPage) {
      setExactSearchResult(null);
      return;
    }

    // Query backend GET /api/orders/{orderNumber} for exact lookup across all pages
    setIsSearchingExact(true);
    try {
      const found = await fetchAdminOrderByNumber(query);
      if (found && found.id) {
        setExactSearchResult(found);
      } else {
        setExactSearchResult(null);
        setSearchNotFoundMsg(
          `No se encontró ningún pedido con el número exacto "${query}".`
        );
      }
    } catch (err) {
      if (err?.status === 404) {
        setExactSearchResult(null);
        setSearchNotFoundMsg(
          `No se encontró ningún pedido con el número "${query}".`
        );
      } else {
        setErrorMessage(
          err?.message || 'Error al buscar el pedido por número.'
        );
      }
    } finally {
      setIsSearchingExact(false);
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setExactSearchResult(null);
    setSearchNotFoundMsg(null);
  };

  const normalizedQuery = searchInput.trim().toUpperCase();
  const baseOrders = exactSearchResult ? [exactSearchResult] : pageData.content;
  const displayedOrders = normalizedQuery
    ? baseOrders.filter((o) =>
        (o.orderNumber || '').toUpperCase().includes(normalizedQuery)
      )
    : baseOrders;

  return (
    <AdminShell activeSection="orders">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
              Gestión Comercial
            </span>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark">
                Pedidos (Orders)
              </h1>
              <span className="text-xs font-mono text-brand-dark/45">
                [{isLoading ? '--' : pageData.totalElements}]
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setExactSearchResult(null);
              setSearchNotFoundMsg(null);
              loadOrders(statusFilter, page);
            }}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark bg-white/85 border border-brand-dark/15 hover:border-brand-dark rounded-xs transition-colors cursor-pointer"
          >
            Actualizar listado
          </button>
        </div>

        {/* Filters & Order Number Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Filtrar pedidos por estado"
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

          {/* Order Number Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 w-full lg:w-auto"
          >
            <div className="relative flex-1 lg:w-64">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value.trim()) {
                    setExactSearchResult(null);
                    setSearchNotFoundMsg(null);
                  }
                }}
                placeholder="Buscar Nº pedido (ej. ORD-...)"
                aria-label="Buscar por número de pedido"
                className="form-input w-full h-9 pl-3 pr-8 text-base sm:text-xs font-mono placeholder:font-sans"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-brand-dark/45 hover:text-brand-dark cursor-pointer"
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearchingExact}
              className="h-9 px-3.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] hover:opacity-90 rounded-xs transition-opacity cursor-pointer shrink-0"
            >
              {isSearchingExact ? 'Buscando...' : 'Buscar'}
            </button>
          </form>
        </div>

        {/* Exact Search Notice */}
        {(exactSearchResult || searchNotFoundMsg) && (
          <div className="p-3 bg-[#FAF9F6] border border-brand-dark/15 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs text-brand-dark">
            <span>
              {searchNotFoundMsg ? (
                searchNotFoundMsg
              ) : (
                <>
                  Mostrando resultado exacto para el pedido{' '}
                  <strong className="font-mono">
                    {exactSearchResult.orderNumber}
                  </strong>
                  .
                </>
              )}
            </span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="font-semibold underline underline-offset-4 hover:opacity-75 cursor-pointer"
            >
              Volver al listado paginado
            </button>
          </div>
        )}

        {/* Error State */}
        {errorMessage && (
          <div
            className="p-4 bg-red-50/90 border border-red-200 rounded-xs text-xs text-red-800 flex flex-wrap items-center justify-between gap-3"
            role="alert"
          >
            <div>
              <p className="font-semibold">Error al obtener los pedidos</p>
              <p>{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => loadOrders(statusFilter, page)}
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
        {!isLoading && !errorMessage && displayedOrders.length === 0 && (
          <div className="py-16 px-6 text-center bg-[#FAF9F6]/85 border border-brand-dark/10 rounded-xs space-y-3">
            <p className="text-sm sm:text-base font-semibold text-brand-dark">
              No se encontraron pedidos registrados
            </p>
            <p className="text-xs text-brand-dark/60 max-w-md mx-auto">
              {normalizedQuery
                ? `No hay coincidencias para "${searchInput.trim()}". Probá ingresando el código completo (ej. ORD-...) y presionando Buscar.`
                : statusFilter
                  ? 'No hay pedidos registrados con el estado seleccionado en este momento.'
                  : 'Todavía no se han generado pedidos a partir de consultas comerciales.'}
            </p>
            {(statusFilter || normalizedQuery) && (
              <div className="pt-1 flex items-center justify-center gap-4">
                {normalizedQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-xs font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 cursor-pointer"
                  >
                    Limpiar búsqueda
                  </button>
                )}
                {statusFilter && (
                  <button
                    type="button"
                    onClick={() => handleFilterChange('')}
                    className="text-xs font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 cursor-pointer"
                  >
                    Mostrar todos los estados
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Orders Table (Desktop) & Cards (Mobile) */}
        {!isLoading && !errorMessage && displayedOrders.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/10 rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-dark/10 bg-brand-dark/[0.03] text-[11px] font-semibold uppercase tracking-wider text-brand-dark/55">
                      <th className="py-3.5 px-4">Nº Pedido</th>
                      <th className="py-3.5 px-4">Fecha de creación</th>
                      <th className="py-3.5 px-4">Cliente / Contacto</th>
                      <th className="py-3.5 px-4 text-center">Artículos</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4 text-right">Importe total</th>
                      <th className="py-3.5 px-4 text-right">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/[0.06] text-xs sm:text-sm">
                    {displayedOrders.map((order) => {
                      const totalUnits = getTotalUnits(order);
                      const lineCount = Array.isArray(order.items)
                        ? order.items.length
                        : 0;
                      const isPending = order.status === 'PENDING';

                      return (
                        <tr
                          key={order.id}
                          className={`transition-colors hover:bg-brand-dark/[0.03] ${
                            isPending ? 'bg-amber-50/25' : ''
                          }`}
                        >
                          <td className="py-4 px-4 font-mono font-semibold text-brand-dark whitespace-nowrap">
                            <a
                              href={`/admin/orders/detail?id=${order.id}`}
                              className="hover:underline underline-offset-2"
                            >
                              {order.orderNumber}
                            </a>
                            <span className="block text-[10px] font-mono text-brand-dark/45 mt-0.5">
                              ID #{order.id}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-xs text-brand-dark/65 whitespace-nowrap tabular-nums">
                            {formatArgentinaDateTime(order.createdAt)}
                          </td>
                          <td className="py-4 px-4 text-brand-dark">
                            {order.contactName && order.contactName.trim() ? (
                              <div>
                                <span className="font-medium block">
                                  {order.contactName}
                                </span>
                                {order.contactPhone &&
                                  order.contactPhone.trim() && (
                                    <span className="text-[11px] font-mono text-brand-dark/55">
                                      {order.contactPhone}
                                    </span>
                                  )}
                              </div>
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
                              {lineCount === 1 ? 'línea' : 'líneas'})
                            </span>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <OrderStatusBadge status={order.status} />
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-brand-dark tabular-nums whitespace-nowrap">
                            {formatPrice(Number(order.totalAmount) || 0)}
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <a
                              href={`/admin/orders/detail?id=${order.id}`}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs transition-colors ${
                                isPending
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
              {displayedOrders.map((order) => {
                const totalUnits = getTotalUnits(order);
                return (
                  <a
                    key={order.id}
                    href={`/admin/orders/detail?id=${order.id}`}
                    className="block bg-[#FAF9F6]/90 border border-brand-dark/12 p-4 rounded-xs space-y-3 hover:border-brand-dark/35 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-bold text-brand-dark">
                          {order.orderNumber}
                        </span>
                        <span className="block text-[11px] text-brand-dark/55 tabular-nums">
                          {formatArgentinaDateTime(order.createdAt)}
                        </span>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>

                    <div className="flex items-center justify-between text-xs border-t border-brand-dark/[0.06] pt-2.5">
                      <div className="text-brand-dark/75">
                        <span className="font-medium text-brand-dark">
                          {order.contactName && order.contactName.trim()
                            ? order.contactName
                            : 'Cliente sin nombre'}
                        </span>
                        <span className="mx-1.5 text-brand-dark/30">•</span>
                        <span>
                          {totalUnits}{' '}
                          {totalUnits === 1 ? 'unidad' : 'unidades'}
                        </span>
                      </div>
                      <span className="font-bold text-brand-dark tabular-nums">
                        {formatPrice(Number(order.totalAmount) || 0)}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {!exactSearchResult && pageData.totalPages > 1 && (
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
                  ({pageData.totalElements} pedidos en total)
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

