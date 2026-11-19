import Button from './Button';
import { cx } from './cx';

/**
 * Paginación compacta: "1–12 de 30" + Anterior / Siguiente.
 * Props: number (0-based), size, totalPages, totalElements, onPrev, onNext, itemLabel (opcional, ej. 'productos').
 */
export default function Pagination({ number = 0, size = 12, totalPages = 0, totalElements = 0, shown, onPrev, onNext, className }) {
  if (totalPages <= 1) return null;
  const from = number * size + 1;
  const to = number * size + (shown ?? size);
  const hasPrev = number > 0;
  const hasNext = number + 1 < totalPages;

  return (
    <nav aria-label="Paginación" className={cx('flex items-center justify-between gap-3 text-sm text-ink-muted', className)}>
      <span className="tabular-nums">
        {from}–{Math.min(to, totalElements)} de {totalElements}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={!hasPrev} onClick={onPrev}>
          Anterior
        </Button>
        <Button variant="secondary" size="sm" disabled={!hasNext} onClick={onNext}>
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
