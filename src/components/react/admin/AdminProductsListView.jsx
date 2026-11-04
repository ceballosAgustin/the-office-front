import { useState, useEffect, useCallback } from 'react';
import AdminShell from './AdminShell';
import {
  fetchAdminProducts,
  updateAdminProductStatus,
  fetchCategories,
  formatPrice,
} from '../../../services/api';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22500%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23F2F2F0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-size%3D%2212%22%20fill%3D%22%231D110D80%22%3ESIN%20IMAGEN%3C%2Ftext%3E%3C%2Fsvg%3E';

const STATUS_TABS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'INACTIVE', label: 'Inactivos' },
];

function resolvePrimaryImage(product) {
  if (!Array.isArray(product?.images) || product.images.length === 0) {
    return PLACEHOLDER_IMAGE;
  }
  const sorted = [...product.images].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
  });
  const url = sorted[0]?.imageUrl;
  return typeof url === 'string' && url.trim() ? url : PLACEHOLDER_IMAGE;
}

function calculateActiveStock(product) {
  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    return product.variants
      .filter((v) => v && v.isActive !== false)
      .reduce((sum, v) => sum + (Math.max(0, Number(v.stock) || 0)), 0);
  }
  return Math.max(0, Number(product?.baseStock) || 0);
}

function getActiveSizesSummary(product) {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return 'Sin variantes';
  }
  const active = product.variants.filter((v) => v && v.isActive !== false);
  const inactiveCount = product.variants.length - active.length;
  if (active.length === 0) {
    return `0 activas (${inactiveCount} inact.)`;
  }
  const sizesText = active.map((v) => v.size).join(', ');
  return inactiveCount > 0
    ? `${sizesText} (+${inactiveCount} inact.)`
    : sizesText;
}

export default function AdminProductsListView() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(12);

  const [categories, setCategories] = useState([]);
  const [pageData, setPageData] = useState({
    content: [],
    totalPages: 0,
    totalElements: 0,
    number: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Deactivation confirmation modal state
  const [productToDeactivate, setProductToDeactivate] = useState(null);
  const [togglingProductId, setTogglingProductId] = useState(null);

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        if (Array.isArray(cats)) {
          setCategories(cats);
        }
      })
      .catch(() => {});
  }, []);

  const loadProducts = useCallback(
    async (targetStatus, targetCategoryId, targetTitle, targetPage) => {
      setIsLoading(true);
      setErrorMessage(null);

      let isActiveParam = null;
      if (targetStatus === 'ACTIVE') isActiveParam = true;
      if (targetStatus === 'INACTIVE') isActiveParam = false;

      try {
        const res = await fetchAdminProducts({
          page: targetPage,
          size: pageSize,
          sort: 'id,desc',
          isActive: isActiveParam,
          categoryId: targetCategoryId ? Number(targetCategoryId) : null,
          title: targetTitle || undefined,
        });

        setPageData({
          content: Array.isArray(res?.content) ? res.content : [],
          totalPages: Number(res?.totalPages) || 0,
          totalElements: Number(res?.totalElements) || 0,
          number: Number(res?.number) || 0,
        });
      } catch (err) {
        if (err?.status === 401) {
          window.location.replace('/admin/login?reason=expired');
          return;
        }
        if (err?.status === 403) {
          window.location.replace('/admin/login?reason=forbidden');
          return;
        }
        setErrorMessage(
          err?.message || 'No se pudo cargar el listado de productos.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    loadProducts(statusFilter, categoryFilter, appliedSearch, page);
  }, [statusFilter, categoryFilter, appliedSearch, page, loadProducts]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    setAppliedSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setStatusFilter('ALL');
    setCategoryFilter('');
    setSearchInput('');
    setAppliedSearch('');
    setPage(0);
  };

  const handleToggleStatusClick = (product) => {
    setActionMessage(null);
    setActionError(null);
    const currentlyActive = product.isActive !== false;
    if (currentlyActive) {
      setProductToDeactivate(product);
    } else {
      executeStatusChange(product, true);
    }
  };

  const executeStatusChange = async (product, nextActiveState) => {
    if (!product || togglingProductId != null) return;
    setTogglingProductId(product.id);
    setActionMessage(null);
    setActionError(null);

    try {
      const updated = await updateAdminProductStatus(
        product.id,
        nextActiveState
      );
      setPageData((prev) => ({
        ...prev,
        content: prev.content.map((item) =>
          item.id === updated.id ? updated : item
        ),
      }));
      setProductToDeactivate(null);
      setActionMessage(
        `El producto "${updated.title}" fue ${
          updated.isActive !== false ? 'activado' : 'desactivado'
        } correctamente.`
      );
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      if (err?.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }
      setActionError(
        err?.message || 'No se pudo actualizar el estado del producto.'
      );
      setProductToDeactivate(null);
    } finally {
      setTogglingProductId(null);
    }
  };

  const products = pageData.content;
  const hasActiveFilters =
    statusFilter !== 'ALL' || Boolean(categoryFilter) || Boolean(appliedSearch);

  return (
    <AdminShell activeSection="products">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-dark/[0.08] pb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/45">
              Catálogo e Inventario
            </span>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark">
                Products Management
              </h1>
              <span className="text-xs font-mono text-brand-dark/45">
                [{isLoading ? '--' : pageData.totalElements}]
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                loadProducts(statusFilter, categoryFilter, appliedSearch, page)
              }
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark bg-white/85 border border-brand-dark/15 hover:border-brand-dark rounded-xs transition-colors cursor-pointer"
            >
              Actualizar
            </button>
            <a
              href="/admin/categories"
              className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark bg-white/85 border border-brand-dark/20 hover:border-brand-dark rounded-xs transition-colors"
            >
              Categorías
            </a>
            <a
              href="/admin/products/new"
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark hover:opacity-90 rounded-xs transition-opacity"
            >
              + Nuevo producto
            </a>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-[#FAF9F6]/90 border border-brand-dark/10 p-4 rounded-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status Filter Tabs */}
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="tablist"
              aria-label="Filtrar productos por estado"
            >
              {STATUS_TABS.map((tab) => {
                const isSelected = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setStatusFilter(tab.value);
                      setPage(0);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-brand-dark text-[#FAFAFA] border-brand-dark'
                        : 'bg-white text-brand-dark/70 border-brand-dark/15 hover:border-brand-dark hover:text-brand-dark'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Category Select & Search Form */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <select
                aria-label="Filtrar por categoría"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(0);
                }}
                className="h-9 px-3 text-xs font-medium text-brand-dark bg-white border border-brand-dark/20 rounded-xs focus:outline-none focus:border-brand-dark"
              >
                <option value="">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-1.5"
              >
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por nombre..."
                  aria-label="Buscar producto por nombre"
                  className="h-9 px-3 text-xs text-brand-dark bg-white border border-brand-dark/20 rounded-xs placeholder:text-brand-dark/35 focus:outline-none focus:border-brand-dark min-w-[180px]"
                />
                <button
                  type="submit"
                  className="h-9 px-3 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Buscar
                </button>
              </form>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="h-9 px-2.5 text-xs font-medium text-brand-dark/65 hover:text-brand-dark underline underline-offset-4 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Feedback Banners */}
        {actionMessage && (
          <div
            className="p-3.5 bg-emerald-50/95 border border-emerald-200 rounded-xs text-xs text-emerald-900 flex items-center justify-between gap-3"
            role="status"
          >
            <span className="font-medium">{actionMessage}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-emerald-800 hover:opacity-70 font-bold cursor-pointer"
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {actionError && (
          <div
            className="p-3.5 bg-red-50/95 border border-red-200 rounded-xs text-xs text-red-800 flex items-center justify-between gap-3"
            role="alert"
          >
            <span className="font-medium">{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-800 hover:opacity-70 font-bold cursor-pointer"
              aria-label="Cerrar error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Load Error State */}
        {errorMessage && (
          <div
            className="p-4 bg-red-50/90 border border-red-200 rounded-xs text-xs text-red-800 flex flex-wrap items-center justify-between gap-3"
            role="alert"
          >
            <div>
              <p className="font-semibold">Error al obtener los productos</p>
              <p>{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                loadProducts(statusFilter, categoryFilter, appliedSearch, page)
              }
              className="px-3 py-1.5 font-semibold uppercase tracking-wider bg-red-800 text-white rounded-xs cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-2.5 animate-pulse">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-16 w-full bg-[#F2F2F0] rounded-xs"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !errorMessage && products.length === 0 && (
          <div className="py-16 px-6 text-center bg-[#FAF9F6]/85 border border-brand-dark/10 rounded-xs space-y-3">
            <p className="text-sm sm:text-base font-semibold text-brand-dark">
              No se encontraron productos
            </p>
            <p className="text-xs text-brand-dark/60 max-w-md mx-auto">
              {hasActiveFilters
                ? 'No hay productos que coincidan con los filtros o la búsqueda aplicada.'
                : 'Aún no hay productos registrados en el catálogo.'}
            </p>
            <div className="pt-1 flex items-center justify-center gap-4">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 cursor-pointer"
                >
                  Restablecer filtros
                </button>
              )}
              <a
                href="/admin/products/new"
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs"
              >
                + Crear producto
              </a>
            </div>
          </div>
        )}

        {/* Products Table (Desktop) & Cards (Mobile) */}
        {!isLoading && !errorMessage && products.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-[#FAF9F6]/90 backdrop-blur-xs border border-brand-dark/10 rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-dark/10 bg-brand-dark/[0.03] text-[11px] font-semibold uppercase tracking-wider text-brand-dark/55">
                      <th className="py-3.5 px-4">Producto</th>
                      <th className="py-3.5 px-4">Categoría</th>
                      <th className="py-3.5 px-4 text-right">Precio</th>
                      <th className="py-3.5 px-4 text-center">Stock activo</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/[0.06] text-xs sm:text-sm">
                    {products.map((prod) => {
                      const isActive = prod.isActive !== false;
                      const activeStock = calculateActiveStock(prod);
                      const primaryImg = resolvePrimaryImage(prod);
                      const sizesSummary = getActiveSizesSummary(prod);
                      const isToggling = togglingProductId === prod.id;

                      return (
                        <tr
                          key={prod.id}
                          className={`transition-colors hover:bg-brand-dark/[0.02] ${
                            !isActive ? 'opacity-70 bg-brand-dark/[0.015]' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3.5">
                              <a
                                href={`/admin/products/${prod.id}/edit`}
                                className="w-12 h-15 shrink-0 bg-[#F2F2F0] rounded-xs overflow-hidden border border-brand-dark/10 block"
                              >
                                <img
                                  src={primaryImg}
                                  alt={prod.title || 'Producto'}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = PLACEHOLDER_IMAGE;
                                  }}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <a
                                    href={`/admin/products/${prod.id}/edit`}
                                    className="font-semibold text-brand-dark hover:underline underline-offset-2 truncate"
                                  >
                                    {prod.title || 'Sin título'}
                                  </a>
                                  <span className="font-mono text-[11px] text-brand-dark/40">
                                    #{prod.id}
                                  </span>
                                </div>
                                <p className="text-[11px] text-brand-dark/55 truncate">
                                  Talles: {sizesSummary}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {prod.categoryName ? (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-brand-dark/[0.05] text-brand-dark rounded-xs">
                                {prod.categoryName}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200 rounded-xs">
                                Sin categoría asignada
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-semibold text-brand-dark tabular-nums whitespace-nowrap">
                            {formatPrice(Number(prod.price) || 0)}
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold rounded-xs ${
                                activeStock > 0
                                  ? 'bg-brand-dark/[0.06] text-brand-dark'
                                  : 'bg-red-50 text-red-800 border border-red-200'
                              }`}
                            >
                              {activeStock} u.
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider border rounded-xs ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                  : 'bg-brand-dark/[0.05] text-brand-dark/60 border-brand-dark/15'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive
                                    ? 'bg-emerald-600'
                                    : 'bg-brand-dark/35'
                                }`}
                              />
                              <span>{isActive ? 'Activo' : 'Inactivo'}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2">
                              <a
                                href={`/admin/products/${prod.id}/edit`}
                                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] hover:opacity-90 rounded-xs transition-opacity"
                              >
                                Editar
                              </a>
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => handleToggleStatusClick(prod)}
                                className={`px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider border rounded-xs transition-colors cursor-pointer ${
                                  isActive
                                    ? 'border-red-200 text-red-800 bg-white hover:bg-red-50'
                                    : 'border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100'
                                }`}
                              >
                                {isToggling
                                  ? '...'
                                  : isActive
                                  ? 'Desactivar'
                                  : 'Activar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {products.map((prod) => {
                const isActive = prod.isActive !== false;
                const activeStock = calculateActiveStock(prod);
                const primaryImg = resolvePrimaryImage(prod);
                const sizesSummary = getActiveSizesSummary(prod);
                const isToggling = togglingProductId === prod.id;

                return (
                  <div
                    key={prod.id}
                    className={`bg-[#FAF9F6]/90 border border-brand-dark/12 p-4 rounded-xs space-y-3 ${
                      !isActive ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <a
                        href={`/admin/products/${prod.id}/edit`}
                        className="w-16 aspect-[4/5] shrink-0 bg-[#F2F2F0] rounded-xs overflow-hidden border border-brand-dark/10"
                      >
                        <img
                          src={primaryImg}
                          alt={prod.title || 'Producto'}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = PLACEHOLDER_IMAGE;
                          }}
                          className="w-full h-full object-cover"
                        />
                      </a>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={`/admin/products/${prod.id}/edit`}
                            className="text-sm font-bold text-brand-dark truncate"
                          >
                            {prod.title || 'Sin título'}
                          </a>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded-xs shrink-0 ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                : 'bg-brand-dark/[0.05] text-brand-dark/60 border-brand-dark/15'
                            }`}
                          >
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <p className="text-xs text-brand-dark/60">
                          {prod.categoryName || 'Sin categoría asignada'}
                        </p>
                        <p className="text-[11px] text-brand-dark/50 truncate">
                          Talles: {sizesSummary}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-sm font-bold text-brand-dark tabular-nums">
                            {formatPrice(Number(prod.price) || 0)}
                          </span>
                          <span className="text-xs font-mono font-semibold text-brand-dark/75">
                            Stock: {activeStock} u.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-dark/[0.06]">
                      <a
                        href={`/admin/products/${prod.id}/edit`}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-brand-dark text-[#FAFAFA] rounded-xs"
                      >
                        Editar
                      </a>
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleStatusClick(prod)}
                        className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border rounded-xs cursor-pointer ${
                          isActive
                            ? 'border-red-200 text-red-800 bg-white'
                            : 'border-emerald-300 text-emerald-900 bg-emerald-50'
                        }`}
                      >
                        {isToggling
                          ? '...'
                          : isActive
                          ? 'Desactivar'
                          : 'Activar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pageData.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-brand-dark/[0.08] text-xs">
                <span className="text-brand-dark/60">
                  Página{' '}
                  <strong className="font-semibold text-brand-dark">
                    {pageData.number + 1}
                  </strong>{' '}
                  de{' '}
                  <strong className="font-semibold text-brand-dark">
                    {pageData.totalPages}
                  </strong>{' '}
                  ({pageData.totalElements} productos en total)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pageData.number <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className={`px-3.5 py-1.5 font-semibold uppercase tracking-wider border rounded-xs transition-colors ${
                      pageData.number <= 0
                        ? 'border-brand-dark/10 text-brand-dark/30 cursor-not-allowed'
                        : 'border-brand-dark/20 text-brand-dark bg-white hover:border-brand-dark cursor-pointer'
                    }`}
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    disabled={pageData.number + 1 >= pageData.totalPages}
                    onClick={() =>
                      setPage((p) =>
                        p + 1 < pageData.totalPages ? p + 1 : p
                      )
                    }
                    className={`px-3.5 py-1.5 font-semibold uppercase tracking-wider border rounded-xs transition-colors ${
                      pageData.number + 1 >= pageData.totalPages
                        ? 'border-brand-dark/10 text-brand-dark/30 cursor-not-allowed'
                        : 'border-brand-dark/20 text-brand-dark bg-white hover:border-brand-dark cursor-pointer'
                    }`}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Dialog before Deactivating Product */}
      {productToDeactivate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-deactivate-product-title"
        >
          <div className="bg-[#FAF9F6] border border-brand-dark/20 max-w-md w-full p-6 sm:p-7 rounded-xs shadow-lg space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700">
                Confirmar desactivación
              </span>
              <h3
                id="modal-deactivate-product-title"
                className="text-lg font-bold tracking-tight text-brand-dark"
              >
                ¿Desactivar producto del catálogo público?
              </h3>
              <p className="text-xs sm:text-sm text-brand-dark/70 leading-relaxed">
                Estás por desactivar{' '}
                <strong className="font-semibold text-brand-dark">
                  {productToDeactivate.title}
                </strong>
                . El producto dejará de mostrarse en la tienda pública, pero
                conservará su historial, variantes y fotografías en el panel
                administrativo.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={togglingProductId != null}
                onClick={() => setProductToDeactivate(null)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 bg-white hover:bg-brand-dark/[0.04] rounded-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={togglingProductId != null}
                onClick={() => executeStatusChange(productToDeactivate, false)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-red-700 hover:bg-red-800 rounded-xs cursor-pointer"
              >
                {togglingProductId != null
                  ? 'Desactivando...'
                  : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

