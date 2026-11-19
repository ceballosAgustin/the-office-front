import StatusBadge from './ui/StatusBadge';

// "Pendiente" = relleno arena; completado = punto verde; cancelado = punto gris.
const ORDER_STATUS_CONFIG = {
  PENDING: { label: 'Pendiente', tone: 'attention' },
  COMPLETED: { label: 'Completado', tone: 'success' },
  CANCELLED: { label: 'Cancelado', tone: 'neutral' },
};

export function getOrderStatusLabel(status) {
  return ORDER_STATUS_CONFIG[status]?.label || status || 'Desconocido';
}

export default function OrderStatusBadge({ status, variant = 'pill', className }) {
  const config = ORDER_STATUS_CONFIG[status] || { label: status || '—', tone: 'neutral' };

  return (
    <StatusBadge tone={config.tone} variant={variant} className={className}>
      {config.label}
    </StatusBadge>
  );
}
