import { useState, useEffect, useCallback, useRef } from 'react';
import { rowLinkProps } from './ui/rowLink';
import AdminShell from './AdminShell';
import InquiryStatusBadge from './InquiryStatusBadge';
import Button from './ui/Button';
import PageHeader from './ui/PageHeader';
import Segmented from './ui/Segmented';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import ListSkeleton from './ui/ListSkeleton';
import Pagination from './ui/Pagination';
import Icon from './ui/icons';
import { formatRelativeTime } from './ui/time';
import {
  fetchAdminInquiries,
  formatPrice,
} from '../../../services/api';
import { formatArgentinaDateTime } from '../../../utils/date';

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

function getClientName(inquiry) {
  return inquiry.contactName && inquiry.contactName.trim()
    ? inquiry.contactName
    : null;
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

  // Request id guard: ignore responses from superseded requests
  const loadReqIdRef = useRef(0);

  const loadInquiries = useCallback(
    async (targetStatus, targetPage) => {
      loadReqIdRef.current += 1;
      const reqId = loadReqIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetchAdminInquiries({
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
          err?.message || 'No se pudo cargar el listado de consultas.'
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
      <div className="space-y-4">
        <PageHeader
          title="Consultas"
          subtitle={
            isLoading
              ? 'Cargando…'
              : errorMessage
                ? ''
                : `${pageData.totalElements} ${
                  pageData.totalElements === 1 ? 'consulta' : 'consultas'
                }`
          }
        />

        <Segmented
          variant="pills"
          ariaLabel="Filtrar consultas por estado"
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={handleFilterChange}
        />

        {errorMessage && (
          <ErrorState
            title="No pudimos cargar las consultas"
            message={errorMessage}
            onRetry={() => loadInquiries(statusFilter, page)}
          />
        )}

        {isLoading && <ListSkeleton rows={6} />}

        {!isLoading && !errorMessage && inquiries.length === 0 && (
          <EmptyState
            icon="chat"
            title="No hay consultas para mostrar"
            description={
              statusFilter
                ? 'No hay consultas con el estado seleccionado en este momento.'
                : 'Todavía no llegaron consultas desde el carrito de la tienda.'
            }
            action={
              statusFilter && (
                <Button variant="secondary" onClick={() => handleFilterChange('')}>
                  Mostrar todas
                </Button>
              )
            }
          />
        )}

        {!isLoading && !errorMessage && inquiries.length > 0 && (
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
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Total ref.
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Estado
                    </th>
                    <th scope="col" className="w-10 px-2 py-3">
                      <span className="sr-only">Abrir</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/[0.06]">
                  {inquiries.map((inq) => {
                    const name = getClientName(inq);
                    return (
                      <tr
                        key={inq.id}
                        {...rowLinkProps(`/admin/inquiries/${inq.id}`)}
                        className="cursor-pointer transition-colors hover:bg-sunken/70"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={`/admin/inquiries/${inq.id}`}
                            className="font-medium text-brand-dark"
                          >
                            {name || (
                              <span className="font-normal italic text-ink-muted">
                                Sin nombre
                              </span>
                            )}
                          </a>
                          <p className="mt-0.5 text-[13px] text-ink-muted">
                            {inq.inquiryNumber} ·{' '}
                            <span title={formatArgentinaDateTime(inq.createdAt)}>
                              {formatRelativeTime(inq.createdAt)}
                            </span>
                            {inq.orderNumber && (
                              <>
                                {' '}
                                ·{' '}
                                {inq.orderId ? (
                                  <a
                                    href={`/admin/orders/detail?id=${inq.orderId}`}
                                    className="relative z-10 font-medium text-brand-dark underline underline-offset-2"
                                  >
                                    Pedido {inq.orderNumber}
                                  </a>
                                ) : (
                                  <>Pedido {inq.orderNumber}</>
                                )}
                              </>
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-brand-dark">
                          {getTotalUnits(inq)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-brand-dark">
                          {formatPrice(Number(inq.totalAmount) || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <InquiryStatusBadge status={inq.status} />
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
              {inquiries.map((inq) => {
                const totalUnits = getTotalUnits(inq);
                const name = getClientName(inq);
                return (
                  <li
                    key={inq.id}
                    className="relative rounded-card bg-white p-3.5 shadow-hairline transition-shadow active:shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={`/admin/inquiries/${inq.id}`}
                        className="min-w-0 truncate text-[15px] font-semibold text-brand-dark after:absolute after:inset-0 after:rounded-card"
                      >
                        {name || 'Sin nombre'}
                      </a>
                      <InquiryStatusBadge status={inq.status} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px] text-ink-muted">
                      <span className="tabular-nums">
                        {inq.inquiryNumber} · {totalUnits}{' '}
                        {totalUnits === 1 ? 'artículo' : 'artículos'} ·{' '}
                        {formatPrice(Number(inq.totalAmount) || 0)}
                      </span>
                      <span
                        className="shrink-0"
                        title={formatArgentinaDateTime(inq.createdAt)}
                      >
                        {formatRelativeTime(inq.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pagination
              number={pageData.number}
              size={pageSize}
              shown={inquiries.length}
              totalPages={pageData.totalPages}
              totalElements={pageData.totalElements}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() =>
                setPage((p) => (p + 1 < pageData.totalPages ? p + 1 : p))
              }
            />
          </>
        )}
      </div>
    </AdminShell>
  );
}
