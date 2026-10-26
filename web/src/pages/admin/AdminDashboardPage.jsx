import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, resolveImageUrl } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView } from '../../components/StateViews';

export default function AdminDashboardPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [dishes, setDishes] = useState([]);
  const [chefs, setChefs] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Quản lý - Tổng quan · CRISPY HOUSE';
  }, []);

  const fetchDashboardData = useCallback(async (signal) => {
    setStatus('loading');
    setErrorMsg('');

    const [dishesRes, chefsRes, ingredientsRes] = await Promise.all([
      apiClient.dishes.list({}, signal),
      apiClient.chefs.list({}, signal),
      apiClient.ingredients.list({}, signal),
    ]);

    if (dishesRes.isAborted || chefsRes.isAborted || ingredientsRes.isAborted) return;

    if (!dishesRes.ok || !chefsRes.ok || !ingredientsRes.ok) {
      const firstErr = !dishesRes.ok
        ? dishesRes.error
        : !chefsRes.ok
        ? chefsRes.error
        : ingredientsRes.error;
      setErrorMsg(firstErr?.message || 'Không thể tải dữ liệu tổng quan hệ thống.');
      setStatus('error');
      return;
    }

    setDishes(Array.isArray(dishesRes.data) ? dishesRes.data : []);
    setChefs(Array.isArray(chefsRes.data) ? chefsRes.data : []);
    setIngredients(Array.isArray(ingredientsRes.data) ? ingredientsRes.data : []);
    setStatus('ok');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardData(controller.signal);
    return () => controller.abort();
  }, [fetchDashboardData]);

  const availableDishesCount = dishes.filter((d) => d.isAvailable).length;
  const recentDishes = dishes.slice(0, 5);
  const recentIngredients = ingredients.slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full space-y-8">
          {/* Top Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
            <div>
              <span className="eyebrow">Trang điều khiển</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-cream tracking-tight">
                Tổng Quan Hệ Thống
              </h1>
              <p className="text-xs text-sand-dim mt-1">
                Thông số hoạt động của nhà hàng gà rán CRISPY HOUSE.
              </p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Link
                to="/admin/dishes/new"
                className="btn btn-primary btn-sm w-full sm:w-auto justify-center"
              >
                <Icon name="plus" cls="w-4 h-4" />
                <span>Thêm Món Mới</span>
              </Link>
            </div>
          </div>

          {status === 'loading' && <LoadingView message="Đang tải dữ liệu tổng quan..." />}

          {status === 'error' && (
            <ErrorView
              title="Lỗi Tải Trang Tổng Quan"
              message={errorMsg}
              onRetry={() => fetchDashboardData()}
              backTo="/"
              backLabel="Về Trang Chủ"
            />
          )}

          {status === 'ok' && (
            <>
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Món ăn */}
                <div className="card stat-card is-accent">
                  <div className="flex items-center justify-between">
                    <span className="stat-icon">
                      <Icon name="dish" cls="w-5 h-5" />
                    </span>
                    <span className="badge badge-ok bg-white/20 text-white border-0 text-[11px]">
                      Đang bán
                    </span>
                  </div>
                  <div className="stat-value">{dishes.length}</div>
                  <div className="stat-label">
                    Tổng số món ăn ({availableDishesCount} có sẵn)
                  </div>
                </div>

                {/* Đầu bếp */}
                <div className="card stat-card">
                  <div className="flex items-center justify-between">
                    <span className="stat-icon">
                      <Icon name="chef" cls="w-5 h-5" />
                    </span>
                    <span className="text-xs text-sand-dim font-mono">Bếp</span>
                  </div>
                  <div className="stat-value">{chefs.length}</div>
                  <div className="stat-label">Đầu bếp & Bếp trưởng</div>
                </div>

                {/* Nguyên liệu */}
                <div className="card stat-card">
                  <div className="flex items-center justify-between">
                    <span className="stat-icon">
                      <Icon name="box" cls="w-5 h-5" />
                    </span>
                    <span className="text-xs text-sand-dim font-mono">Nguyên liệu</span>
                  </div>
                  <div className="stat-value">{ingredients.length}</div>
                  <div className="stat-label">Danh mục nguyên liệu chế biến</div>
                </div>
              </div>

              {/* Two Columns: Recent Dishes & Ingredients List */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Món ăn mới nhất */}
                <div className="xl:col-span-7 card overflow-hidden">
                  <div className="p-5 border-b border-line flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-brand" />
                      <h3 className="font-bold text-sm text-cream uppercase tracking-wider">
                        Món ăn gần đây
                      </h3>
                    </div>
                    <Link
                      to="/admin/dishes"
                      className="text-xs text-sand hover:text-cream transition-colors flex items-center gap-1"
                    >
                      <span>Xem tất cả</span>
                      <Icon name="chevron-right" cls="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Món ăn</th>
                          <th>Danh mục</th>
                          <th>Giá bán</th>
                          <th className="text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentDishes.length > 0 ? (
                          recentDishes.map((d) => {
                            const img =
                              d.images && d.images.length > 0
                                ? resolveImageUrl(d.images[0].imageUrl)
                                : null;
                            return (
                              <tr key={d.id}>
                                <td>
                                  <div className="flex items-center gap-3">
                                    {img ? (
                                      <img
                                        src={img}
                                        alt={d.name}
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
                                    <div>
                                      <div className="font-bold text-cream line-clamp-1">
                                        {d.name}
                                      </div>
                                      <div className="font-mono text-xs text-sand-dim">
                                        #{d.code}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="badge text-xs">{d.category}</span>
                                </td>
                                <td className="font-mono font-bold text-ember text-xs">
                                  {Number(d.price).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <Link
                                      to={`/dishes/${d.id}`}
                                      className="icon-btn w-8 h-8"
                                      data-tip="Xem"
                                    >
                                      <Icon name="eye" cls="w-3.5 h-3.5" />
                                    </Link>
                                    <Link
                                      to={`/admin/dishes/${d.id}/edit`}
                                      className="icon-btn w-8 h-8"
                                      data-tip="Sửa"
                                    >
                                      <Icon name="edit" cls="w-3.5 h-3.5" />
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="text-center py-8 text-sand-dim text-xs"
                            >
                              Chưa có món ăn nào.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Danh mục nguyên liệu (không có số lượng tồn kho) */}
                <div className="xl:col-span-5 card overflow-hidden">
                  <div className="p-5 border-b border-line flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-ember" />
                      <h3 className="font-bold text-sm text-cream uppercase tracking-wider">
                        Nguyên liệu chế biến
                      </h3>
                    </div>
                    <Link
                      to="/admin/ingredients"
                      className="text-xs text-sand hover:text-cream transition-colors flex items-center gap-1"
                    >
                      <span>Danh sách</span>
                      <Icon name="chevron-right" cls="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="p-5 space-y-3">
                    {recentIngredients.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2.5">
                        {recentIngredients.map((ing) => (
                          <div
                            key={ing.id}
                            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/[0.02] border border-line text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon name="box" cls="w-4 h-4 text-ember" />
                              <span className="font-semibold text-cream">{ing.name}</span>
                            </div>
                            <span className="font-mono text-[11px] text-sand-dim">
                              #{ing.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-sand-dim text-xs">
                        Chưa có nguyên vật liệu nào trong hệ thống.
                      </div>
                    )}

                    <div className="pt-4 border-t border-line flex justify-end">
                      <Link
                        to="/admin/ingredients/new"
                        className="btn btn-ghost btn-sm w-full justify-center"
                      >
                        <Icon name="plus" cls="w-4 h-4" />
                        <span>Thêm nguyên liệu mới</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
