import { getOptimizedImageUrl } from '../../services/api';

export const GENDER_LABELS = {
  MEN: 'Hombre',
  WOMEN: 'Mujer',
  UNISEX: 'Unisex',
};

/**
 * Product card shared by the catalog grid and the "Recién ingresados" section.
 * `href` is built by the caller (the catalog adds its filter context to the URL).
 */
export default function ProductGridCard({ product, href, imageLoading = 'lazy' }) {
  return (
    <article className="group relative flex flex-col">
      <a
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/20 rounded-xs"
        aria-label={`${product.title}${
          product.category ? ' — ' + product.category : ''
        }, ${product.formattedPrice}`}
      >
        {/* Image Canvas (4:5 ratio, clean white backdrop for uniform card appearance) */}
        <div className="aspect-[4/5] w-full bg-white rounded-xs overflow-hidden relative flex items-center justify-center">
          <img
            src={getOptimizedImageUrl(product.image, 'card')}
            alt={product.title}
            loading={imageLoading}
            decoding="async"
            className="w-full h-full object-contain object-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] select-none"
          />
          {product.badge && (
            <span className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 text-[8px] sm:text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.18em] px-1.5 py-0.5 sm:px-2 sm:py-0.5 bg-[#1D110D]/90 text-[#FAFAFA] backdrop-blur-xs pointer-events-none">
              {product.badge}
            </span>
          )}
        </div>

        {/* Product Meta */}
        <div className="mt-2.5 sm:mt-3 flex flex-col">
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-dark/45 truncate">
            <span>{product.brandName || product.category || 'The Office BA'}</span>
            {product.gender && (
              <span className="text-brand-dark/35">{GENDER_LABELS[product.gender] || product.gender}</span>
            )}
          </div>
          <h3
            title={product.title}
            className="text-[11px] sm:text-[12px] md:text-[12.5px] font-medium tracking-tight text-brand-dark group-hover:text-brand-dark/70 transition-colors duration-150 mt-0.5 truncate leading-snug"
          >
            {product.title}
          </h3>
          <p className="text-xs sm:text-[13px] md:text-sm font-semibold tracking-tight text-brand-dark tabular-nums mt-0.5 flex flex-wrap items-baseline gap-1.5">
            {product.formattedPreviousPrice && (
              <span className="text-brand-dark/45 line-through font-normal text-[11px] sm:text-xs">
                {product.formattedPreviousPrice}
              </span>
            )}
            <span>{product.formattedPrice}</span>
          </p>
        </div>
      </a>
    </article>
  );
}
