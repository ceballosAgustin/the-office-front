import { useState, useEffect } from 'react';
import AdminShell from './AdminShell';
import InquiryStatusBadge from './InquiryStatusBadge';
import {
  fetchAdminInquirySummaryCounts,
  fetchAdminInquiries,
  formatPrice,
  formatDateTime,
} from '../../../services/api';

function getTotalItemsCount(inquiry) {
  if (!Array.isArray(inquiry?.items)) return 0;
  return inquiry.items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0),
    0
  );
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
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
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
    {
      status: 'NEW',
      title: 'Consultas nuevas',
      description: 'Pendientes de primer contacto',
      value: counts?.NEW ?? 0,
      accentClass: 'border-l-4 border-l-amber-600',
    },
    {
      status: 'IN_PROGRESS',
      title: 'En seguimiento',
      description: 'Conversación activa por WhatsApp',
      value: counts?.IN_PROGRESS ?? 0,
      accentClass: 'border-l-4 border-l-sky-600',
    },
    {
      status: 'CONVERTED',
      title: 'Consultas convertidas',
      description: 'Confirmadas y transformadas en pedido',
      value: counts?.CONVERTED ?? 0,
      accentClass: 'border-l-4 border-l-emerald-600',
    },
    {
      status: 'NOT_CONVERTED',
      title: 'No concretadas',
      description: 'Cerradas sin conversión',
      value: counts?.NOT_CONVERTED ?? 0,
      accentClass: 'border-l-4 border-l-brand-dark/30',
    },
  ];

  return (
    <AdminShell activeSection="dashboard">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
              Resumen Operativo
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark">
              Dashboard de Consultas
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={loadDashboard}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark bg-white/85 border border-brand-dark/15 hover:border-brand-dark rounded-xs transition-colors cursor-pointer"
            >
              Actualizar
            </button>
            <a
              href="/admin/products"
              className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark bg-white/85 border border-brand-dark/20 hover:border-brand-dark rounded-xs transition-colors"
            >
              Gestionar productos
            </a>
            <a
              href="/admin/inquiries"
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark hover:opacity-90 rounded-xs transition-opacity"
            >
              Ver todas las consultas →
            </a>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div
            className="p-4 bg-red-50/90 border border-red-200 rounded-xs text-xs text-red-800 flex flex-wrap items-center justify-between gap-3"
            role="alert"
          >
            <div>
              <p className="font-semibold">Error al cargar el dashboard</p>
              <p>{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={loadDashboard}
              className="px-3 py-1.5 font-semibold uppercase tracking-wider bg-red-800 text-white rounded-xs cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* KPI Cards Grid */}
        <section aria-label="Indicadores por estado">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((card) => (
              <a
                key={card.status}
                href={`/admin/inquiries?status=${card.status}`}
                className={`block bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/10 p-5 rounded-xs hover:border-brand-dark/35 transition-colors ${card.accentClass}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-dark/70">
                    {card.title}
                  </span>
                  <InquiryStatusBadge status={card.status} />
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight text-brand-dark tabular-nums">
                    {isLoading ? '—' : card.value}
                  </span>
                  <span className="text-[11px] font-medium text-brand-dark/45">
                    Filtrar →
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-brand-dark/50">
                  {card.description}
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* Recent Inquiries Section */}
        <section className="space-y-4" aria-label="Consultas más recientes">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-brand-dark">
              Consultas Recientes
            </h2>
            <a
              href="/admin/inquiries"
              className="text-xs font-semibold text-brand-dark/65 hover:text-brand-dark underline underline-offset-4"
            >
              Ir al listado completo
            </a>
          </div>

          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-14 w-full bg-[#F2F2F0] rounded-xs"
                />
              ))}
            </div>
          ) : recentInquiries.length === 0 ? (
            <div className="py-12 px-6 text-center bg-[#FAF9F6]/80 border border-brand-dark/10 rounded-xs space-y-2">
              <p className="text-sm font-medium text-brand-dark/70">
                Todavía no hay consultas comerciales registradas.
              </p>
              <p className="text-xs text-brand-dark/50">
                Las consultas enviadas por los clientes desde el carrito
                aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/10 rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-dark/10 bg-brand-dark/[0.03] text-[11px] font-semibold uppercase tracking-wider text-brand-dark/55">
                      <th className="py-3 px-4">Consulta</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4 text-center">Artículos</th>
                      <th className="py-3 px-4 text-right">Total ref.</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/[0.06] text-xs sm:text-sm">
                    {recentInquiries.map((inq) => {
                      const itemsCount = getTotalItemsCount(inq);
                      return (
                        <tr
                          key={inq.id}
                          className="hover:bg-brand-dark/[0.02] transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-semibold text-brand-dark whitespace-nowrap">
                            <a
                              href={`/admin/inquiries/${inq.id}`}
                              className="hover:underline underline-offset-2"
                            >
                              {inq.inquiryNumber}
                            </a>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-brand-dark/65 whitespace-nowrap tabular-nums">
                            {formatDateTime(inq.createdAt)}
                          </td>
                          <td className="py-3.5 px-4 text-brand-dark">
                            {inq.contactName && inq.contactName.trim() ? (
                              <span className="font-medium">
                                {inq.contactName}
                              </span>
                            ) : (
                              <span className="text-brand-dark/40 italic text-xs">
                                No especificado
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center tabular-nums text-brand-dark/75">
                            {itemsCount} {itemsCount === 1 ? 'u.' : 'u.'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-brand-dark tabular-nums whitespace-nowrap">
                            {formatPrice(Number(inq.totalAmount) || 0)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <InquiryStatusBadge status={inq.status} />
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <a
                              href={`/admin/inquiries/${inq.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:opacity-70"
                            >
                              <span>Gestionar</span>
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
          )}
        </section>
      </div>
    </AdminShell>
  );
}

