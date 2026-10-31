import { useState, useEffect } from 'react';
import { fetchProducts, fetchCategories, getApiBaseUrl } from '../../services/api';

export default function CatalogSection() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadData = async (catId = selectedCategoryId) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [fetchedProducts, fetchedCategories] = await Promise.all([
        fetchProducts({ categoryId: catId }),
        fetchCategories(),
      ]);
      setProducts(fetchedProducts);
      if (fetchedCategories && fetchedCategories.length > 0) {
        setCategories(fetchedCategories);
      }
    } catch (err) {
      setErrorMessage(
        err.message || 'No se pudo conectar con el catálogo de productos.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedCategoryId);
  }, [selectedCategoryId]);

  const handleCategorySelect = (catId) => {
    setSelectedCategoryId(catId);
  };

  return (
    <section
      id="catalogo"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24 scroll-mt-20"
      aria-label="Catálogo de productos"
    >
      {/* Header with Index Counter and Category Filter */}
      <div className="flex items-end justify-between border-b border-brand-dark/[0.08] pb-3 mb-6 sm:mb-8">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm sm:text-base font-semibold tracking-tight text-brand-dark uppercase">
            Selected Catalog
          </h2>
          <span className="text-[11px] font-mono tracking-widest text-brand-dark/40">
            [{isLoading ? '--' : products.length.toString().padStart(2, '0')}]
          </span>
        </div>

        {/* Dynamic Category Filter Tabs (Desktop & Tablet) */}
        <div className="hidden sm:flex items-center gap-5 text-xs font-medium text-brand-dark/45">
          <button
            type="button"
            onClick={() => handleCategorySelect(null)}
            className={`transition-colors cursor-pointer pb-0.5 ${
              selectedCategoryId === null
                ? 'text-brand-dark font-semibold border-b border-brand-dark'
                : 'hover:text-brand-dark'
            }`}
          >
            Shop All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategorySelect(cat.id)}
              className={`transition-colors cursor-pointer pb-0.5 ${
                selectedCategoryId === cat.id
                  ? 'text-brand-dark font-semibold border-b border-brand-dark'
                  : 'hover:text-brand-dark'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Loading State: Minimalist Skeletons */}
      {isLoading && (
        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3.5 gap-y-7 sm:gap-x-5 sm:gap-y-9 lg:gap-x-6 lg:gap-y-12"
          aria-live="polite"
          aria-busy="true"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col animate-pulse">
              <div className="aspect-[4/5] w-full bg-[#F2F2F0] rounded-xs" />
              <div className="mt-3 space-y-2">
                <div className="h-2 w-14 bg-brand-dark/10 rounded-xs" />
                <div className="h-3 w-4/5 bg-brand-dark/15 rounded-xs" />
                <div className="h-3 w-1/3 bg-brand-dark/20 rounded-xs" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Error State: Editorial Notice with Retry */}
      {!isLoading && errorMessage && (
        <div className="py-16 sm:py-20 px-6 sm:px-10 max-w-xl mx-auto text-center border border-brand-dark/10 bg-[#FAF9F6]/80 backdrop-blur-sm rounded-xs space-y-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-dark/5 text-brand-dark/60 mb-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base font-semibold tracking-tight text-brand-dark">
            Servicio de catálogo no disponible
          </h3>
          <p className="text-xs sm:text-sm text-brand-dark/60 leading-relaxed">
            {errorMessage}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => loadData(selectedCategoryId)}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark hover:opacity-85 transition-opacity rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer"
            >
              Reintentar conexión
            </button>
          </div>
        </div>
      )}

      {/* 3. Empty Catalog State */}
      {!isLoading && !errorMessage && products.length === 0 && (
        <div className="py-16 sm:py-24 text-center space-y-3">
          <p className="text-sm font-medium text-brand-dark/60">
            No hay productos disponibles en esta selección.
          </p>
          {selectedCategoryId !== null && (
            <button
              type="button"
              onClick={() => handleCategorySelect(null)}
              className="text-xs font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
            >
              Ver todos los productos
            </button>
          )}
        </div>
      )}

      {/* 4. Loaded State: Grid of Real Products */}
      {!isLoading && !errorMessage && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3.5 gap-y-7 sm:gap-x-5 sm:gap-y-9 lg:gap-x-6 lg:gap-y-12">
          {products.map((product) => (
            <article key={product.id} className="group relative flex flex-col">
              <a
                href={`/products/${product.id}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/20 rounded-xs"
                aria-label={`${product.title}${
                  product.category ? ' — ' + product.category : ''
                }, ${product.formattedPrice}`}
              >
                {/* Image Canvas (4:5 ratio, neutral light background) */}
                <div className="aspect-[4/5] w-full overflow-hidden bg-[#F2F2F0] relative">
                  <img
                    src={product.image}
                    alt={product.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] select-none"
                  />
                  {product.badge && (
                    <span className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 text-[8px] sm:text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.18em] px-1.5 py-0.5 sm:px-2 sm:py-0.5 bg-[#1D110D]/90 text-[#FAFAFA] backdrop-blur-xs">
                      {product.badge}
                    </span>
                  )}
                </div>

                {/* Product Meta */}
                <div className="mt-2.5 sm:mt-3 flex flex-col">
                  {product.category && (
                    <span className="text-[9px] sm:text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-dark/45 truncate">
                      {product.category}
                    </span>
                  )}
                  <h3 className="text-xs sm:text-[13px] md:text-sm font-medium tracking-tight text-brand-dark group-hover:text-brand-dark/70 transition-colors duration-150 mt-0.5 line-clamp-1 leading-snug">
                    {product.title}
                  </h3>
                  <p className="text-xs sm:text-[13px] md:text-sm font-semibold tracking-tight text-brand-dark tabular-nums mt-0.5">
                    {product.formattedPrice}
                  </p>
                </div>
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
