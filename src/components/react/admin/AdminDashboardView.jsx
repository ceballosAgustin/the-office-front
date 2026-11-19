import { useState, useEffect } from 'react';
import AdminShell from './AdminShell';
import InquiryStatusBadge from './InquiryStatusBadge';
import Button from './ui/Button';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import ListSkeleton from './ui/ListSkeleton';
import Icon from './ui/icons';
import { formatRelativeTime } from './ui/time';
import {
  fetchAdminInquirySummaryCounts,
  fetchAdminInquiries,
  formatPrice,
} from '../../../services/api';
import { formatArgentinaDateTime } from '../../../utils/date';

function getTotalItemsCount(inquiry) {
  if (!Array.isArray(inquiry?.items)) return 0;
  return inquiry.items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0),
    0
  );
}

function getClientName(inquiry) {
  return inquiry.contactName && inquiry.contactName.trim()
    ? inquiry.contactName
    : null;
}

export default function AdminDashboardView() {
  const [counts, setCounts] = useState(null);
  const [recentInquiries, setRecentInquiries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadDashboard = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [summaryCounts, recentPage] = await Promise.all([
        fetchAdminInquirySummaryCounts(),
        fetchAdminInquiries({ page: 0, size: 6, sort: 'createdAt,desc' }),
      ]);

      setCounts(summaryCounts);
      setRecentInquiries(
        Array.isArray(recentPage?.content) ? recentPage.content : []
      );
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      setErrorMessage(
        err?.message || 'No se pudieron obtener los indicadores del panel.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const kpiCards = [
    { status: 'NEW', title: 'Nuevas', value: counts?.NEW ?? 0, dot: null },
    {
      status: 'IN_PROGRESS',
      title: 'En seguimiento',
      value: counts?.IN_PROGRESS ?? 0,
      dot: 'bg-sky-600',
    },
    {
      status: 'CONVERTED',
      title: 'Convertidas',
      value: counts?.CONVERTED ?? 0,
      dot: 'bg-emerald-600',
    },
    {
      status: 'NOT_CONVERTED',
      title: 'No concretadas',
      value: counts?.NOT_CONVERTED ?? 0,
      dot: 'bg-brand-dark/35',
    },
  ];

  return (
    <AdminShell activeSection="dashboard">
      <div className="space-y-6">
        <PageHeader
          title="Inicio"
          subtitle="Lo que necesita tu atención hoy."
          actions={
            <Button href="/admin/products/new" size="sm" className="lg:min-h-10">
              <span className="whitespace-nowrap">
                + Nuevo<span className="hidden sm:inline"> producto</span>
              </span>
            </Button>
          }
        />

        {errorMessage && (
          <ErrorState
            title="No pudimos cargar el resumen"
            message={errorMessage}
            onRetry={loadDashboard}
          />
        )}

        {/* KPIs: 2x2 en celu, 4x1 en lg */}
        <section aria-label="Consultas por estado">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpiCards.map((card) => (
              <a
                key={card.status}
                href={`/admin/inquiries?status=${card.status}`}
                className="group block rounded-card bg-white p-4 shadow-hairline transition-shadow hover:shadow-card"
              >
                <div className="flex min-h-6 items-center justify-between gap-2">
                  <span className="text-[13px] text-ink-muted">{card.title}</span>
                  {card.status === 'NEW' ? (
                    !isLoading &&
                    card.value > 0 && (
                      <span className="rounded-full bg-brand-sand px-2 py-0.5 text-xs font-semibold text-brand-dark">
                        Atender
                      </span>
                    )
                  ) : (
                    <span
                      className={`size-2 shrink-0 rounded-full ${card.dot}`}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <p className="mt-2 text-[1.75rem] font-semibold leading-none tabular-nums text-brand-dark">
                  {isLoading ? '—' : card.value}
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* Consultas recientes */}
        <section aria-labelledby="recent-inquiries-title">
          <div className="flex items-center justify-between">
            <h2
              id="recent-inquiries-title"
              className="text-base font-semibold text-brand-dark"
            >
              Consultas recientes
            </h2>
            <a
              href="/admin/inquiries"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark underline-offset-4 hover:underline"
            >
              Ver todas
            </a>
          </div>

          {isLoading ? (
            <ListSkeleton rows={4} className="mt-1" />
          ) : recentInquiries.length === 0 ? (
            <EmptyState
              className="mt-1"
              icon="chat"
              title="Todavía no hay consultas"
              description="Las consultas que los clientes envían desde el carrito aparecen acá automáticamente."
            />
          ) : (
            <>
              {/* Tabla (md+): toda la fila es clickeable vía link real en la primera celda */}
              <div className="mt-1 hidden overflow-hidden rounded-card bg-white shadow-hairline md:block">
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
                    {recentInquiries.map((inq) => {
                      const itemsCount = getTotalItemsCount(inq);
                      const name = getClientName(inq);
                      return (
                        <tr
                          key={inq.id}
                          className="relative transition-colors hover:bg-sunken/70"
                        >
                          <td className="px-4 py-3">
                            <a
                              href={`/admin/inquiries/${inq.id}`}
                              className="font-medium text-brand-dark after:absolute after:inset-0"
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
                            </p>
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-brand-dark">
                            {itemsCount}
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
              <ul className="mt-1 space-y-2.5 md:hidden">
                {recentInquiries.map((inq) => {
                  const itemsCount = getTotalItemsCount(inq);
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
                          {itemsCount} {itemsCount === 1 ? 'artículo' : 'artículos'} ·{' '}
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
            </>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
