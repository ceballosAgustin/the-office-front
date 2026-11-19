import { cx } from './cx';

/**
 * Card blanca sobre el mármol (los datos siempre viven sobre blanco).
 * - padded: aplica p-4 sm:p-6
 * - title / description / actions: cabecera opcional
 * - as: etiqueta (por defecto 'section')
 */
export default function Card({
  as: Tag = 'section',
  title,
  description,
  actions,
  padded = true,
  elevated = false,
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={cx(
        'rounded-card bg-white',
        elevated ? 'shadow-card' : 'shadow-hairline',
        padded && 'p-4 sm:p-6',
        className
      )}
      {...rest}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-brand-dark">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
