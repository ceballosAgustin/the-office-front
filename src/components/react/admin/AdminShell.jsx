import { useState, useEffect } from 'react';
import {
  getAdminSession,
  clearAdminSession,
  onAdminAuthChange,
} from '../../../services/adminAuth';

export default function AdminShell({ activeSection = 'dashboard', children }) {
  const [session, setSession] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

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

  const handleLogout = () => {
    clearAdminSession();
    window.location.replace('/admin/login');
  };

  if (isChecking || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-2 animate-pulse">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-brand-dark/50">
            The Office BA — Admin
          </p>
          <p className="text-sm font-medium text-brand-dark/70">
            Verificando sesión administrativa...
          </p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/admin' },
    { id: 'products', label: 'Products', href: '/admin/products' },
    { id: 'categories', label: 'Categories', href: '/admin/categories' },
    { id: 'inquiries', label: 'Consultas Comerciales', href: '/admin/inquiries' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Administrative Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#FAFAFA]/90 backdrop-blur-md border-b border-brand-dark/[0.08]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-4">
            {/* Left: Brand + Admin Label & Primary Links */}
            <div className="flex items-center gap-6 lg:gap-8">
              <a
                href="/admin"
                className="inline-flex items-center gap-2.5 text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/20 rounded-xs"
              >
                <span className="inline-flex items-baseline text-base font-bold tracking-[-0.03em] uppercase select-none">
                  THE OFFICE
                  <sup className="text-[9px] font-bold tracking-tight relative -top-1.5 ml-0.5 leading-none text-brand-dark">
                    BA
                  </sup>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-0.5 bg-brand-dark text-[#FAFAFA] rounded-xs">
                  Admin
                </span>
              </a>

              {/* Desktop Navigation */}
              <nav
                className="hidden md:flex items-center gap-1"
                aria-label="Navegación administrativa"
              >
                {navItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs transition-colors ${
                        isActive
                          ? 'bg-brand-dark/[0.08] text-brand-dark'
                          : 'text-brand-dark/60 hover:text-brand-dark hover:bg-brand-dark/[0.04]'
                      }`}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </nav>
            </div>

            {/* Right: Store Link, User & Logout */}
            <div className="flex items-center gap-3 sm:gap-4">
              <a
                href="/"
                className="text-xs font-medium text-brand-dark/60 hover:text-brand-dark transition-colors hidden sm:inline-flex items-center gap-1"
              >
                <span>Tienda pública</span>
                <span aria-hidden="true">↗</span>
              </a>

              <div className="h-4 w-px bg-brand-dark/10 hidden sm:block" />

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block text-xs font-mono text-brand-dark/60">
                  {session.username}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 hover:bg-brand-dark hover:text-[#FAFAFA] transition-colors rounded-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Compact Sub-navigation */}
          <nav
            className="flex md:hidden items-center justify-between border-t border-brand-dark/[0.06] py-2 gap-2 overflow-x-auto"
            aria-label="Navegación administrativa móvil"
          >
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-xs whitespace-nowrap ${
                      isActive
                        ? 'bg-brand-dark text-[#FAFAFA]'
                        : 'text-brand-dark/65 hover:text-brand-dark'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
            <a
              href="/"
              className="text-[11px] font-medium text-brand-dark/60 hover:text-brand-dark whitespace-nowrap px-2 py-1"
            >
              Tienda ↗
            </a>
          </nav>
        </div>
      </header>

      {/* Main Administrative Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {children}
      </main>

      {/* Compact Admin Footer */}
      <footer className="border-t border-brand-dark/[0.08] bg-[#FAFAFA]/70 py-4 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-brand-dark/45">
          <span>The Office BA — Panel de Gestión Comercial</span>
          <span className="font-mono uppercase">Sesión activa: {session.username} (ADMIN)</span>
        </div>
      </footer>
    </div>
  );
}

