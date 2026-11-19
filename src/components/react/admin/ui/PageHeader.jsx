import { cx } from './cx';

/**
 * Cabecera de página: H1 + subtítulo y a la derecha UNA acción primaria.
 * - title, subtitle (texto o nodo), actions (nodo; típicamente un <Button>)
 */
export default function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cx('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-brand-dark lg:text-[1.75rem]">{title}</h1>
        {subtitle != null && subtitle !== '' && <p className="mt-0.5 text-sm text-ink-muted tabular-nums">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
