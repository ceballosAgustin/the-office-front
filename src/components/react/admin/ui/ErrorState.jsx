import Button from './Button';
import { cx } from './cx';

/** Error de carga con "Reintentar". role="alert". */
export default function ErrorState({ title = 'Algo salió mal', message, onRetry, retryLabel = 'Reintentar', className }) {
  return (
    <div
      role="alert"
      className={cx('flex flex-wrap items-center justify-between gap-3 rounded-card bg-red-50 p-4 text-sm text-red-900', className)}
    >
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {message && <p className="mt-0.5">{message}</p>}
      </div>
      {onRetry && (
        <Button size="sm" variant="danger" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
