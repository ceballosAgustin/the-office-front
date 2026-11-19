import { useEffect, useState } from 'react';
import { fetchBrands, buildCatalogHref } from '../../services/api';
import { handleCatalogLinkClick } from './catalogNav';

/**
 * Home "Marcas" strip: text pills linking to the catalog filtered by brand.
 * Renders only when there are 2 or more brands.
 */
export default function BrandStrip() {
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchBrands().then((list) => {
      if (!cancelled) setBrands(list.filter((b) => b && b.slug && b.name && b.isActive !== false));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (brands.length < 2) return null;

  return (
    <section id="marcas" className="mx-auto max-w-7xl px-4 pt-4 pb-2 sm:px-6 sm:pt-4 lg:px-8 scroll-mt-20" aria-label="Marcas">
      <div className="sm:flex sm:items-center sm:gap-5">
        <h2 className="text-[13px] font-semibold text-ink-muted sm:shrink-0">Marcas</h2>
        <ul className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:mt-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {brands.map((brand) => {
            const href = buildCatalogHref({ brand: brand.slug });
            return (
              <li key={brand.id ?? brand.slug} className="shrink-0">
                <a
                  href={href}
                  onClick={(e) => handleCatalogLinkClick(e, href)}
                  className="inline-flex h-11 items-center rounded-full bg-sunken px-4 text-[14px] font-medium text-brand-dark transition-colors duration-150 hover:bg-brand-dark hover:text-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark"
                >
                  {brand.name}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
