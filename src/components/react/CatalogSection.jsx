import { useState, useEffect, useRef, useMemo } from 'react';
import {
  fetchProductsPage,
  fetchCategories,
  fetchBrands,
  fetchFilterOptions,
  buildCatalogHref,
  parseCatalogParams,
  formatProductSize,
  isSneakersCategory,
  isShoeSize,
  sortProductSizes,
} from '../../services/api';
import ProductGridCard, { GENDER_LABELS } from './ProductGridCard';

const CATALOG_PAGE_SIZE = 50;

/**
 * Appends `incoming` products to `existing`, skipping ids already present.
 * When `sortByIdDesc` is set (multi-size merges) the result is ordered by id desc.
 */
function mergeUniqueProducts(existing, incoming, sortByIdDesc) {
  const seen = new Set(existing.map((p) => String(p.id)));
  const merged = [...existing];
  for (const p of incoming) {
    const key = String(p.id);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(p);
    }
  }
  if (sortByIdDesc) {
    merged.sort((a, b) => Number(b.id) - Number(a.id));
  }
  return merged;
}

const VISIBLE_SIZES_COLLAPSED = 5;

/**
 * Size filter row. "+ Más" expands the remaining sizes inline and they wrap onto new lines,
 * so the row never overflows the viewport (the old absolute dropdown caused horizontal scroll).
 */
function SizeFilterGroup({
  label,
  sizes,
  selectedSizes,
  onToggleSize,
  expanded,
  onToggleExpanded,
  formatLabel,
  titlePrefix,
  minWidthClass,
}) {
  const isSelected = (size) =>
    selectedSizes.some((s) => s.trim().toLowerCase() === size.trim().toLowerCase());
  const hiddenSizes = sizes.slice(VISIBLE_SIZES_COLLAPSED);
  const visibleSizes = expanded ? sizes : sizes.slice(0, VISIBLE_SIZES_COLLAPSED);
  const hasActiveHidden = !expanded && hiddenSizes.some(isSelected);

  return (
    <div className="flex items-start gap-1.5 min-w-0 max-w-full">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark/40 mr-1 shrink-0 leading-7">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1 min-w-0">
        {visibleSizes.map((size) => {
          const selected = isSelected(size);
          const display = formatLabel(size);
          return (
            <button
              key={`size-${size}`}
              type="button"
              onClick={() => onToggleSize(size)}
              aria-pressed={selected}
              title={`${titlePrefix} ${display}`}
              className={`${minWidthClass} h-7 px-2 flex items-center justify-center text-xs tracking-tight rounded-xs border transition-colors cursor-pointer tabular-nums ${
                selected
                  ? 'bg-brand-dark text-white border-brand-dark font-semibold'
                  : 'border-brand-dark/15 text-brand-dark/70 hover:border-brand-dark hover:text-brand-dark bg-white'
              }`}
            >
              {display}
            </button>
          );
        })}

        {hiddenSizes.length > 0 && (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className={`h-7 px-2 flex items-center gap-1 text-xs tracking-tight rounded-xs border transition-colors cursor-pointer whitespace-nowrap ${
              hasActiveHidden
                ? 'bg-brand-dark text-white border-brand-dark font-semibold'
                : 'border-brand-dark/15 text-brand-dark/70 hover:border-brand-dark hover:text-brand-dark bg-white'
            }`}
          >
            <span>{expanded ? 'Menos' : `+ Más (${hiddenSizes.length})`}</span>
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function CatalogSection() {
  const [products, setProducts] = useState([]);
  const [totalElements, setTotalElements] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);
  // Becomes true once filters have been read from the URL (after hydration), so we don't
  // fetch first with empty defaults and then again with the real filters.
  const [urlSynced, setUrlSynced] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Active filter state. Initialised with the same empty defaults the server renders
  // (avoids hydration mismatches); the real values are read from the URL in syncFromUrl()
  // right after mount.
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic available sizes calculated server-side
  const [availableSizes, setAvailableSizes] = useState([]);
  const [isLoadingSizes, setIsLoadingSizes] = useState(false);

  // "+ Más" expansion of the size filters (inline, wraps to new lines)
  const [showAllClothingSizes, setShowAllClothingSizes] = useState(false);
  const [showAllSneakerSizes, setShowAllSneakerSizes] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Separate and sort available sizes into clothing (textile) and sneakers (shoe numbers)
  const { clothingSizes, sneakerSizes } = useMemo(() => {
    const clothing = [];
    const sneakers = [];

    (availableSizes || []).forEach((size) => {
      if (!size) return;
      if (isShoeSize(size)) {
        sneakers.push(size);
      } else {
        clothing.push(size);
      }
    });

    return {
      clothingSizes: sortProductSizes(clothing),
      sneakerSizes: sortProductSizes(sneakers),
    };
  }, [availableSizes]);

  const productsReqIdRef = useRef(0);
  const filterOptionsReqIdRef = useRef(0);
  const selectedSizesRef = useRef(selectedSizes);
  selectedSizesRef.current = selectedSizes;

  // Pagination context of the current product list. Pagination strategy:
  // - 0 or 1 selected size: a single query (variantSize when 1 size), paged with page/size.
  // - 2+ sizes: the backend only supports ONE variantSize per request, so we issue one query
  //   per selected size, each paged independently (size 50), then merge + dedupe by id and
  //   sort by id desc. "Ver más productos" loads the next page of every query that still has more.
  const paginationRef = useRef({ base: {}, queries: [], multi: false });

  // Runs the next page of every query that still has results and returns the merged batch.
  const fetchNextBatch = async (pagination) => {
    const { base, queries } = pagination;
    const active = queries.filter((q) => q.hasNext);
    const results = await Promise.all(
      active.map((q) =>
        fetchProductsPage({
          ...base,
          variantSize: q.variantSize,
          size: CATALOG_PAGE_SIZE,
          page: q.nextPage,
        })
      )
    );
    const nextQueries = queries.map((q) => {
      const idx = active.indexOf(q);
      if (idx === -1) return q;
      return { ...q, nextPage: results[idx].page + 1, hasNext: results[idx].hasNext };
    });
    let batch = [];
    results.forEach((r) => {
      batch = batch.concat(r.products);
    });
    return {
      products: batch,
      nextQueries,
      // Only a single query has an exact total (sizes overlap across queries)
      totalElements: queries.length === 1 ? results[0]?.totalElements ?? null : null,
    };
  };

  const filterBySizes = (list, sizesVal) => {
    if (!Array.isArray(sizesVal) || sizesVal.length === 0) return list;
    const normSelected = sizesVal.map((s) => s.trim().toLowerCase());
    return list.filter((p) => {
      const available = (p.availableSizes || []).map((s) => String(s).trim().toLowerCase());
      return normSelected.some((sel) => available.includes(sel));
    });
  };

  // Fetch products according to active filters
  const loadProducts = async (
    catSlug = selectedCategory,
    catId = selectedCategoryId,
    brandSlug = selectedBrand,
    genderVal = selectedGender,
    sizesVal = selectedSizes,
    searchVal = searchQuery
  ) => {
    productsReqIdRef.current += 1;
    const reqId = productsReqIdRef.current;

    setIsLoading(true);
    setIsLoadingMore(false);
    setLoadMoreError(null);
    setErrorMessage(null);

    try {
      const sizeList = Array.isArray(sizesVal) ? sizesVal.filter(Boolean) : [];
      const isMulti = sizeList.length > 1;
      const currentPagination = {
        base: {
          category: catSlug || undefined,
          categoryId: catSlug ? undefined : (catId ?? undefined),
          brand: brandSlug || undefined,
          gender: genderVal || undefined,
          search: searchVal || undefined,
        },
        queries: (isMulti ? sizeList : [sizeList[0]]).map((variantSize) => ({
          variantSize: variantSize || undefined,
          nextPage: 0,
          hasNext: true,
        })),
        multi: isMulti,
      };

      const [firstBatch, fetchedCategories, fetchedBrands] = await Promise.all([
        fetchNextBatch(currentPagination),
        categories.length === 0 ? fetchCategories() : Promise.resolve(categories),
        brands.length === 0 ? fetchBrands().catch(() => []) : Promise.resolve(brands),
      ]);

      if (reqId !== productsReqIdRef.current) return;

      paginationRef.current = { ...currentPagination, queries: firstBatch.nextQueries };
      const finalProducts = mergeUniqueProducts(
        [],
        filterBySizes(firstBatch.products, sizesVal),
        isMulti
      );

      setProducts(finalProducts);
      setTotalElements(firstBatch.totalElements);
      setHasMore(firstBatch.nextQueries.some((q) => q.hasNext));
      if (fetchedCategories && fetchedCategories.length > 0) {
        setCategories(fetchedCategories);
      }
      if (fetchedBrands && fetchedBrands.length > 0) {
        setBrands(fetchedBrands);
      }
    } catch (err) {
      if (reqId !== productsReqIdRef.current) return;
      setHasMore(false);
      setErrorMessage(
        err.message || 'No se pudo conectar con el catálogo de productos.'
      );
    } finally {
      if (reqId === productsReqIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Loads the next page(s) and appends them (deduped by id). Uses the same request-id guard,
  // so a filter change while loading discards the stale result.
  const handleLoadMore = async () => {
    if (isLoading || isLoadingMore || !hasMore) return;
    const reqId = productsReqIdRef.current;
    const pagination = paginationRef.current;

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const batch = await fetchNextBatch(pagination);
      if (reqId !== productsReqIdRef.current) return;

      paginationRef.current = { ...pagination, queries: batch.nextQueries };
      const sizesNow = selectedSizesRef.current;
      setProducts((prev) =>
        mergeUniqueProducts(prev, filterBySizes(batch.products, sizesNow), pagination.multi)
      );
      setTotalElements(batch.totalElements);
      setHasMore(batch.nextQueries.some((q) => q.hasNext));
    } catch (err) {
      if (reqId !== productsReqIdRef.current) return;
      setLoadMoreError(
        err?.message || 'No se pudieron cargar más productos. Intentá nuevamente.'
      );
    } finally {
      if (reqId === productsReqIdRef.current) {
        setIsLoadingMore(false);
      }
    }
  };

  // Fetch dynamic size options from backend (independent of selected sizes)
  const loadSizes = async (
    catSlug = selectedCategory,
    catId = selectedCategoryId,
    brandSlug = selectedBrand,
    genderVal = selectedGender,
    searchVal = searchQuery
  ) => {
    filterOptionsReqIdRef.current += 1;
    const reqId = filterOptionsReqIdRef.current;
    setIsLoadingSizes(true);

    try {
      const res = await fetchFilterOptions({
        category: catSlug || undefined,
        categoryId: catSlug ? undefined : (catId ?? undefined),
        brand: brandSlug || undefined,
        gender: genderVal || undefined,
        title: searchVal || undefined,
      });

      if (reqId !== filterOptionsReqIdRef.current) return;

      const loadedSizes = Array.isArray(res?.availableSizes) ? res.availableSizes : [];
      setAvailableSizes(loadedSizes);

      // Consistency: if sizes are selected but no longer available, purge them
      const prevSizes = selectedSizesRef.current;
      if (prevSizes && prevSizes.length > 0 && loadedSizes.length > 0) {
        const valid = prevSizes.filter((sel) =>
          loadedSizes.some((ls) => ls.trim().toLowerCase() === sel.trim().toLowerCase())
        );
        if (valid.length !== prevSizes.length) {
          setSelectedSizes(valid);
          updateCatalogUrl({ sizes: valid }, false);
        }
      }
    } catch {
      if (reqId !== filterOptionsReqIdRef.current) return;
      setAvailableSizes([]);
    } finally {
      if (reqId === filterOptionsReqIdRef.current) {
        setIsLoadingSizes(false);
      }
    }
  };

  // Sync state from current URL
  const syncFromUrl = () => {
    if (typeof window === 'undefined') return;
    const parsed = parseCatalogParams(window.location.search);
    setSelectedCategory(parsed.category);
    setSelectedCategoryId(parsed.categoryId);
    setSelectedBrand(parsed.brand);
    setSelectedGender(parsed.gender);
    const rawSize = parsed.size;
    const sizes = rawSize ? rawSize.split(',').map((s) => s.trim()).filter(Boolean) : [];
    // Keep the same array reference when nothing changed to avoid redundant refetches
    setSelectedSizes((prev) =>
      prev.length === sizes.length && prev.every((s, i) => s === sizes[i]) ? prev : sizes
    );
    setSearchQuery(parsed.search);
    setUrlSynced(true);
  };

  // On mount and URL change listeners (popstate & catalog event)
  useEffect(() => {
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('the-office:catalog-url-change', syncFromUrl);

    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('the-office:catalog-url-change', syncFromUrl);
    };
  }, []);

  // When categories load, resolve legacy categoryId into category slug if needed
  useEffect(() => {
    if (!selectedCategory && selectedCategoryId && categories.length > 0) {
      const matched = categories.find((c) => c.id === selectedCategoryId);
      if (matched && matched.slug) {
        setSelectedCategory(matched.slug);
      }
    }
  }, [categories, selectedCategory, selectedCategoryId]);

  // Load products whenever active filters change
  useEffect(() => {
    if (!urlSynced) return;
    loadProducts(
      selectedCategory,
      selectedCategoryId,
      selectedBrand,
      selectedGender,
      selectedSizes,
      searchQuery
    );
  }, [
    urlSynced,
    selectedCategory,
    selectedCategoryId,
    selectedBrand,
    selectedGender,
    selectedSizes,
    searchQuery,
  ]);

  // Load available size options whenever criteria other than size change
  useEffect(() => {
    if (!urlSynced) return;
    loadSizes(
      selectedCategory,
      selectedCategoryId,
      selectedBrand,
      selectedGender,
      searchQuery
    );
  }, [
    urlSynced,
    selectedCategory,
    selectedCategoryId,
    selectedBrand,
    selectedGender,
    searchQuery,
  ]);

  // Unified catalog URL updater
  const updateCatalogUrl = (nextFilters, usePush = false) => {
    if (typeof window === 'undefined') return;

    const targetCategory =
      nextFilters.category !== undefined ? nextFilters.category : selectedCategory;
    const targetCategoryId =
      nextFilters.categoryId !== undefined
        ? nextFilters.categoryId
        : targetCategory
        ? null
        : selectedCategoryId;
    const targetBrand =
      nextFilters.brand !== undefined ? nextFilters.brand : selectedBrand;
    const targetGender =
      nextFilters.gender !== undefined ? nextFilters.gender : selectedGender;
    const targetSizes =
      nextFilters.sizes !== undefined
        ? nextFilters.sizes
        : nextFilters.size !== undefined
        ? (nextFilters.size ? [nextFilters.size] : [])
        : selectedSizes;
    const targetSearch =
      nextFilters.search !== undefined ? nextFilters.search : searchQuery;

    const nextHref = buildCatalogHref({
      category: targetCategory,
      categoryId: targetCategoryId,
      brand: targetBrand,
      gender: targetGender,
      size: targetSizes.length > 0 ? targetSizes.join(',') : null,
      search: targetSearch,
    });

    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentHref !== nextHref) {
      if (usePush) {
        window.history.pushState({}, '', nextHref);
      } else {
        window.history.replaceState({}, '', nextHref);
      }
      window.dispatchEvent(new CustomEvent('the-office:catalog-url-change'));
    }
  };

  // Filter actions
  const handleCategorySelect = (cat) => {
    const nextSlug = cat ? cat.slug : null;
    const nextId = cat ? cat.id : null;
    setSelectedCategory(nextSlug);
    setSelectedCategoryId(nextSlug ? null : nextId);
    updateCatalogUrl({ category: nextSlug, categoryId: nextSlug ? null : nextId }, true);
  };

  const handleGenderSelect = (genderValue) => {
    const nextGender = selectedGender === genderValue ? null : genderValue;
    setSelectedGender(nextGender);
    updateCatalogUrl({ gender: nextGender }, true);
  };

  const handleToggleSize = (sizeValue) => {
    if (!sizeValue) return;
    const exists = selectedSizes.some(
      (s) => s.trim().toLowerCase() === sizeValue.trim().toLowerCase()
    );
    const nextSizes = exists
      ? selectedSizes.filter((s) => s.trim().toLowerCase() !== sizeValue.trim().toLowerCase())
      : [...selectedSizes, sizeValue];

    setSelectedSizes(nextSizes);
    updateCatalogUrl({ sizes: nextSizes }, true);
  };

  const handleRemoveSize = (sizeToRemove) => {
    const nextSizes = selectedSizes.filter(
      (s) => s.trim().toLowerCase() !== sizeToRemove.trim().toLowerCase()
    );
    setSelectedSizes(nextSizes);
    updateCatalogUrl({ sizes: nextSizes }, true);
  };

  const handleClearCategory = () => {
    setSelectedCategory(null);
    setSelectedCategoryId(null);
    updateCatalogUrl({ category: null, categoryId: null }, true);
  };

  const handleClearBrand = () => {
    setSelectedBrand(null);
    updateCatalogUrl({ brand: null }, true);
  };

  const handleClearGender = () => {
    setSelectedGender(null);
    updateCatalogUrl({ gender: null }, true);
  };

  const handleClearSizes = () => {
    setSelectedSizes([]);
    updateCatalogUrl({ sizes: [] }, true);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    updateCatalogUrl({ search: '' }, true);
  };

  const handleResetAllFilters = () => {
    setSelectedCategory(null);
    setSelectedCategoryId(null);
    setSelectedBrand(null);
    setSelectedGender(null);
    setSelectedSizes([]);
    setSearchQuery('');
    updateCatalogUrl(
      {
        category: null,
        categoryId: null,
        brand: null,
        gender: null,
        sizes: [],
        search: '',
      },
      true
    );
  };

  // Preserves active filters when opening a product detail
  const buildProductDetailHref = (productId) => {
    const params = new URLSearchParams();
    if (selectedCategory) {
      params.set('category', selectedCategory);
      params.set('fromCategory', selectedCategory);
    } else if (selectedCategoryId) {
      params.set('categoryId', String(selectedCategoryId));
      params.set('fromCategory', String(selectedCategoryId));
    }
    if (selectedBrand) {
      params.set('brand', selectedBrand);
      params.set('fromBrand', selectedBrand);
    }
    if (selectedGender) {
      params.set('gender', selectedGender.toLowerCase());
      params.set('fromGender', selectedGender.toLowerCase());
    }
    if (selectedSizes.length > 0) {
      const sizesStr = selectedSizes.join(',');
      params.set('size', sizesStr);
      params.set('fromSize', sizesStr);
    }
    if (searchQuery) {
      params.set('search', searchQuery);
      params.set('fromSearch', searchQuery);
    }
    const queryStr = params.toString();
    return queryStr ? `/products/${productId}?${queryStr}` : `/products/${productId}`;
  };

  // Active filter label resolvers
  const activeCategoryName = useMemo(() => {
    if (selectedCategory) {
      const match = categories.find(
        (c) => c.slug?.toLowerCase() === selectedCategory.toLowerCase()
      );
      return match ? match.name : selectedCategory;
    }
    if (selectedCategoryId) {
      const match = categories.find((c) => c.id === selectedCategoryId);
      return match ? match.name : `Categoría #${selectedCategoryId}`;
    }
    return null;
  }, [categories, selectedCategory, selectedCategoryId]);

  const activeBrandName = useMemo(() => {
    if (!selectedBrand) return null;
    const match = brands.find(
      (b) => b.slug?.toLowerCase() === selectedBrand.toLowerCase()
    );
    return match ? match.name : selectedBrand.charAt(0).toUpperCase() + selectedBrand.slice(1);
  }, [brands, selectedBrand]);

  const genderLabelMap = GENDER_LABELS;

  const hasAnyActiveFilter = Boolean(
    searchQuery ||
    selectedBrand ||
    selectedCategory ||
    selectedCategoryId ||
    selectedGender ||
    selectedSizes.length > 0
  );

  return (
    <section
      id="catalogo"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24 scroll-mt-20"
      aria-label="Catálogo de productos"
    >
      {/* 1. Header with Index Counter and Category Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-brand-dark/[0.08] pb-3 mb-4 sm:mb-6">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm sm:text-base font-semibold tracking-tight text-brand-dark uppercase">
            Selected Catalog
          </h2>
          <span className="text-[11px] font-mono tracking-widest text-brand-dark/40">
            [{isLoading ? '--' : (totalElements ?? products.length).toString().padStart(2, '0')}]
          </span>
        </div>

        {/* Dynamic Category Filter Tabs */}
        <div className="flex items-center gap-4 sm:gap-5 overflow-x-auto text-xs font-medium text-brand-dark/45 no-scrollbar">
          <button
            type="button"
            onClick={() => handleCategorySelect(null)}
            className={`transition-colors cursor-pointer pb-0.5 whitespace-nowrap ${
              !selectedCategory && !selectedCategoryId
                ? 'text-brand-dark font-semibold border-b border-brand-dark'
                : 'hover:text-brand-dark'
            }`}
          >
            Shop All
          </button>
          {categories.map((cat) => {
            const isSelected =
              (selectedCategory && cat.slug?.toLowerCase() === selectedCategory.toLowerCase()) ||
              (!selectedCategory && selectedCategoryId === cat.id);

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat)}
                className={`transition-colors cursor-pointer pb-0.5 whitespace-nowrap ${
                  isSelected
                    ? 'text-brand-dark font-semibold border-b border-brand-dark'
                    : 'hover:text-brand-dark'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Secondary Filter Bar (Gender, Talles & Números) */}
      <div className="flex flex-col gap-3.5 py-3 border-b border-brand-dark/[0.06] mb-6">
        <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6">
          {/* Gender Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark/40 mr-1 shrink-0">
              Género:
            </span>
            {[
              { value: null, label: 'Todos' },
              { value: 'MEN', label: 'Hombre' },
              { value: 'WOMEN', label: 'Mujer' },
              { value: 'UNISEX', label: 'Unisex' },
            ].map((item) => {
              const isActive =
                item.value === null ? selectedGender === null : selectedGender === item.value;
              return (
                <button
                  key={`gender-${item.label}`}
                  type="button"
                  onClick={() => handleGenderSelect(item.value)}
                  className={`px-3 py-1 text-xs tracking-tight rounded-xs border transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-brand-dark text-white border-brand-dark font-medium'
                      : 'border-brand-dark/15 text-brand-dark/70 hover:border-brand-dark hover:text-brand-dark bg-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Sizes / Numbers Filter Options (inline expansion: wraps instead of overflowing) */}
          {((clothingSizes && clothingSizes.length > 0) || (sneakerSizes && sneakerSizes.length > 0)) && (
            <div className="flex flex-wrap items-start gap-y-2.5 gap-x-5 min-w-0 max-w-full">
              {clothingSizes.length > 0 && (
                <SizeFilterGroup
                  label="Talles:"
                  sizes={clothingSizes}
                  selectedSizes={selectedSizes}
                  onToggleSize={handleToggleSize}
                  expanded={showAllClothingSizes}
                  onToggleExpanded={() => setShowAllClothingSizes((prev) => !prev)}
                  formatLabel={(size) => size}
                  titlePrefix="Filtrar por talle"
                  minWidthClass="min-w-[32px]"
                />
              )}
              {sneakerSizes.length > 0 && (
                <SizeFilterGroup
                  label="Números:"
                  sizes={sneakerSizes}
                  selectedSizes={selectedSizes}
                  onToggleSize={handleToggleSize}
                  expanded={showAllSneakerSizes}
                  onToggleExpanded={() => setShowAllSneakerSizes((prev) => !prev)}
                  formatLabel={(size) => formatProductSize(size, 'sneakers')}
                  titlePrefix="Filtrar por número"
                  minWidthClass="min-w-[34px]"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Active Filters Chips Banner */}
      {hasAnyActiveFilter && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8 px-3.5 py-2.5 bg-brand-dark/[0.03] border border-brand-dark/12 rounded-xs"
          aria-live="polite"
        >
          <div className="flex items-center flex-wrap gap-2 text-xs text-brand-dark/75">
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xs border border-brand-dark/10">
                <span>Búsqueda:</span>
                <strong className="text-brand-dark font-medium">«{searchQuery}»</strong>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Quitar filtro de búsqueda"
                  className="ml-1 text-brand-dark/40 hover:text-brand-dark font-bold cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}

            {activeCategoryName && (
              <span className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xs border border-brand-dark/10">
                <span>Categoría:</span>
                <strong className="text-brand-dark font-medium">{activeCategoryName}</strong>
                <button
                  type="button"
                  onClick={handleClearCategory}
                  aria-label="Quitar filtro de categoría"
                  className="ml-1 text-brand-dark/40 hover:text-brand-dark font-bold cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}

            {activeBrandName && (
              <span className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xs border border-brand-dark/10">
                <span>Marca:</span>
                <strong className="text-brand-dark font-medium">{activeBrandName}</strong>
                <button
                  type="button"
                  onClick={handleClearBrand}
                  aria-label="Quitar filtro de marca"
                  className="ml-1 text-brand-dark/40 hover:text-brand-dark font-bold cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}

            {selectedGender && (
              <span className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xs border border-brand-dark/10">
                <span>Género:</span>
                <strong className="text-brand-dark font-medium">{genderLabelMap[selectedGender] || selectedGender}</strong>
                <button
                  type="button"
                  onClick={handleClearGender}
                  aria-label="Quitar filtro de género"
                  className="ml-1 text-brand-dark/40 hover:text-brand-dark font-bold cursor-pointer"
                >
                  ×
                </button>
              </span>
            )}

            {selectedSizes.length > 0 &&
              selectedSizes.map((sz) => {
                const isShoe = isShoeSize(sz);
                const display = isShoe ? formatProductSize(sz, 'sneakers') : sz;
                return (
                  <span
                    key={`chip-size-${sz}`}
                    className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xs border border-brand-dark/10"
                  >
                    <span>{isShoe ? 'Número:' : 'Talle:'}</span>
                    <strong className="text-brand-dark font-medium tabular-nums">{display}</strong>
                    <button
                      type="button"
                      onClick={() => handleRemoveSize(sz)}
                      aria-label={`Quitar filtro de ${isShoe ? 'número' : 'talle'} ${display}`}
                      className="ml-1 text-brand-dark/40 hover:text-brand-dark font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAllFilters}
              aria-label="Limpiar todos los filtros"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-dark hover:bg-brand-dark hover:text-[#FAFAFA] border border-brand-dark/20 rounded-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer"
            >
              <span>Limpiar filtros</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Loading State: Minimalist Skeletons */}
      {isLoading && (
        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3.5 gap-y-7 sm:gap-x-5 sm:gap-y-9 lg:gap-x-6 lg:gap-y-12"
          aria-live="polite"
          aria-busy="true"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col animate-pulse">
              <div className="aspect-[4/5] w-full bg-[#F2F2F0] rounded-xs" />
              <div className="mt-3 space-y-2">
                <div className="h-2 w-14 bg-brand-dark/10 rounded-xs" />
                <div className="h-3 w-4/5 bg-brand-dark/15 rounded-xs" />
                <div className="h-3 w-1/3 bg-brand-dark/20 rounded-xs" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Error State */}
      {!isLoading && errorMessage && (
        <div className="py-16 sm:py-20 px-6 sm:px-10 max-w-xl mx-auto text-center border border-brand-dark/10 bg-[#FAF9F6]/80 backdrop-blur-sm rounded-xs space-y-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-dark/5 text-brand-dark/60 mb-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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
          <h3 className="text-sm sm:text-base font-semibold tracking-tight text-brand-dark">
            Servicio de catálogo no disponible
          </h3>
          <p className="text-xs sm:text-sm text-brand-dark/60 leading-relaxed">
            {errorMessage}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() =>
                loadProducts(
                  selectedCategory,
                  selectedCategoryId,
                  selectedBrand,
                  selectedGender,
                  selectedSizes,
                  searchQuery
                )
              }
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] bg-brand-dark hover:opacity-85 transition-opacity rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer"
            >
              Reintentar conexión
            </button>
          </div>
        </div>
      )}

      {/* 6. Empty State */}
      {!isLoading && !errorMessage && products.length === 0 && (
        <div className="py-16 sm:py-24 text-center space-y-3">
          <p className="text-sm font-medium text-brand-dark/65">
            {searchQuery
              ? `No se encontraron productos que coincidan con «${searchQuery}»${
                  activeCategoryName ? ` en ${activeCategoryName}` : ''
                }.`
              : 'No hay productos disponibles para los filtros seleccionados.'}
          </p>
          <div className="flex items-center justify-center flex-wrap gap-4 pt-1">
            {hasAnyActiveFilter && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="text-xs font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* 7. Product Grid */}
      {!isLoading && !errorMessage && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3.5 gap-y-7 sm:gap-x-5 sm:gap-y-9 lg:gap-x-6 lg:gap-y-12">
          {products.map((product) => (
            <ProductGridCard
              key={product.id}
              product={product}
              href={buildProductDetailHref(product.id)}
            />
          ))}
        </div>
      )}

      {/* 8. Load more (next page) */}
      {!isLoading && !errorMessage && products.length > 0 && (hasMore || loadMoreError) && (
        <div className="flex flex-col items-center gap-3 pt-10 sm:pt-12">
          {loadMoreError && (
            <p className="text-xs text-red-800" role="alert">
              {loadMoreError}
            </p>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              aria-busy={isLoadingMore}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-brand-dark border border-brand-dark/20 rounded-xs hover:bg-brand-dark hover:text-[#FAFAFA] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? 'Cargando...' : 'Ver más productos'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
