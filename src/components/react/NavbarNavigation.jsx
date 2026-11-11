import { useState, useEffect, useRef } from 'react';
import {
  fetchPublicNavigation,
  getNavigationItemHref,
  isExternalCustomUrl,
  isCatalogHref,
} from '../../services/api';

/**
 * Editorial contextual cards for the mega-menu floating panel
 */
function getSectionEditorial(code, label) {
  const c = (code || '').toLowerCase();
  if (c === 'brands') {
    return {
      tag: 'The Office BA',
      title: 'Curaduría de Marcas Urbanas',
      desc: 'Piezas exclusivas de marcas globales seleccionadas con criterio de calidad, autenticidad y siluetas contemporáneas.',
      cta: 'Explorar colección completa →',
      href: '/#catalogo',
    };
  }
  if (c === 'sneakers') {
    return {
      tag: 'Footwear Archive',
      title: 'Calzado Urbano Contemporáneo',
      desc: 'Selección de pares emblemáticos y lanzamientos limitados con verificación y disponibilidad inmediata.',
      cta: 'Ver catálogo de calzado →',
      href: '/#catalogo',
    };
  }
  if (c === 'streetwear') {
    return {
      tag: 'Streetwear Studio',
      title: 'Indumentaria Estructurada',
      desc: 'Prendas pesadas, calces boxy y siluetas contemporáneas desarrolladas con atención al detalle y alta durabilidad.',
      cta: 'Ver indumentaria disponible →',
      href: '/#catalogo',
    };
  }
  if (c === 'accessories') {
    return {
      tag: 'Objects & Details',
      title: 'Detalles y Objetos de Autor',
      desc: 'Complementos concebidos para acompañar el estilo diario de The Office BA. Nuevos ingresos se publican periódicamente.',
      cta: 'Ver accesorios disponibles →',
      href: '/#catalogo',
    };
  }
  return {
    tag: 'The Office BA',
    title: label || 'Colección Oficial',
    desc: 'Piezas exclusivas seleccionadas con criterio de autenticidad, calidad y diseño contemporáneo.',
    cta: 'Ver todas las piezas →',
    href: '/#catalogo',
  };
}

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
        className="hidden lg:flex items-center justify-center gap-6 xl:gap-8"
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
                className={`text-[13px] font-medium tracking-tight py-2 transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/20 rounded-xs cursor-pointer inline-flex items-center gap-1.5 ${
                  isActive
                    ? 'text-brand-dark font-semibold'
                    : 'text-brand-dark/70 hover:text-brand-dark'
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
                    isActive ? 'rotate-180 text-brand-dark' : 'text-brand-dark/40'
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
          className="fixed left-0 right-0 top-14 md:top-16 z-30 bg-[#FAFAFA]/95 backdrop-blur-md border-b border-brand-dark/[0.08] shadow-lg animate-fadeIn transition-all duration-200"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-10">
            {/* Grid container */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Check if section has any columns / items */}
              {(!activeSection.columns || activeSection.columns.length === 0) ? (
                <div className="md:col-span-8 space-y-3 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
                    {activeSection.label}
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-dark/65 max-w-md">
                    Actualmente no hay elementos disponibles en esta sección.
                  </p>
                  <a
                    href="/#catalogo"
                    onClick={(e) => handleItemClick(e, '/#catalogo')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-dark underline underline-offset-4 hover:opacity-70 transition-opacity"
                  >
                    Ver todo el catálogo →
                  </a>
                </div>
              ) : (
                <>
                  {/* Dynamic Columns Rendering */}
                  {activeSection.columns.map((col) => {
                    const isBrandsSection = activeSection.code?.toLowerCase() === 'brands';
                    const colSpan = activeSection.columns.length === 1 ? 'md:col-span-8' : 'md:col-span-4';
                    const columnHeader = isBrandsSection
                      ? col.columnIndex === 0
                        ? 'Featured Brands'
                        : 'Explore Brands'
                      : activeSection.columns.length > 1
                      ? `Colección ${col.columnIndex + 1}`
                      : 'Colección & Siluetas';

                    return (
                      <div key={`col-${col.columnIndex}`} className={`${colSpan} space-y-3`}>
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
                          {columnHeader}
                        </h3>
                        <ul className="space-y-2">
                          {(!col.items || col.items.length === 0) ? (
                            <li>
                              <span className="text-xs text-brand-dark/40 italic">
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
                                    className="text-xs sm:text-sm text-brand-dark/75 hover:text-brand-dark transition-colors duration-150 py-1 block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
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

              {/* Editorial Context Card */}
              {(() => {
                const editorial = getSectionEditorial(activeSection.code, activeSection.label);
                return (
                  <div className="md:col-span-4 p-5 bg-white/80 border border-brand-dark/[0.08] rounded-xs space-y-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-brand-dark/40">
                      {editorial.tag}
                    </span>
                    <h4 className="text-sm font-semibold tracking-tight text-brand-dark">
                      {editorial.title}
                    </h4>
                    <p className="text-xs text-brand-dark/65 leading-relaxed">
                      {editorial.desc}
                    </p>
                    <div className="pt-2">
                      <a
                        href={editorial.href}
                        onClick={(e) => handleItemClick(e, editorial.href)}
                        className="text-xs font-semibold tracking-tight text-brand-dark underline underline-offset-4 hover:opacity-70 transition-opacity"
                      >
                        {editorial.cta}
                      </a>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 3. Mobile Navigation Drawer & Accordions */}
      {isMobileOpen && (
        <div
          id="navbar-mobile-drawer"
          role="dialog"
          aria-label="Menú de navegación móvil"
          className="lg:hidden fixed left-0 right-0 top-14 md:top-16 bottom-0 z-30 bg-[#FAFAFA]/98 backdrop-blur-md overflow-y-auto px-5 py-6 border-t border-brand-dark/[0.08] animate-fadeIn"
        >
          <nav className="flex flex-col space-y-2" aria-label="Navegación móvil">
            {sections.map((sec) => {
              const isExpanded = expandedMobileSectionId === sec.id;
              const allItems = (sec.columns || []).flatMap((col) => col.items || []);

              return (
                <div key={`mob-sec-${sec.id}`} className="border-b border-brand-dark/[0.06] pb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMobileSectionId((prev) => (prev === sec.id ? null : sec.id))
                    }
                    aria-expanded={isExpanded}
                    className="w-full flex items-center justify-between py-3 text-sm font-semibold text-brand-dark uppercase tracking-wider cursor-pointer"
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
                      className={`shrink-0 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="pl-3 pb-3 space-y-2 animate-fadeIn">
                      {allItems.length === 0 ? (
                        <div className="space-y-2 py-1">
                          <p className="text-xs text-brand-dark/50 italic">
                            No hay elementos disponibles en este momento.
                          </p>
                          <a
                            href="/#catalogo"
                            onClick={(e) => handleItemClick(e, '/#catalogo')}
                            className="text-xs font-semibold text-brand-dark underline"
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
                              className="block py-1.5 text-xs text-brand-dark/75 hover:text-brand-dark transition-colors"
                            >
                              {item.label}
                            </a>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* General Direct Link */}
            <div className="pt-4">
              <a
                href="/#catalogo"
                onClick={(e) => handleItemClick(e, '/#catalogo')}
                className="w-full py-3 px-4 flex items-center justify-between bg-brand-dark text-[#FAFAFA] rounded-xs text-xs font-semibold uppercase tracking-wider"
              >
                <span>Ver todo el catálogo</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
