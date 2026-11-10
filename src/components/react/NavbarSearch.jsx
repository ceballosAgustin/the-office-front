import { useState, useEffect, useRef } from 'react';
import { fetchProducts } from '../../services/api';

const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 280;

export default function NavbarSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const toggleButtonRef = useRef(null);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  const trimmedQuery = query.trim();

  // Synchronize input with URL ?search= parameter on mount and URL changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialParams = new URLSearchParams(window.location.search);
    const initialSearch = initialParams.get('search')?.trim() || '';
    if (initialSearch) {
      setQuery(initialSearch);
    }

    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlSearch = params.get('search')?.trim() || '';
      setQuery(urlSearch);
    };

    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('the-office:catalog-url-change', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('the-office:catalog-url-change', syncFromUrl);
    };
  }, []);

  // Focus input automatically when search opens
  useEffect(() => {
    if (!isOpen) return;

    // Close mobile nav menu if open to avoid overlapping panels on small screens
    if (typeof document !== 'undefined') {
      const mobileMenu = document.getElementById('mobile-nav-menu');
      const mobileToggle = document.getElementById('mobile-menu-toggle');
      const iconOpen = document.getElementById('menu-icon-open');
      const iconClose = document.getElementById('menu-icon-close');
      if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
        mobileToggle?.setAttribute('aria-expanded', 'false');
        iconOpen?.classList.remove('hidden');
        iconClose?.classList.add('hidden');
      }
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 15);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Close search when clicking outside container
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Debounced search with requestId and AbortController to prevent race conditions
  const executeSearch = async (searchTerm, reqId) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchProducts({
        search: searchTerm,
        size: 8,
        signal: controller.signal,
      });

      // Ignore stale responses if a newer query was started
      if (reqId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      setResults(Array.isArray(data) ? data : []);
      setHasSearched(true);
      setIsLoading(false);
    } catch (err) {
      if (
        err?.name === 'AbortError' ||
        controller.signal.aborted ||
        reqId !== requestIdRef.current
      ) {
        return;
      }
      setError(err?.message || 'No se pudo realizar la búsqueda.');
      setResults([]);
      setHasSearched(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Invalidate any previous in-flight request immediately
    requestIdRef.current += 1;
    const currentReqId = requestIdRef.current;
    abortControllerRef.current?.abort();
    setActiveIndex(-1);

    if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const debounceTimer = setTimeout(() => {
      executeSearch(trimmedQuery, currentReqId);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [trimmedQuery]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleToggleOpen = (event) => {
    event.stopPropagation();
    setIsOpen((prev) => {
      const next = !prev;
      if (!next) {
        setActiveIndex(-1);
      }
      return next;
    });
  };

  const handleClose = (event) => {
    if (event) event.stopPropagation();
    setIsOpen(false);
    setActiveIndex(-1);
    toggleButtonRef.current?.focus();
  };

  const handleClearInput = (event) => {
    event.stopPropagation();
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    setQuery('');
    setResults([]);
    setIsLoading(false);
    setError(null);
    setHasSearched(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const buildProductResultHref = (productId) => {
    if (trimmedQuery) {
      return `/products/${productId}?search=${encodeURIComponent(trimmedQuery)}`;
    }
    return `/products/${productId}`;
  };

  const buildCatalogSearchHref = () => {
    if (!trimmedQuery) return '/#catalogo';
    return `/?search=${encodeURIComponent(trimmedQuery)}#catalogo`;
  };

  const navigateToCatalogSearch = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!trimmedQuery) return;

    const targetHref = buildCatalogSearchHref();
    setIsOpen(false);
    setActiveIndex(-1);

    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/') {
        const currentParams = new URLSearchParams(window.location.search);
        const catId = currentParams.get('categoryId');
        const nextParams = new URLSearchParams();
        if (catId) {
          nextParams.set('categoryId', catId);
        }
        nextParams.set('search', trimmedQuery);
        const nextUrl = `/?${nextParams.toString()}#catalogo`;

        window.history.pushState({}, '', nextUrl);
        window.dispatchEvent(new CustomEvent('the-office:catalog-url-change'));
        const catalogEl = document.getElementById('catalogo');
        if (catalogEl) {
          catalogEl.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        window.location.assign(targetHref);
      }
    }
  };

  const handleResultClick = (event, product) => {
    event.stopPropagation();
    setIsOpen(false);
    setActiveIndex(-1);

    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/products/')
    ) {
      event.preventDefault();
      const targetHref = buildProductResultHref(product.id);
      window.history.pushState(
        {
          productId: String(product.id),
          categoryId: null,
          search: trimmedQuery,
        },
        '',
        targetHref
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      if (results.length > 0) {
        event.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      if (results.length > 0) {
        event.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (activeIndex >= 0 && results[activeIndex]) {
        const selected = results[activeIndex];
        const targetHref = buildProductResultHref(selected.id);
        setIsOpen(false);
        setActiveIndex(-1);
        if (
          typeof window !== 'undefined' &&
          window.location.pathname.startsWith('/products/')
        ) {
          window.history.pushState(
            {
              productId: String(selected.id),
              categoryId: null,
              search: trimmedQuery,
            },
            '',
            targetHref
          );
          window.dispatchEvent(new PopStateEvent('popstate'));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (typeof window !== 'undefined') {
          window.location.assign(targetHref);
        }
        return;
      }

      if (trimmedQuery.length >= 1) {
        navigateToCatalogSearch();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Toggle Icon Button */}
      <button
        ref={toggleButtonRef}
        type="button"
        onClick={handleToggleOpen}
        aria-label={isOpen ? 'Cerrar buscador de productos' : 'Buscar productos'}
        aria-expanded={isOpen}
        aria-controls="navbar-search-panel"
        className={`relative flex items-center justify-center w-11 h-11 rounded-sm text-brand-dark transition-opacity duration-150 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 active:scale-95 cursor-pointer ${
          isOpen ? 'bg-brand-dark/[0.06]' : ''
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1D110D"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {/* Expandable Search Panel & Results Dropdown */}
      {isOpen && (
        <div
          id="navbar-search-panel"
          role="dialog"
          aria-label="Buscador de productos"
          onKeyDown={handleKeyDown}
          className="fixed left-0 right-0 top-14 md:top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] md:w-[430px] z-50 bg-[#FAFAFA] border-b sm:border border-brand-dark/15 sm:rounded-xs shadow-lg overflow-hidden"
        >
          {/* Input Bar */}
          <form
            onSubmit={navigateToCatalogSearch}
            className="flex items-center gap-2 px-3.5 py-2.5 border-b border-brand-dark/[0.08] bg-white"
            role="search"
          >
            <label htmlFor="navbar-search-input" className="sr-only">
              Buscar productos por nombre
            </label>

            <span
              className="text-brand-dark/45 shrink-0 flex items-center justify-center w-5 h-5"
              aria-hidden="true"
            >
              {isLoading ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-dark/25 border-t-brand-dark animate-spin block" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
            </span>

            <input
              ref={inputRef}
              id="navbar-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos..."
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="navbar-search-results"
              aria-activedescendant={
                activeIndex >= 0 && results[activeIndex]
                  ? `navbar-search-option-${results[activeIndex].id}`
                  : undefined
              }
              className="w-full bg-transparent text-base sm:text-sm text-brand-dark placeholder:text-brand-dark/35 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />

            {query.length > 0 && (
              <button
                type="button"
                onClick={handleClearInput}
                aria-label="Limpiar texto de búsqueda"
                className="px-1.5 py-0.5 text-[11px] font-medium text-brand-dark/45 hover:text-brand-dark transition-colors rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 cursor-pointer shrink-0"
              >
                Limpiar
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              aria-label="Cerrar buscador"
              className="flex items-center justify-center w-7 h-7 rounded-xs text-brand-dark/50 hover:text-brand-dark hover:bg-brand-dark/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </form>

          {/* Dropdown Body */}
          <div className="bg-[#FAFAFA]">
            {/* 1. Minimum characters hint */}
            {trimmedQuery.length === 1 && (
              <div className="px-4 py-5 text-center text-xs text-brand-dark/50">
                Ingresá al menos {MIN_SEARCH_LENGTH} caracteres para iniciar la búsqueda.
              </div>
            )}

            {/* 2. Loading State */}
            {trimmedQuery.length >= MIN_SEARCH_LENGTH &&
              isLoading &&
              results.length === 0 && (
                <div
                  className="px-4 py-6 text-center text-xs text-brand-dark/55"
                  aria-live="polite"
                >
                  Buscando «{trimmedQuery}»...
                </div>
              )}

            {/* 3. Error State */}
            {trimmedQuery.length >= MIN_SEARCH_LENGTH && !isLoading && error && (
              <div
                className="px-4 py-5 text-center space-y-2.5"
                role="alert"
              >
                <p className="text-xs text-red-800/90 leading-relaxed">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    requestIdRef.current += 1;
                    executeSearch(trimmedQuery, requestIdRef.current);
                  }}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark rounded-xs hover:opacity-85 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* 4. Empty Results State */}
            {trimmedQuery.length >= MIN_SEARCH_LENGTH &&
              !isLoading &&
              !error &&
              hasSearched &&
              results.length === 0 && (
                <div
                  className="px-4 py-6 text-center space-y-1"
                  aria-live="polite"
                >
                  <p className="text-xs font-medium text-brand-dark/70">
                    No se encontraron productos para «{trimmedQuery}».
                  </p>
                  <p className="text-[11px] text-brand-dark/45">
                    Intentá con otro nombre o explorá el catálogo completo.
                  </p>
                </div>
              )}

            {/* 5. Results List */}
            {trimmedQuery.length >= MIN_SEARCH_LENGTH &&
              !error &&
              results.length > 0 && (
                <>
                  <ul
                    id="navbar-search-results"
                    role="listbox"
                    aria-label="Resultados de búsqueda"
                    className="max-h-[58vh] sm:max-h-[340px] overflow-y-auto divide-y divide-brand-dark/[0.06]"
                  >
                    {results.map((product, index) => {
                      const isActive = index === activeIndex;
                      return (
                        <li
                          key={product.id}
                          id={`navbar-search-option-${product.id}`}
                          role="option"
                          aria-selected={isActive}
                        >
                          <a
                            href={buildProductResultHref(product.id)}
                            onClick={(e) => handleResultClick(e, product)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={`flex items-center gap-3.5 px-3.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-dark/30 ${
                              isActive
                                ? 'bg-brand-dark/[0.06]'
                                : 'hover:bg-brand-dark/[0.04]'
                            }`}
                          >
                            {/* Product Primary Image (4:5 ratio) */}
                            <div className="aspect-[4/5] w-11 shrink-0 overflow-hidden rounded-xs bg-[#F2F2F0] border border-brand-dark/[0.06]">
                              <img
                                src={product.image}
                                alt={product.title}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Product Name & Category */}
                            <div className="min-w-0 flex-1">
                              {product.category && (
                                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-dark/45 truncate">
                                  {product.category}
                                </p>
                              )}
                              <p className="text-xs sm:text-[13px] font-medium tracking-tight text-brand-dark truncate">
                                {product.title}
                              </p>
                            </div>

                            {/* Formatted Price */}
                            <div className="flex flex-col items-end shrink-0 tabular-nums">
                              {product.formattedPreviousPrice && (
                                <span className="text-[10px] text-brand-dark/45 line-through font-normal leading-tight">
                                  {product.formattedPreviousPrice}
                                </span>
                              )}
                              <span className="text-xs sm:text-[13px] font-semibold tracking-tight text-brand-dark">
                                {product.formattedPrice}
                              </span>
                            </div>
                          </a>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Footer Action: View All Results in Catalog */}
                  <div className="border-t border-brand-dark/[0.08] bg-white px-3.5 py-2.5">
                    <a
                      href={buildCatalogSearchHref()}
                      onClick={navigateToCatalogSearch}
                      className="flex items-center justify-between text-xs font-semibold tracking-tight text-brand-dark hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 rounded-xs py-0.5"
                    >
                      <span className="truncate pr-2">
                        Ver todos los resultados para «{trimmedQuery}»
                      </span>
                      <span className="font-mono text-[11px] text-brand-dark/50 shrink-0">
                        [{results.length}] →
                      </span>
                    </a>
                  </div>
                </>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
