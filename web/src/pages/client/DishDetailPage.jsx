import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient, resolveImageUrl } from '../../api/client';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView, NotFoundView } from '../../components/StateViews';

export default function DishDetailPage() {
  const { id } = useParams();

  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'notFound' | 'error'
  const [dish, setDish] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);

  const fetchDishDetail = useCallback(
    async (signal) => {
      setStatus('loading');
      setErrorMsg('');
      setDish(null);
      setActiveImgIdx(0);

      const result = await apiClient.dishes.getById(id, signal);
      if (result.isAborted) return;

      if (!result.ok) {
        if (result.error.code === 'NOT_FOUND') {
          setErrorMsg(result.error.message || `Món ăn #${id} không tồn tại hoặc đã ngừng phục vụ.`);
          setStatus('notFound');
        } else {
          setErrorMsg(result.error.message || 'Không thể tải thông tin chi tiết món ăn.');
          setStatus('error');
        }
        return;
      }

      setDish(result.data);
      document.title = `${result.data.name} · CRISPY HOUSE`;
      setStatus('ok');
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDishDetail(controller.signal);
    return () => controller.abort();
  }, [fetchDishDetail]);

  const handleSelectImage = (idx) => {
    if (idx === activeImgIdx) return;
    setIsSwapping(true);
    setTimeout(() => {
      setActiveImgIdx(idx);
      setIsSwapping(false);
    }, 160);
  };

  if (status === 'loading') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <LoadingView message="Đang tải chi tiết món ăn..." />
      </div>
    );
  }

  if (status === 'notFound') {
    return (
      <NotFoundView
        title="Không Tìm Thấy Món Ăn"
        message={errorMsg}
        backTo="/dishes"
        backLabel="Quay Lại Thực Đơn"
      />
    );
  }

  if (status === 'error' || !dish) {
    return (
      <ErrorView
        title="Không Thể Tải Chi Tiết Món Ăn"
        message={errorMsg}
        onRetry={() => fetchDishDetail()}
        backTo="/dishes"
        backLabel="Quay Lại Thực Đơn"
      />
    );
  }

  const images = dish.images || [];
  const mainImg =
    images.length > 0
      ? resolveImageUrl(images[activeImgIdx]?.imageUrl || images[0].imageUrl)
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Breadcrumbs & Quick Return */}
      <div className="flex items-center justify-between text-xs text-sand">
        <nav className="flex items-center gap-2" aria-label="Đường dẫn">
          <Link to="/" className="hover:text-cream transition-colors">
            Trang chủ
          </Link>
          <span className="text-sand/40">/</span>
          <Link to="/dishes" className="hover:text-cream transition-colors">
            Menu
          </Link>
          <span className="text-sand/40">/</span>
          <span className="text-cream font-medium truncate max-w-[200px]">{dish.name}</span>
        </nav>

        <Link
          to="/dishes"
          className="inline-flex items-center gap-1.5 text-sand hover:text-cream transition-colors"
        >
          <Icon name="arrow-left" cls="w-4 h-4" />
          <span>Trở lại Menu</span>
        </Link>
      </div>

      {/* Main Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Large Image & Gallery */}
        <div className="lg:col-span-6 space-y-4">
          <div className="detail-hero">
            {mainImg ? (
              <img
                id="detail-main-img"
                src={mainImg}
                alt={dish.name}
                className={isSwapping ? 'is-swapping' : ''}
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#f4eee6] text-sand-dim gap-3 p-8 select-none">
                <div className="w-20 h-20 rounded-3xl bg-white border border-[rgba(0,0,0,0.08)] grid place-items-center text-brand shadow-sm">
                  <Icon name="drumstick" cls="w-10 h-10 stroke-[1.8]" />
                </div>
                <span className="text-xs font-semibold tracking-wider uppercase text-sand/60">
                  Hình ảnh đang được cập nhật
                </span>
              </div>
            )}
          </div>

          {/* Multiple Image Strip */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => handleSelectImage(idx)}
                  className="thumb-btn"
                  aria-pressed={idx === activeImgIdx ? 'true' : 'false'}
                  aria-label={`Xem ảnh ${idx + 1}`}
                >
                  <img
                    src={resolveImageUrl(img.imageUrl)}
                    alt={`${dish.name} ${idx + 1}`}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Details & Information */}
        <div className="lg:col-span-6 space-y-8">
          <div className="space-y-3">
            <div className="flex items-center text-xs font-mono text-sand-dim">
              <span>DANH MỤC: {dish.category}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-cream tracking-tight leading-tight">
              {dish.name}
            </h1>
          </div>

          {/* Price Banner */}
          <div className="card p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-brand/10 to-transparent border border-brand/20">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-sand">
                Giá bán niêm yết
              </span>
              <div className="price-tag mt-1">
                {Number(dish.price).toLocaleString('vi-VN')}
                <small>VNĐ</small>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-sand-dim block">Tình trạng</span>
              <span
                className={`text-sm font-bold ${
                  dish.isAvailable ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {dish.isAvailable ? 'Có sẵn phục vụ' : 'Hết món'}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sand">Mô tả món ăn</h3>
            <p className="text-sm text-sand leading-relaxed whitespace-pre-line">
              {dish.description ||
                'Món ăn đặc sắc của nhà hàng, được chế biến từ những nguyên liệu tươi ngon nhất cùng công thức gia vị độc quyền.'}
            </p>
          </div>

          {/* Chefs (Đầu bếp phụ trách) */}
          {dish.chefs && dish.chefs.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[rgba(0,0,0,0.08)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sand">
                Đầu bếp thực hiện
              </h3>
              <div className="flex flex-wrap gap-3">
                {dish.chefs.map((link) => {
                  const chef = link.chef;
                  if (!chef) return null;
                  const chefImg =
                    chef.images && chef.images.length > 0
                      ? resolveImageUrl(chef.images[0].imageUrl)
                      : null;
                  return (
                    <div key={chef.id} className="person-chip">
                      {chefImg ? (
                        <img
                          src={chefImg}
                          alt={chef.name}
                          className="w-9 h-9 rounded-full object-cover border border-line"
                        />
                      ) : (
                        <div className="initial">{chef.name.charAt(0)}</div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-cream">{chef.name}</div>
                        <div className="text-[10px] text-sand-dim">
                          {chef.field} · {chef.experience} năm kinh nghiệm
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ingredients (Nguyên liệu - Chỉ hiển thị tên nguyên liệu theo yêu cầu mới) */}
          {dish.ingredients && dish.ingredients.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[rgba(0,0,0,0.08)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sand">
                Nguyên liệu thành phần
              </h3>
              <div className="flex flex-wrap gap-2">
                {dish.ingredients.map((link) => {
                  const ing = link.ingredient;
                  if (!ing) return null;
                  return (
                    <span
                      key={ing.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.03] border border-line text-xs text-sand"
                    >
                      <Icon name="box" cls="w-3.5 h-3.5 text-ember" />
                      <span>{ing.name}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-6 border-t border-[rgba(0,0,0,0.08)] flex flex-wrap gap-3">
            <Link to="/dishes" className="btn btn-ghost btn-sm w-full sm:w-auto justify-center">
              <Icon name="arrow-left" cls="w-4 h-4" />
              <span>Xem các món khác</span>
            </Link>
            <Link
              to={`/admin/dishes/${dish.id}/edit`}
              className="btn btn-primary btn-sm w-full sm:w-auto justify-center"
            >
              <Icon name="edit" cls="w-4 h-4" />
              <span>Chỉnh sửa món này</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
