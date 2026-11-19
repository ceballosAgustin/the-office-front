import Icon from './icons';
import { cx } from './cx';

/**
 * Estado vacío: ícono + título + una línea + acción (CTA).
 * - icon: nombre de ícono de ./icons (default 'inbox')
 * - action: nodo (Button, link…)
 */
export default function EmptyState({ icon = 'inbox', title, description, action, className }) {
  return (
    <div className={cx('rounded-card bg-white p-8 text-center shadow-hairline', className)}>
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-sunken text-ink-muted">
        <Icon name={icon} size={22} />
      </span>
      {title && <p className="mt-3 text-base font-semibold text-brand-dark">{title}</p>}
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
