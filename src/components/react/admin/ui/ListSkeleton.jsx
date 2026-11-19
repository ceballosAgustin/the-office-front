import { cx } from './cx';

/** Skeleton de lista dentro de una card blanca (alto fijo por fila para evitar saltos de layout). */
export default function ListSkeleton({ rows = 6, rowClassName = 'h-[68px]', className }) {
  return (
    <div
      className={cx('divide-y divide-brand-dark/[0.06] overflow-hidden rounded-card bg-white shadow-hairline', className)}
      role="status"
      aria-label="Cargando"
    >
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className={cx('flex animate-pulse items-center gap-3 px-4', rowClassName)}>
          <div className="size-10 shrink-0 rounded-ctl bg-sunken" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 max-w-xs rounded-full bg-sunken" />
            <div className="h-3 w-1/3 max-w-[10rem] rounded-full bg-sunken" />
          </div>
          <div className="hidden h-3.5 w-16 rounded-full bg-sunken sm:block" />
        </div>
      ))}
    </div>
  );
}
