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
import CategoryIcon from './icons/CategoryIcon';

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

/** Category filter pill: icon + name. Active = brand-dark fill with sand text/icon. */
function CategoryFilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      className={`inline-flex h-11 shrink-0 cursor-pointer snap-start items-center gap-2 whitespace-nowrap rounded-full pl-3.5 pr-4 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark ${
        active
          ? 'bg-brand-dark font-semibold text-brand-sand'
          : 'bg-sunken font-medium text-brand-dark hover:bg-brand-dark/10'
      }`}
    >
      {children}
    </button>
  );
}

const GENDER_OPTIONS = [
  { value: null, label: 'Todos' },
  { value: 'MEN', label: 'Hombre' },
  { value: 'WOMEN', label: 'Mujer' },
  { value: 'UNISEX', label: 'Unisex' },
];

/** iOS-style segmented control for gender (same toggle behaviour as before, only the look changed). */
function GenderControl({ selectedGender, onSelect, full = false }) {
  return (
    <div
      role="radiogroup"
      aria-label="Género"
      className={`grid grid-cols-4 rounded-full bg-brand-dark/[0.06] p-1 ${full ? 'w-full' : 'md:inline-grid'}`}
    >
      {GENDER_OPTIONS.map((item) => {
        const isActive = item.value === null ? selectedGender === null : selectedGender === item.value;
        return (
          <button
            key={`gender-${item.label}`}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(item.value)}
            className={`h-11 whitespace-nowrap rounded-full px-3 text-sm transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark md:h-9 md:px-4 ${
              isActive
                ? 'bg-white font-semibold text-brand-dark shadow-[0_1px_3px_rgb(29_17_13/0.14)]'
                : 'font-medium text-ink-muted hover:text-brand-dark'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Removable active-filter chip (sand fill + brand-dark text). */
function FilterChip({ label, value, onRemove, removeLabel }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full bg-brand-sand pl-3.5 pr-1 text-[13px] text-brand-dark shadow-hairline">
      <span>{label}</span>
      <strong className="font-semibold tabular-nums">{value}</strong>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="grid size-7 cursor-pointer place-items-center rounded-full transition-colors hover:bg-brand-sand-deep focus-visible:outline-2 focus-visible:outline-brand-dark"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </span>
  );
}

/**
 * Size filter row. "+ Más" expands the remaining sizes inline and they wrap onto new lines,
 * so the row never overflows the viewport (the old absolute dropdown caused horizontal scroll).
 * `stacked` puts the label above the chips (bottom sheet); otherwise it sits inline (md+ bar).
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
  stacked = false,
}) {
  const isSelected = (size) =>
    selectedSizes.some((s) => s.trim().toLowerCase() === size.trim().toLowerCase());
  const hiddenSizes = sizes.slice(VISIBLE_SIZES_COLLAPSED);
  const visibleSizes = expanded ? sizes : sizes.slice(0, VISIBLE_SIZES_COLLAPSED);
  const hasActiveHidden = !expanded && hiddenSizes.some(isSelected);

  return (
    <div className={stacked ? 'flex flex-col gap-3' : 'flex min-w-0 max-w-full items-start gap-3'}>
      <span
        className={`text-[13px] font-semibold text-ink-muted ${stacked ? '' : 'shrink-0 leading-10'}`}
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
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
              className={`flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full px-3.5 text-sm tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark md:h-10 md:min-w-10 ${
                selected
                  ? 'bg-brand-dark font-semibold text-brand-sand'
                  : 'bg-sunken font-medium text-brand-dark hover:bg-brand-dark/10'
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
            className={`flex h-11 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark md:h-10 ${
              hasActiveHidden
                ? 'bg-brand-dark font-semibold text-brand-sand'
                : 'font-medium text-brand-dark hover:bg-brand-dark/10'
            }`}
          >
            <span>{expanded ? 'Menos' : `+ ${hiddenSizes.length} más`}</span>
            <svg
              className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
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

  // Mobile filters bottom sheet (UI-only state)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const sheetRef = useRef(null);
  const filtersTriggerRef = useRef(null);

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

  const totalCount = totalElements ?? products.length;
  const hasAnySizes = clothingSizes.length > 0 || sneakerSizes.length > 0;
  // Filters living inside the bottom sheet (gender + sizes); category pills stay visible outside it
  const sheetFilterCount = (selectedGender ? 1 : 0) + selectedSizes.length;

  const closeFilterSheet = () => setIsFilterSheetOpen(false);

  // Clears gender + sizes in a single URL update (two separate clears would read stale state)
  const handleClearSheetFilters = () => {
    setSelectedGender(null);
    setSelectedSizes([]);
    updateCatalogUrl({ gender: null, sizes: [] }, true);
  };

  // Bottom sheet a11y: body scroll lock, focus trap, Escape to close, restore focus, auto-close on md+
  useEffect(() => {
    if (!isFilterSheetOpen) return undefined;
    const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';

    const sheetEl = sheetRef.current;
    if (sheetEl) {
      const first = sheetEl.querySelector(FOCUSABLE);
      (first || sheetEl).focus();
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsFilterSheetOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const el = sheetRef.current;
      if (!el) return;
      const nodes = Array.from(el.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const mq = window.matchMedia('(min-width: 768px)');
    const onMqChange = (e) => {
      if (e.matches) setIsFilterSheetOpen(false);
    };
    mq.addEventListener('change', onMqChange);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      mq.removeEventListener('change', onMqChange);
      document.body.style.overflow = previousOverflow;
      const target = filtersTriggerRef.current || previousFocus;
      if (target && typeof target.focus === 'function') target.focus();
    };
  }, [isFilterSheetOpen]);

  return (
    <section
      id="catalogo"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-8 sm:pb-12 scroll-mt-24"
      aria-label="Catálogo de productos"
    >
      {/* 1. Header: title + product count */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-brand-dark sm:text-[2rem]">
          Todo el catálogo
        </h2>
        <p className="mt-1 text-[15px] tabular-nums text-ink-muted" aria-live="polite">
          {isLoading
            ? 'Cargando productos…'
            : `${totalCount} ${totalCount === 1 ? 'producto' : 'productos'}`}
        </p>
      </div>

      {/* 2. Filter card: category pills + (md+) inline gender / sizes, (mobile) "Filtros" button */}
      <div className="mb-5 rounded-tile bg-white p-4 shadow-card sm:p-5">
        {/* Category filter pills (icon + name): snap scroll on mobile, wrap on lg */}
        <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 sm:-mx-5 sm:scroll-px-5 sm:px-5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          <CategoryFilterPill
            active={!selectedCategory && !selectedCategoryId}
            onClick={() => handleCategorySelect(null)}
          >
            <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
              <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
              <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
              <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
            </svg>
            Todo
          </CategoryFilterPill>
          {categories.map((cat) => {
            const isSelected =
              (selectedCategory && cat.slug?.toLowerCase() === selectedCategory.toLowerCase()) ||
              (!selectedCategory && selectedCategoryId === cat.id);

            return (
              <CategoryFilterPill
                key={cat.id}
                active={isSelected}
                onClick={() => handleCategorySelect(cat)}
              >
                <CategoryIcon category={cat} className="size-5 shrink-0" />
                {cat.name}
              </CategoryFilterPill>
            );
          })}
        </div>

        {/* Mobile: single "Filtros" button that opens the bottom sheet */}
        <div className="mt-3 flex items-center md:hidden">
          <button
            ref={filtersTriggerRef}
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isFilterSheetOpen}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-sunken px-4 text-sm font-medium text-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="8" cy="17" r="2" />
            </svg>
            Filtros
            {sheetFilterCount > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-brand-dark px-1.5 py-0.5 text-xs font-semibold leading-none text-brand-sand">
                {sheetFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* md+: inline gender + sizes (wraps instead of overflowing) */}
        <div className="mt-4 hidden flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-hairline pt-4 md:flex">
          <GenderControl selectedGender={selectedGender} onSelect={handleGenderSelect} />
          {hasAnySizes && (
            <div className="flex min-w-0 max-w-full flex-wrap items-start gap-x-6 gap-y-3">
              {clothingSizes.length > 0 && (
                <SizeFilterGroup
                  label="Talle"
                  sizes={clothingSizes}
                  selectedSizes={selectedSizes}
                  onToggleSize={handleToggleSize}
                  expanded={showAllClothingSizes}
                  onToggleExpanded={() => setShowAllClothingSizes((prev) => !prev)}
                  formatLabel={(size) => size}
                  titlePrefix="Filtrar por talle"
                />
              )}
              {sneakerSizes.length > 0 && (
                <SizeFilterGroup
                  label="Número"
                  sizes={sneakerSizes}
                  selectedSizes={selectedSizes}
                  onToggleSize={handleToggleSize}
                  expanded={showAllSneakerSizes}
                  onToggleExpanded={() => setShowAllSneakerSizes((prev) => !prev)}
                  formatLabel={(size) => formatProductSize(size, 'sneakers')}
                  titlePrefix="Filtrar por número"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Active Filters Chips */}
      {hasAnyActiveFilter && (
        <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8" aria-live="polite">
          {searchQuery && (
            <FilterChip
              label="Búsqueda:"
              value={`«${searchQuery}»`}
              onRemove={handleClearSearch}
              removeLabel="Quitar filtro de búsqueda"
            />
          )}
          {activeCategoryName && (
            <FilterChip
              label="Categoría:"
              value={activeCategoryName}
              onRemove={handleClearCategory}
              removeLabel="Quitar filtro de categoría"
            />
          )}
          {activeBrandName && (
            <FilterChip
              label="Marca:"
              value={activeBrandName}
              onRemove={handleClearBrand}
              removeLabel="Quitar filtro de marca"
            />
          )}
          {selectedGender && (
            <FilterChip
              label="Género:"
              value={genderLabelMap[selectedGender] || selectedGender}
              onRemove={handleClearGender}
              removeLabel="Quitar filtro de género"
            />
          )}
          {selectedSizes.map((sz) => {
            const isShoe = isShoeSize(sz);
            const display = isShoe ? formatProductSize(sz, 'sneakers') : sz;
            return (
              <FilterChip
                key={`chip-size-${sz}`}
                label={isShoe ? 'Número:' : 'Talle:'}
                value={display}
                onRemove={() => handleRemoveSize(sz)}
                removeLabel={`Quitar filtro de ${isShoe ? 'número' : 'talle'} ${display}`}
              />
            );
          })}
          <button
            type="button"
            onClick={handleResetAllFilters}
            aria-label="Limpiar todos los filtros"
            className="inline-flex h-11 cursor-pointer items-center px-2 text-[13px] font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-brand-dark"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Mobile filters bottom sheet (rendered only while open) */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 animate-fadeIn bg-brand-dark/45"
            onClick={closeFilterSheet}
            aria-hidden="true"
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-filters-title"
            tabIndex={-1}
            className="animate-sheet-up absolute inset-x-0 bottom-0 flex max-h-[88%] flex-col rounded-t-tile bg-brand-light shadow-sheet focus:outline-none motion-reduce:animate-none"
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-brand-dark/15" aria-hidden="true" />
            <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-2">
              <h2 id="catalog-filters-title" className="text-headline text-brand-dark">
                Filtros
              </h2>
              <button
                type="button"
                onClick={closeFilterSheet}
                aria-label="Cerrar filtros"
                className="grid size-11 cursor-pointer place-items-center rounded-full text-brand-dark hover:bg-brand-dark/[0.06] focus-visible:outline-2 focus-visible:outline-brand-dark"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-5 pt-2">
              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-ink-muted">Género</span>
                <GenderControl selectedGender={selectedGender} onSelect={handleGenderSelect} full />
              </div>
              {clothingSizes.length > 0 && (
                <SizeFilterGroup
                  stacked
                  label="Talle"
                  sizes={clothingSizes}
                  selectedSizes={selectedSizes}
                  onToggleSize={handleToggleSize}
                  expanded={showAllClothingSizes}
                  onToggleExpanded={() => setShowAllClothingSizes((prev) => !prev)}
                  formatLabel={(size) => size}
                  titlePrefix="Filtrar por talle"
                />
              )}
              {sneakerSizes.length > 0 && (
                <SizeFilterGroup
                  stacked
                  label="Número"
                  sizes={sneakerSizes}
                  selectedSizes={selectedSizes}
                  onToggleSize={handleToggleSize}
                  expanded={showAllSneakerSizes}
                  onToggleExpanded={() => setShowAllSneakerSizes((prev) => !prev)}
                  formatLabel={(size) => formatProductSize(size, 'sneakers')}
                  titlePrefix="Filtrar por número"
                />
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-hairline px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={handleClearSheetFilters}
                disabled={sheetFilterCount === 0}
                className="h-12 shrink-0 cursor-pointer rounded-full px-4 text-[15px] font-medium text-ink-muted hover:text-brand-dark disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-dark"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={closeFilterSheet}
                className="h-12 flex-1 cursor-pointer rounded-full bg-brand-dark px-4 text-[15px] font-semibold text-brand-sand transition-colors hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark"
              >
                {isLoading ? 'Ver productos' : `Ver ${totalCount} ${totalCount === 1 ? 'producto' : 'productos'}`}
              </button>
            </div>
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
              <div className="aspect-[4/5] w-full rounded-card bg-sunken" />
              <div className="mt-3 space-y-2">
                <div className="h-3 w-1/3 rounded-full bg-sunken" />
                <div className="h-4 w-4/5 rounded-full bg-sunken" />
                <div className="h-4 w-1/3 rounded-full bg-sunken" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Error State */}
      {!isLoading && errorMessage && (
        <div className="py-12 sm:py-16 px-6 sm:px-10 max-w-xl mx-auto text-center bg-white shadow-card rounded-tile space-y-4">
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
              className="inline-flex h-11 items-center justify-center px-6 text-sm font-semibold text-brand-light bg-brand-dark hover:bg-ink-soft transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer"
            >
              Reintentar conexión
            </button>
          </div>
        </div>
      )}

      {/* 6. Empty State */}
      {!isLoading && !errorMessage && products.length === 0 && (
        <div className="py-16 sm:py-24 text-center space-y-3">
          <p className="text-[15px] font-medium text-ink-muted">
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
                className="inline-flex h-11 items-center text-sm font-semibold text-brand-dark underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
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
              className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 px-8 text-[15px] font-semibold text-brand-dark bg-white shadow-hairline rounded-full hover:shadow-card transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? 'Cargando...' : 'Ver más productos'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
