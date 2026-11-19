import { useCallback, useEffect, useRef, useState } from 'react';
import ProductGridCard from './ProductGridCard';
import { getNewInProducts } from './newInStore';

// Card width: ~2.2 cards on phones (peek of the next one), 3 on sm, 4 on lg (gap-6 = 1.5rem)
const ITEM_CLASSES =
  'w-[44%] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-3*1.5rem)/4)]';

/**
 * Home "Recién ingresados" section: up to 20 products picked and ordered by the admin
 * (product form → "Mostrar en Recién ingresados" + position), shown as a horizontal snap carousel.
 * Renders nothing when the admin hasn't picked any product, so the home never shows an empty block.
 */
export default function NewInSection() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const trackRef = useRef(null);
  const [scrollState, setScrollState] = useState({ overflow: false, atStart: true, atEnd: true });

  useEffect(() => {
    let cancelled = false;
    getNewInProducts()
      .then((list) => {
        if (cancelled) return;
        setProducts(list);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth > 2;
    const atStart = el.scrollLeft <= 2;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setScrollState((prev) =>
      prev.overflow === overflow && prev.atStart === atStart && prev.atEnd === atEnd
        ? prev
        : { overflow, atStart, atEnd }
    );
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || status !== 'ready') return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [status, products, updateScrollState]);

  const scrollByPage = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? 'auto' : 'smooth' });
  };

  // Hide the whole section when it has nothing to show (or the API failed: the catalog below still works)
  if (status === 'error' || (status === 'ready' && products.length === 0)) {
    return null;
  }

  const arrowClass =
    'size-11 place-items-center rounded-full bg-white shadow-hairline transition duration-150 hover:shadow-card active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark';

  return (
    <section
      id="recien-ingresados"
      className="mx-auto max-w-7xl px-4 pt-12 pb-8 sm:px-6 sm:pt-16 sm:pb-10 lg:px-8 lg:pt-20 scroll-mt-20"
      aria-label="Recién ingresados"
    >
      <div className="mb-5 flex items-end justify-between gap-3 sm:mb-8">
        <div className="min-w-0">
          <h2 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-brand-dark sm:text-[2rem]">
            Recién ingresados
          </h2>
          <p className="mt-1 text-[15px] text-ink-muted">Lo último que llegó a The Office.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="#catalogo"
            className="inline-flex h-11 items-center px-1 text-sm font-semibold text-brand-dark underline-offset-4 hover:underline sm:mr-1"
          >
            Ver todo
          </a>
          {status === 'ready' && scrollState.overflow && (
            <>
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={scrollState.atStart}
                aria-label="Ver productos anteriores"
                className={`hidden lg:grid ${arrowClass}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                disabled={scrollState.atEnd}
                aria-label="Ver productos siguientes"
                className={`hidden lg:grid ${arrowClass}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div
        ref={trackRef}
        role="region"
        aria-label="Productos recién ingresados"
        aria-busy={status === 'loading'}
        tabIndex={0}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-4 sm:-mx-6 sm:gap-5 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:gap-6 lg:scroll-px-0 lg:px-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark"
      >
        {status === 'loading' ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${ITEM_CLASSES} animate-pulse`}>
              <div className="aspect-[4/5] w-full rounded-card bg-sunken" />
              <div className="mt-3 space-y-2">
                <div className="h-3 w-1/3 rounded-full bg-sunken" />
                <div className="h-4 w-4/5 rounded-full bg-sunken" />
                <div className="h-4 w-1/3 rounded-full bg-sunken" />
              </div>
            </div>
          ))
        ) : (
          <>
            {products.map((product, idx) => (
              <div key={product.id} className={ITEM_CLASSES}>
                <ProductGridCard
                  product={product}
                  href={`/products/${encodeURIComponent(product.id)}`}
                  imageLoading={idx < 2 ? 'eager' : 'lazy'}
                  isNew
                />
              </div>
            ))}
            <div className={ITEM_CLASSES}>
              <a
                href="#catalogo"
                className="group flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-card bg-brand-dark p-4 text-center transition-colors duration-150 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark"
              >
                <span className="text-[15px] font-semibold text-brand-sand">Ver todo el catálogo</span>
                <span
                  className="grid size-11 place-items-center rounded-full bg-brand-sand text-brand-dark transition-transform duration-300 ease-ios group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
