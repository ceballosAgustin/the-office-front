import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Button from './Button';
import Icon from './icons';
import useDismiss from './useDismiss';
import { cx } from './cx';

/**
 * Menú de acciones "⋯" (role="menu"). Flechas / Home / End / Escape; el foco vuelve al botón al cerrar.
 *
 * items: [{
 *   key?, label, onSelect?, href?, external?, danger?, disabled?, hidden?,
 *   confirm?: { message, confirmLabel?, cancelLabel? }   // confirmación en línea dentro del menú
 * }]
 *
 * - label: nombre accesible del botón disparador (default "Más acciones")
 * - align: 'right' (default) | 'left'; direction: 'down' (default) | 'up' (barras fijas abajo)
 * - trigger: opcional, render prop ({ props, open }) => node, para un disparador propio
 */
export default function Menu({ items = [], label = 'Más acciones', align = 'right', direction = 'down', trigger, className, panelClassName }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const [side, setSide] = useState(align);

  // Si el panel se sale de la pantalla, lo abre hacia el otro lado (útil en tiles/celdas pegadas al borde)
  useLayoutEffect(() => {
    if (!open) {
      setSide(align);
      return;
    }
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.left < 8) setSide('left');
    else if (rect.right > window.innerWidth - 8) setSide('right');
  }, [open, align, confirming]);

  const visible = items.filter((item) => !item.hidden);

  const close = (restoreFocus = true) => {
    setOpen(false);
    setConfirming(null);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useDismiss(open, containerRef, (reason) => close(reason === 'escape'));

  const getFocusable = () =>
    Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled]), [data-menu-focus]') || []);

  useEffect(() => {
    if (!open) return;
    const [first] = getFocusable();
    first?.focus();
  }, [open, confirming]);

  const handleMenuKeyDown = (e) => {
    const focusables = getFocusable();
    if (focusables.length === 0) return;
    const index = focusables.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = index + 1 >= focusables.length ? 0 : index + 1;
    else if (e.key === 'ArrowUp') next = index <= 0 ? focusables.length - 1 : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = focusables.length - 1;
    else if (e.key === 'Tab') {
      close(false);
      return;
    }
    if (next == null) return;
    e.preventDefault();
    focusables[next].focus();
  };

  const handleSelect = async (item) => {
    if (item.disabled) return;
    if (item.confirm) {
      setConfirming(item);
      return;
    }
    close();
    await item.onSelect?.();
  };

  const handleConfirm = async () => {
    if (!confirming || busy) return;
    const item = confirming;
    setBusy(true);
    try {
      await item.onSelect?.();
    } finally {
      setBusy(false);
      close();
    }
  };

  const triggerProps = {
    ref: triggerRef,
    type: 'button',
    onClick: () => (open ? close(false) : setOpen(true)),
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown' && !open) {
        e.preventDefault();
        setOpen(true);
      }
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    'aria-label': label,
  };

  return (
    <div ref={containerRef} className={cx('relative inline-block', className, open && 'z-40')}>
      {trigger ? (
        trigger({ props: triggerProps, open })
      ) : (
        <button
          {...triggerProps}
          className="grid size-11 place-items-center rounded-full bg-white text-brand-dark shadow-hairline transition-shadow hover:shadow-card active:scale-[0.97] lg:size-10"
        >
          <Icon name="dots" size={18} />
        </button>
      )}

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className={cx(
            cx(direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'),
            'absolute z-30 w-60 max-w-[calc(100vw-2rem)] animate-fadeIn rounded-card text-left bg-white p-1.5 shadow-float ring-1 ring-brand-dark/[0.06]',
            side === 'right' ? 'right-0' : 'left-0',
            panelClassName
          )}
        >
          {confirming ? (
            <div className="rounded-ctl bg-red-50 p-3 text-sm text-red-900">
              <p>{confirming.confirm.message}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button data-menu-focus size="sm" variant="danger" loading={busy} onClick={handleConfirm}>
                  {confirming.confirm.confirmLabel || confirming.label}
                </Button>
                <Button data-menu-focus size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(null)}>
                  {confirming.confirm.cancelLabel || 'Cancelar'}
                </Button>
              </div>
            </div>
          ) : (
            visible.map((item, i) => {
              const classes = cx(
                'flex min-h-11 w-full items-center rounded-ctl px-3 text-left text-sm transition-colors',
                item.danger ? 'text-red-800 hover:bg-red-50' : 'text-brand-dark hover:bg-sunken',
                item.disabled && 'pointer-events-none opacity-50'
              );
              const key = item.key || item.label || i;
              return item.href ? (
                <a
                  key={key}
                  role="menuitem"
                  href={item.href}
                  className={classes}
                  {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  onClick={() => close(false)}
                >
                  {item.label}
                </a>
              ) : (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={classes}
                  onClick={() => handleSelect(item)}
                >
                  {item.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
