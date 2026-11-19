import { useState, useEffect, useCallback, useRef } from 'react';
import AdminShell from './AdminShell';
import Button from './ui/Button';
import PageHeader from './ui/PageHeader';
import Segmented from './ui/Segmented';
import StatusBadge from './ui/StatusBadge';
import Menu from './ui/Menu';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import ListSkeleton from './ui/ListSkeleton';
import Pagination from './ui/Pagination';
import Icon from './ui/icons';
import { toast } from './ui/Toast';
import { inputClass, selectClass } from './ui/Field';
import {
  fetchAdminProducts,
  updateAdminProductStatus,
  fetchCategories,
  formatPrice,
  getOptimizedImageUrl,
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

function ProductThumb({ product, className }) {
  const primaryImg = resolvePrimaryImage(product);
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-ctl bg-sunken ${className}`}
    >
      <img
        src={getOptimizedImageUrl(primaryImg, 'thumbnail')}
        alt=""
        loading="lazy"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = PLACEHOLDER_IMAGE;
        }}
        className="h-full w-full object-contain object-center"
      />
    </span>
  );
}

function StockLabel({ stock }) {
  if (stock > 0) {
    return <span className="tabular-nums">{stock}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className="size-2 shrink-0 rounded-full bg-red-600" aria-hidden="true" />
      Sin stock
    </span>
  );
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
  const [togglingProductId, setTogglingProductId] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('created') === '1') {
        toast.success('El producto se creó y ya está en el catálogo.', {
          title: 'Producto creado',
        });
        params.delete('created');
        const cleanUrl = `${window.location.pathname}${
          params.toString() ? `?${params.toString()}` : ''
        }`;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, []);

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        if (Array.isArray(cats)) {
          setCategories(cats);
        }
      })
      .catch(() => {});
  }, []);

  // Request id guard: ignore responses from superseded requests
  const loadReqIdRef = useRef(0);

  const loadProducts = useCallback(
    async (targetStatus, targetCategoryId, targetTitle, targetPage) => {
      loadReqIdRef.current += 1;
      const reqId = loadReqIdRef.current;
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
        if (reqId !== loadReqIdRef.current) return;

        setPageData({
          content: Array.isArray(res?.content) ? res.content : [],
          totalPages: Number(res?.totalPages) || 0,
          totalElements: Number(res?.totalElements) || 0,
          number: Number(res?.number) || 0,
        });
      } catch (err) {
        if (reqId !== loadReqIdRef.current) return;
        if (err?.status === 401) {
          window.location.replace('/admin/login?reason=expired');
          return;
        }
        setErrorMessage(
          err?.message || 'No se pudo cargar el listado de productos.'
        );
      } finally {
        if (reqId === loadReqIdRef.current) {
          setIsLoading(false);
        }
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

  const handleClearSearchInput = () => {
    setSearchInput('');
    if (appliedSearch) {
      setAppliedSearch('');
      setPage(0);
    }
  };

  const handleClearFilters = () => {
    setStatusFilter('ALL');
    setCategoryFilter('');
    setSearchInput('');
    setAppliedSearch('');
    setPage(0);
  };

  // La confirmación de "Desactivar" es en línea (dentro del menú de la fila); "Activar" no necesita confirmación.
  const executeStatusChange = async (product, nextActiveState) => {
    if (!product || togglingProductId != null) return;
    setTogglingProductId(product.id);

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
      toast.success(
        `"${updated.title}" quedó ${
          updated.isActive !== false ? 'activo' : 'desactivado'
        }.`
      );
    } catch (err) {
      if (err?.status === 401) {
        window.location.replace('/admin/login?reason=expired');
        return;
      }
      toast.error(
        err?.message || 'No se pudo actualizar el estado del producto.'
      );
    } finally {
      setTogglingProductId(null);
    }
  };

  const getMenuItems = (prod) => {
    const isActive = prod.isActive !== false;
    const isToggling = togglingProductId === prod.id;
    return [
      { key: 'edit', label: 'Editar', href: `/admin/products/${prod.id}/edit` },
      isActive
        ? {
            key: 'deactivate',
            label: 'Desactivar…',
            danger: true,
            disabled: isToggling,
            confirm: {
              message:
                'Se oculta de la tienda. Conserva historial, variantes y fotos, y lo podés reactivar.',
              confirmLabel: 'Desactivar',
            },
            onSelect: () => executeStatusChange(prod, false),
          }
        : {
            key: 'activate',
            label: 'Activar',
            disabled: isToggling,
            onSelect: () => executeStatusChange(prod, true),
          },
    ];
  };

  const products = pageData.content;
  const hasActiveFilters =
    statusFilter !== 'ALL' || Boolean(categoryFilter) || Boolean(appliedSearch);

  return (
    <AdminShell activeSection="products">
      <div className="space-y-4">
        <PageHeader
          title="Productos"
          subtitle={
            isLoading
              ? 'Cargando…'
              : errorMessage
                ? ''
                : `${pageData.totalElements} ${
                  pageData.totalElements === 1 ? 'producto' : 'productos'
                }`
          }
          actions={
            <Button href="/admin/products/new" size="sm" className="lg:min-h-10">
              <span className="whitespace-nowrap">
                + Nuevo<span className="hidden sm:inline"> producto</span>
              </span>
            </Button>
          }
        />

        {/* Filtros */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            ariaLabel="Filtrar productos por estado"
            options={STATUS_TABS}
            value={statusFilter}
            onChange={(next) => {
              setStatusFilter(next);
              setPage(0);
            }}
            fullWidth
            className="lg:w-auto"
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="Filtrar por categoría"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
              className={`${selectClass} sm:w-52`}
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </option>
              ))}
            </select>

            <form onSubmit={handleSearchSubmit} role="search" className="sm:w-64">
              <div className="relative">
                <Icon
                  name="search"
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  type="search"
                  enterKeyHint="search"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    if (!e.target.value.trim() && appliedSearch) {
                      setAppliedSearch('');
                      setPage(0);
                    }
                  }}
                  placeholder="Buscar por nombre"
                  aria-label="Buscar producto por nombre"
                  className={`${inputClass} pl-10 ${searchInput ? 'pr-11' : 'pr-3.5'} [&::-webkit-search-cancel-button]:hidden`}
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearchInput}
                    className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-r-ctl text-ink-muted hover:text-brand-dark lg:h-10"
                    aria-label="Limpiar búsqueda"
                  >
                    <Icon name="x" size={16} />
                  </button>
                )}
              </div>
            </form>

            {hasActiveFilters && (
              <Button variant="ghost" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {errorMessage && (
          <ErrorState
            title="No pudimos cargar los productos"
            message={errorMessage}
            onRetry={() =>
              loadProducts(statusFilter, categoryFilter, appliedSearch, page)
            }
          />
        )}

        {isLoading && <ListSkeleton rows={6} rowClassName="h-[72px]" />}

        {!isLoading && !errorMessage && products.length === 0 && (
          <EmptyState
            icon="tag"
            title="No hay productos para mostrar"
            description={
              hasActiveFilters
                ? 'Ningún producto coincide con los filtros o la búsqueda.'
                : 'Todavía no cargaste productos en el catálogo.'
            }
            action={
              <>
                {hasActiveFilters && (
                  <Button variant="secondary" onClick={handleClearFilters}>
                    Restablecer filtros
                  </Button>
                )}
                <Button href="/admin/products/new">+ Crear producto</Button>
              </>
            }
          />
        )}

        {!isLoading && !errorMessage && products.length > 0 && (
          <>
            {/* Tabla (md+): fila clickeable (link real en el nombre) */}
            <div className="hidden rounded-card bg-white shadow-hairline md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-dark/[0.06] text-[13px] text-ink-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Producto
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Categoría
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Precio
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Stock
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Estado
                    </th>
                    <th scope="col" className="w-16 px-2 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/[0.06] [&>tr:last-child>td:first-child]:rounded-bl-card [&>tr:last-child>td:last-child]:rounded-br-card">
                  {products.map((prod) => {
                    const isActive = prod.isActive !== false;
                    return (
                      <tr
                        key={prod.id}
                        className="relative transition-colors hover:*:bg-sunken/70"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <ProductThumb product={prod} className="h-12 w-10" />
                            <div className="min-w-0">
                              <a
                                href={`/admin/products/${prod.id}/edit`}
                                className="block max-w-[22rem] truncate font-medium text-brand-dark after:absolute after:inset-0"
                              >
                                {prod.title || 'Sin título'}
                              </a>
                              <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                                {prod.brandName || 'Sin marca'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-ink-muted">
                          {prod.categoryName || 'Sin categoría'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-brand-dark">
                          {formatPrice(Number(prod.price) || 0)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-brand-dark">
                          <StockLabel stock={calculateActiveStock(prod)} />
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge
                            variant="dot"
                            tone={isActive ? 'success' : 'neutral'}
                          >
                            {isActive ? 'Activo' : 'Inactivo'}
                          </StatusBadge>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <Menu
                            className="z-10"
                            label={`Acciones para ${prod.title || 'producto'}`}
                            items={getMenuItems(prod)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards (< md) */}
            <ul className="space-y-2.5 md:hidden">
              {products.map((prod) => {
                const isActive = prod.isActive !== false;
                return (
                  <li
                    key={prod.id}
                    className="relative flex gap-3 rounded-card bg-white p-3 shadow-hairline transition-shadow active:shadow-card"
                  >
                    <ProductThumb product={prod} className="h-[72px] w-[58px]" />
                    <div className="absolute right-0.5 top-0.5 z-10 focus-within:z-30">
                      <Menu
                        label={`Acciones para ${prod.title || 'producto'}`}
                        items={getMenuItems(prod)}
                        trigger={({ props }) => (
                          <button
                            {...props}
                            className="grid size-11 place-items-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-brand-dark"
                          >
                            <Icon name="dots" size={18} />
                          </button>
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/admin/products/${prod.id}/edit`}
                        className="line-clamp-2 pr-9 text-[15px] font-semibold leading-snug text-brand-dark after:absolute after:inset-0 after:rounded-card"
                      >
                        {prod.title || 'Sin título'}
                      </a>
                      <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                        {prod.categoryName || 'Sin categoría'} ·{' '}
                        {prod.brandName || 'Sin marca'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                        <span className="text-sm font-semibold tabular-nums text-brand-dark">
                          {formatPrice(Number(prod.price) || 0)}
                        </span>
                        <span className="text-ink-muted">
                          Stock: <StockLabel stock={calculateActiveStock(prod)} />
                        </span>
                        <StatusBadge
                          variant="dot"
                          tone={isActive ? 'success' : 'neutral'}
                          className="text-[13px]"
                        >
                          {isActive ? 'Activo' : 'Inactivo'}
                        </StatusBadge>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pagination
              number={pageData.number}
              size={pageSize}
              shown={products.length}
              totalPages={pageData.totalPages}
              totalElements={pageData.totalElements}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() =>
                setPage((p) => (p + 1 < pageData.totalPages ? p + 1 : p))
              }
            />
          </>
        )}
      </div>
    </AdminShell>
  );
}
