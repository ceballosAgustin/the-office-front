import { useRef } from 'react';
import { cx } from './cx';

/**
 * Control segmentado (radiogroup accesible, con flechas del teclado).
 * - options: [{ value, label, count? }]
 * - value / onChange(value)
 * - ariaLabel: obligatorio (describe el grupo)
 * - variant: 'track' (pista redondeada con ítem activo blanco; para 2-4 opciones cortas)
 *            'pills' (chips sueltos, activo brand-dark + texto arena; scrollea horizontal en celu)
 * - fullWidth: en celu ocupa todo el ancho (solo 'track')
 */
export default function Segmented({
  options = [],
  value,
  onChange,
  ariaLabel,
  variant = 'track',
  fullWidth = false,
  disabled = false,
  className,
}) {
  const groupRef = useRef(null);

  const focusAndSelect = (index) => {
    const opt = options[index];
    if (!opt) return;
    onChange?.(opt.value);
    const buttons = groupRef.current?.querySelectorAll('[role="radio"]');
    buttons?.[index]?.focus();
  };

  const handleKeyDown = (e, index) => {
    if (disabled) return;
    const last = options.length - 1;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index >= last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index <= 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next == null) return;
    e.preventDefault();
    focusAndSelect(next);
  };

  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const isPills = variant === 'pills';

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(
        isPills
          ? 'no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0'
          : cx('inline-flex max-w-full rounded-full bg-brand-dark/[0.06] p-1', fullWidth && 'flex w-full sm:inline-flex sm:w-auto'),
        className
      )}
    >
      {options.map((opt, index) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabbableIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange?.(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cx(
              'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-sm whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 disabled:opacity-50',
              isPills
                ? cx(
                    'h-10 px-4',
                    selected
                      ? 'bg-brand-dark font-semibold text-brand-sand'
                      : 'bg-white font-medium text-brand-dark shadow-hairline hover:shadow-card'
                  )
                : cx(
                    'h-10 px-4 lg:h-9',
                    fullWidth && 'flex-1 sm:flex-none',
                    selected
                      ? 'bg-white font-semibold text-brand-dark shadow-[0_1px_3px_rgb(29_17_13/0.14)]'
                      : 'font-medium text-ink-muted hover:text-brand-dark'
                  )
            )}
          >
            <span>{opt.label}</span>
            {opt.count != null && (
              <span className={cx('tabular-nums text-[13px]', selected && isPills ? 'text-brand-sand/80' : 'text-ink-muted')}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
