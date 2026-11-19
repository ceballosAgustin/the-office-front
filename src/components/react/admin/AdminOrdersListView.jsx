import { useState, useEffect, useCallback, useRef } from 'react';
import { rowLinkProps } from './ui/rowLink';
import AdminShell from './AdminShell';
import OrderStatusBadge from './OrderStatusBadge';
import AdminOrderDetailView from './AdminOrderDetailView';
import Button from './ui/Button';
import PageHeader from './ui/PageHeader';
import Segmented from './ui/Segmented';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import ListSkeleton from './ui/ListSkeleton';
import Pagination from './ui/Pagination';
import Icon from './ui/icons';
import { inputClass } from './ui/Field';
import { formatRelativeTime } from './ui/time';
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

function getClientName(order) {
  return order.contactName && order.contactName.trim()
    ? order.contactName
    : null;
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

  // Request id guard: ignore responses from superseded requests
  const loadReqIdRef = useRef(0);

  const loadOrders = useCallback(
    async (targetStatus, targetPage) => {
      loadReqIdRef.current += 1;
      const reqId = loadReqIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetchAdminOrders({
          status: targetStatus || undefined,
          page: targetPage,
          size: pageSize,
          sort: 'createdAt,desc',
        });
        if (reqId !== loadReqIdRef.current) return;

        setPageData({
          content: Array.isArray(res?.content) ? res.content : [],
          totalPages: Number(res?.totalPages) || 0,
          totalElements: Number(res?.totalElements) || 0,
          number: Number(res?.number) || 0,
        });
      } catch (err) {
        if (reqId !== loadReqIdRef.current) return;
        if (err?.status === 401) {
          window.location.replace('/admin/login?reason=expired');
          return;
        }
        setErrorMessage(
          err?.message || 'No se pudo cargar el listado de pedidos.'
        );
      } finally {
        if (reqId === loadReqIdRef.current) {
          setIsLoading(false);
        }
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
      <div className="space-y-4">
        <PageHeader
          title="Pedidos"
          subtitle={
            isLoading
              ? 'Cargando…'
              : errorMessage
                ? ''
                : `${pageData.totalElements} ${
                  pageData.totalElements === 1 ? 'pedido' : 'pedidos'
                }`
          }
        />

        {/* Filtros + búsqueda por número */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            variant="pills"
            ariaLabel="Filtrar pedidos por estado"
            options={STATUS_FILTERS}
            value={statusFilter}
            onChange={handleFilterChange}
          />

          <form
            onSubmit={handleSearchSubmit}
            role="search"
            className="flex w-full items-center gap-2 lg:w-auto"
          >
            <div className="relative flex-1 lg:w-72 lg:flex-none">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
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
                placeholder="Buscar Nº de pedido"
                aria-label="Buscar por número de pedido"
                className={`${inputClass} pl-10 ${searchInput ? 'pr-11' : 'pr-3.5'}`}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-r-ctl text-ink-muted hover:text-brand-dark lg:h-10"
                  aria-label="Limpiar búsqueda"
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
            <Button
              type="submit"
              loading={isSearchingExact}
              loadingText="Buscando…"
              className="shrink-0"
            >
              Buscar
            </Button>
          </form>
        </div>

        {(exactSearchResult || searchNotFoundMsg) && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-x-3 rounded-card bg-white p-3.5 text-sm text-brand-dark shadow-hairline"
          >
            <span>
              {searchNotFoundMsg ? (
                searchNotFoundMsg
              ) : (
                <>
                  Resultado exacto para el pedido{' '}
                  <strong className="font-semibold">
                    {exactSearchResult.orderNumber}
                  </strong>
                  .
                </>
              )}
            </span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              Volver al listado
            </button>
          </div>
        )}

        {errorMessage && (
          <ErrorState
            title="No pudimos cargar los pedidos"
            message={errorMessage}
            onRetry={() => loadOrders(statusFilter, page)}
          />
        )}

        {isLoading && <ListSkeleton rows={6} />}

        {!isLoading && !errorMessage && displayedOrders.length === 0 && (
          <EmptyState
            icon="bag"
            title="No hay pedidos para mostrar"
            description={
              normalizedQuery
                ? `No hay coincidencias para "${searchInput.trim()}". Probá con el código completo y apretá Buscar.`
                : statusFilter
                  ? 'No hay pedidos con el estado seleccionado en este momento.'
                  : 'Todavía no se generaron pedidos a partir de consultas.'
            }
            action={
              <>
                {normalizedQuery && (
                  <Button variant="secondary" onClick={handleClearSearch}>
                    Limpiar búsqueda
                  </Button>
                )}
                {statusFilter && (
                  <Button
                    variant="secondary"
                    onClick={() => handleFilterChange('')}
                  >
                    Mostrar todos
                  </Button>
                )}
              </>
            }
          />
        )}

        {!isLoading && !errorMessage && displayedOrders.length > 0 && (
          <>
            {/* Tabla (md+): fila clickeable con link real en la primera celda */}
            <div className="hidden overflow-hidden rounded-card bg-white shadow-hairline md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-dark/[0.06] text-[13px] text-ink-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Cliente
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium">
                      Artículos
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Total
                    </th>
                    <th scope="col" className="w-10 px-2 py-3">
                      <span className="sr-only">Abrir</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/[0.06]">
                  {displayedOrders.map((order) => {
                    const name = getClientName(order);
                    return (
                      <tr
                        key={order.id}
                        {...rowLinkProps(`/admin/orders/detail?id=${order.id}`)}
                        className="cursor-pointer transition-colors hover:bg-sunken/70"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={`/admin/orders/detail?id=${order.id}`}
                            className="font-medium text-brand-dark"
                          >
                            {name || (
                              <span className="font-normal italic text-ink-muted">
                                Sin nombre
                              </span>
                            )}
                          </a>
                          <p className="mt-0.5 text-[13px] text-ink-muted">
                            {order.orderNumber} ·{' '}
                            <span title={formatArgentinaDateTime(order.createdAt)}>
                              {formatRelativeTime(order.createdAt)}
                            </span>
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-brand-dark">
                          {getTotalUnits(order)}
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-brand-dark">
                          {formatPrice(Number(order.totalAmount) || 0)}
                        </td>
                        <td className="px-2 py-3 text-ink-muted">
                          <Icon name="chevronRight" size={18} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards (< md) */}
            <ul className="space-y-2.5 md:hidden">
              {displayedOrders.map((order) => {
                const totalUnits = getTotalUnits(order);
                const name = getClientName(order);
                return (
                  <li
                    key={order.id}
                    className="relative rounded-card bg-white p-3.5 shadow-hairline transition-shadow active:shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={`/admin/orders/detail?id=${order.id}`}
                        className="min-w-0 truncate text-[15px] font-semibold text-brand-dark after:absolute after:inset-0 after:rounded-card"
                      >
                        {name || 'Sin nombre'}
                      </a>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px] text-ink-muted">
                      <span className="min-w-0 truncate tabular-nums">
                        {order.orderNumber} · {totalUnits}{' '}
                        {totalUnits === 1 ? 'unidad' : 'unidades'} ·{' '}
                        {formatPrice(Number(order.totalAmount) || 0)}
                      </span>
                      <span
                        className="shrink-0"
                        title={formatArgentinaDateTime(order.createdAt)}
                      >
                        {formatRelativeTime(order.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {!exactSearchResult && (
              <Pagination
                number={pageData.number}
                size={pageSize}
                shown={pageData.content.length}
                totalPages={pageData.totalPages}
                totalElements={pageData.totalElements}
                onPrev={() => setPage((p) => Math.max(0, p - 1))}
                onNext={() =>
                  setPage((p) => (p + 1 < pageData.totalPages ? p + 1 : p))
                }
              />
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
