import { useEffect, useId, useRef } from 'react';
import Icon from './icons';
import { cx } from './cx';

/**
 * Diálogo/sheet para formularios y confirmaciones del admin (sheet en celu, card centrada desde sm).
 * - open, onClose (Esc / fondo / ✕; se ignora si `busy`), title, description, children, footer
 * - size: 'sm' | 'md' | 'lg'
 * Maneja foco (entra al primer campo, vuelve al disparador), Tab dentro del diálogo y scroll del fondo.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  busy = false,
  size = 'md',
  className,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      const el = dialogRef.current?.querySelector(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-autofocus]'
      );
      (el || dialogRef.current)?.focus();
    }, 30);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!busyRef.current) closeRef.current?.();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-brand-dark/45 animate-fadeIn sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'my-auto max-h-[100dvh] w-full animate-sheet-up overflow-y-auto rounded-t-tile bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float outline-none sm:animate-fade-up sm:rounded-tile sm:p-7',
          size === 'sm' && 'sm:max-w-sm',
          size === 'md' && 'sm:max-w-md',
          size === 'lg' && 'sm:max-w-2xl',
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold tracking-[-0.02em] text-brand-dark">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-brand-dark disabled:opacity-50"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}
