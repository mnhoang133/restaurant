import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient, resolveImageUrl, getDishImageUrl, getCategoryImageUrl } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView } from '../../components/StateViews';

export default function AdminChefsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const fieldParam = searchParams.get('field') || '';
  const sortParam = searchParams.get('sort') || 'name_asc';

  const [searchInput, setSearchInput] = useState(qParam);
  const [fieldInput, setFieldInput] = useState(fieldParam);
  const [sortInput, setSortInput] = useState(sortParam);

  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [chefs, setChefs] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // State cho Modal xem chi tiết món ăn phụ trách của đầu bếp
  const [selectedChefForDetail, setSelectedChefForDetail] = useState(null);

  useEffect(() => {
    document.title = 'Quản trị - Danh sách đầu bếp · CRISPY HOUSE';
  }, []);

  useEffect(() => {
    setSearchInput(qParam);
    setFieldInput(fieldParam);
    setSortInput(sortParam);
  }, [qParam, fieldParam, sortParam]);

  const fetchChefs = useCallback(
    async (signal) => {
      setStatus('loading');
      setErrorMsg('');

      const result = await apiClient.chefs.list({ q: qParam }, signal);
      if (result.isAborted) return;

      if (!result.ok) {
        setErrorMsg(result.error.message || 'Không thể tải danh sách đầu bếp.');
        setStatus('error');
        return;
      }

      setChefs(Array.isArray(result.data) ? result.data : []);
      setStatus('ok');
    },
    [qParam]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchChefs(controller.signal);
    return () => controller.abort();
  }, [fetchChefs]);

  const applyFilters = (nextQ, nextField, nextSort) => {
    const nextParams = {};
    if ((nextQ || '').trim()) nextParams.q = nextQ.trim();
    if ((nextField || '').trim()) nextParams.field = nextField.trim();
    if (nextSort && nextSort !== 'name_asc') nextParams.sort = nextSort;
    setSearchParams(nextParams);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    applyFilters(searchInput, fieldInput, sortInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setFieldInput('');
    setSortInput('name_asc');
    setSearchParams({});
  };

  // Trích xuất danh sách các lĩnh vực/chuyên môn duy nhất để lọc
  const uniqueFields = Array.from(
    new Set(chefs.map((c) => c.field).filter(Boolean))
  ).sort();

  // Lọc và sắp xếp phía client
  const filteredAndSortedChefs = chefs
    .filter((chef) => {
      if (fieldInput && chef.field !== fieldInput) return false;
      return true;
    })
    .sort((a, b) => {
      const aDishesCount = Array.isArray(a.dishes) ? a.dishes.length : 0;
      const bDishesCount = Array.isArray(b.dishes) ? b.dishes.length : 0;

      if (sortInput === 'name_asc') return a.name.localeCompare(b.name, 'vi');
      if (sortInput === 'name_desc') return b.name.localeCompare(a.name, 'vi');
      if (sortInput === 'exp_desc') return (b.experience || 0) - (a.experience || 0);
      if (sortInput === 'exp_asc') return (a.experience || 0) - (b.experience || 0);
      if (sortInput === 'dishes_desc') return bDishesCount - aDishesCount;
      if (sortInput === 'dishes_asc') return aDishesCount - bDishesCount;
      return a.name.localeCompare(b.name, 'vi');
    });

  const hasFilter = Boolean(qParam || fieldParam || sortParam !== 'name_asc');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full space-y-6">
          {/* Search, Filter & Sắp xếp trong Quản lý đầu bếp */}
          <div className="card p-4 space-y-3">
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                <div className="field-icon flex-grow min-w-0 w-full">
                  <Icon name="search" cls="w-4 h-4" />
                  <input
                    type="text"
                    name="q"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tìm theo tên hoặc chuyên môn đầu bếp..."
                    className="field text-xs sm:text-sm"
                  />
                </div>
                <Link
                  to="/admin/chefs/new"
                  className="btn btn-primary h-12 px-5 w-full sm:w-auto justify-center flex-shrink-0 whitespace-nowrap"
                >
                  <Icon name="plus" cls="w-4 h-4" />
                  <span>Thêm Đầu Bếp</span>
                </Link>
              </div>

              {/* Hàng bộ lọc và sắp xếp */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-line/60 text-xs">
                {/* Lọc chuyên môn */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto sm:flex-initial min-w-0">
                  <span className="text-sand-dim font-medium whitespace-nowrap">Chuyên môn:</span>
                  <select
                    value={fieldInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFieldInput(val);
                      applyFilters(searchInput, val, sortInput);
                    }}
                    className="field text-xs h-9 py-1 flex-1 min-w-0"
                  >
                    <option value="">Tất cả chuyên môn</option>
                    {uniqueFields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sắp xếp */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto sm:flex-initial min-w-0">
                  <span className="text-sand-dim font-medium whitespace-nowrap">Sắp xếp:</span>
                  <select
                    value={sortInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSortInput(val);
                      applyFilters(searchInput, fieldInput, val);
                    }}
                    className="field text-xs h-9 py-1 flex-1 min-w-0"
                  >
                    <option value="name_asc">Tên: A → Z</option>
                    <option value="name_desc">Tên: Z → A</option>
                    <option value="exp_desc">Kinh nghiệm: Nhiều nhất</option>
                    <option value="exp_asc">Kinh nghiệm: Ít nhất</option>
                    <option value="dishes_desc">Số món phụ trách: Nhiều nhất</option>
                    <option value="dishes_asc">Số món phụ trách: Ít nhất</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto justify-end">
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="btn btn-primary h-9 px-4 text-xs justify-center flex-1 sm:flex-initial"
                  >
                    <span>Lọc</span>
                  </button>

                  {hasFilter && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      disabled={status === 'loading'}
                      className="btn btn-ghost h-9 px-3 text-xs justify-center text-sand hover:text-cream flex-1 sm:flex-initial"
                      title="Xóa lọc"
                    >
                      <Icon name="x" cls="w-3.5 h-3.5" />
                      <span>Xóa lọc</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {status === 'loading' && <LoadingView message="Đang tải danh sách đầu bếp..." />}

          {status === 'error' && (
            <ErrorView
              title="Không Thể Tải Danh Sách Đầu Bếp"
              message={errorMsg}
              onRetry={() => fetchChefs()}
              backTo="/admin/dishes"
              backLabel="Về Quản Lý Món Ăn"
            />
          )}

          {status === 'ok' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAndSortedChefs.length > 0 ? (
                filteredAndSortedChefs.map((chef) => {
                  const avatar =
                    chef.images && chef.images.length > 0
                      ? resolveImageUrl(chef.images[0].imageUrl)
                      : null;
                  const cookedDishes = Array.isArray(chef.dishes)
                    ? chef.dishes.map((d) => d.dish).filter(Boolean)
                    : [];

                  return (
                    <div
                      key={chef.id}
                      className="card p-6 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 min-w-0">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={chef.name}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-line flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center text-brand font-bold text-xl flex-shrink-0">
                              {chef.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-base sm:text-lg text-cream break-words">
                              {chef.name}
                            </h3>
                            <p className="text-xs text-ember font-semibold mt-0.5 break-words">
                              {chef.field}
                            </p>
                          </div>
                        </div>

                        {/* YÊU CẦU: CHỈ HIỂN THỊ SỐ NĂM KINH NGHIỆM VÀ SỐ MÓN PHỤ TRÁCH */}
                        <div className="py-3 border-y border-line space-y-2 text-xs">
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-sand-dim">Kinh nghiệm chuyên môn:</span>
                            <span className="font-bold text-cream whitespace-nowrap">
                              {chef.experience} năm
                            </span>
                          </div>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-sand-dim">Số món phụ trách:</span>
                            <span className="font-bold text-brand whitespace-nowrap">
                              {cookedDishes.length} món
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Các nút hành động: Xem chi tiết (mở modal danh sách món), Sửa, Xóa */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
                        <button
                          type="button"
                          onClick={() => setSelectedChefForDetail(chef)}
                          className="btn btn-ghost btn-xs text-brand hover:text-brand font-semibold flex items-center gap-1.5 min-w-0"
                        >
                          <Icon name="eye" cls="w-3.5 h-3.5" />
                          <span className="truncate">Xem món phụ trách ({cookedDishes.length})</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/admin/chefs/${chef.id}/edit`}
                            className="icon-btn w-8 h-8"
                            data-tip="Chỉnh sửa"
                          >
                            <Icon name="edit" cls="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            to={`/admin/chefs/${chef.id}/delete`}
                            className="icon-btn is-danger w-8 h-8"
                            data-tip="Xóa"
                          >
                            <Icon name="trash" cls="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full card card-pad text-center py-12 text-sand-dim text-xs">
                  Không tìm thấy đầu bếp nào phù hợp với bộ lọc.
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL XEM CHI TIẾT ĐẦU BẾP & DANH SÁCH MÓN ĂN PHỤ TRÁCH (YÊU CẦU ĐỀ BÀI) */}
      {selectedChefForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-chef-title"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-xl border border-[rgba(0,0,0,0.08)] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedChefForDetail.images && selectedChefForDetail.images.length > 0 ? (
                  <img
                    src={resolveImageUrl(selectedChefForDetail.images[0].imageUrl)}
                    alt={selectedChefForDetail.name}
                    className="w-12 h-12 rounded-xl object-cover border border-line"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 grid place-items-center text-brand font-bold text-lg">
                    {selectedChefForDetail.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 id="modal-chef-title" className="font-bold text-base text-cream">
                    {selectedChefForDetail.name}
                  </h3>
                  <p className="text-xs text-sand-dim">
                    {selectedChefForDetail.field} • {selectedChefForDetail.experience} năm kinh nghiệm
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedChefForDetail(null)}
                className="icon-btn w-8 h-8 text-sand hover:text-cream"
                aria-label="Đóng"
              >
                <Icon name="x" cls="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Danh sách món ăn đầu bếp phụ trách */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="text-xs font-bold text-cream uppercase tracking-wider">
                Danh sách món ăn phụ trách (
                {Array.isArray(selectedChefForDetail.dishes) ? selectedChefForDetail.dishes.length : 0})
              </div>

              {Array.isArray(selectedChefForDetail.dishes) && selectedChefForDetail.dishes.length > 0 ? (
                <div className="space-y-2.5">
                  {selectedChefForDetail.dishes.map((item) => {
                    const dish = item.dish || item;
                    const thumb = getDishImageUrl(dish);

                    return (
                      <div
                        key={dish.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-ink-850 border border-line/60 gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={thumb}
                            alt={dish.name}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = getCategoryImageUrl(dish.category);
                            }}
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-cream truncate">{dish.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-sand-dim">
                              <span>{dish.category}</span>
                              <span>•</span>
                              <span className="font-bold text-ember whitespace-nowrap">
                                {Number(dish.price).toLocaleString('vi-VN')}&nbsp;đ
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {dish.isAvailable ? (
                            <span className="badge badge-ok text-[10px] px-2 py-0.5">Phục vụ</span>
                          ) : (
                            <span className="badge badge-off text-[10px] px-2 py-0.5">Tạm hết</span>
                          )}
                          <Link
                            to={`/dishes/${dish.id}`}
                            className="icon-btn w-7 h-7"
                            title="Xem trang món"
                          >
                            <Icon name="eye" cls="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-sand-dim italic">
                  Đầu bếp hiện chưa được phân công phụ trách món ăn nào.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line bg-ink-900 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedChefForDetail(null)}
                className="btn btn-primary h-10 px-5 text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
