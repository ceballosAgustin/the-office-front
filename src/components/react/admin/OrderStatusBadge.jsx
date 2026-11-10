const ORDER_STATUS_CONFIG = {
  PENDING: {
    label: 'Pendiente',
    dotClass: 'bg-amber-600',
    badgeClass:
      'bg-amber-50 text-amber-900 border-amber-300/80 font-semibold',
  },
  COMPLETED: {
    label: 'Completado',
    dotClass: 'bg-emerald-600',
    badgeClass:
      'bg-emerald-50 text-emerald-900 border-emerald-200/90 font-semibold',
  },
  CANCELLED: {
    label: 'Cancelado',
    dotClass: 'bg-red-600',
    badgeClass:
      'bg-red-50 text-red-900 border-red-200/90 font-semibold',
  },
};

export function getOrderStatusLabel(status) {
  return ORDER_STATUS_CONFIG[status]?.label || status || 'Desconocido';
}

export default function OrderStatusBadge({ status }) {
  const config = ORDER_STATUS_CONFIG[status] || {
    label: status || '—',
    dotClass: 'bg-brand-dark/40',
    badgeClass: 'bg-brand-dark/5 text-brand-dark border-brand-dark/15',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] uppercase tracking-wider border rounded-xs whitespace-nowrap ${config.badgeClass}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`}
        aria-hidden="true"
      />
      <span>{config.label}</span>
    </span>
  );
}

