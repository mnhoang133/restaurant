import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient, resolveImageUrl } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView } from '../../components/StateViews';

const CATEGORIES = [
  'Gà Rán',
  'Burger',
  'Ăn Kèm',
  'Combo',
  'Nước Uống',
];

export default function AdminDishesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';

  const [searchInput, setSearchInput] = useState(qParam);
  const [categoryInput, setCategoryInput] = useState(categoryParam);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [dishes, setDishes] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Quản trị - Danh sách món ăn · CRISPY HOUSE';
  }, []);

  useEffect(() => {
    setSearchInput(qParam);
    setCategoryInput(categoryParam);
  }, [qParam, categoryParam]);

  const fetchDishes = useCallback(
    async (signal) => {
      setStatus('loading');
      setErrorMsg('');

      const result = await apiClient.dishes.list(
        { q: qParam, category: categoryParam },
        signal
      );
      if (result.isAborted) return;

      if (!result.ok) {
        setErrorMsg(result.error.message || 'Không thể tải danh sách món ăn.');
        setStatus('error');
        return;
      }

      setDishes(Array.isArray(result.data) ? result.data : []);
      setStatus('ok');
    },
    [qParam, categoryParam]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDishes(controller.signal);
    return () => controller.abort();
  }, [fetchDishes]);

  const applyFilterParams = (nextQ, nextCat) => {
    const nextParams = {};
    if ((nextQ || '').trim()) nextParams.q = nextQ.trim();
    if ((nextCat || '').trim()) nextParams.category = nextCat.trim();
    setSearchParams(nextParams);
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    applyFilterParams(searchInput, categoryInput);
  };

  const handleCategoryChange = (e) => {
    const nextCat = e.target.value;
    setCategoryInput(nextCat);
    applyFilterParams(searchInput, nextCat);
  };

  const handleClearFilter = () => {
    setSearchInput('');
    setCategoryInput('');
    setSearchParams({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full space-y-6">
          {/* Search, Category Filter & Add Action Row */}
          <div className="card p-4">
            <form
              onSubmit={handleFilterSubmit}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3"
            >
              <div className="field-icon flex-grow min-w-0">
                <Icon name="search" cls="w-4 h-4" />
                <input
                  type="text"
                  name="q"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm theo tên món hoặc mã món (#DISH001)..."
                  className="field text-xs sm:text-sm"
                />
              </div>

              <select
                name="category"
                value={categoryInput}
                onChange={handleCategoryChange}
                disabled={status === 'loading'}
                aria-label="Lọc theo danh mục"
                className="field text-xs sm:text-sm sm:w-44 flex-shrink-0"
              >
                <option value="">Tất cả danh mục</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="btn btn-primary h-12 px-5 flex-1 sm:flex-initial justify-center"
                >
                  <span>Lọc</span>
                </button>

                {(qParam || categoryParam) && (
                  <button
                    type="button"
                    onClick={handleClearFilter}
                    disabled={status === 'loading'}
                    className="btn btn-ghost h-12 px-4 flex-1 sm:flex-initial justify-center"
                  >
                    <span>Xóa lọc</span>
                  </button>
                )}

                <Link
                  to="/admin/dishes/new"
                  className="btn btn-primary h-12 px-5 w-full sm:w-auto justify-center flex-shrink-0"
                >
                  <Icon name="plus" cls="w-4 h-4" />
                  <span>Thêm Món Mới</span>
                </Link>
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
                      <th>Hình ảnh</th>
                      <th>Mã & Tên món</th>
                      <th>Danh mục</th>
                      <th>Giá bán</th>
                      <th>Trạng thái</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dishes.length > 0 ? (
                      dishes.map((dish) => {
                        const img =
                          dish.images && dish.images.length > 0
                            ? resolveImageUrl(dish.images[0].imageUrl)
                            : null;
                        return (
                          <tr key={dish.id}>
                            <td>
                              {img ? (
                                <img
                                  src={img}
                                  alt={dish.name}
                                  className="thumb"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="thumb grid place-items-center bg-[#f4eee6] text-sand/60">
                                  <Icon
                                    name="drumstick"
                                    cls="w-5 h-5 text-brand/50"
                                  />
                                </div>
                              )}
                            </td>

                            <td>
                              <div className="font-bold text-cream">{dish.name}</div>
                              <div className="font-mono text-xs text-sand-dim">
                                #{dish.code}
                              </div>
                            </td>

                            <td>
                              <span className="badge text-xs">{dish.category}</span>
                            </td>

                            <td className="font-mono font-bold text-ember text-sm">
                              {Number(dish.price).toLocaleString('vi-VN')} đ
                            </td>

                            <td>
                              {dish.isAvailable ? (
                                <span className="badge badge-ok badge-dot text-xs">
                                  Phục vụ
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
                        <td
                          colSpan={6}
                          className="text-center py-12 text-sand-dim text-xs"
                        >
                          Không tìm thấy món ăn nào trong danh sách.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
