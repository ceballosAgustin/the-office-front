import { cx } from './cx';

/**
 * Switch accesible (role="switch"). Con `label`, la fila entera es el botón (zona táctil >= 44px).
 * Sin `label`, pasá `ariaLabel`.
 * - checked / onChange(nextChecked)
 * - description: texto secundario bajo el label
 */
export default function Switch({
  checked = false,
  onChange,
  label,
  description,
  ariaLabel,
  disabled = false,
  id,
  className,
}) {
  const track = (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-block h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-brand-dark' : 'bg-brand-dark/20'
      )}
    >
      <span
        className={cx(
          'absolute left-0.5 top-0.5 size-6 rounded-full shadow-sm transition-transform duration-200 ease-ios',
          checked ? 'translate-x-5 bg-brand-sand' : 'translate-x-0 bg-white'
        )}
      />
    </span>
  );

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cx(
        'flex min-h-11 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50',
        label ? 'w-full justify-between' : 'justify-center',
        className
      )}
    >
      {label && (
        <span className="min-w-0">
          <span className="block text-sm font-medium text-brand-dark">{label}</span>
          {description && <span className="mt-0.5 block text-[13px] text-ink-muted">{description}</span>}
        </span>
      )}
      {track}
    </button>
  );
}
