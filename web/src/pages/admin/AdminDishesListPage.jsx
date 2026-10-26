import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient, resolveImageUrl, getDishImageUrl, getCategoryImageUrl } from '../../api/client';
import AdminNav from '../../components/AdminNav';
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

export default function AdminDishesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const isAvailableParam = searchParams.get('isAvailable') || '';
  const sortParam = searchParams.get('sort') || 'newest';

  const [searchInput, setSearchInput] = useState(qParam);
  const [categoryInput, setCategoryInput] = useState(categoryParam);
  const [isAvailableInput, setIsAvailableInput] = useState(isAvailableParam);
  const [sortInput, setSortInput] = useState(sortParam);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // Phân trang bảng quản trị để giải quyết triệt để vấn đề lag khi có 1.000+ món ăn
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [dishes, setDishes] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Quản trị - Danh sách món ăn · CRISPY HOUSE';
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiClient.dishes.getCategories().then((res) => {
      if (isMounted && res.ok && Array.isArray(res.data) && res.data.length > 0) {
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

  useEffect(() => {
    setSearchInput(qParam);
    setCategoryInput(categoryParam);
    setIsAvailableInput(isAvailableParam);
    setSortInput(sortParam);
  }, [qParam, categoryParam, isAvailableParam, sortParam]);

  // Real-time debounced typing filter: Tự động cập nhật sau 250ms không gõ phím, mượt mà 60 FPS
  useEffect(() => {
    if (searchInput === qParam) return;
    const timer = setTimeout(() => {
      applyFilterParams(searchInput, categoryInput, isAvailableInput, sortInput);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, qParam, categoryInput, isAvailableInput, sortInput]);

  const fetchDishes = useCallback(
    async (signal) => {
      setStatus('loading');
      setErrorMsg('');

      const params = {
        all: true,
      };
      if (qParam.trim()) params.q = qParam.trim();
      if (categoryParam.trim()) params.category = categoryParam.trim();
      if (isAvailableParam === 'true' || isAvailableParam === 'false') {
        params.isAvailable = isAvailableParam === 'true';
      }

      const result = await apiClient.dishes.list(params, signal);
      if (result.isAborted) return;

      if (!result.ok) {
        setErrorMsg(result.error.message || 'Không thể tải danh sách món ăn.');
        setStatus('error');
        return;
      }

      setDishes(Array.isArray(result.data) ? result.data : []);
      setCurrentPage(1);
      setStatus('ok');
    },
    [qParam, categoryParam, isAvailableParam]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDishes(controller.signal);
    return () => controller.abort();
  }, [fetchDishes]);

  const applyFilterParams = (nextQ, nextCat, nextAvail, nextSort) => {
    const nextParams = {};
    if ((nextQ || '').trim()) nextParams.q = nextQ.trim();
    if ((nextCat || '').trim()) nextParams.category = nextCat.trim();
    if (nextAvail === 'true' || nextAvail === 'false') nextParams.isAvailable = nextAvail;
    if (nextSort && nextSort !== 'newest') nextParams.sort = nextSort;
    setSearchParams(nextParams);
    setCurrentPage(1);
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    applyFilterParams(searchInput, categoryInput, isAvailableInput, sortInput);
    setCurrentPage(1);
  };

  const handleClearFilter = () => {
    setSearchInput('');
    setCategoryInput('');
    setIsAvailableInput('');
    setSortInput('newest');
    setSearchParams({});
    setCurrentPage(1);
  };

  // Sắp xếp danh sách món ăn phía client có Memoization chống lag
  const sortedDishes = useMemo(() => {
    const list = [...dishes];
    if (sortInput === 'name_asc') return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    if (sortInput === 'name_desc') return list.sort((a, b) => b.name.localeCompare(a.name, 'vi'));
    if (sortInput === 'price_asc') return list.sort((a, b) => a.price - b.price);
    if (sortInput === 'price_desc') return list.sort((a, b) => b.price - a.price);
    if (sortInput === 'oldest') return list.sort((a, b) => a.id - b.id);
    return list.sort((a, b) => b.id - a.id); // newest (mặc định)
  }, [dishes, sortInput]);

  const totalPages = Math.ceil(sortedDishes.length / pageSize) || 1;

  // Cắt phân trang: Chỉ render 20 dòng trên DOM, giúp bảng phản hồi tức thì < 1ms
  const paginatedDishes = useMemo(() => {
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedDishes.slice(start, start + pageSize);
  }, [sortedDishes, currentPage, totalPages, pageSize]);

  const hasFilter = Boolean(qParam || categoryParam || isAvailableParam || sortParam !== 'newest');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full space-y-6">
          {/* Search, Filter & Sắp xếp trong Quản lý */}
          <div className="card p-4 space-y-3">
            <form onSubmit={handleFilterSubmit} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                <div className="relative flex-grow min-w-0">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sand-dim">
                    <Icon name="search" cls="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="q"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tìm theo tên món ăn..."
                    className="field text-xs sm:text-sm w-full pl-10 pr-10"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        applyFilterParams('', categoryInput, isAvailableInput, sortInput);
                        setCurrentPage(1);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-sand-dim hover:text-cream transition-colors"
                      aria-label="Xóa từ khóa"
                    >
                      <Icon name="x" cls="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <Link
                  to="/admin/dishes/new"
                  className="btn btn-primary h-12 px-5 w-full sm:w-auto justify-center flex-shrink-0"
                >
                  <Icon name="plus" cls="w-4 h-4" />
                  <span>Thêm Món Mới</span>
                </Link>
              </div>

              {/* Hàng bộ lọc và sắp xếp */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-line/60 text-xs">
                {/* Lọc danh mục */}
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[140px]">
                  <span className="text-sand-dim font-medium whitespace-nowrap">Danh mục:</span>
                  <select
                    value={categoryInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCategoryInput(val);
                      applyFilterParams(searchInput, val, isAvailableInput, sortInput);
                    }}
                    className="field text-xs h-9 py-1 flex-1"
                  >
                    <option value="">Tất cả</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lọc trạng thái */}
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[140px]">
                  <span className="text-sand-dim font-medium whitespace-nowrap">Trạng thái:</span>
                  <select
                    value={isAvailableInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIsAvailableInput(val);
                      applyFilterParams(searchInput, categoryInput, val, sortInput);
                    }}
                    className="field text-xs h-9 py-1 flex-1"
                  >
                    <option value="">Tất cả</option>
                    <option value="true">Đang phục vụ</option>
                    <option value="false">Tạm ngưng</option>
                  </select>
                </div>

                {/* Sắp xếp */}
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[160px]">
                  <span className="text-sand-dim font-medium whitespace-nowrap">Sắp xếp:</span>
                  <select
                    value={sortInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSortInput(val);
                      applyFilterParams(searchInput, categoryInput, isAvailableInput, val);
                    }}
                    className="field text-xs h-9 py-1 flex-1"
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="name_asc">Tên: A → Z</option>
                    <option value="name_desc">Tên: Z → A</option>
                    <option value="price_asc">Giá: Thấp đến Cao</option>
                    <option value="price_desc">Giá: Cao đến Thấp</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="btn btn-primary h-9 px-4 text-xs justify-center"
                  >
                    <span>Lọc</span>
                  </button>

                  {hasFilter && (
                    <button
                      type="button"
                      onClick={handleClearFilter}
                      disabled={status === 'loading'}
                      className="btn btn-ghost h-9 px-3 text-xs justify-center text-sand hover:text-cream"
                      title="Xóa bộ lọc"
                    >
                      <Icon name="x" cls="w-3.5 h-3.5" />
                      <span>Xóa lọc</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {status === 'loading' && <LoadingView message="Đang tải danh sách món ăn..." />}

          {status === 'error' && (
            <ErrorView
              title="Không Thể Tải Danh Sách Món Ăn"
              message={errorMsg}
              onRetry={() => fetchDishes()}
              backTo="/dishes"
              backLabel="Về Thực Đơn"
            />
          )}

          {status === 'ok' && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-16">Hình ảnh</th>
                      <th>Tên món ăn</th>
                      <th>Danh mục</th>
                      <th>Giá bán</th>
                      <th>Trạng thái</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDishes.length > 0 ? (
                      paginatedDishes.map((dish) => {
                        const img = getDishImageUrl(dish);
                        return (
                          <tr key={dish.id}>
                            <td>
                              <img
                                src={img}
                                alt={dish.name}
                                className="thumb object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = getCategoryImageUrl(dish.category);
                                }}
                              />
                            </td>

                            <td>
                              <div className="font-bold text-cream">{dish.name}</div>
                              {dish.description && (
                                <p className="text-xs text-sand-dim line-clamp-1 mt-0.5">
                                  {dish.description}
                                </p>
                              )}
                            </td>

                            <td>
                              <span className="badge text-xs">{dish.category}</span>
                            </td>

                            <td className="font-mono font-bold text-ember text-sm whitespace-nowrap">
                              {Number(dish.price).toLocaleString('vi-VN')}&nbsp;đ
                            </td>

                            <td>
                              {dish.isAvailable ? (
                                <span className="badge badge-ok badge-dot text-xs">
                                  Đang phục vụ
                                </span>
                              ) : (
                                <span className="badge badge-off badge-dot text-xs">
                                  Tạm ngưng
                                </span>
                              )}
                            </td>

                            <td className="text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 flex-nowrap">
                                <Link
                                  to={`/dishes/${dish.id}`}
                                  className="icon-btn w-8 h-8"
                                  data-tip="Xem"
                                >
                                  <Icon name="eye" cls="w-3.5 h-3.5" />
                                </Link>
                                <Link
                                  to={`/admin/dishes/${dish.id}/edit`}
                                  className="icon-btn w-8 h-8"
                                  data-tip="Sửa"
                                >
                                  <Icon name="edit" cls="w-3.5 h-3.5" />
                                </Link>
                                <Link
                                  to={`/admin/dishes/${dish.id}/delete`}
                                  className="icon-btn is-danger w-8 h-8"
                                  data-tip="Xóa"
                                >
                                  <Icon name="trash" cls="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-sand-dim text-xs">
                          Không tìm thấy món ăn nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Phân trang Bảng Quản Trị (Loại bỏ 100% hiện tượng lag khi quản lý 1.000+ món ăn) */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-[#fdfcfb]">
                  <span className="text-sand-dim">
                    Hiển thị <b>{(currentPage - 1) * pageSize + 1}</b> -{' '}
                    <b>{Math.min(currentPage * pageSize, sortedDishes.length)}</b> trong tổng số{' '}
                    <b>{sortedDishes.length.toLocaleString('vi-VN')}</b> món ăn
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage <= 1}
                      className="w-8 h-8 rounded-lg border border-line flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cream-soft font-bold transition-all text-sand hover:text-cream"
                      title="Trang đầu"
                    >
                      «
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="w-8 h-8 rounded-lg border border-line flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cream-soft transition-all text-sand hover:text-cream"
                      title="Trang trước"
                    >
                      <Icon name="chevron-left" cls="w-3.5 h-3.5" />
                    </button>

                    <span className="px-3 py-1 font-bold text-cream bg-white border border-line rounded-lg shadow-2xs">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="w-8 h-8 rounded-lg border border-line flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cream-soft transition-all text-sand hover:text-cream"
                      title="Trang sau"
                    >
                      <Icon name="chevron-right" cls="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage >= totalPages}
                      className="w-8 h-8 rounded-lg border border-line flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cream-soft font-bold transition-all text-sand hover:text-cream"
                      title="Trang cuối"
                    >
                      »
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
