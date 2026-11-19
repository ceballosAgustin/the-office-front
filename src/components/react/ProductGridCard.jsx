import {
  getOptimizedImageUrl,
  formatProductSize,
  sortProductSizes,
} from '../../services/api';

export const GENDER_LABELS = {
  MEN: 'Hombre',
  WOMEN: 'Mujer',
  UNISEX: 'Unisex',
};

const MAX_SIZES_SHOWN = 4;
const LOW_STOCK_THRESHOLD = 3;

/**
 * Product card shared by the catalog grid and the "Recién ingresados" section.
 * `href` is built by the caller (the catalog adds its filter context to the URL).
 * `isNew` shows the "Nuevo" badge (the caller knows the product belongs to Recién ingresados;
 * the Product mapper does not expose `newInPosition`).
 */
export default function ProductGridCard({ product, href, imageLoading = 'lazy', isNew = false }) {
  const uniqueSizes = sortProductSizes(
    Array.from(new Set((product.availableSizes || []).filter(Boolean)))
  );
  const shownSizes = uniqueSizes.slice(0, MAX_SIZES_SHOWN).map((s) => formatProductSize(s, product));
  const extraSizes = uniqueSizes.length - shownSizes.length;

  const totalStock = (product.variants || []).reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
  const isLowStock = totalStock > 0 && totalStock <= LOW_STOCK_THRESHOLD;

  const discountPct =
    product.previousPrice && product.price > 0 && product.previousPrice > product.price
      ? Math.round((1 - product.price / product.previousPrice) * 100)
      : 0;

  return (
    <article className="group relative flex flex-col">
      <a
        href={href}
        className="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 focus-visible:ring-offset-2"
        aria-label={`${product.title}${
          product.category ? ' — ' + product.category : ''
        }, ${product.formattedPrice}`}
      >
        {/* Image tile (4:5, sunken backdrop; multiply blends white product photos into it) */}
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-card bg-sunken shadow-hairline transition duration-300 ease-ios motion-safe:group-hover:-translate-y-0.5 group-hover:shadow-card-hover">
          <img
            src={getOptimizedImageUrl(product.image, 'card')}
            alt={product.title}
            loading={imageLoading}
            decoding="async"
            className="h-full w-full select-none object-contain object-center p-3 mix-blend-multiply transition-transform duration-500 ease-ios motion-safe:group-hover:scale-[1.05]"
          />
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
            {isNew && (
              <span className="rounded-full bg-brand-sand px-2.5 py-1 text-xs font-semibold leading-none text-brand-dark">
                Nuevo
              </span>
            )}
            {discountPct > 0 && (
              <span className="rounded-full bg-brand-dark px-2.5 py-1 text-xs font-semibold leading-none text-brand-sand">
                -{discountPct}%
              </span>
            )}
            {product.badge && (
              <span className="rounded-full bg-brand-dark px-2.5 py-1 text-xs font-semibold leading-none text-brand-light">
                {product.badge}
              </span>
            )}
          </div>
          {isLowStock && (
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold leading-none text-brand-dark shadow-hairline">
              Últimas unidades
            </span>
          )}
        </div>

        {/* Product Meta */}
        <div className="mt-3 flex flex-col gap-0.5">
          <p className="truncate text-[13px] text-ink-muted">
            {product.brandName || product.category || 'The Office BA'}
          </p>
          <h3
            title={product.title}
            className="line-clamp-2 text-[15px] font-medium leading-snug text-brand-dark"
          >
            {product.title}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold tabular-nums text-brand-dark">
            <span>{product.formattedPrice}</span>
            {product.formattedPreviousPrice && (
              <span className="text-[13px] font-normal text-ink-muted line-through">
                {product.formattedPreviousPrice}
              </span>
            )}
          </p>
          {shownSizes.length > 0 && (
            <p className="mt-0.5 text-xs text-ink-muted">
              Talles: {shownSizes.join(' · ')}
              {extraSizes > 0 ? ` +${extraSizes}` : ''}
            </p>
          )}
        </div>
      </a>
    </article>
  );
}
