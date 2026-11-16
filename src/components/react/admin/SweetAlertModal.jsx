import { useEffect } from 'react';

/**
 * SweetAlert-style floating modal for admin actions (Creation, Update, Deletion, Confirmation).
 * Positioned fixed in the center of the viewport so the user receives unmistakable feedback
 * regardless of their current scroll position on long pages.
 */
export default function SweetAlertModal({
  isOpen = false,
  type = 'success', // 'success' | 'error' | 'warning' | 'confirm'
  title = '',
  message = '',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  autoCloseMs = 0,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (typeof onCancel === 'function') onCancel();
        else if (typeof onConfirm === 'function') onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    let timer = null;
    if (autoCloseMs > 0 && type !== 'confirm') {
      timer = setTimeout(() => {
        if (typeof onConfirm === 'function') onConfirm();
      }, autoCloseMs);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, autoCloseMs, type, onConfirm, onCancel]);

  if (!isOpen) return null;

  const isConfirmType = type === 'confirm';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sweetalert-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="bg-white rounded-xs shadow-2xl border border-brand-dark/12 max-w-sm sm:max-w-md w-full p-6 sm:p-7 text-center transform transition-all duration-200 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Icon */}
        <div className="mx-auto mb-4 flex items-center justify-center">
          {type === 'success' && (
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border-2 border-emerald-200 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}

          {type === 'error' && (
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 border-2 border-rose-200 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          )}

          {(type === 'warning' || type === 'confirm') && (
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 border-2 border-amber-200 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          )}
        </div>

        {/* Title */}
        <h3
          id="sweetalert-title"
          className="text-lg sm:text-xl font-bold text-brand-dark tracking-tight mb-2"
        >
          {title}
        </h3>

        {/* Message */}
        {message && (
          <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed mb-6">
            {message}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mt-5">
          {isConfirmType && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark/70 hover:text-brand-dark border border-brand-dark/20 hover:bg-brand-dark/5 rounded-xs transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white rounded-xs shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              type === 'error' || type === 'confirm'
                ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500'
                : 'bg-brand-dark hover:bg-brand-dark/85 focus-visible:ring-brand-dark'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
