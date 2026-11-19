import Card from '../ui/Card';
import Segmented from '../ui/Segmented';
import Button from '../ui/Button';
import Icon from '../ui/icons';
import { inputClass } from '../ui/Field';
import { cx } from '../ui/cx';
import { QUICK_SIZES, QUICK_SNEAKER_SIZES } from './productSizing';
import { normalizeClothingSizeLabel } from '../../../../services/api';

const SIZING_OPTIONS = [
  { value: 'multi', label: 'Con talles' },
  { value: 'single', label: 'Talle único' },
];

function Stepper({ value, onChange, disabled, label }) {
  const num = Math.max(0, Number(value) || 0);
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        disabled={disabled || num <= 0}
        onClick={() => onChange(num - 1)}
        aria-label="Restar una unidad"
        className="grid size-11 place-items-center rounded-full bg-sunken text-brand-dark transition-colors hover:bg-brand-dark/[0.09] active:scale-[0.97] disabled:opacity-40 lg:size-10"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          −
        </span>
      </button>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        disabled={disabled}
        value={num}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="form-input h-11 w-14 px-1 text-center text-sm font-semibold tabular-nums [appearance:textfield] lg:h-10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(num + 1)}
        aria-label="Sumar una unidad"
        className="grid size-11 place-items-center rounded-full bg-sunken text-brand-dark transition-colors hover:bg-brand-dark/[0.09] active:scale-[0.97] disabled:opacity-40 lg:size-10"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          +
        </span>
      </button>
    </div>
  );
}

/**
 * Card "Talles y stock". `vm` es el resultado de useProductVariants.
 * Props: vm, isSneakers, disabled.
 */
export default function ProductVariantsCard({ vm, isSneakers, disabled = false }) {
  const quick = isSneakers ? QUICK_SNEAKER_SIZES : QUICK_SIZES;
  const isActiveSize = (size) => vm.activeVariants.some((v) => vm.sameSize(v.size, size));

  const handleOtherKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      vm.addVariant(vm.newVariantSize);
    }
  };

  return (
    <Card
      aria-labelledby="card-variants-title"
      title={<span id="card-variants-title">Talles y stock</span>}
      actions={
        <span className="text-sm text-ink-muted tabular-nums">
          Stock total: <strong className="font-semibold text-brand-dark">{vm.totalActiveStock}</strong>{' '}
          {vm.totalActiveStock === 1 ? 'unidad' : 'unidades'}
        </span>
      }
    >
      <Segmented
        ariaLabel="Esquema de talles"
        options={SIZING_OPTIONS}
        value={vm.sizingMode}
        onChange={vm.switchSizingMode}
        fullWidth
        disabled={disabled}
      />

      {vm.sizingMode === 'single' ? (
        <div className="mt-5">
          <p className="text-[13px] text-ink-muted">
            Producto sin talles: el cliente no tiene que elegir. Solo cargás el stock disponible.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-ctl p-3 ring-1 ring-brand-dark/[0.08]">
            {vm.activeSingleVariant?.id != null ? (
              <span className="inline-flex h-10 min-w-14 items-center justify-center rounded-ctl bg-brand-dark px-3 text-sm font-semibold text-brand-light">
                {vm.activeSingleVariant.size}
              </span>
            ) : (
              <select
                aria-label="Nombre del talle único"
                disabled={disabled}
                value={vm.activeSingleVariant?.size || vm.singleSizeLabel}
                onChange={(e) => vm.changeSingleLabel(e.target.value)}
                className="form-select h-11 w-36 pl-3.5 text-sm font-semibold lg:h-10"
              >
                <option value="Único">Único</option>
                <option value="One Size">One Size</option>
              </select>
            )}
            <Stepper
              value={vm.activeSingleVariant?.stock ?? 0}
              onChange={vm.changeSingleStock}
              disabled={disabled}
              label="Stock del talle único"
            />
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-[13px] font-medium text-ink-muted">
            {isSneakers ? 'Tocá para sumar o quitar (talles US)' : 'Tocá para sumar o quitar'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Talles rápidos">
            {quick.map((size) => {
              const on = isActiveSize(size);
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => vm.toggleQuickSize(size)}
                  className={cx(
                    'h-11 min-w-12 rounded-full px-4 text-sm transition-colors active:scale-[0.97] disabled:opacity-50 lg:h-10',
                    on
                      ? 'bg-brand-dark font-semibold text-brand-sand'
                      : 'bg-sunken font-medium text-brand-dark hover:bg-brand-dark/[0.09]'
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              maxLength={50}
              disabled={disabled}
              value={vm.newVariantSize}
              onChange={(e) => vm.setNewVariantSize(e.target.value)}
              onKeyDown={handleOtherKeyDown}
              placeholder="Otro talle"
              aria-label="Otro talle"
              className={cx(inputClass, 'max-w-[11rem]')}
            />
            <Button
              variant="secondary"
              disabled={disabled || !vm.newVariantSize.trim()}
              onClick={() => vm.addVariant(vm.newVariantSize)}
            >
              Agregar
            </Button>
          </div>

          {vm.feedbackError && (
            <p role="alert" className="mt-2 text-[13px] font-medium text-red-800">
              {vm.feedbackError}
            </p>
          )}

          <div className="mt-5">
            {vm.activeVariants.length === 0 ? (
              <p className="rounded-ctl bg-sunken p-4 text-center text-sm text-ink-muted">
                Todavía no hay talles activos. Tocá uno de arriba o agregá otro.
              </p>
            ) : (
              <ul className="divide-y divide-brand-dark/[0.07] rounded-ctl ring-1 ring-brand-dark/[0.08]">
                {vm.activeVariants.map((v) => (
                  <li key={v.localKey} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-2.5 sm:p-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {v.id != null ? (
                        <span
                          className="inline-flex h-10 min-w-12 items-center justify-center rounded-ctl bg-brand-dark px-3 text-sm font-semibold text-brand-light"
                          title="Talle guardado: no se puede renombrar. Desactivalo y creá uno nuevo si hace falta."
                        >
                          {normalizeClothingSizeLabel(v.size)}
                        </span>
                      ) : (
                        <input
                          type="text"
                          maxLength={50}
                          disabled={disabled}
                          value={v.size}
                          onChange={(e) => vm.changeSize(v.localKey, e.target.value)}
                          aria-label="Nombre del talle nuevo"
                          className="form-input h-10 w-24 px-2.5 text-sm font-semibold uppercase"
                        />
                      )}
                      {v.id == null && <span className="text-xs text-ink-muted">Nuevo</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Stepper
                        value={v.stock}
                        onChange={(val) => vm.changeStock(v.localKey, val)}
                        disabled={disabled}
                        label={`Stock del talle ${v.size}`}
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => (v.id != null ? vm.deactivate(v.localKey) : vm.removeUnsaved(v.localKey))}
                        aria-label={v.id != null ? `Desactivar talle ${v.size}` : `Quitar talle ${v.size}`}
                        title={v.id != null ? 'Desactivar talle (se conserva el historial)' : 'Quitar talle'}
                        className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-brand-dark lg:size-10"
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {vm.inactiveVariants.length > 0 && (
        <details className="group mt-4 border-t border-brand-dark/[0.07] pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-brand-dark">
            <span>Talles desactivados ({vm.inactiveVariants.length})</span>
            <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
          </summary>
          <p className="text-[13px] text-ink-muted">
            Ocultos en la tienda y sin sumar al stock. Se conservan por el historial de pedidos.
          </p>
          <ul className="mt-2 divide-y divide-brand-dark/[0.07] rounded-ctl ring-1 ring-brand-dark/[0.08]">
            {vm.inactiveVariants.map((v) => (
              <li key={v.localKey} className="flex items-center justify-between gap-3 p-2.5 sm:p-3">
                <span className="min-w-0 text-sm text-ink-muted">
                  <span className="font-semibold text-brand-dark line-through">{normalizeClothingSizeLabel(v.size)}</span> · stock guardado {v.stock}
                </span>
                <Button size="sm" variant="secondary" disabled={disabled} onClick={() => vm.reactivate(v.localKey)}>
                  Reactivar
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
