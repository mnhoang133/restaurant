import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView } from '../../components/StateViews';

export default function AdminIngredientsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(qParam);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [ingredients, setIngredients] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Quản trị - Danh sách nguyên liệu · CRISPY HOUSE';
  }, []);

  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  const fetchIngredients = useCallback(
    async (signal) => {
      setStatus('loading');
      setErrorMsg('');

      const result = await apiClient.ingredients.list({ q: qParam }, signal);
      if (result.isAborted) return;

      if (!result.ok) {
        setErrorMsg(result.error.message || 'Không thể tải danh sách nguyên liệu.');
        setStatus('error');
        return;
      }

      setIngredients(Array.isArray(result.data) ? result.data : []);
      setStatus('ok');
    },
    [qParam]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchIngredients(controller.signal);
    return () => controller.abort();
  }, [fetchIngredients]);

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
                  placeholder="Tìm theo tên hoặc mã nguyên liệu..."
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
                  to="/admin/ingredients/new"
                  className="btn btn-primary h-12 px-5 w-full sm:w-auto justify-center flex-shrink-0 whitespace-nowrap"
                >
                  <Icon name="plus" cls="w-4 h-4" />
                  <span>Thêm Nguyên Liệu</span>
                </Link>
              </div>
            </form>
          </div>

          {status === 'loading' && <LoadingView message="Đang tải danh sách nguyên liệu..." />}

          {status === 'error' && (
            <ErrorView
              title="Không Thể Tải Danh Sách Nguyên Liệu"
              message={errorMsg}
              onRetry={() => fetchIngredients()}
              backTo="/admin/dishes"
              backLabel="Về Quản Lý Món Ăn"
            />
          )}

          {status === 'ok' && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mã nguyên liệu</th>
                      <th>Tên nguyên liệu</th>
                      <th className="text-right whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.length > 0 ? (
                      ingredients.map((ing) => (
                        <tr key={ing.id}>
                          <td className="font-mono font-bold text-xs text-sand-dim">
                            #{ing.code}
                          </td>

                          <td className="font-bold text-cream">{ing.name}</td>

                          <td className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 flex-nowrap">
                              <Link
                                to={`/admin/ingredients/${ing.id}/edit`}
                                className="icon-btn w-8 h-8"
                                data-tip="Chỉnh sửa"
                              >
                                <Icon name="edit" cls="w-3.5 h-3.5" />
                              </Link>
                              <Link
                                to={`/admin/ingredients/${ing.id}/delete`}
                                className="icon-btn is-danger w-8 h-8"
                                data-tip="Xóa"
                              >
                                <Icon name="trash" cls="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-center py-12 text-sand-dim text-xs"
                        >
                          Chưa có nguyên vật liệu nào trong hệ thống.
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
