import { useEffect, useRef } from 'react';
import Button from './ui/Button';
import Icon from './ui/icons';
import { toast, hasToastHost } from './ui/Toast';

/**
 * Diálogo del admin. Se usa para confirmaciones destructivas y avisos que exigen un clic.
 * API sin cambios (isOpen, type, title, message, confirmText, cancelText, onConfirm, onCancel, autoCloseMs).
 *
 * Los avisos de éxito con `autoCloseMs` (notificaciones puras) ya NO bloquean la pantalla:
 * se muestran como toast y `onConfirm` se llama al vencer el tiempo, igual que antes.
 * (Si no hay un <ToastProvider> montado, cae al diálogo.)
 *
 * type: 'success' | 'error' | 'warning' | 'confirm'  ('confirm' = botón destructivo rojo; confirmVariant lo cambia)
 */
export default function SweetAlertModal({
  isOpen = false,
  type = 'success',
  title = '',
  message = '',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  confirmVariant,
  onConfirm,
  onCancel,
  autoCloseMs = 0,
}) {
  // Keep the latest callbacks in refs so parent re-renders (new inline functions)
  // do not restart the auto-close timer or re-register listeners.
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
    onCancelRef.current = onCancel;
  });

  const confirmButtonRef = useRef(null);
  const dialogRef = useRef(null);

  const showAsToast = isOpen && type === 'success' && autoCloseMs > 0 && hasToastHost();
  const showDialog = isOpen && !showAsToast;

  // Éxito con auto-cierre: toast no bloqueante + onConfirm al terminar el tiempo
  useEffect(() => {
    if (!showAsToast) return undefined;
    toast.success(message || title, { title: message ? title : undefined });
    const timer = setTimeout(() => {
      if (typeof onConfirmRef.current === 'function') onConfirmRef.current();
    }, autoCloseMs);
    // El toast se cierra solo; acá solo se cancela el onConfirm diferido si el aviso cambia o se desmonta.
    return () => clearTimeout(timer);
  }, [showAsToast, title, message, autoCloseMs]);

  // Focus management: focus the primary button on open, restore previous focus on close
  useEffect(() => {
    if (!showDialog) return undefined;
    const previouslyFocused =
      typeof document !== 'undefined' ? document.activeElement : null;
    // En 'confirm' el foco arranca en Cancelar (opción segura)
    const target =
      type === 'confirm'
        ? dialogRef.current?.querySelector('[data-cancel]')
        : confirmButtonRef.current;
    (target || confirmButtonRef.current)?.focus();

    return () => {
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function' &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [showDialog, type]);

  useEffect(() => {
    if (!showDialog) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (typeof onCancelRef.current === 'function') onCancelRef.current();
        else if (typeof onConfirmRef.current === 'function') onConfirmRef.current();
        return;
      }
      // Trampa de foco simple dentro del diálogo
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll('button:not([disabled])');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    let timer = null;
    if (autoCloseMs > 0 && type !== 'confirm') {
      timer = setTimeout(() => {
        if (typeof onConfirmRef.current === 'function') onConfirmRef.current();
      }, autoCloseMs);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [showDialog, autoCloseMs, type]);

  if (!showDialog) return null;

  const isConfirmType = type === 'confirm';
  const primaryVariant =
    confirmVariant || (type === 'confirm' ? 'danger' : 'primary');

  const iconWrap =
    type === 'error'
      ? 'bg-red-50 text-red-800'
      : type === 'success'
        ? 'bg-brand-sand text-brand-dark'
        : 'bg-sunken text-brand-dark';
  const iconName = type === 'success' ? 'check' : 'alert';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sweetalert-title"
      aria-describedby={message ? 'sweetalert-message' : undefined}
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/45 animate-fadeIn sm:items-center sm:p-4"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md animate-sheet-up rounded-t-tile bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float sm:animate-fade-up sm:rounded-tile sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`grid size-10 place-items-center rounded-full ${iconWrap}`}>
          <Icon name={iconName} size={20} />
        </span>

        <h3
          id="sweetalert-title"
          className="mt-4 text-xl font-semibold tracking-[-0.02em] text-brand-dark"
        >
          {title}
        </h3>

        {message && (
          <p
            id="sweetalert-message"
            className="mt-1.5 text-sm leading-relaxed text-ink-muted"
          >
            {message}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {isConfirmType && (
            <Button
              variant="ghost"
              onClick={onCancel}
              data-cancel
              className="w-full sm:w-auto"
            >
              {cancelText}
            </Button>
          )}

          <Button
            ref={confirmButtonRef}
            variant={primaryVariant}
            onClick={onConfirm}
            className="w-full sm:w-auto"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
