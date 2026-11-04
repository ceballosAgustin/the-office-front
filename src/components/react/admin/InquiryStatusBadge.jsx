const STATUS_CONFIG = {
  NEW: {
    label: 'Nueva',
    dotClass: 'bg-amber-600',
    badgeClass:
      'bg-amber-50 text-amber-900 border-amber-300/80 font-semibold',
  },
  IN_PROGRESS: {
    label: 'En seguimiento',
    dotClass: 'bg-sky-600',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-200/90 font-semibold',
  },
  CONVERTED: {
    label: 'Convertida',
    dotClass: 'bg-emerald-600',
    badgeClass:
      'bg-emerald-50 text-emerald-900 border-emerald-200/90 font-semibold',
  },
  NOT_CONVERTED: {
    label: 'No concretada',
    dotClass: 'bg-brand-dark/35',
    badgeClass:
      'bg-brand-dark/[0.05] text-brand-dark/65 border-brand-dark/15 font-medium',
  },
};

export function getStatusLabel(status) {
  return STATUS_CONFIG[status]?.label || status || 'Desconocido';
}

export default function InquiryStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
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

