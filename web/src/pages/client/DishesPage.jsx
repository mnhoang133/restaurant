import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient, resolveImageUrl, getDishImageUrl, getCategoryImageUrl } from '../../api/client';
import Icon from '../../components/Icon';
import { LoadingView } from '../../components/StateViews';

const DEFAULT_CATEGORIES = [
  'Gà Rán',
  'Burger',
  'Ăn Kèm',
  'Combo',
  'Nước Uống',
  'Tráng Miệng',
];

const PAGINATION_MODES = [
  { id: 'numbers', label: 'Số trang', icon: 'grid' },
  { id: 'loadmore', label: 'Tải thêm', icon: 'plus' },
  { id: 'infinite', label: 'Cuộn vô tận', icon: 'arrow-right' },
];

const SORT_OPTIONS = [
  { id: 'default', label: 'Mặc định', sortBy: 'id', sortOrder: 'asc' },
  { id: 'price_asc', label: 'Giá: Thấp đến Cao', sortBy: 'price', sortOrder: 'asc' },
  { id: 'price_desc', label: 'Giá: Cao đến Thấp', sortBy: 'price', sortOrder: 'desc' },
  { id: 'name_asc', label: 'Tên: A → Z', sortBy: 'name', sortOrder: 'asc' },
  { id: 'name_desc', label: 'Tên: Z → A', sortBy: 'name', sortOrder: 'desc' },
  { id: 'newest', label: 'Món mới nhất', sortBy: 'createdAt', sortOrder: 'desc' },
];

export default function DishesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. ĐỌC THAM SỐ TỪ URL (Slide 14 & 15: Lưu và khôi phục trạng thái)
  const qParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const availableParam = searchParams.get('available') || ''; // 'true' | 'false' | ''
  const sortByParam = searchParams.get('sortBy') || 'id';
  const sortOrderParam = searchParams.get('sortOrder') || 'asc';
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSizeParam = 9; // 9 món/trang phù hợp với bố cục lưới 3 cột
  const paginationMode = searchParams.get('paginationMode') || 'numbers'; // 'numbers' | 'loadmore' | 'infinite'

  // Trạng thái bật/tắt bộ lọc nâng cao
  const isAdvancedInitial =
    Boolean(categoryParam || minPriceParam || maxPriceParam || availableParam) ||
    searchParams.get('advanced') === 'true';
  const [showAdvanced, setShowAdvanced] = useState(isAdvancedInitial);

  // 2. FORM STATE (Dữ liệu nhập liệu)
  const [searchInput, setSearchInput] = useState(qParam);
  const [categoryInput, setCategoryInput] = useState(categoryParam);
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);
  const [availableInput, setAvailableInput] = useState(availableParam);
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

  // Refs quản lý đồng bộ tránh race condition (Slide 13 & 38)
  const pendingRef = useRef(false);
  const sentinelRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Đồng bộ form khi URL thay đổi (Back / Forward)
  useEffect(() => {
    setSearchInput(qParam);
    setCategoryInput(categoryParam);
    setMinPriceInput(minPriceParam);
    setMaxPriceInput(maxPriceParam);
    setAvailableInput(availableParam);
    if (categoryParam || minPriceParam || maxPriceParam || availableParam) {
      setShowAdvanced(true);
    }
  }, [qParam, categoryParam, minPriceParam, maxPriceParam, availableParam]);

  useEffect(() => {
    document.title = 'Thực đơn món ăn · CRISPY HOUSE';
  }, []);

  // Lấy danh mục thực tế từ backend (chuẩn hóa về mảng chuỗi tên danh mục)
  useEffect(() => {
    let isMounted = true;
    apiClient.dishes.getCategories().then((res) => {
      if (isMounted && res.ok && Array.isArray(res.data) && res.data.length > 0) {
        // Backend có thể trả về mảng object [{ name: 'Gà Rán', count: 200, cover: '...' }] hoặc mảng chuỗi
        const names = res.data
          .map((c) => (typeof c === 'object' && c !== null ? c.name : c))
          .filter(Boolean);
        setCategories(names);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Xây dựng params gửi API (tự động kích hoạt mode=advanced khi có tiêu chí mở rộng)
  const buildApiParams = useCallback(
    (targetPage) => {
      const hasAdvancedCriteria = Boolean(
        categoryParam.trim() ||
          (minPriceParam !== '' && !isNaN(Number(minPriceParam))) ||
          (maxPriceParam !== '' && !isNaN(Number(maxPriceParam))) ||
          availableParam === 'true' ||
          availableParam === 'false'
      );

      const params = {
        page: targetPage,
        pageSize: pageSizeParam,
        mode: hasAdvancedCriteria ? 'advanced' : 'basic',
        sortBy: sortByParam,
        sortOrder: sortOrderParam,
      };

      if (qParam.trim()) {
        params.q = qParam.trim();
      }

      if (hasAdvancedCriteria) {
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
      sortByParam,
      sortOrderParam,
      qParam,
      categoryParam,
      minPriceParam,
      maxPriceParam,
      availableParam,
    ]
  );

  // Tải dữ liệu chính (Trang ban đầu hoặc chuyển trang trong Numbered)
  const fetchPrimaryDishes = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('loading');
    setErrorInfo({ message: '', fields: null });
    setLoadMoreError(null);
    pendingRef.current = false;

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

    const reachedEnd = items.length === 0 || 1 >= totalPages || items.length >= total;
    setHasMore(!reachedEnd);

    setStatus('ok');
  }, [paginationMode, pageParam, pageSizeParam, buildApiParams]);

  useEffect(() => {
    fetchPrimaryDishes();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchPrimaryDishes]);

  // Tải trang kế tiếp cho Load More & Infinite Scroll (Slide 12 & 13)
  const handleLoadNextPage = useCallback(async () => {
    if (pendingRef.current || !hasMore || status !== 'ok') {
      return;
    }

    const nextPage = loadedPage + 1;
    pendingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    const params = buildApiParams(nextPage);
    if (metadata.total > 0) {
      params.total = metadata.total; // Tối ưu: truyền total đã biết để backend không phải scan COUNT(*) lại toàn bộ DB
    }
    const result = await apiClient.dishes.list(params);

    pendingRef.current = false;
    setLoadingMore(false);

    if (result.isAborted) return;

    if (!result.ok) {
      setLoadMoreError(result.error?.message || 'Có lỗi xảy ra khi tải thêm món. Vui lòng thử lại.');
      return;
    }

    const { items = [], page = nextPage, totalPages = 0 } = result.data || {};

    setAccumulatedDishes((prev) => {
      const existingIds = new Set(prev.map((d) => d.id));
      const freshItems = items.filter((d) => !existingIds.has(d.id));
      return [...prev, ...freshItems];
    });

    setLoadedPage(page);

    const isNowEnd = items.length === 0 || page >= totalPages;
    if (isNowEnd) {
      setHasMore(false);
    }
  }, [loadedPage, hasMore, status, buildApiParams]);

  // IntersectionObserver cho Infinite Scroll (Slide 13)
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
        rootMargin: '600px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [paginationMode, hasMore, loadingMore, status, handleLoadNextPage]);

  // Cập nhật tham số trên URL
  const updateUrlParams = (changes = {}, resetPage = true) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(changes).forEach(([key, val]) => {
      if (val === undefined || val === null || String(val).trim() === '') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, String(val).trim());
      }
    });

    if (resetPage) {
      nextParams.delete('page');
    }

    setSearchParams(nextParams);
  };

  // Real-time debounced typing filter cho ô tìm kiếm thực đơn (Ảnh 4)
  useEffect(() => {
    if (searchInput === qParam) return;

    const timer = setTimeout(() => {
      updateUrlParams({ q: searchInput }, true);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, qParam]);

  // Submit tìm kiếm
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateUrlParams(
      {
        q: searchInput,
        category: showAdvanced ? categoryInput : '',
        minPrice: showAdvanced ? minPriceInput : '',
        maxPrice: showAdvanced ? maxPriceInput : '',
        available: showAdvanced ? availableInput : '',
        advanced: showAdvanced ? 'true' : '',
      },
      true
    );
  };

  // Đổi cách hiển thị phân trang
  const handlePaginationModeChange = (modeId) => {
    updateUrlParams({ paginationMode: modeId }, true);
  };

  // Đổi sắp xếp
  const handleSortChange = (e) => {
    const selected = SORT_OPTIONS.find((opt) => opt.id === e.target.value) || SORT_OPTIONS[0];
    updateUrlParams(
      {
        sortBy: selected.sortBy,
        sortOrder: selected.sortOrder,
      },
      false
    );
  };

  // Xóa toàn bộ điều kiện lọc
  const handleClearAll = () => {
    setSearchInput('');
    setCategoryInput('');
    setMinPriceInput('');
    setMaxPriceInput('');
    setAvailableInput('');
    setShowAdvanced(false);

    setSearchParams({
      paginationMode,
    });
  };

  // Chuyển trang cho Numbered Pagination
  const handlePageSelect = (targetPage) => {
    if (targetPage < 1 || targetPage > metadata.totalPages || targetPage === metadata.page) {
      return;
    }
    updateUrlParams({ page: targetPage }, false);
    const menuEl = document.getElementById('menu-dishes-grid');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const displayedDishes = paginationMode === 'numbers' ? dishes : accumulatedDishes;

  // Xác định lựa chọn sắp xếp hiện tại
  const currentSortId =
    SORT_OPTIONS.find(
      (opt) => opt.sortBy === sortByParam && opt.sortOrder === sortOrderParam
    )?.id || 'default';

  const hasActiveFilters = Boolean(
    qParam || categoryParam || minPriceParam || maxPriceParam || availableParam
  );

  // Render các số trang trong Pager (Ảnh 2: Đồng bộ kích thước và style các nút)
  const renderPageNumbers = () => {
    const { page, totalPages } = metadata;
    if (totalPages <= 1) return null;

    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
        pages.push(p);
      } else if (p === page - 2 || p === page + 2) {
        pages.push('gap');
      }
    }

    const deduped = pages.filter((item, idx, arr) => !(item === 'gap' && arr[idx - 1] === 'gap'));

    return deduped.map((item, idx) => {
      if (item === 'gap') {
        return (
          <span
            key={`gap-${idx}`}
            className="w-8 h-10 flex items-center justify-center text-sand-dim font-bold select-none text-xs sm:text-sm"
            aria-hidden="true"
          >
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
          className={`min-w-[40px] h-10 px-2 flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold border transition-all ${
            isCurrent
              ? 'bg-brand text-white border-brand shadow-sm font-extrabold'
              : 'bg-white text-sand hover:text-cream hover:bg-cream-soft/60 border-black/10 shadow-2xs'
          }`}
          aria-current={isCurrent ? 'page' : undefined}
          aria-label={`Trang ${item}`}
        >
          {item}
        </button>
      );
    });
  };

  return (
    <div id="menu-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* HEADER TỐI GIẢN — DÀNH RIÊNG CHO KHÁCH HÀNG (ĐÃ LOẠI BỎ TEXT TECH Ở ẢNH 1) */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[rgba(0,0,0,0.08)]">
        <div>
          <div className="eyebrow mb-1">Thực Đơn Nhà Hàng</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-cream">
            Khám Phá Hương Vị Độc Quyền
          </h1>
          <p className="text-xs sm:text-sm text-sand-dim mt-1">
            Gà rán giòn tan, burger nóng hổi cùng đa dạng các món ăn kèm và thức uống hấp dẫn.
          </p>
        </div>

        {/* ẢNH 2: CHỈ HIỂN THỊ CÁC NÚT CHUYỂN ĐỔI PHÂN TRANG (TỐI GIẢN, KHÔNG HIỆN THÔNG TIN TECH) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-sand font-medium hidden md:inline">Xem theo:</span>
          <div
            className="inline-flex p-1 bg-ink-850 rounded-xl border border-[rgba(0,0,0,0.06)]"
            role="group"
            aria-label="Kiểu hiển thị phân trang"
          >
            {PAGINATION_MODES.map((pm) => {
              const isActive = paginationMode === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => handlePaginationModeChange(pm.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
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
      </header>

      {/* ẢNH 3: BỘ TÌM KIẾM TÍCH HỢP & NÚT LỰA CHỌN NÂNG CAO (TỐI GIẢN, TRẢI NGHIỆM NGƯỜI DÙNG THẬT) */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-[rgba(0,0,0,0.08)] shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          {/* Thanh tìm kiếm chính (Ảnh 4: Sửa lỗi UI & Tích hợp Typing Filter theo thời gian thực) */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-grow min-w-0">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sand-dim">
                <Icon name="search" cls="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm tên món ăn, hương vị, mô tả..."
                className="field text-xs sm:text-sm w-full pl-10 pr-10"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    updateUrlParams({ q: '' }, true);
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sand-dim hover:text-cream transition-colors"
                  aria-label="Xóa từ khóa"
                >
                  <Icon name="x" cls="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Nút bật/tắt Lựa chọn nâng cao */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`btn h-12 px-4 text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  showAdvanced
                    ? 'bg-brand/10 text-brand border border-brand/30'
                    : 'btn-ghost text-sand hover:text-cream'
                }`}
                aria-expanded={showAdvanced}
              >
                <Icon name="list" cls="w-4 h-4" />
                <span>Nâng cao</span>
                {showAdvanced && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
              </button>

              {/* Nút Tìm kiếm */}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn btn-primary h-12 px-6 justify-center flex-1 sm:flex-initial"
              >
                <span>Tìm Kiếm</span>
              </button>

              {/* Nút Xóa bộ lọc khi có điều kiện đang áp dụng */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={status === 'loading'}
                  className="btn btn-ghost h-12 px-3 text-sand hover:text-cream"
                  title="Xóa bộ lọc"
                >
                  <Icon name="x" cls="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* KHU VỰC BỘ LỌC NÂNG CAO (Chỉ mở ra khi người dùng bấm lựa chọn 'Nâng cao') */}
          {showAdvanced && (
            <div className="p-4 rounded-xl bg-ink-850 border border-[rgba(0,0,0,0.06)] space-y-3 transition-all animate-fadeIn">
              <div className="text-xs font-bold text-cream">Bộ lọc nâng cao theo tiêu chí:</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Danh mục */}
                <div>
                  <label className="block text-xs font-semibold text-sand mb-1">Danh mục món</label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    className="field text-xs w-full h-10"
                  >
                    <option value="">Tất cả danh mục</option>
                    {categories.map((c) => {
                      const catName = typeof c === 'object' && c !== null ? c.name : String(c);
                      return (
                        <option key={catName} value={catName}>
                          {catName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 2. Giá tối thiểu */}
                <div>
                  <label className="block text-xs font-semibold text-sand mb-1">Giá từ (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    placeholder="VD: 0 hoặc 50.000"
                    className="field text-xs w-full h-10"
                  />
                </div>

                {/* 3. Giá tối đa */}
                <div>
                  <label className="block text-xs font-semibold text-sand mb-1">Giá đến (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    placeholder="VD: 150.000"
                    className="field text-xs w-full h-10"
                  />
                </div>

                {/* 4. Trạng thái món */}
                <div>
                  <label className="block text-xs font-semibold text-sand mb-1">Tình trạng phục vụ</label>
                  <select
                    value={availableInput}
                    onChange={(e) => setAvailableInput(e.target.value)}
                    className="field text-xs w-full h-10"
                  >
                    <option value="">Tất cả</option>
                    <option value="true">Đang phục vụ</option>
                    <option value="false">Tạm hết món</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* DÒNG THỐNG KÊ GỌN GÀNG (ĐÃ BỎ SẮP XẾP Ở MENU THEO YÊU CẦU) */}
          <div className="pt-2 border-t border-[rgba(0,0,0,0.06)] text-xs text-sand">
            {status === 'ok' && (
              <span>
                Tìm thấy <strong className="text-cream font-bold">{metadata.total.toLocaleString()}</strong> món
                {qParam && (
                  <span>
                    {' '}cho &quot;<strong className="text-brand">{qParam}</strong>&quot;
                  </span>
                )}
                {categoryParam && (
                  <span>
                    {' '}trong <strong>{categoryParam}</strong>
                  </span>
                )}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* THÔNG BÁO LỖI NẾU BỘ LỌC KHÔNG HỢP LỆ */}
      {status === 'error' && errorInfo.message && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs">
            <Icon name="alert" cls="w-4 h-4 text-red-600" />
            <span>Thông tin tìm kiếm chưa hợp lệ:</span>
          </div>
          <p className="text-xs text-red-800">{errorInfo.message}</p>
          {errorInfo.fields && (
            <ul className="text-xs list-disc list-inside space-y-0.5 text-red-700">
              {Object.entries(errorInfo.fields).map(([field, msg]) => (
                <li key={field}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* TRẠNG THÁI LOADING BAN ĐẦU */}
      {status === 'loading' && <LoadingView message="Đang tải thực đơn món ăn..." />}

      {/* DANH SÁCH MÓN ĂN (GRID 3 CỘT ĐẸP MẮT) */}
      {status === 'ok' && displayedDishes.length > 0 && (
        <>
          <div
            id="menu-dishes-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {displayedDishes.map((dish) => {
              const thumbUrl = getDishImageUrl(dish);

              return (
                <Link
                  key={dish.id}
                  to={`/dishes/${dish.id}`}
                  className="dish-card group block transition-all"
                >
                  {/* Khung ảnh có aspect-ratio cố định chống CLS & lazy loading */}
                  <div className="dish-frame relative overflow-hidden rounded-2xl bg-ink-850">
                    <img
                      src={thumbUrl}
                      alt={dish.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getCategoryImageUrl(dish.category);
                      }}
                    />

                    {/* Badge trạng thái khi tạm hết món (đã bỏ hiển thị danh mục theo yêu cầu) */}
                    {!dish.isAvailable && (
                      <div className="absolute top-3 left-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-black/75 text-white backdrop-blur-sm">
                          Tạm hết
                        </span>
                      </div>
                    )}

                    <span className="dish-go">
                      <Icon name="arrow-up-right" cls="w-4 h-4" sw={2.2} />
                    </span>
                  </div>

                  {/* Thông tin món */}
                  <div className="pt-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="dish-name line-clamp-1 text-base font-bold text-cream group-hover:text-brand transition-colors">
                        {dish.name}
                      </h3>
                      <span className="dish-price font-bold text-brand whitespace-nowrap">
                        {Number(dish.price).toLocaleString('vi-VN')}&nbsp;đ
                      </span>
                    </div>

                    {dish.description && (
                      <p className="text-xs text-sand-dim line-clamp-2 leading-relaxed">
                        {dish.description}
                      </p>
                    )}

                    {dish.chefs && dish.chefs.length > 0 && dish.chefs[0]?.chef && (
                      <div className="pt-1 text-[11px] font-mono text-sand-dim">
                        <span>Bếp: {dish.chefs[0].chef.name}</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ================================================================= */}
          {/* PHÂN TRANG (CHỈ CÁC NÚT VÀ ĐIỀU HƯỚNG THEO MODE ĐÃ CHỌN) */}
          {/* ================================================================= */}

          {/* 1. SỐ TRANG (PAGE NUMBERING - ĐỒNG BỘ UI THEO ẢNH 2, BỎ DÒNG TEXT DƯỚI) */}
          {paginationMode === 'numbers' && metadata.totalPages > 1 && (
            <div className="pt-8 border-t border-[rgba(0,0,0,0.08)] flex justify-center">
              <nav className="flex items-center justify-center gap-1.5 flex-wrap" aria-label="Phân trang thực đơn">
                <button
                  type="button"
                  onClick={() => handlePageSelect(1)}
                  disabled={metadata.page <= 1 || status === 'loading'}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                    metadata.page <= 1
                      ? 'opacity-30 cursor-not-allowed bg-ink-850/40 text-sand-dim border-transparent'
                      : 'bg-white text-sand hover:text-cream hover:bg-cream-soft/60 border-black/10 shadow-2xs'
                  }`}
                  aria-label="Về trang đầu"
                  title="Về trang đầu"
                >
                  «
                </button>

                <button
                  type="button"
                  onClick={() => handlePageSelect(metadata.page - 1)}
                  disabled={metadata.page <= 1 || status === 'loading'}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                    metadata.page <= 1
                      ? 'opacity-30 cursor-not-allowed bg-ink-850/40 text-sand-dim border-transparent'
                      : 'bg-white text-sand hover:text-cream hover:bg-cream-soft/60 border-black/10 shadow-2xs'
                  }`}
                  aria-label="Trang trước"
                  title="Trang trước"
                >
                  <Icon name="chevron-left" cls="w-4 h-4" />
                </button>

                {renderPageNumbers()}

                <button
                  type="button"
                  onClick={() => handlePageSelect(metadata.page + 1)}
                  disabled={metadata.page >= metadata.totalPages || status === 'loading'}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                    metadata.page >= metadata.totalPages
                      ? 'opacity-30 cursor-not-allowed bg-ink-850/40 text-sand-dim border-transparent'
                      : 'bg-white text-sand hover:text-cream hover:bg-cream-soft/60 border-black/10 shadow-2xs'
                  }`}
                  aria-label="Trang kế tiếp"
                  title="Trang kế tiếp"
                >
                  <Icon name="chevron-right" cls="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handlePageSelect(metadata.totalPages)}
                  disabled={metadata.page >= metadata.totalPages || status === 'loading'}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                    metadata.page >= metadata.totalPages
                      ? 'opacity-30 cursor-not-allowed bg-ink-850/40 text-sand-dim border-transparent'
                      : 'bg-white text-sand hover:text-cream hover:bg-cream-soft/60 border-black/10 shadow-2xs'
                  }`}
                  aria-label="Đến trang cuối"
                  title="Đến trang cuối"
                >
                  »
                </button>
              </nav>
            </div>
          )}

          {/* 2. TẢI THÊM (LOAD MORE) */}
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
                        Đang tải thêm...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Icon name="plus" cls="w-4 h-4" />
                        Tải thêm món ăn
                      </span>
                    )}
                  </button>
                  <span className="text-xs text-sand-dim">
                    Đã hiển thị {displayedDishes.length} / {metadata.total.toLocaleString()} món ăn
                  </span>
                </div>
              ) : (
                <div className="text-center py-3 text-xs font-semibold text-sand-dim bg-ink-850 px-6 rounded-full border border-[rgba(0,0,0,0.06)]">
                  Đã hiển thị toàn bộ {metadata.total.toLocaleString()} món ăn
                </div>
              )}
            </div>
          )}

          {/* 3. CUỘN VÔ TẬN (INFINITE SCROLL) */}
          {paginationMode === 'infinite' && (
            <div className="pt-8 border-t border-[rgba(0,0,0,0.08)] flex flex-col items-center justify-center">
              <div
                ref={sentinelRef}
                id="infinite-scroll-sentinel"
                className="w-full py-4 flex flex-col items-center justify-center text-xs text-sand"
                aria-live="polite"
              >
                {loadingMore && (
                  <div className="flex items-center gap-2 py-2.5 px-5 rounded-full bg-white shadow-sm border border-[rgba(0,0,0,0.08)]">
                    <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    <span className="font-semibold text-cream">Đang tải thêm món ăn...</span>
                  </div>
                )}

                {!hasMore && (
                  <div className="text-center py-2.5 px-6 rounded-full bg-ink-850 text-sand-dim font-medium border border-[rgba(0,0,0,0.06)]">
                    Đã hiển thị toàn bộ {metadata.total.toLocaleString()} món ăn
                  </div>
                )}
              </div>

              {hasMore && !loadingMore && (
                <button
                  type="button"
                  onClick={handleLoadNextPage}
                  className="btn btn-ghost text-xs text-sand hover:text-cream mt-1"
                >
                  Bấm vào đây để tải tiếp
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

      {/* TRẠNG THÁI RỖNG */}
      {status === 'ok' && displayedDishes.length === 0 && (
        <div className="card card-pad text-center py-16 space-y-4 bg-white rounded-2xl border border-[rgba(0,0,0,0.08)]">
          <div className="w-16 h-16 rounded-2xl bg-black/[0.03] border border-[rgba(0,0,0,0.08)] grid place-items-center text-sand mx-auto">
            <Icon name="alert" cls="w-7 h-7 text-ember" />
          </div>
          <h3 className="text-xl font-bold text-cream">Không tìm thấy món ăn nào</h3>
          <p className="text-xs text-sand-dim max-w-md mx-auto">
            Không có món ăn nào phù hợp với từ khóa hoặc bộ lọc đã chọn. Hãy thử lại với từ khóa khác nhé.
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
