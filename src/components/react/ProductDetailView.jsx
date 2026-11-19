import { useState, useEffect, useRef } from 'react';
import ProductGallery from './ProductGallery';
import ProductPurchaseSection from './ProductPurchaseSection';
import {
  fetchProductById,
  fetchProducts,
  formatPrice,
  buildCatalogHref,
  parsePositiveIntId,
  safeDecodeURIComponent,
} from '../../services/api';

function parseLocationState(fallbackProductId) {
  if (typeof window === 'undefined') {
    return {
      productId: String(fallbackProductId || ''),
      category: null,
      categoryId: null,
      brand: '',
      gender: null,
      size: null,
      search: '',
    };
  }

  const params = new URLSearchParams(window.location.search);
  const queryId = parsePositiveIntId(params.get('id'));

  const match = window.location.pathname.match(/\/products\/([^/?#]+)/);
  const pathId =
    match && match[1] && match[1].toLowerCase() !== 'fallback'
      ? parsePositiveIntId(safeDecodeURIComponent(match[1]))
      : null;
  // Only numeric ids are valid; anything else resolves to '' (shown as "Producto no especificado")
  const resolvedProductId = String(
    pathId ?? queryId ?? parsePositiveIntId(String(fallbackProductId || '')) ?? ''
  );

  // Category slug / legacy categoryId / fromCategory
  const rawCatSlug =
    params.get('category')?.trim().toLowerCase() ||
    params.get('fromCategory')?.trim().toLowerCase() ||
    null;

  const rawCatId =
    params.get('categoryId') ||
    (rawCatSlug && Number.isFinite(Number(rawCatSlug)) ? rawCatSlug : null);
  const parsedCatId =
    rawCatId !== null && String(rawCatId).trim() !== '' && Number.isFinite(Number(rawCatId))
      ? Number(rawCatId)
      : null;

  const resolvedCatSlug =
    rawCatSlug && !Number.isFinite(Number(rawCatSlug)) ? rawCatSlug : null;

  // Brand / fromBrand
  const rawBrand =
    params.get('brand')?.trim().toLowerCase() ||
    params.get('fromBrand')?.trim().toLowerCase() ||
    '';

  // Gender / fromGender
  const rawGender =
    params.get('gender')?.trim().toUpperCase() ||
    params.get('fromGender')?.trim().toUpperCase() ||
    null;
  const parsedGender =
    rawGender === 'MEN' || rawGender === 'WOMEN' || rawGender === 'UNISEX'
      ? rawGender
      : null;

  // Size / fromSize / variantSize
  const rawSize =
    params.get('size')?.trim() ||
    params.get('fromSize')?.trim() ||
    params.get('variantSize')?.trim() ||
    null;

  // Search / fromSearch
  const rawSearch =
    params.get('search')?.trim() ||
    params.get('fromSearch')?.trim() ||
    '';

  return {
    productId: resolvedProductId,
    category: resolvedCatSlug,
    categoryId: parsedCatId,
    brand: rawBrand,
    gender: parsedGender,
    size: rawSize,
    search: rawSearch,
  };
}

function buildProductHref(targetId, context = {}) {
  const params = new URLSearchParams();
  if (context.category) {
    params.set('category', context.category);
    params.set('fromCategory', context.category);
  } else if (context.categoryId != null) {
    params.set('categoryId', String(context.categoryId));
    params.set('fromCategory', String(context.categoryId));
  }
  if (context.brand) {
    params.set('brand', context.brand);
    params.set('fromBrand', context.brand);
  }
  if (context.gender) {
    params.set('gender', context.gender.toLowerCase());
    params.set('fromGender', context.gender.toLowerCase());
  }
  if (context.size) {
    params.set('size', context.size);
    params.set('fromSize', context.size);
  }
  if (context.search) {
    params.set('search', context.search);
    params.set('fromSearch', context.search);
  }
  const query = params.toString();
  return query ? `/products/${targetId}?${query}` : `/products/${targetId}`;
}

function updateProductMeta(product) {
  if (typeof document === 'undefined') return;

  const CANONICAL_ORIGIN = 'https://theofficeba.ar';
  let linkCanonical = document.querySelector('link[rel="canonical"]');
  let metaOgUrl = document.querySelector('meta[property="og:url"]');

  if (product && product.id) {
    const canonicalHref = `${CANONICAL_ORIGIN}/products/${product.id}`;

    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalHref);

    if (!metaOgUrl) {
      metaOgUrl = document.createElement('meta');
      metaOgUrl.setAttribute('property', 'og:url');
      document.head.appendChild(metaOgUrl);
    }
    metaOgUrl.setAttribute('content', canonicalHref);

    if (product.title) {
      document.title = `${product.title} — The Office BA`;
      const metaOgTitle = document.querySelector('meta[property="og:title"]');
      if (metaOgTitle) {
        metaOgTitle.setAttribute('content', `${product.title} — The Office BA`);
      }
      const metaTwitterTitle = document.querySelector('meta[name="twitter:title"]');
      if (metaTwitterTitle) {
        metaTwitterTitle.setAttribute('content', `${product.title} — The Office BA`);
      }
    }
  } else {
    // If product does not exist, remove any canonical/og:url to avoid presenting it as a valid product
    if (linkCanonical) {
      linkCanonical.remove();
    }
    if (metaOgUrl) {
      metaOgUrl.remove();
    }
    document.title = 'Producto no encontrado — The Office BA';
  }
}

/**
 * @param {Object} [props]
 * @param {string|number} [props.productId]
 */
export default function ProductDetailView({ productId = '' } = {}) {
  const [navState, setNavState] = useState(() => ({
    productId: String(productId || ''),
    category: null,
    categoryId: null,
    brand: '',
    gender: null,
    size: null,
    search: '',
  }));

  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [catalogList, setCatalogList] = useState([]);
  const [effectiveContext, setEffectiveContext] = useState(() => ({
    category: null,
    categoryId: null,
    brand: '',
    gender: null,
    size: null,
    search: '',
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cache catalog collections by context key to avoid redundant list requests when moving between products
  const collectionCacheRef = useRef(new Map());

  const fetchCollectionForContext = async (ctx) => {
    const key = `${ctx.category || ctx.categoryId || 'all'}|${ctx.brand || 'all'}|${ctx.gender || 'all'}|${ctx.size || 'all'}|${ctx.search || ''}`;
    if (collectionCacheRef.current.has(key)) {
      return collectionCacheRef.current.get(key);
    }
    const list = await fetchProducts({
      category: ctx.category || undefined,
      categoryId: ctx.category ? undefined : (ctx.categoryId ?? undefined),
      brand: ctx.brand || undefined,
      gender: ctx.gender || undefined,
      variantSize: ctx.size || undefined,
      search: ctx.search || undefined,
      size: 50,
      page: 0,
    });
    collectionCacheRef.current.set(key, list);
    return list;
  };

  // Request id guard: only the latest navigation's result is applied
  const loadReqIdRef = useRef(0);

  const loadProductAndContext = async (targetState) => {
    loadReqIdRef.current += 1;
    const reqId = loadReqIdRef.current;
    const isStale = () => reqId !== loadReqIdRef.current;

    const currentId = String(targetState.productId || '');
    if (!currentId) {
      setIsLoading(false);
      setError({
        message: 'Producto no especificado.',
        isNotFound: true,
      });
      updateProductMeta(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [productData, contextualList] = await Promise.all([
        fetchProductById(currentId),
        fetchCollectionForContext(targetState).catch(() => []),
      ]);
      if (isStale()) return;

      setProduct(productData);
      setSelectedVariant(null);
      updateProductMeta(productData);
      if (typeof document !== 'undefined' && productData?.title) {
        document.title = `${productData.title} — The Office BA`;
      }

      const indexInContext = contextualList.findIndex(
        (item) => String(item.id) === currentId
      );

      const hasSpecificFilters = Boolean(
        targetState.category ||
        targetState.categoryId !== null ||
        targetState.search ||
        targetState.brand ||
        targetState.gender ||
        targetState.size
      );

      if (indexInContext === -1 && hasSpecificFilters) {
        // Fallback to general catalog for sequence list only, but preserve origin filter context
        const generalList = await fetchCollectionForContext({}).catch(() => []);
        if (isStale()) return;
        setCatalogList(generalList);
        setEffectiveContext({
          category: targetState.category,
          categoryId: targetState.categoryId,
          brand: targetState.brand || '',
          gender: targetState.gender,
          size: targetState.size,
          search: targetState.search,
        });
      } else {
        setCatalogList(contextualList);
        setEffectiveContext({
          category: targetState.category,
          categoryId: targetState.categoryId,
          brand: targetState.brand || '',
          gender: targetState.gender,
          size: targetState.size,
          search: targetState.search,
        });
      }
    } catch (err) {
      if (isStale()) return;
      setError({
        message: err.message || 'Error al obtener el producto.',
        isNotFound: err.isNotFound || false,
      });
      updateProductMeta(null);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
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
  }, [
    navState.productId,
    navState.category,
    navState.categoryId,
    navState.brand,
    navState.gender,
    navState.size,
    navState.search,
  ]);

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
    const nextHref = buildProductHref(targetProduct.id, effectiveContext);

    if (typeof window !== 'undefined') {
      window.history.pushState(
        {
          productId: String(targetProduct.id),
          ...effectiveContext,
        },
        '',
        nextHref
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setNavState({
      productId: String(targetProduct.id),
      ...effectiveContext,
    });
  };

  const catalogBackHref = buildCatalogHref({
    category: effectiveContext.category,
    categoryId: effectiveContext.categoryId,
    brand: effectiveContext.brand,
    gender: effectiveContext.gender,
    size: effectiveContext.size,
    search: effectiveContext.search,
  });

  const categoryBreadcrumbHref = product?.categorySlug
    ? buildCatalogHref({ category: product.categorySlug })
    : product?.categoryId
      ? buildCatalogHref({ categoryId: product.categoryId })
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
          <div className="lg:col-span-7 w-full aspect-[4/3] max-h-[500px] bg-sunken rounded-tile" />

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
        <p className="text-[13px] font-semibold text-ink-muted">
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
            className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-brand-light bg-brand-dark px-6 rounded-full hover:bg-ink-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
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
            className="inline-flex h-11 items-center justify-center px-6 text-sm font-semibold text-brand-light bg-brand-dark hover:bg-ink-soft transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer"
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
          className="text-xs text-ink-muted tabular-nums mr-1 select-none"
          aria-live="polite"
        >
          {effectiveContext.brand
            ? `${effectiveContext.brand.toUpperCase()} · `
            : ''}

          {effectiveContext.categoryId !== null && product?.category
            ? `${product.category} · `
            : ''}

          {effectiveContext.search
            ? `«${effectiveContext.search}» · `
            : ''}
          {currentIndex + 1} / {catalogList.length}
        </span>

        <div className="inline-flex items-center gap-1.5">
          {previousProduct ? (
            <a
              href={buildProductHref(
                previousProduct.id,
                effectiveContext
              )}
              onClick={(e) => handleNavigateToProduct(e, previousProduct)}
              aria-label={`Producto anterior: ${previousProduct.title}`}
              title={previousProduct.title}
              className="inline-flex items-center gap-1.5 min-h-11 px-4 text-[13px] font-medium text-brand-dark bg-white shadow-hairline hover:shadow-card rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
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
              className="inline-flex items-center gap-1.5 min-h-11 px-4 text-[13px] font-medium text-ink-muted/60 bg-sunken rounded-full cursor-not-allowed select-none"
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
                effectiveContext
              )}
              onClick={(e) => handleNavigateToProduct(e, nextProduct)}
              aria-label={`Producto siguiente: ${nextProduct.title}`}
              title={nextProduct.title}
              className="inline-flex items-center gap-1.5 min-h-11 px-4 text-[13px] font-medium text-brand-dark bg-white shadow-hairline hover:shadow-card rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30"
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
              className="inline-flex items-center gap-1.5 min-h-11 px-4 text-[13px] font-medium text-ink-muted/60 bg-sunken rounded-full cursor-not-allowed select-none"
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
          <ol className="flex items-center flex-wrap gap-2 text-[13px] text-ink-muted">
            <li>
              <a
                href="/"
                className="hover:text-brand-dark transition-colors duration-150 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
              >
                Inicio
              </a>
            </li>
            <li aria-hidden="true" className="select-none text-ink-muted">
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
            <li aria-hidden="true" className="select-none text-ink-muted">
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
              <div className="flex items-center gap-2 flex-wrap">
                {product.brandName && (
                  <span className="text-[13px] font-semibold text-brand-dark">
                    {product.brandName}
                  </span>
                )}
                {product.brandName && product.category && (
                  <span className="text-ink-muted text-xs select-none">/</span>
                )}
                <span className="text-[13px] text-ink-muted">
                  {product.category}
                </span>
              </div>
              {product.badge && (
                <span className="text-xs font-semibold px-2.5 py-1 bg-brand-dark text-brand-sand rounded-full">
                  {product.badge}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-brand-dark leading-[1.1]">
              {product.title}
            </h1>

            <p className="text-2xl font-semibold tracking-tight text-brand-dark tabular-nums pt-1 flex flex-wrap items-baseline gap-2.5">
              {product.formattedPreviousPrice && (
                <span className="text-base text-ink-muted line-through font-normal">
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
              <p className="text-[15px] text-ink-muted leading-relaxed whitespace-pre-line">
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
          <div className="border-t border-brand-dark/[0.08] pt-4 grid grid-cols-2 gap-3 text-xs text-ink-muted">
            <div className="space-y-0.5">
              <p className="font-medium text-brand-dark">Envíos a todo el país</p>
              <p>Despacho seguro desde Buenos Aires</p>
            </div>
            <div className="space-y-0.5">
              <p className="font-medium text-brand-dark">Cambios y garantía</p>
              <p>Hasta 30 días para cambios de talle</p>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Footer Navigation: Back to Catalog & Product Sequence Controls */}
      <div className="mt-16 pt-8 border-t border-brand-dark/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <a
          href={catalogBackHref}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-dark hover:opacity-70 transition-opacity duration-150 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
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
          {effectiveContext.search
            ? `Volver a resultados de «${effectiveContext.search}»`
            : effectiveContext.brand && effectiveContext.categoryId !== null && product?.category
              ? `Volver a ${product.category} de ${effectiveContext.brand.toUpperCase()}`
              : effectiveContext.brand
                ? `Volver a productos de ${effectiveContext.brand.toUpperCase()}`
                : effectiveContext.categoryId !== null && product?.category
                  ? `Volver a ${product.category}`
                  : 'Volver al catálogo completo'}
        </a>

        {renderProductSequenceControls()}
      </div>
    </div>
  );
}
