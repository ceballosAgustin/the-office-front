import { useEffect, useState } from 'react';
import { getOptimizedImageUrl } from '../../services/api';
import { getNewInProducts } from './newInStore';

/**
 * Hero "spotlight" (lg+ only): first product of "Recién ingresados".
 * Renders nothing when the list is empty or the API fails (the hero then spans the full width).
 * While loading it reserves the final size (no layout shift).
 */
const TILE_CLASSES =
  'relative block overflow-hidden rounded-tile bg-white shadow-card lg:col-span-5 lg:min-h-[420px]';

export default function HeroSpotlight() {
  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  // null until mounted; true only on lg+ (the tile is not rendered on phones so its image is never downloaded)
  const [isDesktop, setIsDesktop] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    getNewInProducts()
      .then((list) => {
        if (cancelled) return;
        setProduct(list[0] || null);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isDesktop]);

  // Before mount (SSR): reserve the desktop space with plain CSS, no image
  if (isDesktop === null) {
    return <div className="hidden lg:col-span-5 lg:block lg:min-h-[420px]" aria-hidden="true" />;
  }
  if (!isDesktop) return null;

  if (status === 'error' || (status === 'ready' && !product)) return null;

  if (status === 'loading') {
    return <div className={`${TILE_CLASSES} animate-pulse bg-sunken!`} aria-hidden="true" />;
  }

  return (
    <a
      href={`/products/${encodeURIComponent(product.id)}`}
      className={`${TILE_CLASSES} group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark`}
      aria-label={`${product.title}, ${product.formattedPrice}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_30%,#ffffff_0%,#F4F3F3_70%)]" />
      <img
        src={getOptimizedImageUrl(product.image, 'card')}
        alt={product.title}
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="absolute inset-x-0 top-6 mx-auto h-[62%] w-[92%] object-contain mix-blend-multiply transition-transform duration-700 ease-ios motion-safe:group-hover:-rotate-2 motion-safe:group-hover:scale-[1.04]"
      />
      <span className="absolute left-4 top-4 rounded-full bg-brand-sand px-2.5 py-1 text-xs font-semibold leading-none text-brand-dark">
        Nuevo
      </span>
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-card bg-white p-3.5 shadow-float sm:inset-x-4 sm:bottom-4 sm:p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">Recién ingresado</p>
          <p className="truncate text-[15px] font-semibold text-brand-dark">{product.title}</p>
          <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-brand-dark">
            {product.formattedPrice}
          </p>
        </div>
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-dark text-brand-sand transition-transform duration-300 ease-ios group-hover:scale-110"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
        </span>
      </div>
    </a>
  );
}
