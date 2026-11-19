import { useState, useEffect, useRef } from 'react';
import {
  getAdminSession,
  clearAdminSession,
  onAdminAuthChange,
} from '../../../services/adminAuth';
import { fetchAdminInquiries } from '../../../services/api';
import Icon from './ui/icons';
import PageHeader from './ui/PageHeader';
import { ToastProvider } from './ui/Toast';
import { cx } from './ui/cx';

export { PageHeader };

const NAV_GROUPS = [
  {
    title: 'Ventas',
    items: [
      { id: 'dashboard', label: 'Inicio', href: '/admin', icon: 'home' },
      { id: 'inquiries', label: 'Consultas', href: '/admin/inquiries', icon: 'chat', badge: true },
      { id: 'orders', label: 'Pedidos', href: '/admin/orders', icon: 'bag' },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { id: 'products', label: 'Productos', href: '/admin/products', icon: 'tag' },
      { id: 'categories', label: 'Categorías', href: '/admin/categories', icon: 'grid' },
      { id: 'brands', label: 'Marcas', href: '/admin/brands', icon: 'star' },
    ],
  },
  {
    title: 'Tienda',
    items: [
      { id: 'navigation', label: 'Navegación', href: '/admin/navigation', icon: 'list' },
    ],
  },
];

function Wordmark({ className }) {
  return (
    <span
      className={cx(
        'inline-flex select-none items-baseline font-bold uppercase tracking-[-0.03em]',
        className
      )}
    >
      THE OFFICE
      <sup className="relative -top-1.5 ml-0.5 text-[10px] leading-none">BA</sup>
    </span>
  );
}

function NavList({ activeSection, newInquiries, onNavigate }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2" aria-label="Administración">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="mb-3">
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-brand-light/60">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = activeSection === item.id;
              const count = item.badge ? newInquiries : 0;
              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={cx(
                      'flex min-h-11 items-center gap-3 rounded-ctl px-3 text-sm transition-colors focus-visible:outline-brand-sand',
                      isActive
                        ? 'bg-brand-sand font-semibold text-brand-dark'
                        : 'text-brand-light/85 hover:bg-white/[0.07] hover:text-white'
                    )}
                  >
                    <Icon name={item.icon} size={20} className="shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {count > 0 && (
                      <span
                        className={cx(
                          'min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums',
                          isActive ? 'bg-brand-dark text-brand-sand' : 'bg-brand-sand text-brand-dark'
                        )}
                        aria-label={`${count} ${count === 1 ? 'nueva' : 'nuevas'}`}
                      >
                        {count}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ username, onLogout, onNavigate }) {
  const initial = (username || 'a').trim().charAt(0).toUpperCase() || 'A';
  return (
    <div className="border-t border-white/10 p-3">
      <a
        href="/"
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 rounded-ctl px-3 text-sm text-brand-light/80 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-brand-sand"
      >
        <span>Tienda pública</span>
        <Icon name="external" size={16} />
      </a>
      <div className="mt-1 flex items-center gap-3 px-3 py-2">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-sand text-sm font-semibold text-brand-dark"
          aria-hidden="true"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-brand-light">{username}</p>
          <button
            type="button"
            onClick={onLogout}
            className="-ml-1 inline-flex min-h-11 items-center rounded-md px-1 text-[13px] text-brand-light/70 transition-colors hover:text-white focus-visible:outline-brand-sand"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({ activeSection = 'dashboard', children }) {
  const [session, setSession] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newInquiries, setNewInquiries] = useState(0);
  const openButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const current = getAdminSession();
    if (!current) {
      window.location.replace('/admin/login');
      return;
    }
    setSession(current);
    setIsChecking(false);

    const unsubscribe = onAdminAuthChange((nextSession) => {
      if (!nextSession) {
        window.location.replace('/admin/login');
      } else {
        setSession(nextSession);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Contador de consultas nuevas para el menú (best-effort: si falla, no se muestra; cada pantalla maneja su propio 401/403)
  const hasSession = Boolean(session);
  useEffect(() => {
    if (!hasSession) return undefined;
    let cancelled = false;
    // Una sola request liviana (size=1): solo interesa totalElements
    fetchAdminInquiries({ status: 'NEW', page: 0, size: 1 })
      .then((page) => {
        if (!cancelled) setNewInquiries(Number(page?.totalElements) || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  // Drawer: Escape cierra, bloquea scroll del fondo y maneja el foco
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // El panel pasa de visibility:hidden a visible con transición: hay que esperar un frame para poder enfocar
    const focusTimer = setTimeout(() => closeButtonRef.current?.focus(), 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      openButtonRef.current?.focus();
    };
  }, [drawerOpen]);

  const handleLogout = () => {
    clearAdminSession();
    window.location.replace('/admin/login');
  };

  if (isChecking || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p
          className="animate-pulse text-sm font-medium text-ink-muted"
          role="status"
        >
          Verificando sesión…
        </p>
      </div>
    );
  }

  const closeDrawer = () => setDrawerOpen(false);
  const initial = (session.username || 'a').trim().charAt(0).toUpperCase() || 'A';

  return (
    <ToastProvider>
      <div className="min-h-screen">
        {/* Sidebar (desktop) */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-brand-dark text-brand-light lg:flex">
          <a
            href="/admin"
            className="flex h-16 shrink-0 items-center gap-2.5 px-5 focus-visible:outline-brand-sand"
          >
            <Wordmark className="text-[17px] text-brand-sand" />
            <span className="rounded-full bg-brand-sand px-2 py-0.5 text-xs font-semibold text-brand-dark">
              Admin
            </span>
          </a>
          <NavList activeSection={activeSection} newInquiries={newInquiries} />
          <SidebarFooter username={session.username} onLogout={handleLogout} />
        </aside>

        {/* Barra superior (mobile) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-brand-dark/[0.08] bg-brand-light px-3 lg:hidden">
          <button
            ref={openButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            aria-controls="admin-drawer"
            className="grid size-11 place-items-center rounded-full text-brand-dark transition-colors hover:bg-brand-dark/[0.06] active:scale-[0.97]"
          >
            <Icon name="menu" size={22} />
          </button>
          <a href="/admin" className="rounded-md text-brand-dark">
            <Wordmark className="text-base" />
          </a>
          <span
            className="grid size-9 place-items-center rounded-full bg-brand-dark text-sm font-semibold text-brand-sand"
            aria-hidden="true"
          >
            {initial}
          </span>
        </header>

        {/* Drawer (mobile) */}
        <div
          id="admin-drawer"
          inert={!drawerOpen}
          aria-hidden={!drawerOpen}
          className={cx(
            'fixed inset-0 z-50 transition-[visibility] duration-300 lg:hidden',
            drawerOpen ? 'visible' : 'invisible'
          )}
        >
          <div
            onClick={closeDrawer}
            className={cx(
              'absolute inset-0 bg-brand-dark/45 transition-opacity duration-300',
              drawerOpen ? 'opacity-100' : 'opacity-0'
            )}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú de administración"
            className={cx(
              'absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col rounded-r-tile bg-brand-dark text-brand-light transition-transform duration-300 ease-ios',
              drawerOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <div className="flex h-14 shrink-0 items-center justify-between pl-5 pr-2">
              <span className="flex items-center gap-2.5">
                <Wordmark className="text-base text-brand-sand" />
                <span className="rounded-full bg-brand-sand px-2 py-0.5 text-xs font-semibold text-brand-dark">
                  Admin
                </span>
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDrawer}
                aria-label="Cerrar menú"
                className="grid size-11 place-items-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-brand-sand"
              >
                <Icon name="x" size={22} />
              </button>
            </div>
            <NavList
              activeSection={activeSection}
              newInquiries={newInquiries}
              onNavigate={closeDrawer}
            />
            <SidebarFooter
              username={session.username}
              onLogout={handleLogout}
              onNavigate={closeDrawer}
            />
          </aside>
        </div>

        {/* Contenido */}
        <main className="lg:pl-60">
          <div className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
