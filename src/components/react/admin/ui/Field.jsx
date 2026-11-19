import { Children, cloneElement, isValidElement, useId } from 'react';
import { cx } from './cx';

/** Clases para controles nativos (estilo base en global.css: .form-input/.form-select/.form-textarea). */
export const inputClass = 'form-input w-full h-11 px-3.5 text-sm lg:h-10';
export const selectClass = 'form-select w-full h-11 pl-3.5 text-sm lg:h-10';
export const textareaClass = 'form-textarea w-full px-3.5 py-2.5 text-sm';

/**
 * Campo de formulario: label 13px + control + hint + error.
 * El control (hijo único) recibe id, aria-describedby y aria-invalid automáticamente;
 * también se puede pasar una función: children({ id, 'aria-describedby', 'aria-invalid' }).
 */
export default function Field({ label, hint, error, required = false, id, className, labelClassName, children }) {
  const autoId = useId();
  const fieldId = id || `field-${autoId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const controlProps = {
    id: fieldId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  };

  let control = null;
  if (typeof children === 'function') {
    control = children(controlProps);
  } else {
    const only = Children.toArray(children);
    control =
      only.length === 1 && isValidElement(only[0])
        ? cloneElement(only[0], { ...controlProps, id: only[0].props.id || fieldId })
        : children;
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className={cx('mb-1.5 block text-[13px] font-medium text-brand-dark', labelClassName)}>
          {label}
          {required && (
            <span className="ml-0.5 text-red-700" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {control}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[13px] font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
