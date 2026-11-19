import { formatArgentinaDate } from '../../../../utils/date';

/**
 * Tiempo relativo corto en español rioplatense para listas: "hace 12 min", "hace 3 h", "ayer",
 * "hace 4 días"; a partir de una semana, la fecha DD/MM/YYYY. Devuelve '—' si la fecha no es válida.
 */
export function formatRelativeTime(value, now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!value || Number.isNaN(time)) return '—';

  const diffMs = now - time;
  if (diffMs < 0) return formatArgentinaDate(date);

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return formatArgentinaDate(date);
}
