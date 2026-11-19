import { useEffect, useState } from 'react';
import { fetchNewInProducts, MAX_NEW_IN_PRODUCTS } from '../../services/api';
import ProductGridCard from './ProductGridCard';

/**
 * Home "Recién ingresados" section: up to 20 products picked and ordered by the admin
 * (product form → "Mostrar en Recién ingresados" + position).
 * Renders nothing when the admin hasn't picked any product, so the home never shows an empty block.
 */
export default function NewInSection() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;
    fetchNewInProducts()
      .then((list) => {
        if (cancelled) return;
        setProducts(list.slice(0, MAX_NEW_IN_PRODUCTS));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the whole section when it has nothing to show (or the API failed: the catalog below still works)
  if (status === 'error' || (status === 'ready' && products.length === 0)) {
    return null;
  }

  return (
    <section
      id="recien-ingresados"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20 scroll-mt-20"
      aria-label="Recién ingresados"
    >
      <div className="flex items-end justify-between gap-3 border-b border-brand-dark/[0.08] pb-3 mb-6 sm:mb-8">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm sm:text-base font-semibold tracking-tight text-brand-dark uppercase">
            Recién ingresados
          </h2>
          <span className="text-[11px] font-mono tracking-widest text-brand-dark/40">
            [{status === 'loading' ? '--' : String(products.length).padStart(2, '0')}]
          </span>
        </div>
        <a
          href="#catalogo"
          className="text-xs font-semibold tracking-tight text-brand-dark/70 hover:text-brand-dark border-b border-brand-dark/30 hover:border-brand-dark pb-0.5 transition-colors"
        >
          Ver todo el catálogo
        </a>
      </div>

      {status === 'loading' ? (
        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3.5 gap-y-7 sm:gap-x-5 sm:gap-y-9 lg:gap-x-6 lg:gap-y-12"
          aria-busy="true"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <div className="aspect-[4/5] w-full bg-brand-dark/5 rounded-xs animate-pulse" />
              <div className="h-3 w-1/3 bg-brand-dark/5 rounded-xs animate-pulse" />
              <div className="h-3 w-2/3 bg-brand-dark/5 rounded-xs animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3.5 gap-y-7 sm:gap-x-5 sm:gap-y-9 lg:gap-x-6 lg:gap-y-12">
          {products.map((product, idx) => (
            <ProductGridCard
              key={product.id}
              product={product}
              href={`/products/${encodeURIComponent(product.id)}`}
              imageLoading={idx < 4 ? 'eager' : 'lazy'}
            />
          ))}
        </div>
      )}
    </section>
  );
}
