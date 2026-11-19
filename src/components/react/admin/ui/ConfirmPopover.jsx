import { useEffect, useId, useRef, useState } from 'react';
import Button from './Button';
import useDismiss from './useDismiss';
import { cx } from './cx';

/**
 * Panel de confirmación en línea (sin modal) para acciones destructivas acotadas.
 *
 * <ConfirmPopover
 *   title="¿Desactivar producto?"
 *   message="Se oculta de la tienda. No se borra nada."
 *   confirmLabel="Desactivar"
 *   onConfirm={async () => { ... }}            // puede ser async: mientras tanto queda "ocupado"
 *   trigger={(props) => <Button variant="ghost" {...props}>Desactivar</Button>}
 * />
 *
 * `trigger` es una función que recibe { onClick, 'aria-haspopup', 'aria-expanded', 'aria-controls', ref }
 * y devuelve el botón disparador. El foco entra en "Cancelar" (opción segura) y vuelve al disparador al cerrar.
 * - align: 'right' (default) | 'left'
 */
export default function ConfirmPopover({
  trigger,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = true,
  align = 'right',
  onConfirm,
  onOpenChange,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const cancelRef = useRef(null);
  const panelId = useId();

  const setOpenState = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const close = (restoreFocus = true) => {
    setOpenState(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useDismiss(open, containerRef, (reason) => close(reason === 'escape'));

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
      setOpenState(false);
    }
  };

  return (
    <div ref={containerRef} className={cx('relative inline-block', className, open && 'z-40')}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpenState(!open),
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': open ? panelId : undefined,
      })}
      {open && (
        <div
          id={panelId}
          role="alertdialog"
          aria-label={title || 'Confirmar acción'}
          className={cx(
            'absolute top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] animate-fadeIn rounded-card bg-white p-4 text-left shadow-float ring-1 ring-brand-dark/[0.06]',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {title && <p className="text-sm font-semibold text-brand-dark">{title}</p>}
          {message && <p className={cx('text-[13px] text-ink-muted', title && 'mt-1')}>{message}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={danger ? 'danger' : 'primary'}
              onClick={handleConfirm}
              loading={busy}
            >
              {confirmLabel}
            </Button>
            <Button ref={cancelRef} size="sm" variant="ghost" onClick={() => close()} disabled={busy}>
              {cancelLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
