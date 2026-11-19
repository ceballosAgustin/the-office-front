import StatusBadge from './ui/StatusBadge';

// "Nueva" = relleno arena (única llamada de atención); el resto, punto de color + texto oscuro.
const STATUS_CONFIG = {
  NEW: { label: 'Nueva', tone: 'attention' },
  IN_PROGRESS: { label: 'En seguimiento', tone: 'info' },
  CONVERTED: { label: 'Convertida', tone: 'success' },
  NOT_CONVERTED: { label: 'No concretada', tone: 'neutral' },
};

export function getStatusLabel(status) {
  return STATUS_CONFIG[status]?.label || status || 'Desconocido';
}

export default function InquiryStatusBadge({ status, variant = 'pill', className }) {
  const config = STATUS_CONFIG[status] || { label: status || '—', tone: 'neutral' };

  return (
    <StatusBadge tone={config.tone} variant={variant} className={className}>
      {config.label}
    </StatusBadge>
  );
}
