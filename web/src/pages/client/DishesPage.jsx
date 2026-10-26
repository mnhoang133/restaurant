import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient, resolveImageUrl } from '../../api/client';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView } from '../../components/StateViews';

const DEFAULT_CATEGORIES = [
  'Gà Rán',
  'Burger',
  'Ăn Kèm',
  'Combo',
  'Nước Uống',
  'Tráng Miệng',
];

const SEARCH_MODES = [
  {
    id: 'basic',
    name: 'Cơ bản',
    icon: 'search',
    desc: 'Tìm một phần tên món ăn (LIKE không phân biệt hoa thường)',
  },
  {
    id: 'advanced',
    name: 'Nâng cao',
    icon: 'list',
    desc: 'Kết hợp nhiều tiêu chí AND (Tên, Danh mục, Khoảng giá, Trạng thái)',
  },
  {
    id: 'fulltext',
    name: 'Toàn văn (FTS)',
    icon: 'sparkle',
    desc: 'PostgreSQL FTS simple trên Tên & Mô tả món, xếp hạng theo độ khớp',
  },
  {
    id: 'fuzzy',
    name: 'Gần đúng (Fuzzy)',
    icon: 'pan',
    desc: 'pg_trgm bắt lỗi chính tả, gõ nhầm ký tự (similarity >= 0.3)',
  },
];

const PAGINATION_MODES = [
  {
    id: 'numbers',
    label: 'Số trang',
    badge: 'Page Numbering',
    icon: 'grid',
    desc: 'Chọn trang cụ thể để thay danh sách đang xem',
  },
  {
    id: 'loadmore',
    label: 'Tải thêm',
    badge: 'Load More',
    icon: 'plus',
    desc: 'Bấm nút để nối tiếp các món mới vào đuôi danh sách',
  },
  {
    id: 'infinite',
    label: 'Cuộn vô tận',
    badge: 'Infinite Scroll',
    icon: 'arrow-right',
    desc: 'Tự động tải thêm khi cuộn trang gần tới chân danh sách',
  },
];

const PAGE_SIZE_OPTIONS = [6, 9, 12, 18];

export default function DishesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. ĐỌC THAM SỐ TỪ URL (Slide 14 & 15: Mở lại đúng kết quả qua URL)
  const modeParam = searchParams.get('mode') || 'basic';
  const qParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const availableParam = searchParams.get('available') || ''; // 'true' | 'false' | ''
  const sortByParam =
    searchParams.get('sortBy') ||
    (modeParam === 'fulltext' ? 'rank' : modeParam === 'fuzzy' ? 'similarity' : 'id');
  const sortOrderParam =
    searchParams.get('sortOrder') ||
    (sortByParam === 'rank' || sortByParam === 'similarity' ? 'desc' : 'asc');
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSizeParam = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') || '9', 10) || 9)
  );
  const paginationMode = searchParams.get('paginationMode') || 'numbers'; // 'numbers' | 'loadmore' | 'infinite'

  // 2. FORM STATE (Dữ liệu nhập liệu trên Form)
  const [searchInput, setSearchInput] = useState(qParam);
  const [categoryInput, setCategoryInput] = useState(categoryParam);
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);
  const [availableInput, setAvailableInput] = useState(availableParam);
  const [sortByInput, setSortByInput] = useState(sortByParam);
  const [sortOrderInput, setSortOrderInput] = useState(sortOrderParam);
  const [pageSizeInput, setPageSizeInput] = useState(pageSizeParam);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // 3. DATA & LOADING STATES
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [dishes, setDishes] = useState([]); // Dùng cho 'numbers' mode
  const [accumulatedDishes, setAccumulatedDishes] = useState([]); // Dùng cho 'loadmore' & 'infinite'
  const [metadata, setMetadata] = useState({
    total: 0,
    page: 1,
    pageSize: 9,
    totalPages: 0,
  });
  const [errorInfo, setErrorInfo] = useState({ message: '', fields: null });

  // 4. LOAD MORE & INFINITE SCROLL STATE (Slide 12 & 13)
  const [loadedPage, setLoadedPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadMoreError, setLoadMoreError] = useState(null);

  // Refs để quản lý đồng bộ tránh race condition & duplicate calls (Slide 13)
  const pendingRef = useRef(false);
  const sentinelRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Cập nhật form input khi URL params thay đổi (Back/Forward navigation, Slide 15)
  useEffect(() => {
    setSearchInput(qParam);
    setCategoryInput(categoryParam);
    setMinPriceInput(minPriceParam);
    setMaxPriceInput(maxPriceParam);
    setAvailableInput(availableParam);
    setSortByInput(sortByParam);
    setSortOrderInput(sortOrderParam);
    setPageSizeInput(pageSizeParam);
  }, [
    qParam,
    categoryParam,
    minPriceParam,
    maxPriceParam,
    availableParam,
    sortByParam,
    sortOrderParam,
    pageSizeParam,
  ]);

  useEffect(() => {
    document.title = 'Thực đơn & Tìm kiếm món ăn · CRISPY HOUSE';
  }, []);

  // Tải danh mục thực tế từ backend (nếu có)
  useEffect(() => {
    let isMounted = true;
    apiClient.dishes.getCategories().then((res) => {
      if (isMounted && res.ok && Array.isArray(res.data) && res.data.length > 0) {
        setCategories(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Xây dựng params gửi lên API theo chuẩn API Contract
  const buildApiParams = useCallback(
    (targetPage) => {
      const params = {
        page: targetPage,
        pageSize: pageSizeParam,
        mode: modeParam,
        sortBy: sortByParam,
        sortOrder: sortOrderParam,
      };

      if (qParam.trim()) {
        params.q = qParam.trim();
      }

      if (modeParam === 'advanced') {
        if (categoryParam.trim()) params.category = categoryParam.trim();
        if (minPriceParam !== '' && !isNaN(Number(minPriceParam))) {
          params.minPrice = Number(minPriceParam);
        }
        if (maxPriceParam !== '' && !isNaN(Number(maxPriceParam))) {
          params.maxPrice = Number(maxPriceParam);
        }
        if (availableParam === 'true' || availableParam === 'false') {
          params.available = availableParam;
        }
      }

      return params;
    },
    [
      pageSizeParam,
      modeParam,
      sortByParam,
      sortOrderParam,
      qParam,
      categoryParam,
      minPriceParam,
      maxPriceParam,
      availableParam,
    ]
  );

  /**
   * Tải dữ liệu ban đầu hoặc tải khi đổi trang trong chế độ Numbered
   */
  const fetchPrimaryDishes = useCallback(async () => {
    // Hủy request trước đó nếu chưa hoàn tất để tránh race condition (Slide 38)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('loading');
    setErrorInfo({ message: '', fields: null });
    setLoadMoreError(null);
    pendingRef.current = false;

    // Trong chế độ Load More hoặc Infinite Scroll, lần tải đầu tiên luôn lấy trang 1
    const requestPage = paginationMode === 'numbers' ? pageParam : 1;
    const params = buildApiParams(requestPage);

    const result = await apiClient.dishes.list(params, controller.signal);
    if (result.isAborted) return;

    if (!result.ok) {
      const err = result.error || {};
      setErrorInfo({
        message: err.message || 'Không thể tải danh sách món ăn từ máy chủ.',
        fields: err.fields || null,
      });
      setStatus('error');
      return;
    }

    const { items = [], total = 0, page = requestPage, pageSize = pageSizeParam, totalPages = 0 } =
      result.data || {};

    setMetadata({ total, page, pageSize, totalPages });
    setDishes(items);
    setAccumulatedDishes(items);
    setLoadedPage(1);

    // Kiểm tra kết thúc cho Load More / Infinite Scroll (Slide 12: page * pageSize >= total hoặc items rỗng)
    const reachedEnd = items.length === 0 || 1 >= totalPages || items.length >= total;
    setHasMore(!reachedEnd);

    setStatus('ok');
  }, [paginationMode, pageParam, pageSizeParam, buildApiParams]);

  // Kích hoạt fetch khi URL thay đổi
  useEffect(() => {
    fetchPrimaryDishes();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchPrimaryDishes]);

  /**
   * Tải tiếp trang tiếp theo (Load More & Infinite Scroll)
   * Tuân thủ nghiêm ngặt Slide 12 & 13:
   * - Kiểm tra pending và end trước khi gọi
   * - Đặt pendingRef đồng bộ ngay trước fetch
   * - Nối data.items vào cuối mảng tích lũy
   * - Cập nhật nextPage và trạng thái end
   */
  const handleLoadNextPage = useCallback(async () => {
    if (pendingRef.current || !hasMore || status !== 'ok') {
      return;
    }

    const nextPage = loadedPage + 1;
    pendingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    const params = buildApiParams(nextPage);
    const result = await apiClient.dishes.list(params);

    pendingRef.current = false;
    setLoadingMore(false);

    if (result.isAborted) return;

    if (!result.ok) {
      setLoadMoreError(result.error?.message || 'Lỗi khi tải thêm món ăn. Vui lòng bấm thử lại.');
      return;
    }

    const { items = [], total = 0, page = nextPage, totalPages = 0 } = result.data || {};

    // Nối các món mới vào danh sách tích lũy (Slide 12: [...oldItems, ...newItems])
    setAccumulatedDishes((prev) => {
      const existingIds = new Set(prev.map((d) => d.id));
      const freshItems = items.filter((d) => !existingIds.has(d.id));
      return [...prev, ...freshItems];
    });

    setLoadedPage(page);

    // Điều kiện kết thúc (Slide 12: page * pageSize >= total hoặc items rỗng)
    const isNowEnd = items.length === 0 || page >= totalPages;
    if (isNowEnd) {
      setHasMore(false);
    }
  }, [loadedPage, hasMore, status, buildApiParams]);

  /**
   * Cài đặt IntersectionObserver cho Infinite Scroll (Slide 13)
   */
  useEffect(() => {
    if (paginationMode !== 'infinite') return;
    if (!hasMore || loadingMore || status !== 'ok') return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          handleLoadNextPage();
        }
      },
      {
        root: null,
        rootMargin: '200px 0px', // Đọc trước 200px trước khi chạm đáy (Slide 13)
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [paginationMode, hasMore, loadingMore, status, handleLoadNextPage]);

  // CẬP NHẬT URL KHI THAY ĐỔI TIÊU CHÍ (Slide 14 & 15)
  const updateUrlParams = (changes = {}, resetPage = true) => {
    const nextParams = new URLSearchParams(searchParams);

    // Áp dụng các thay đổi mới
    Object.entries(changes).forEach(([key, val]) => {
      if (val === undefined || val === null || String(val).trim() === '') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, String(val).trim());
      }
    });

    // Reset về trang 1 khi tìm lại hoặc đổi bộ lọc (Slide 15)
    if (resetPage) {
      nextParams.delete('page');
    }

    setSearchParams(nextParams);
  };

  // Submit form tìm kiếm
  const handleSearchSubmit = (e) => {
    e.preventDefault();

    // Slide 21: Với fulltext và fuzzy, q trim rỗng là không hợp lệ
    if ((modeParam === 'fulltext' || modeParam === 'fuzzy') && !searchInput.trim()) {
      alert(`Chế độ ${modeParam === 'fulltext' ? 'Toàn văn (FTS)' : 'Gần đúng (Fuzzy)'} yêu cầu nhập từ khóa tìm kiếm.`);
      return;
    }

    updateUrlParams(
      {
        q: searchInput,
        category: modeParam === 'advanced' ? categoryInput : '',
        minPrice: modeParam === 'advanced' ? minPriceInput : '',
        maxPrice: modeParam === 'advanced' ? maxPriceInput : '',
        available: modeParam === 'advanced' ? availableInput : '',
        sortBy: sortByInput,
        sortOrder: sortOrderInput,
        pageSize: pageSizeInput,
      },
      true
    );
  };

  // Đổi chế độ tìm kiếm
  const handleModeChange = (nextMode) => {
    let nextSortBy = sortByInput;
    let nextSortOrder = sortOrderInput;

    if (nextMode === 'fulltext') {
      nextSortBy = 'rank';
      nextSortOrder = 'desc';
    } else if (nextMode === 'fuzzy') {
      nextSortBy = 'similarity';
      nextSortOrder = 'desc';
    } else if (sortByInput === 'rank' || sortByInput === 'similarity') {
      nextSortBy = 'id';
      nextSortOrder = 'asc';
    }

    setSortByInput(nextSortBy);
    setSortOrderInput(nextSortOrder);

    updateUrlParams(
      {
        mode: nextMode,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
      },
      true
    );
  };

  // Đổi chế độ phân trang UI (Numbered, Load More, Infinite Scroll)
  const handlePaginationModeChange = (nextMode) => {
    updateUrlParams({ paginationMode: nextMode }, true);
  };

  // Xóa toàn bộ điều kiện lọc (Slide 15)
  const handleClearAll = () => {
    setSearchInput('');
    setCategoryInput('');
    setMinPriceInput('');
    setMaxPriceInput('');
    setAvailableInput('');
    setSortByInput('id');
    setSortOrderInput('asc');

    setSearchParams({
      paginationMode,
      mode: 'basic',
    });
  };

  // Chuyển trang cho Numbered Pagination
  const handlePageSelect = (targetPage) => {
    if (targetPage < 1 || targetPage > metadata.totalPages || targetPage === metadata.page) {
      return;
    }
    updateUrlParams({ page: targetPage }, false);
    // Cuộn mượt lên đầu danh sách món ăn
    const menuEl = document.getElementById('menu-dishes-grid');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Quyết định danh sách hiển thị tuỳ theo UI Mode
  const displayedDishes = paginationMode === 'numbers' ? dishes : accumulatedDishes;

  // Tính toán các trang cần hiển thị trong Pager (Numbered Pagination)
  const renderPageNumbers = () => {
    const { page, totalPages } = metadata;
    if (totalPages <= 1) return null;

    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (
        p === 1 ||
        p === totalPages ||
        (p >= page - 1 && p <= page + 1)
      ) {
        pages.push(p);
      } else if (p === page - 2 || p === page + 2) {
        pages.push('gap');
      }
    }

    // Loại bỏ gap trùng lặp
    const deduped = pages.filter((item, idx, arr) => !(item === 'gap' && arr[idx - 1] === 'gap'));

    return deduped.map((item, idx) => {
      if (item === 'gap') {
        return (
          <span key={`gap-${idx}`} className="pager-gap" aria-hidden="true">
            …
          </span>
        );
      }
      const isCurrent = item === page;
      return (
        <button
          key={item}
          type="button"
          onClick={() => handlePageSelect(item)}
          disabled={status === 'loading'}
          className={isCurrent ? 'is-current' : ''}
          aria-current={isCurrent ? 'page' : undefined}
          aria-label={`Trang ${item}`}
        >
          {item}
        </button>
      );
    });
  };

  return (
    <div id="menu-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* HEADER & TỔNG QUAN TỐI ƯU HOÁ TỐC ĐỘ */}
      <header className="space-y-3 pb-6 border-b border-[rgba(0,0,0,0.08)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="eyebrow mb-1">Thực Đơn Món Ăn</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-cream">
              Khám Phá Hương Vị Độc Quyền
            </h1>
          </div>

          {/* Badge tối ưu hóa tốc độ tải trang */}
          <div className="flex flex-col items-start md:items-end gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Tối ưu: Server-side Pagination & Lazy Loading
            </span>
            <span className="text-[11px] text-sand-dim">
              Cơ sở dữ liệu: <strong className="text-cream">1.000+ món ăn</strong> trong PostgreSQL (Supabase)
            </span>
          </div>
        </div>
      </header>

      {/* KHỐI 1: CHỌN CHẾ ĐỘ PHÂN TRANG (3 KIỂU HIỂN THỊ UI - SLIDE 11, 34) */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-[rgba(0,0,0,0.08)] shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-brand/10 text-brand grid place-items-center font-bold text-sm">
              UI
            </span>
            <div>
              <h2 className="text-sm font-bold text-cream">Kiểu Hiển Thị Phân Trang (3 Modes)</h2>
              <p className="text-xs text-sand-dim">
                Cùng sử dụng chung API phân trang phía máy chủ theo chuẩn Slide 11
              </p>
            </div>
          </div>

          {/* Segmented Control cho 3 mode UI */}
          <div className="inline-flex p-1 bg-ink-850 rounded-xl border border-[rgba(0,0,0,0.06)] self-start sm:self-auto">
            {PAGINATION_MODES.map((pm) => {
              const isActive = paginationMode === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => handlePaginationModeChange(pm.id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-brand shadow-sm border border-[rgba(0,0,0,0.08)]'
                      : 'text-sand hover:text-cream'
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon name={pm.icon} cls="w-3.5 h-3.5" />
                  <span>{pm.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chú thích mode phân trang đang kích hoạt */}
        <div className="text-xs text-sand bg-ink-900 px-3 py-2 rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <strong className="text-cream">
              {PAGINATION_MODES.find((m) => m.id === paginationMode)?.badge}:
            </strong>{' '}
            {PAGINATION_MODES.find((m) => m.id === paginationMode)?.desc}
          </span>
          <span className="font-mono text-[11px] text-brand">
            {paginationMode === 'numbers' && `Trang ${metadata.page} / ${metadata.totalPages || 1}`}
            {paginationMode === 'loadmore' && `Đã tải ${displayedDishes.length} / ${metadata.total} món`}
            {paginationMode === 'infinite' && `Đã cuộn ${displayedDishes.length} / ${metadata.total} món`}
          </span>
        </div>
      </section>

      {/* KHỐI 2: BỘ TÌM KIẾM 4 CHẾ ĐỘ & BỘ LỌC (SLIDE 21, 37) */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-[rgba(0,0,0,0.08)] shadow-sm space-y-5">
        {/* Thanh chọn 4 chế độ tìm kiếm */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-sand">
            Chế độ tìm kiếm (Search Mode - Slide 37)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SEARCH_MODES.map((m) => {
              const isSelected = modeParam === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModeChange(m.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-brand bg-brand/[0.04] text-cream ring-1 ring-brand'
                      : 'border-[rgba(0,0,0,0.08)] bg-ink-900 text-sand hover:bg-white hover:border-sand'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-cream flex items-center gap-1.5">
                      <Icon name={m.icon} cls="w-3.5 h-3.5 text-brand" />
                      {m.name}
                    </span>
                    {isSelected && <Icon name="check" cls="w-3.5 h-3.5 text-brand" />}
                  </div>
                  <p className="text-[11px] text-sand-dim line-clamp-1 leading-snug">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form tìm kiếm & các trường lọc */}
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Ô nhập từ khóa q */}
            <div className="field-icon flex-grow min-w-0">
              <Icon name="search" cls="w-4 h-4" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={
                  modeParam === 'fulltext'
                    ? 'Nhập từ khóa tìm toàn văn trên tên và mô tả (bắt buộc)...'
                    : modeParam === 'fuzzy'
                    ? 'Nhập từ khóa tìm gần đúng, bắt lỗi chính tả (bắt buộc)...'
                    : 'Tìm theo tên món ăn...'
                }
                className="field text-xs sm:text-sm w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="text-sand hover:text-cream p-1"
                  aria-label="Xóa từ khóa"
                >
                  <Icon name="x" cls="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Nút hành động */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn btn-primary h-12 px-6 justify-center flex-1 sm:flex-initial"
              >
                <Icon name="search" cls="w-4 h-4" />
                <span>Tìm Kiếm</span>
              </button>

              {(qParam ||
                categoryParam ||
                minPriceParam ||
                maxPriceParam ||
                availableParam ||
                modeParam !== 'basic') && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={status === 'loading'}
                  className="btn btn-ghost h-12 px-4"
                  title="Xóa toàn bộ điều kiện lọc và đặt lại trang 1"
                >
                  <Icon name="x" cls="w-4 h-4" />
                  <span>Xóa Lọc</span>
                </button>
              )}
            </div>
          </div>

          {/* VÙNG LỌC NÂNG CAO (Chỉ hiện khi mode === 'advanced' theo Slide 26 & 28) */}
          {modeParam === 'advanced' && (
            <div className="p-4 rounded-xl bg-ink-850 border border-[rgba(0,0,0,0.06)] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cream uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="list" cls="w-3.5 h-3.5 text-brand" />
                  Các Tiêu Chí Nâng Cao (Kết hợp AND - Slide 26)
                </span>
                <span className="text-[11px] text-sand-dim">Bỏ trống trường nào sẽ bỏ qua trường đó</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Category */}
                <div>
                  <label className="block text-xs font-semibold text-sand mb-1">Danh mục món</label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    className="field text-xs w-full h-10"
                  >
                    <option value="">Tất cả danh mục</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Min Price (Slide 27: minPrice=0 là cận hợp lệ) */}
                <div>
                  <label className="block text-xs font-semibold text-sand mb-1">
                    Giá từ (VNĐ) <span className="text-sand-dim font-normal">- hỗ trợ 0đ</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    placeholder="VD: 0 hoặc 50000"
                    className="field text-xs w-full h-10"
                  />
                </div>

                {/* 3. Max Price */}
                <div>
                  <label className="block text-xs font-semibold text-sand mb-1">Giá đến (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    placeholder="VD: 150000"
                    className="field text-xs w-full h-10"
                  />
                </div>

                {/* 4. Available (Slide 27: available=false là điều kiện có nghĩa) */}
                <div>
                  <label className="block text-xs font-semibold text-sand mb-1">Trạng thái bán</label>
                  <select
                    value={availableInput}
                    onChange={(e) => setAvailableInput(e.target.value)}
                    className="field text-xs w-full h-10"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="true">Còn bán (Available)</option>
                    <option value="false">Hết hàng (Not available - Slide 27)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* DÒNG TIỆN ÍCH: SẮP XẾP & KÍCH THƯỚC TRANG (Slide 8 & 38) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[rgba(0,0,0,0.06)] text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Sắp xếp theo */}
              <div className="flex items-center gap-1.5">
                <span className="text-sand font-medium">Sắp xếp:</span>
                <select
                  value={sortByInput}
                  onChange={(e) => {
                    const nextSb = e.target.value;
                    setSortByInput(nextSb);
                    updateUrlParams({ sortBy: nextSb }, false);
                  }}
                  className="bg-ink-850 border border-[rgba(0,0,0,0.1)] rounded-lg px-2.5 py-1 font-semibold text-cream"
                >
                  <option value="id">Mã món (Mặc định)</option>
                  <option value="name">Tên món</option>
                  <option value="price">Giá bán</option>
                  <option value="createdAt">Mới nhất</option>
                  {modeParam === 'fulltext' && <option value="rank">Độ phù hợp (ts_rank FTS)</option>}
                  {modeParam === 'fuzzy' && (
                    <option value="similarity">Độ tương đồng (pg_trgm)</option>
                  )}
                </select>
              </div>

              {/* Chiều sắp xếp */}
              <div className="flex items-center gap-1.5">
                <select
                  value={sortOrderInput}
                  onChange={(e) => {
                    const nextSo = e.target.value;
                    setSortOrderInput(nextSo);
                    updateUrlParams({ sortOrder: nextSo }, false);
                  }}
                  className="bg-ink-850 border border-[rgba(0,0,0,0.1)] rounded-lg px-2.5 py-1 font-semibold text-cream"
                >
                  <option value="asc">Tăng dần (A-Z, Giá thấp - cao)</option>
                  <option value="desc">Giảm dần (Z-A, Giá cao - thấp)</option>
                </select>
              </div>
            </div>

            {/* Số món mỗi trang */}
            <div className="flex items-center gap-2">
              <span className="text-sand">Hiển thị mỗi trang:</span>
              <div className="inline-flex gap-1">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSizeInput(size);
                      updateUrlParams({ pageSize: size }, true);
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      pageSizeParam === size
                        ? 'bg-brand text-white shadow-xs'
                        : 'bg-ink-850 text-sand hover:text-cream'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* THÔNG BÁO LỖI NGHIỆP VỤ / VALIDATION (SLIDE 10 & 27: VALIDATION_FAILED) */}
      {status === 'error' && errorInfo.message && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Icon name="alert" cls="w-5 h-5 text-red-600" />
            <span>Lỗi dữ liệu tìm kiếm hoặc phân trang (VALIDATION_FAILED)</span>
          </div>
          <p className="text-xs text-red-800">{errorInfo.message}</p>
          {errorInfo.fields && (
            <ul className="text-xs list-disc list-inside space-y-1 text-red-700 bg-white/60 p-2.5 rounded-lg border border-red-100">
              {Object.entries(errorInfo.fields).map(([field, msg]) => (
                <li key={field}>
                  <strong>{field}:</strong> {msg}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={fetchPrimaryDishes}
            className="btn btn-sm bg-red-600 text-white hover:bg-red-700 mt-2"
          >
            Thử Lại
          </button>
        </div>
      )}

      {/* THANH THỐNG KÊ KẾT QUẢ TÌM KIẾM */}
      {status === 'ok' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-sand px-1">
          <div>
            Tìm thấy <strong className="text-cream font-bold">{metadata.total.toLocaleString()}</strong> món ăn
            {qParam && (
              <span>
                {' '}
                với từ khóa &quot;<strong className="text-brand">{qParam}</strong>&quot;
              </span>
            )}
            {categoryParam && modeParam === 'advanced' && (
              <span>
                {' '}
                thuộc danh mục &quot;<strong className="text-cream">{categoryParam}</strong>&quot;
              </span>
            )}
            {minPriceParam && modeParam === 'advanced' && (
              <span>
                {' '}
                giá từ <strong>{Number(minPriceParam).toLocaleString()}đ</strong>
              </span>
            )}
            {maxPriceParam && modeParam === 'advanced' && (
              <span>
                {' '}
                đến <strong>{Number(maxPriceParam).toLocaleString()}đ</strong>
              </span>
            )}
            {availableParam === 'false' && modeParam === 'advanced' && (
              <span className="text-ember font-semibold"> (Chỉ món hết hàng)</span>
            )}
          </div>

          <div className="text-sand-dim font-mono">
            {paginationMode === 'numbers' ? (
              <span>
                Trang {metadata.page} / {metadata.totalPages || 1} (LIMIT {metadata.pageSize} OFFSET{' '}
                {(metadata.page - 1) * metadata.pageSize})
              </span>
            ) : (
              <span>
                Hiển thị {displayedDishes.length} / {metadata.total} món
              </span>
            )}
          </div>
        </div>
      )}

      {/* TRẠNG THÁI LOADING BAN ĐẦU */}
      {status === 'loading' && <LoadingView message="Đang tải danh sách món ăn từ máy chủ..." />}

      {/* DANH SÁCH MÓN ĂN (GRID 3 CỘT) */}
      {status === 'ok' && displayedDishes.length > 0 && (
        <>
          <div
            id="menu-dishes-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {displayedDishes.map((dish) => {
              const thumbUrl =
                dish.images && dish.images.length > 0
                  ? resolveImageUrl(dish.images[0].imageUrl)
                  : null;

              return (
                <Link
                  key={dish.id}
                  to={`/dishes/${dish.id}`}
                  className="dish-card group block transition-all"
                >
                  {/* Khung ảnh có aspect-ratio cố định để chống CLS và lazy-loading (Tối ưu LCP/CLS) */}
                  <div className="dish-frame relative overflow-hidden rounded-2xl bg-ink-850">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={dish.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#f4eee6] text-sand-dim gap-2 p-4 select-none">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-[rgba(0,0,0,0.08)] grid place-items-center text-brand shadow-sm">
                          <Icon name="pan" cls="w-6 h-6 stroke-[1.8]" />
                        </div>
                        <span className="text-[11px] font-semibold tracking-wider uppercase text-sand/60">
                          Chờ cập nhật ảnh
                        </span>
                      </div>
                    )}

                    {/* Tag danh mục & Trạng thái */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {dish.category && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-sm text-cream shadow-xs">
                          {dish.category}
                        </span>
                      )}
                      {!dish.isAvailable && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-black/75 text-white backdrop-blur-sm">
                          Hết món
                        </span>
                      )}
                    </div>

                    <span className="dish-go">
                      <Icon name="arrow-up-right" cls="w-4 h-4" sw={2.2} />
                    </span>
                  </div>

                  {/* Thông tin chi tiết món ăn */}
                  <div className="pt-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="dish-name line-clamp-1 text-base font-bold text-cream group-hover:text-brand transition-colors">
                        {dish.name}
                      </h3>
                      <span className="dish-price font-bold text-brand whitespace-nowrap">
                        {Number(dish.price).toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    {dish.description && (
                      <p className="text-xs text-sand-dim line-clamp-2 leading-relaxed">
                        {dish.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-sand-dim">
                      <span>Mã: {dish.code || `DISH${dish.id}`}</span>
                      {dish.chefs && dish.chefs.length > 0 && dish.chefs[0]?.chef && (
                        <span>Bếp: {dish.chefs[0].chef.name}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ================================================================= */}
          {/* PHẦN HIỂN THỊ PHÂN TRANG THEO 3 KIỂU (SLIDE 11, 12, 13) */}
          {/* ================================================================= */}

          {/* KIỂU 1: PHÂN TRANG SỐ (PAGE NUMBERING - SLIDE 8, 9, 10, 11) */}
          {paginationMode === 'numbers' && metadata.totalPages > 1 && (
            <div className="pt-8 border-t border-[rgba(0,0,0,0.08)] flex flex-col items-center justify-center gap-3">
              <nav className="pager" aria-label="Phân trang thực đơn">
                {/* Nút Về đầu */}
                <button
                  type="button"
                  onClick={() => handlePageSelect(1)}
                  disabled={metadata.page <= 1 || status === 'loading'}
                  className="pager-nav"
                  aria-label="Về trang đầu"
                  title="Về trang đầu"
                >
                  «
                </button>

                {/* Nút Trang trước */}
                <button
                  type="button"
                  onClick={() => handlePageSelect(metadata.page - 1)}
                  disabled={metadata.page <= 1 || status === 'loading'}
                  className="pager-nav"
                  aria-label="Trang trước"
                  title="Trang trước"
                >
                  <Icon name="chevron-left" cls="w-4 h-4" />
                </button>

                {/* Các nút số trang có gap ... */}
                {renderPageNumbers()}

                {/* Nút Trang kế tiếp */}
                <button
                  type="button"
                  onClick={() => handlePageSelect(metadata.page + 1)}
                  disabled={metadata.page >= metadata.totalPages || status === 'loading'}
                  className="pager-nav"
                  aria-label="Trang kế tiếp"
                  title="Trang kế tiếp"
                >
                  <Icon name="chevron-right" cls="w-4 h-4" />
                </button>

                {/* Nút Đến trang cuối */}
                <button
                  type="button"
                  onClick={() => handlePageSelect(metadata.totalPages)}
                  disabled={metadata.page >= metadata.totalPages || status === 'loading'}
                  className="pager-nav"
                  aria-label="Đến trang cuối"
                  title="Đến trang cuối"
                >
                  »
                </button>
              </nav>

              <p className="text-xs text-sand-dim">
                Hiển thị món {(metadata.page - 1) * metadata.pageSize + 1} -{' '}
                {Math.min(metadata.page * metadata.pageSize, metadata.total)} trên tổng số{' '}
                {metadata.total.toLocaleString()} món
              </p>
            </div>
          )}

          {/* KIỂU 2: NÚT TẢI THÊM (LOAD MORE - SLIDE 12) */}
          {paginationMode === 'loadmore' && (
            <div className="pt-8 border-t border-[rgba(0,0,0,0.08)] flex flex-col items-center justify-center gap-3">
              {loadMoreError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <Icon name="alert" cls="w-4 h-4 text-red-600" />
                  <span>{loadMoreError}</span>
                  <button
                    type="button"
                    onClick={handleLoadNextPage}
                    className="underline font-bold ml-2 text-red-800"
                  >
                    Thử lại
                  </button>
                </div>
              )}

              {hasMore ? (
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadNextPage}
                    disabled={loadingMore}
                    className="btn btn-primary h-12 px-8 text-sm font-bold shadow-md hover:shadow-lg transition-all"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Đang tải thêm món...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Icon name="plus" cls="w-4 h-4" />
                        Tải thêm món ăn (Trang {loadedPage + 1} / {metadata.totalPages})
                      </span>
                    )}
                  </button>
                  <span className="text-xs text-sand-dim">
                    Đã hiển thị {displayedDishes.length} / {metadata.total} món ăn
                  </span>
                </div>
              ) : (
                <div className="text-center py-4 text-xs font-semibold text-sand-dim bg-ink-850 px-6 py-2.5 rounded-full border border-[rgba(0,0,0,0.06)]">
                  ✔ Đã hiển thị toàn bộ {metadata.total.toLocaleString()} món ăn
                </div>
              )}
            </div>
          )}

          {/* KIỂU 3: CUỘN VÔ TẬN (INFINITE SCROLL - SLIDE 13) */}
          {paginationMode === 'infinite' && (
            <div className="pt-8 border-t border-[rgba(0,0,0,0.08)] flex flex-col items-center justify-center">
              {/* Sentinel theo dõi cuộn với IntersectionObserver (Slide 13) */}
              <div
                ref={sentinelRef}
                id="infinite-scroll-sentinel"
                className="w-full py-4 flex flex-col items-center justify-center text-xs text-sand"
                aria-live="polite"
              >
                {loadingMore && (
                  <div className="flex items-center gap-2 py-3 px-5 rounded-full bg-white shadow-sm border border-[rgba(0,0,0,0.08)]">
                    <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    <span className="font-semibold text-cream">Tự động tải thêm trang {loadedPage + 1}...</span>
                  </div>
                )}

                {!hasMore && (
                  <div className="text-center py-3 px-6 rounded-full bg-ink-850 text-sand-dim font-medium border border-[rgba(0,0,0,0.06)]">
                    ✔ Đã cuộn hết toàn bộ {metadata.total.toLocaleString()} món ăn
                  </div>
                )}
              </div>

              {/* Lựa chọn fallback cho người dùng bàn phím hoặc khi cuộn chưa kích hoạt (Slide 12 & 13) */}
              {hasMore && !loadingMore && (
                <button
                  type="button"
                  onClick={handleLoadNextPage}
                  className="btn btn-ghost text-xs text-sand hover:text-cream mt-2"
                >
                  Cuộn xuống để tải tiếp hoặc bấm vào đây
                </button>
              )}

              {loadMoreError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 mt-2">
                  <Icon name="alert" cls="w-4 h-4 text-red-600" />
                  <span>{loadMoreError}</span>
                  <button
                    type="button"
                    onClick={handleLoadNextPage}
                    className="underline font-bold ml-2 text-red-800"
                  >
                    Thử lại
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TRẠNG THÁI RỖNG (EMPTY STATE - KHÔNG TÌM THẤY MÓN NÀO) */}
      {status === 'ok' && displayedDishes.length === 0 && (
        <div className="card card-pad text-center py-16 space-y-4 bg-white rounded-2xl border border-[rgba(0,0,0,0.08)]">
          <div className="w-16 h-16 rounded-2xl bg-black/[0.03] border border-[rgba(0,0,0,0.08)] grid place-items-center text-sand mx-auto">
            <Icon name="alert" cls="w-7 h-7 text-ember" />
          </div>
          <h3 className="text-xl font-bold text-cream">Không tìm thấy món ăn nào</h3>
          <p className="text-xs text-sand-dim max-w-md mx-auto">
            Không có món ăn nào thỏa mãn bộ lọc tìm kiếm hiện tại. Bạn có thể thử từ khóa khác hoặc đặt lại bộ lọc.
          </p>
          <div className="pt-2">
            <button type="button" onClick={handleClearAll} className="btn btn-primary btn-sm">
              Xem tất cả thực đơn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
