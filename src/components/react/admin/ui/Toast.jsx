import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import Icon from './icons';
import { cx } from './cx';

/**
 * Toasts del admin.
 *
 * Cada pantalla del admin es su propia isla de Astro, así que el estado vive en un store
 * de módulo (sin dependencias) y <ToastProvider> (ya montado dentro de AdminShell) solo renderiza
 * el viewport. Se puede disparar desde cualquier lugar de la isla:
 *
 *   import { toast, useToast } from './ui/Toast';
 *   toast.success('Producto guardado');           // fuera de componentes
 *   const t = useToast(); t.error('No se pudo…'); // dentro de componentes (misma API)
 *
 * toast.success|error|info(message, { title?, duration? }) -> id ; toast.dismiss(id)
 */

const MAX_VISIBLE = 3;
let toasts = [];
let nextId = 1;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

const EMPTY = [];
function getServerSnapshot() {
  return EMPTY;
}

function push(type, message, options = {}) {
  const id = nextId++;
  const duration = options.duration ?? (type === 'error' ? 6000 : 4000);
  toasts = [...toasts, { id, type, message, title: options.title, duration }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

function dismiss(id) {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export const toast = {
  success: (message, options) => push('success', message, options),
  error: (message, options) => push('error', message, options),
  info: (message, options) => push('info', message, options),
  dismiss,
};

// Cuántos <ToastProvider> hay montados en la página (para que otros componentes sepan si pueden usar toasts).
let hostCount = 0;
export function hasToastHost() {
  return hostCount > 0;
}

export function useToast() {
  return toast;
}

function ToastItem({ item }) {
  const timerRef = useRef(null);
  const { id, duration } = item;

  const start = () => {
    if (!duration || duration <= 0) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => dismiss(id), duration);
  };
  const stop = () => clearTimeout(timerRef.current);

  useEffect(() => {
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, duration]);

  const isError = item.type === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocus={stop}
      onBlur={start}
      className="pointer-events-auto flex animate-fade-up items-start gap-3 rounded-card bg-brand-dark py-3 pl-4 pr-1 text-brand-light shadow-float"
    >
      <Icon
        name={isError ? 'alert' : item.type === 'info' ? 'info' : 'check'}
        size={20}
        className={cx('mt-0.5 shrink-0', isError ? 'text-red-300' : 'text-brand-sand')}
      />
      <div className="min-w-0 flex-1 py-0.5 text-sm">
        {item.title && <p className="font-semibold">{item.title}</p>}
        <p className={cx(item.title ? 'mt-0.5 text-brand-light/80' : 'font-medium')}>{item.message}</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss(id)}
        aria-label="Cerrar aviso"
        className="-my-0.5 grid size-11 shrink-0 place-items-center rounded-full text-brand-light/70 transition-colors hover:text-white focus-visible:outline-brand-sand"
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (items.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-16 z-[60] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-auto"
      aria-live="polite"
    >
      {items.map((item) => (
        <ToastItem key={item.id} item={item} />
      ))}
    </div>
  );
}

export function ToastProvider({ children }) {
  useLayoutEffect(() => {
    hostCount += 1;
    return () => {
      hostCount -= 1;
    };
  }, []);
  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}
