import { useState, useEffect } from 'react';
import ProductGallery from './ProductGallery';
import ProductPurchaseSection from './ProductPurchaseSection';
import { fetchProductById } from '../../services/api';

export default function ProductDetailView({ productId }) {
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProduct = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProductById(productId);
      setProduct(data);
    } catch (err) {
      setError({
        message: err.message || 'Error al obtener el producto.',
        isNotFound: err.isNotFound || false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  // 1. Loading Skeleton State
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-14 animate-pulse">
        {/* Breadcrumb Skeleton */}
        <div className="h-3 w-48 bg-brand-dark/10 rounded-xs mb-8" />

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
          El artículo con identificador <span className="font-mono">#{productId}</span> no existe en el catálogo o no está disponible en este momento.
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
            onClick={loadProduct}
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

  // 4. Loaded Product Detail
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-14">
      {/* Breadcrumbs Navigation */}
      <nav className="mb-6 sm:mb-8" aria-label="Breadcrumb">
        <ol className="flex items-center flex-wrap gap-2 text-xs text-brand-dark/50">
          <li>
            <a
              href="/"
              className="hover:text-brand-dark transition-colors duration-150 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
            >
              Home
            </a>
          </li>
          <li aria-hidden="true" className="select-none text-brand-dark/30">/</li>
          <li>
            <a
              href="/#catalogo"
              className="hover:text-brand-dark transition-colors duration-150 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-dark/30 rounded-xs"
            >
              {product.category}
            </a>
          </li>
          <li aria-hidden="true" className="select-none text-brand-dark/30">/</li>
          <li
            className="font-medium text-brand-dark truncate max-w-[200px] sm:max-w-none"
            aria-current="page"
          >
            {product.title}
          </li>
        </ol>
      </nav>

      {/* Main Product Layout (2 columns in desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
        {/* Left Column: Image Gallery (58% width in desktop) */}
        <section className="lg:col-span-7 w-full" aria-label="Galería de imágenes">
          <ProductGallery images={product.images} title={product.title} />
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

            <p className="text-xl sm:text-2xl font-semibold tracking-tight text-brand-dark tabular-nums pt-1">
              {product.formattedPrice}
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
            availableSizes={product.availableSizes}
            colors={[]}
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

      {/* Back to Catalog Link */}
      <div className="mt-16 pt-8 border-t border-brand-dark/[0.08]">
        <a
          href="/#catalogo"
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
          Volver al catálogo completo
        </a>
      </div>
    </div>
  );
}
