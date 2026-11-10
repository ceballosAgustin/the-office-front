import { useState, useEffect, useRef } from 'react';
import ProductGallery from './ProductGallery';
import ProductPurchaseSection from './ProductPurchaseSection';
import { fetchProductById, fetchProducts, formatPrice } from '../../services/api';

function parseLocationState(fallbackProductId) {
  if (typeof window === 'undefined') {
    return {
      productId: String(fallbackProductId || ''),
      categoryId: null,
      search: '',
    };
  }

  const match = window.location.pathname.match(/\/products\/([^/?#]+)/);
  const resolvedProductId =
    match && match[1]
      ? decodeURIComponent(match[1])
      : String(fallbackProductId || '');

  const params = new URLSearchParams(window.location.search);
  const rawCat = params.get('categoryId');
  const parsedCat =
    rawCat !== null && rawCat.trim() !== '' && Number.isFinite(Number(rawCat))
      ? Number(rawCat)
      : null;
  const rawSearch = params.get('search') ? params.get('search').trim() : '';

  return {
    productId: resolvedProductId,
    categoryId: parsedCat,
    search: rawSearch,
  };
}

function buildProductHref(targetId, categoryId = null, search = '') {
  const params = new URLSearchParams();
  if (categoryId !== null && categoryId !== undefined) {
    params.set('categoryId', String(categoryId));
  }
  if (search) {
    params.set('search', search);
  }
  const query = params.toString();
  return query ? `/products/${targetId}?${query}` : `/products/${targetId}`;
}

export default function ProductDetailView({ productId }) {
  const [navState, setNavState] = useState(() => ({
    productId: String(productId || ''),
    categoryId: null,
    search: '',
  }));

  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [catalogList, setCatalogList] = useState([]);
  const [effectiveCategoryId, setEffectiveCategoryId] = useState(null);
  const [effectiveSearch, setEffectiveSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cache catalog collections by context key to avoid redundant list requests when moving between products
  const collectionCacheRef = useRef(new Map());

  const fetchCollectionForContext = async (categoryId, search) => {
    const key = `${categoryId ?? 'all'}|${search || ''}`;
    if (collectionCacheRef.current.has(key)) {
      return collectionCacheRef.current.get(key);
    }
    const list = await fetchProducts({
      categoryId: categoryId ?? undefined,
      search: search || undefined,
    });
    collectionCacheRef.current.set(key, list);
    return list;
  };

  const loadProductAndContext = async (targetState) => {
    const currentId = String(targetState.productId || '');
    if (!currentId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [productData, contextualList] = await Promise.all([
        fetchProductById(currentId),
        fetchCollectionForContext(targetState.categoryId, targetState.search).catch(
          () => []
        ),
      ]);

      setProduct(productData);
      setSelectedVariant(null);
      if (typeof document !== 'undefined' && productData?.title) {
        document.title = `${productData.title} — The Office BA`;
      }

      const indexInContext = contextualList.findIndex(
        (item) => String(item.id) === currentId
      );

      if (
        indexInContext === -1 &&
        (targetState.categoryId !== null || Boolean(targetState.search))
      ) {
        // Fallback to general catalog if the product does not belong to the requested filter context
        const generalList = await fetchCollectionForContext(null, '').catch(
          () => []
        );
        setCatalogList(generalList);
        setEffectiveCategoryId(null);
        setEffectiveSearch('');
      } else {
        setCatalogList(contextualList);
        setEffectiveCategoryId(targetState.categoryId);
        setEffectiveSearch(targetState.search);
      }
    } catch (err) {
      setError({
        message: err.message || 'Error al obtener el producto.',
        isNotFound: err.isNotFound || false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sync with browser URL on mount and browser Back/Forward (popstate)
  useEffect(() => {
    const syncFromLocation = () => {
      const parsed = parseLocationState(productId);
      setNavState(parsed);
    };

    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, [productId]);

  useEffect(() => {
    const resolved =
      typeof window !== 'undefined' ? parseLocationState(navState.productId) : navState;
    loadProductAndContext(resolved);
  }, [navState.productId, navState.categoryId, navState.search]);

  const currentIndex = catalogList.findIndex(
    (item) => String(item.id) === String(product?.id ?? navState.productId)
  );
  const previousProduct =
    currentIndex > 0 ? catalogList[currentIndex - 1] : null;
  const nextProduct =
    currentIndex !== -1 && currentIndex < catalogList.length - 1
      ? catalogList[currentIndex + 1]
      : null;

  const handleNavigateToProduct = (event, targetProduct) => {
    if (!targetProduct) return;

    // Allow standard browser behavior for middle-click or modifier keys (open in new tab/window)
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    const nextHref = buildProductHref(
      targetProduct.id,
      effectiveCategoryId,
      effectiveSearch
    );

    if (typeof window !== 'undefined') {
      window.history.pushState(
        {
          productId: String(targetProduct.id),
          categoryId: effectiveCategoryId,
          search: effectiveSearch,
        },
        '',
        nextHref
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setNavState({
      productId: String(targetProduct.id),
      categoryId: effectiveCategoryId,
      search: effectiveSearch,
    });
  };

  const catalogBackHref = (() => {
    const params = new URLSearchParams();
    if (effectiveCategoryId !== null && effectiveCategoryId !== undefined) {
      params.set('categoryId', String(effectiveCategoryId));
    }
    if (effectiveSearch && effectiveSearch.trim()) {
      params.set('search', effectiveSearch.trim());
    }
    const queryStr = params.toString();
    return queryStr ? `/?${queryStr}#catalogo` : '/#catalogo';
  })();

  const categoryBreadcrumbHref = product?.categoryId
    ? `/?categoryId=${encodeURIComponent(product.categoryId)}#catalogo`
    : '/#catalogo';

  // 1. Loading Skeleton State
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-14 animate-pulse">
        {/* Top Bar Skeleton */}
        <div className="flex items-center justify-between pb-3.5 mb-6 sm:mb-8 border-b border-brand-dark/[0.08]">
          <div className="h-3 w-48 bg-brand-dark/10 rounded-xs" />
          <div className="h-7 w-40 bg-brand-dark/10 rounded-xs" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          {/* Gallery Skeleton (Left 58%) */}
          <div className="lg:col-span-7 w-full aspect-[4/5] bg-[#F2F2F0] rounded-xs" />

          {/* Meta & Purchase Skeleton (Right 42%) */}
          <div className="lg:col-span-5 w-full space-y-6">
            <div className="space-y-3 pb-5 border-b border-brand-dark/[0.08]">
              <div className="h-3 w-20 bg-brand-dark/10 rounded-xs" />
              <div className="h-8 w-4/5 bg-brand-dark/15 rounded-xs" />
              <div className="h-6 w-1/3 bg-brand-dark/20 rounded-xs" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-brand-dark/10 rounded-xs" />
              <div className="h-3 w-5/6 bg-brand-dark/10 rounded-xs" />
            </div>
            <div className="h-11 w-full bg-brand-dark/10 rounded-xs mt-6" />
          </div>
        </div>
      </div>
    );
  }

  // 2. 404 / Not Found State
  if (error && error.isNotFound) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/40">
          Error 404
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark">
          Producto no encontrado
        </h1>
        <p className="text-sm text-brand-dark/60 max-w-md mx-auto leading-relaxed">
          El artículo con identificador <span className="font-mono">#{navState.productId}</span> no existe en el catálogo o no está disponible en este momento.
        </p>
        <div className="pt-4">
          <a
            href="/#catalogo"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark px-5 py-2.5 rounded-xs hover:opacity-85 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
          >
            ← Volver al catálogo completo
          </a>
        </div>
      </div>
    );
  }

  // 3. Network or Server Error State
  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-dark/5 text-brand-dark/60 mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-dark">
          No se pudo cargar la información del producto
        </h1>
        <p className="text-xs sm:text-sm text-brand-dark/65 max-w-md mx-auto leading-relaxed">
          {error.message}
        </p>
        <div className="pt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => loadProductAndContext(navState)}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark hover:opacity-85 transition-opacity rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer"
          >
            Reintentar
          </button>
          <a
            href="/#catalogo"
            className="text-xs font-semibold text-brand-dark hover:opacity-70 transition-opacity"
          >
            Ir al catálogo
          </a>
        </div>
      </div>
    );
  }

  const renderProductSequenceControls = () => {
    if (catalogList.length === 0 || currentIndex === -1) return null;

    return (
      <nav
        aria-label="Navegación entre productos"
        className="flex items-center justify-between sm:justify-end gap-2 sm:gap-2.5"
      >
        <span
          className="text-[11px] font-mono tracking-wider text-brand-dark/40 tabular-nums mr-1 select-none"
          aria-live="polite"
        >
          {effectiveCategoryId !== null && product?.category
            ? `${product.category} · `
            : ''}
          {effectiveSearch ? `«${effectiveSearch}» · ` : ''}
          {currentIndex + 1} / {catalogList.length}
        </span>

        <div className="inline-flex items-center gap-1.5">
          {previousProduct ? (
            <a
              href={buildProductHref(
                previousProduct.id,
                effectiveCategoryId,
                effectiveSearch
              )}
              onClick={(e) => handleNavigateToProduct(e, previousProduct)}
              aria-label={`Producto anterior: ${previousProduct.title}`}
              title={previousProduct.title}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium tracking-tight text-brand-dark/75 hover:text-brand-dark hover:bg-brand-dark/[0.04] border border-brand-dark/15 rounded-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Anterior</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-label="Sin producto anterior"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium tracking-tight text-brand-dark/25 border border-brand-dark/[0.07] rounded-xs cursor-not-allowed select-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Anterior</span>
            </button>
          )}

          {nextProduct ? (
            <a
              href={buildProductHref(
                nextProduct.id,
                effectiveCategoryId,
                effectiveSearch
              )}
              onClick={(e) => handleNavigateToProduct(e, nextProduct)}
              aria-label={`Producto siguiente: ${nextProduct.title}`}
              title={nextProduct.title}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium tracking-tight text-brand-dark/75 hover:text-brand-dark hover:bg-brand-dark/[0.04] border border-brand-dark/15 rounded-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
            >
              <span>Siguiente</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-label="Sin producto siguiente"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium tracking-tight text-brand-dark/25 border border-brand-dark/[0.07] rounded-xs cursor-not-allowed select-none"
            >
              <span>Siguiente</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </nav>
    );
  };

  // 4. Loaded Product Detail
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-14">
      {/* Top Bar: Breadcrumbs & Previous/Next Product Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 mb-6 sm:mb-8 border-b border-brand-dark/[0.08]">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center flex-wrap gap-2 text-xs text-brand-dark/50">
            <li>
              <a
                href="/"
                className="hover:text-brand-dark transition-colors duration-150 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
              >
                Home
              </a>
            </li>
            <li aria-hidden="true" className="select-none text-brand-dark/30">
              /
            </li>
            <li>
              <a
                href={categoryBreadcrumbHref}
                className="hover:text-brand-dark transition-colors duration-150 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
              >
                {product.category}
              </a>
            </li>
            <li aria-hidden="true" className="select-none text-brand-dark/30">
              /
            </li>
            <li
              className="font-medium text-brand-dark truncate max-w-[200px] sm:max-w-none"
              aria-current="page"
            >
              {product.title}
            </li>
          </ol>
        </nav>

        {renderProductSequenceControls()}
      </div>

      {/* Main Product Layout (2 columns in desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
        {/* Left Column: Image Gallery (58% width in desktop) */}
        <section className="lg:col-span-7 w-full" aria-label="Galería de imágenes">
          <ProductGallery
            key={product.id}
            images={product.images}
            title={product.title}
          />
        </section>

        {/* Right Column: Product Meta, Selection & Purchase (42% width) */}
        <section
          className="lg:col-span-5 w-full lg:sticky lg:top-24 space-y-6"
          aria-label="Información del producto"
        >
          {/* Header Info */}
          <div className="space-y-2 border-b border-brand-dark/[0.08] pb-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/50">
                {product.category}
              </span>
              {product.badge && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] px-2 py-0.5 bg-brand-dark text-[#FAFAFA] rounded-xs">
                  {product.badge}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-brand-dark leading-[1.1]">
              {product.title}
            </h1>

            <p className="text-xl sm:text-2xl font-semibold tracking-tight text-brand-dark tabular-nums pt-1 flex flex-wrap items-baseline gap-2.5">
              {product.formattedPreviousPrice && (
                <span className="text-base sm:text-lg text-brand-dark/45 line-through font-normal">
                  {product.formattedPreviousPrice}
                </span>
              )}
              <span>
                {selectedVariant &&
                selectedVariant.price != null &&
                Number(selectedVariant.price) > 0
                  ? selectedVariant.formattedPrice || formatPrice(selectedVariant.price)
                  : product.formattedPrice}
              </span>
            </p>
          </div>

          {/* Editorial Description */}
          {product.description && (
            <div className="space-y-3">
              <h2 className="sr-only">Descripción</h2>
              <p className="text-sm sm:text-[15px] text-brand-dark/75 leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Interactive Purchase Section (Sizes, Variants, Add to Cart) */}
          <ProductPurchaseSection
            key={product.id}
            product={product}
            onVariantChange={setSelectedVariant}
          />

          {/* Shipping & Support Micro-info */}
          <div className="border-t border-brand-dark/[0.08] pt-4 grid grid-cols-2 gap-3 text-[11px] text-brand-dark/50">
            <div className="space-y-0.5">
              <p className="font-medium text-brand-dark/80">Envíos a todo el país</p>
              <p>Despacho seguro desde Buenos Aires</p>
            </div>
            <div className="space-y-0.5">
              <p className="font-medium text-brand-dark/80">Cambios y garantía</p>
              <p>Hasta 30 días para cambios de talle</p>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Footer Navigation: Back to Catalog & Product Sequence Controls */}
      <div className="mt-16 pt-8 border-t border-brand-dark/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <a
          href={catalogBackHref}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-tight text-brand-dark hover:text-brand-dark/60 transition-colors duration-150 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
        >
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
            className="shrink-0"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {effectiveSearch
            ? `Volver a resultados de «${effectiveSearch}»`
            : effectiveCategoryId !== null && product?.category
              ? `Volver a ${product.category}`
              : 'Volver al catálogo completo'}
        </a>

        {renderProductSequenceControls()}
      </div>
    </div>
  );
}
