/**
 * Same-page catalog navigation, mirroring NavbarNavigation.handleItemClick:
 * on the home page it updates the URL with pushState, scrolls to #catalogo and fires
 * 'the-office:catalog-url-change' (CatalogSection listens to it); elsewhere the browser navigates natively.
 */
export function handleCatalogLinkClick(e, href) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  if (typeof window === 'undefined') return;

  const isHomePage = window.location.pathname === '/' || window.location.pathname === '';
  if (!isHomePage) return;

  e.preventDefault();
  window.history.pushState({}, '', href);

  const catalogEl = document.getElementById('catalogo');
  if (catalogEl) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    catalogEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  window.dispatchEvent(new CustomEvent('the-office:catalog-url-change'));
}
