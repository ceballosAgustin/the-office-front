import { useState, useEffect, useRef } from 'react';
import {
  fetchPublicNavigation,
  getNavigationItemHref,
  isExternalCustomUrl,
  isCatalogHref,
} from '../../services/api';
import { WHATSAPP_CONTACT_URL, SOCIAL_LINKS } from '../../utils/contact';

export default function NavbarNavigation() {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeSectionId, setActiveSectionId] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMobileSectionId, setExpandedMobileSectionId] = useState(null);

  const navContainerRef = useRef(null);
  const leaveTimeoutRef = useRef(null);
  const activeButtonRef = useRef(null);

  // Load public navigation tree dynamically from GET /api/navigation
  useEffect(() => {
    let isMounted = true;

    fetchPublicNavigation()
      .then((data) => {
        if (!isMounted) return;
        // Business rule: only sections with at least one valid public item appear in the navbar
        const validSections = Array.isArray(data)
          ? data
              .filter(
                (sec) =>
                  sec &&
                  Array.isArray(sec.columns) &&
                  sec.columns.some((col) => Array.isArray(col.items) && col.items.length > 0)
              )
              .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          : [];
        setSections(validSections);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setSections([]);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync with mobile toggle button rendered in Navbar.astro
  useEffect(() => {
    const toggleBtn = document.getElementById('navbar-mobile-toggle-btn');
    const iconOpen = document.getElementById('navbar-menu-icon-open');
    const iconClose = document.getElementById('navbar-menu-icon-close');

    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(isMobileOpen));
      if (iconOpen && iconClose) {
        if (isMobileOpen) {
          iconOpen.classList.add('hidden');
          iconClose.classList.remove('hidden');
        } else {
          iconOpen.classList.remove('hidden');
          iconClose.classList.add('hidden');
        }
      }

      const handleToggleClick = (e) => {
        e.preventDefault();
        setIsMobileOpen((prev) => !prev);
      };

      toggleBtn.addEventListener('click', handleToggleClick);
      return () => {
        toggleBtn.removeEventListener('click', handleToggleClick);
      };
    }
  }, [isMobileOpen]);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (!isMobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  // Close menus on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activeSectionId) {
          setActiveSectionId(null);
          activeButtonRef.current?.focus();
        }
        if (isMobileOpen) {
          setIsMobileOpen(false);
          document.getElementById('navbar-mobile-toggle-btn')?.focus();
        }
      }
    };

    const handleClickOutside = (e) => {
      if (
        navContainerRef.current &&
        !navContainerRef.current.contains(e.target) &&
        !e.target.closest('#navbar-mobile-toggle-btn')
      ) {
        setActiveSectionId(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeSectionId, isMobileOpen]);

  // Desktop Hover Handlers with debounce delay to prevent accidental closures
  const handleTriggerMouseEnter = (sectionId, event) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    activeButtonRef.current = event.currentTarget;
    setActiveSectionId(sectionId);
  };

  const handleContainerMouseLeave = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
    }
    leaveTimeoutRef.current = setTimeout(() => {
      setActiveSectionId(null);
    }, 180);
  };

  const handleContainerMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  const handleItemClick = (e, href) => {
    // 1. Close active mega-menu panel and mobile drawer
    setActiveSectionId(null);
    setIsMobileOpen(false);

    // 2. If keyboard modifiers or non-left-click, let browser perform native action (e.g. open in new tab)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    // 3. If target specifies opening in another tab/window (e.g. target="_blank"), preserve native browser behavior
    const linkTarget =
      e.currentTarget?.getAttribute?.('target') ||
      e.target?.closest?.('a')?.getAttribute('target');
    if (linkTarget && linkTarget !== '_self') {
      return;
    }

    // 3. Category/Brand/Catalog internal navigation
    if (isCatalogHref(href)) {
      if (typeof window !== 'undefined') {
        const isHomePage = window.location.pathname === '/' || window.location.pathname === '';
        if (isHomePage) {
          // If already on the home page, prevent full page reload:
          // Update URL and browser history via pushState
          e.preventDefault();
          window.history.pushState({}, '', href);

          // Smooth scroll to catalog section
          const catalogEl = document.getElementById('catalogo');
          if (catalogEl) {
            catalogEl.scrollIntoView({ behavior: 'smooth' });
          }

          // Trigger reactive filter updates in CatalogSection and NavbarSearch
          window.dispatchEvent(new CustomEvent('the-office:catalog-url-change'));
        }
        // If on another page (e.g. /cart, /products/1), allow browser native navigation to href
      }
      return;
    }

    // 4. Other internal routes (/colecciones, /sobre-nosotros) and external HTTPS:
    // Allow standard native navigation; do NOT call e.preventDefault() and do NOT dispatch catalog events.
  };

  const activeSection = sections.find((s) => s.id === activeSectionId);

  return (
    <div
      ref={navContainerRef}
      onMouseLeave={handleContainerMouseLeave}
      onMouseEnter={handleContainerMouseEnter}
      className="relative flex items-center"
    >
      {/* 1. Desktop Navigation Bar (Center) */}
      <nav
        className="hidden lg:flex items-center justify-center gap-1 xl:gap-2"
        aria-label="Navegación principal"
      >
        {isLoading && sections.length === 0 ? (
          <div className="flex items-center gap-6 py-2 text-xs text-brand-dark/40 animate-pulse">
            <span className="h-4 w-16 bg-brand-dark/[0.06] rounded-xs" />
            <span className="h-4 w-18 bg-brand-dark/[0.06] rounded-xs" />
            <span className="h-4 w-20 bg-brand-dark/[0.06] rounded-xs" />
          </div>
        ) : (
          sections.map((sec) => {
            const isActive = activeSectionId === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                aria-haspopup="true"
                aria-expanded={isActive}
                aria-controls={`megamenu-${sec.id}`}
                onMouseEnter={(e) => handleTriggerMouseEnter(sec.id, e)}
                onClick={() => setActiveSectionId(isActive ? null : sec.id)}
                className={`text-[14px] font-medium rounded-full px-3.5 py-2 transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer inline-flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-brand-dark/[0.06] text-brand-dark'
                    : 'text-brand-dark hover:bg-brand-dark/[0.06]'
                }`}
              >
                <span>{sec.label}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`shrink-0 transition-transform duration-200 ${
                    isActive ? 'rotate-180 text-brand-dark' : 'text-ink-muted'
                  }`}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            );
          })
        )}
      </nav>

      {/* 2. Desktop Mega-Menu Floating Panel */}
      {activeSection && (
        <div
          id={`megamenu-${activeSection.id}`}
          role="region"
          aria-label={`Desplegable de ${activeSection.label}`}
          className="fixed left-0 right-0 top-14 md:top-16 z-30 bg-brand-light rounded-b-tile shadow-card-hover animate-fadeIn"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-10">
            {/* Grid container */}
            <div className="flex flex-wrap items-start gap-x-14 gap-y-8">
              {/* Check if section has any columns / items */}
              {(!activeSection.columns || activeSection.columns.length === 0) ? (
                <div className="max-w-md space-y-3 py-2">
                  <h3 className="text-[13px] font-semibold text-ink-muted">
                    {activeSection.label}
                  </h3>
                  <p className="text-sm text-ink-muted max-w-md">
                    Actualmente no hay elementos disponibles en esta sección.
                  </p>
                  <a
                    href="/#catalogo"
                    onClick={(e) => handleItemClick(e, '/#catalogo')}
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 transition-opacity"
                  >
                    Ver todo el catálogo →
                  </a>
                </div>
              ) : (
                <>
                  {/* Dynamic Columns Rendering */}
                  {activeSection.columns.map((col) => {
                    const isBrandsSection = activeSection.code?.toLowerCase() === 'brands';
                                        const columnHeader = isBrandsSection
                      ? col.columnIndex === 0
                        ? 'Marcas destacadas'
                        : 'Más marcas'
                      : activeSection.columns.length > 1
                      ? `Colección ${col.columnIndex + 1}`
                      : 'Colección & Siluetas';

                    return (
                      <div key={`col-${col.columnIndex}`} className="min-w-44 max-w-xs space-y-3">
                        <h3 className="text-[13px] font-semibold text-ink-muted">
                          {columnHeader}
                        </h3>
                        <ul className="space-y-2">
                          {(!col.items || col.items.length === 0) ? (
                            <li>
                              <span className="text-sm text-ink-muted italic">
                                Próximamente nuevos modelos
                              </span>
                            </li>
                          ) : (
                            col.items.map((item) => {
                              const href = getNavigationItemHref(item);
                              const isExternal =
                                item.targetType === 'CUSTOM_LINK' &&
                                isExternalCustomUrl(item.customUrl);

                              return (
                                <li key={`item-${item.id}`}>
                                  <a
                                    href={href}
                                    target={isExternal ? '_blank' : undefined}
                                    rel={isExternal ? 'noopener noreferrer' : undefined}
                                    onClick={(e) => handleItemClick(e, href)}
                                    className="text-sm text-brand-dark hover:underline underline-offset-4 transition-colors duration-150 py-1.5 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 rounded-ctl"
                                  >
                                    {item.label}
                                  </a>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Mobile Navigation Drawer & Accordions (right panel under the navbar; the navbar toggle stays visible) */}
      {isMobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-x-0 bottom-0 top-14 md:top-16 z-30 bg-brand-dark/45 animate-fadeIn"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            id="navbar-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación móvil"
            className="lg:hidden fixed right-0 bottom-0 top-14 md:top-16 z-30 w-[88%] max-w-sm overflow-y-auto overscroll-contain rounded-bl-tile bg-brand-light px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-sheet animate-sheet-up motion-reduce:animate-none"
          >
            <nav className="flex flex-col gap-4" aria-label="Navegación móvil">
              <ul className="divide-y divide-brand-dark/[0.07] overflow-hidden rounded-card bg-white shadow-hairline">
                {sections.map((sec) => {
                  const isExpanded = expandedMobileSectionId === sec.id;
                  const allItems = (sec.columns || []).flatMap((col) => col.items || []);

                  return (
                    <li key={`mob-sec-${sec.id}`}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMobileSectionId((prev) => (prev === sec.id ? null : sec.id))
                        }
                        aria-expanded={isExpanded}
                        className="flex min-h-[52px] w-full cursor-pointer items-center justify-between px-4 text-left text-[17px] font-medium text-brand-dark"
                      >
                        <span>{sec.label}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`shrink-0 text-ink-muted transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="animate-fadeIn bg-sunken px-4 py-2">
                          {allItems.length === 0 ? (
                            <div className="space-y-1 py-1">
                              <p className="text-sm text-ink-muted italic">
                                No hay elementos disponibles en este momento.
                              </p>
                              <a
                                href="/#catalogo"
                                onClick={(e) => handleItemClick(e, '/#catalogo')}
                                className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark underline"
                              >
                                Ver todo el catálogo
                              </a>
                            </div>
                          ) : (
                            allItems.map((item) => {
                              const href = getNavigationItemHref(item);
                              const isExternal =
                                item.targetType === 'CUSTOM_LINK' &&
                                isExternalCustomUrl(item.customUrl);

                              return (
                                <a
                                  key={`mob-item-${item.id}`}
                                  href={href}
                                  target={isExternal ? '_blank' : undefined}
                                  rel={isExternal ? 'noopener noreferrer' : undefined}
                                  onClick={(e) => handleItemClick(e, href)}
                                  className="flex min-h-11 items-center text-[15px] text-brand-dark transition-colors hover:underline"
                                >
                                  {item.label}
                                </a>
                              );
                            })
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
                <li>
                  <a
                    href="/#catalogo"
                    onClick={(e) => handleItemClick(e, '/#catalogo')}
                    className="flex min-h-[52px] items-center justify-between px-4 text-[17px] font-medium text-brand-dark"
                  >
                    <span>Ver todo el catálogo</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </a>
                </li>
              </ul>

              <a
                href={WHATSAPP_CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand-dark text-[15px] font-semibold text-brand-sand transition-colors hover:bg-ink-soft"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
                  <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
                </svg>
                Escribinos por WhatsApp
              </a>
              <a
                href={SOCIAL_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center justify-center rounded-full text-[15px] font-medium text-ink-muted hover:text-brand-dark"
              >
                Instagram
              </a>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
