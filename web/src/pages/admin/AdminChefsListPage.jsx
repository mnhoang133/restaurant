import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient, resolveImageUrl } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView } from '../../components/StateViews';

export default function AdminChefsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(qParam);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [chefs, setChefs] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Quản trị - Danh sách đầu bếp · CRISPY HOUSE';
  }, []);

  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed });
    } else {
      setSearchParams({});
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchParams({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full space-y-6">
          {/* Search & Add Action Row */}
          <div className="card p-4">
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3"
            >
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
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="btn btn-primary h-12 px-5 flex-1 sm:flex-initial justify-center whitespace-nowrap"
                >
                  <span>Tìm</span>
                </button>
                {qParam && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    disabled={status === 'loading'}
                    className="btn btn-ghost h-12 px-4 flex-1 sm:flex-initial justify-center whitespace-nowrap"
                  >
                    <span>Xóa lọc</span>
                  </button>
                )}
                <Link
                  to="/admin/chefs/new"
                  className="btn btn-primary h-12 px-5 w-full sm:w-auto justify-center flex-shrink-0 whitespace-nowrap"
                >
                  <Icon name="plus" cls="w-4 h-4" />
                  <span>Thêm Đầu Bếp</span>
                </Link>
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
              {chefs.length > 0 ? (
                chefs.map((chef) => {
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
                        <div className="flex items-center gap-4">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={chef.name}
                              className="w-16 h-16 rounded-2xl object-cover border border-line"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center text-brand font-bold text-xl">
                              {chef.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-mono text-[10px] text-sand-dim font-bold uppercase">
                              #{chef.code}
                            </div>
                            <h3 className="font-bold text-lg text-cream">{chef.name}</h3>
                            <p className="text-xs text-ember font-semibold mt-0.5">
                              {chef.field}
                            </p>
                          </div>
                        </div>

                        <div className="py-3 border-y border-line flex justify-between items-center text-xs">
                          <span className="text-sand-dim">Kinh nghiệm chuyên môn:</span>
                          <span className="font-bold text-cream">{chef.experience} năm</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-sand-dim">
                            <span>Món phụ trách</span>
                            <span>{cookedDishes.length} món</span>
                          </div>
                          {cookedDishes.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {cookedDishes.slice(0, 4).map((d) => (
                                <span
                                  key={d.id}
                                  className="badge text-[11px] bg-[#f8f5f0] text-cream"
                                >
                                  {d.name}
                                </span>
                              ))}
                              {cookedDishes.length > 4 && (
                                <span className="badge text-[11px]">
                                  +{cookedDishes.length - 4}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-sand-dim italic">
                              Chưa phân công món ăn
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-line">
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
                  );
                })
              ) : (
                <div className="col-span-full card card-pad text-center py-12 text-sand-dim text-xs">
                  Chưa có đầu bếp nào trong hệ thống.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
