import Switch from '../ui/Switch';
import { cx } from '../ui/cx';

/**
 * "Recién ingresados": switch + grilla de casilleros numerados.
 * - takenByOthers: Map<position, {title, ...}> (el casillero propio queda seleccionable)
 * - max: cantidad de casilleros (MAX_NEW_IN_PRODUCTS)
 * - occupiedCount: casilleros en uso (de todos los productos)
 */
export default function NewInSlotPicker({
  enabled,
  onToggle,
  position,
  onPositionChange,
  takenByOthers,
  max,
  occupiedCount,
  slotsError,
  error,
  disabled = false,
}) {
  const positions = Array.from({ length: max }, (_, i) => i + 1);
  const freeCount = positions.filter((p) => !takenByOthers.has(p)).length;
  const isFull = freeCount === 0;
  const selected = Number(position) || null;

  return (
    <div>
      <Switch
        checked={enabled}
        onChange={onToggle}
        disabled={disabled || (!enabled && isFull)}
        label="Mostrar en Recién ingresados"
        description={`${occupiedCount} de ${max} lugares en uso`}
      />

      {!enabled && isFull && (
        <p className="mt-1 text-[13px] text-ink-muted">
          La sección ya tiene {max} productos. Para sumar este, primero quitá otro de Recién ingresados.
        </p>
      )}

      {slotsError && (
        <p role="status" className="mt-1 text-[13px] text-ink-muted">
          {slotsError}
        </p>
      )}

      {enabled && (
        <div className="mt-3">
          <p id="new-in-grid-label" className="mb-2 text-[13px] font-medium text-brand-dark">
            Posición <span className="text-ink-muted">(la 1 aparece primero)</span>
          </p>
          <div role="group" aria-labelledby="new-in-grid-label" className="grid grid-cols-5 gap-2">
            {positions.map((pos) => {
              const takenBy = takenByOthers.get(pos);
              const isSelected = selected === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  disabled={disabled || Boolean(takenBy)}
                  aria-pressed={isSelected}
                  aria-label={takenBy ? `Posición ${pos}, ocupada por ${takenBy.title}` : `Posición ${pos}`}
                  title={takenBy ? `En uso: ${takenBy.title}` : undefined}
                  onClick={() => onPositionChange(String(pos))}
                  className={cx(
                    'h-11 rounded-ctl text-sm tabular-nums transition-colors lg:h-10',
                    isSelected
                      ? 'bg-brand-dark font-semibold text-brand-sand'
                      : takenBy
                        ? 'cursor-not-allowed bg-sunken text-ink-muted/60 line-through'
                        : 'bg-white font-medium text-brand-dark ring-1 ring-brand-dark/[0.14] hover:ring-brand-dark'
                  )}
                >
                  {pos}
                </button>
              );
            })}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-[13px] font-medium text-red-800">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
