import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient, resolveImageUrl, getDishImageUrl, getCategoryImageUrl } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView, NotFoundView } from '../../components/StateViews';

export default function AdminChefFormPage({ mode = 'create' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';

  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'notFound' | 'error'
  const [pageError, setPageError] = useState('');

  // Form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [field, setField] = useState('');
  const [experience, setExperience] = useState('');
  const [currentAvatar, setCurrentAvatar] = useState(null);
  const [newFiles, setNewFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);

  // Hai danh sách món ăn:
  // 1. cookedDishIds: thứ tự các món đầu bếp này nấu (khi chọn món mới, món đó được đưa lên đầu danh sách)
  // 2. allDishes: toàn bộ món ăn trong hệ thống để suy ra 2 list
  const [allDishes, setAllDishes] = useState([]);
  const [cookedDishIds, setCookedDishIds] = useState([]);

  // Lọc món ăn thời gian thực (typing filter + dropdown danh mục theo Yêu cầu Ảnh 3)
  const [dishSearchQuery, setDishSearchQuery] = useState('');
  const [dishCategoryFilter, setDishCategoryFilter] = useState('');
  const [visibleUncookedLimit, setVisibleUncookedLimit] = useState(48);

  // Submit & validation states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const loadData = useCallback(
    async (signal) => {
      setStatus('loading');
      setPageError('');

      if (isEdit) {
        const [chefRes, dishesRes] = await Promise.all([
          apiClient.chefs.getById(id, signal),
          apiClient.dishes.list({}, signal),
        ]);

        if (chefRes.isAborted || dishesRes.isAborted) return;

        if (!chefRes.ok) {
          if (chefRes.error.code === 'NOT_FOUND') {
            setPageError(chefRes.error.message || `Đầu bếp #${id} không tồn tại.`);
            setStatus('notFound');
          } else {
            setPageError(chefRes.error.message || 'Không thể tải thông tin đầu bếp.');
            setStatus('error');
          }
          return;
        }

        if (!dishesRes.ok) {
          setPageError(dishesRes.error.message || 'Không thể tải danh sách món ăn.');
          setStatus('error');
          return;
        }

        const c = chefRes.data;
        setCode(c.code || '');
        setName(c.name || '');
        setField(c.field || '');
        setExperience(c.experience !== undefined ? String(c.experience) : '0');
        setCurrentAvatar(
          c.images && c.images.length > 0 ? resolveImageUrl(c.images[0].imageUrl) : null
        );

        const initialCookedIds = Array.isArray(c.dishes)
          ? c.dishes.map((link) => link.dishId)
          : [];
        setCookedDishIds(initialCookedIds);
        setAllDishes(Array.isArray(dishesRes.data) ? dishesRes.data : []);

        document.title = `Chỉnh sửa: ${c.name} · CRISPY HOUSE`;
        setStatus('ok');
      } else {
        const dishesRes = await apiClient.dishes.list({}, signal);
        if (dishesRes.isAborted) return;

        if (!dishesRes.ok) {
          setPageError(dishesRes.error.message || 'Không thể tải danh sách món ăn.');
          setStatus('error');
          return;
        }

        setAllDishes(Array.isArray(dishesRes.data) ? dishesRes.data : []);
        setCookedDishIds([]);
        document.title = 'Thêm đầu bếp mới · CRISPY HOUSE';
        setStatus('ok');
      }
    },
    [id, isEdit]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    setNewFiles(files);

    if (files.length === 0) {
      setFilePreviews([]);
      return;
    }

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve({ name: file.name, url: ev.target.result });
            reader.readAsDataURL(file);
          })
      )
    ).then(setFilePreviews);
  };

  /**
   * Yêu cầu UI:
   * - "Khi chọn món mới cho đầu bếp, món đó sẽ được xuất hiện lên trên những món đầu bếp đó nấu."
   * - "Tương tự với việc xóa, những món bị xóa sẽ di chuyển xuống list những món đầu bếp đó không nấu."
   */
  const handleAddDishToChef = (dishId) => {
    setCookedDishIds((prev) => {
      if (prev.includes(dishId)) return prev;
      // Đưa món mới chọn lên đầu danh sách những món đầu bếp đó nấu
      return [dishId, ...prev];
    });
  };

  const handleRemoveDishFromChef = (dishId) => {
    setCookedDishIds((prev) => prev.filter((item) => item !== dishId));
  };

  // Danh mục món ăn thực tế để render dropdown filter
  const dishCategories = React.useMemo(() => {
    const set = new Set();
    allDishes.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return Array.from(set).sort();
  }, [allDishes]);

  // Bộ lọc theo thời gian thực (typing filter & category dropdown)
  const matchesDishFilter = useCallback(
    (dish) => {
      if (dishCategoryFilter && dish.category !== dishCategoryFilter) {
        return false;
      }
      if (dishSearchQuery.trim()) {
        const q = dishSearchQuery.trim().toLowerCase();
        const nameMatch = dish.name && dish.name.toLowerCase().includes(q);
        const catMatch = dish.category && dish.category.toLowerCase().includes(q);
        return Boolean(nameMatch || catMatch);
      }
      return true;
    },
    [dishCategoryFilter, dishSearchQuery]
  );

  // Tạo 2 danh sách:
  // List 1 (Trên): Những món ăn đầu bếp đó nấu (giữ đúng thứ tự trong cookedDishIds để món mới chọn xuất hiện ở trên cùng)
  const cookedDishesList = React.useMemo(() => {
    return cookedDishIds
      .map((dId) => allDishes.find((d) => d.id === dId))
      .filter(Boolean);
  }, [cookedDishIds, allDishes]);

  // List 2 (Dưới): Những món ăn đầu bếp đó không nấu
  const uncookedDishesList = React.useMemo(() => {
    return allDishes.filter((d) => !cookedDishIds.includes(d.id));
  }, [allDishes, cookedDishIds]);

  const filteredCookedDishes = React.useMemo(() => {
    return cookedDishesList.filter(matchesDishFilter);
  }, [cookedDishesList, matchesDishFilter]);

  const filteredUncookedDishes = React.useMemo(() => {
    return uncookedDishesList.filter(matchesDishFilter);
  }, [uncookedDishesList, matchesDishFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError('');
    setFieldErrors({});
    setIsSubmitting(true);

    let payload;
    const parsedExpNumber = experience === '' ? '' : Number(experience);

    if (newFiles.length > 0) {
      const formData = new FormData();
      formData.append('code', code);
      formData.append('name', name);
      formData.append('field', field);
      formData.append('experience', experience);
      formData.append('dishIds', JSON.stringify(cookedDishIds));
      newFiles.forEach((f) => formData.append('images', f));
      payload = formData;
    } else {
      payload = {
        code,
        name,
        field,
        experience: parsedExpNumber,
        dishIds: cookedDishIds,
      };
    }

    const result = isEdit
      ? await apiClient.chefs.update(id, payload)
      : await apiClient.chefs.create(payload);

    setIsSubmitting(false);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        setPageError(result.error.message || 'Đầu bếp không tồn tại.');
        setStatus('notFound');
        return;
      }
      setSubmitError(result.error.message || 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.');
      if (result.error.fields) {
        setFieldErrors(result.error.fields);
      }
      return;
    }

    navigate('/admin/chefs');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full space-y-6">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
            <div>
              <span className="eyebrow">Đầu bếp</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-cream tracking-tight">
                {isEdit ? 'Chỉnh Sửa Đầu Bếp' : 'Thêm Đầu Bếp Mới'}
              </h1>
              <p className="text-xs text-sand-dim mt-1">
                {isEdit
                  ? `Cập nhật thông tin và phân công món ăn cho đầu bếp ${name || ''}.`
                  : 'Ghi nhận thông tin nghệ nhân phụ trách bếp và phân công thực đơn.'}
              </p>
            </div>

            <Link
              to="/admin/chefs"
              className="btn btn-ghost btn-sm w-full sm:w-auto justify-center"
            >
              <Icon name="arrow-left" cls="w-4 h-4" />
              <span>{isEdit ? 'Danh sách' : 'Quay lại'}</span>
            </Link>
          </div>

          {status === 'loading' && <LoadingView message="Đang tải dữ liệu đầu bếp..." />}

          {status === 'notFound' && (
            <NotFoundView
              title="Không Tìm Thấy Đầu Bếp"
              message={pageError}
              backTo="/admin/chefs"
              backLabel="Quay Lại Danh Sách"
            />
          )}

          {status === 'error' && (
            <ErrorView
              title="Không Thể Tải Biểu Mẫu Đầu Bếp"
              message={pageError}
              onRetry={() => loadData()}
              backTo="/admin/chefs"
              backLabel="Quay Lại Danh Sách"
            />
          )}

          {status === 'ok' && (
            <>
              {submitError && (
                <div className="alert alert-error">
                  <Icon name="alert" cls="w-5 h-5" />
                  <div>
                    <b>{isEdit ? 'Lỗi cập nhật:' : 'Lỗi nhập liệu:'}</b>
                    <p className="mt-0.5 text-xs">{submitError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="card card-pad space-y-6">
                <div>
                  <div>
                    <label className="field-label">
                      Họ & Tên Đầu Bếp <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nguyễn Thành Đạt"
                      className="field font-semibold"
                    />
                    {fieldErrors.name && (
                      <p className="mt-1.5 text-xs font-semibold text-brand">{fieldErrors.name}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="field-label">
                      Lĩnh Vực Chuyên Môn <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="field"
                      value={field}
                      onChange={(e) => setField(e.target.value)}
                      placeholder="Bếp Trưởng Gà Rán & Sốt Đặc Chế"
                      className="field"
                    />
                    {(fieldErrors.field || fieldErrors.specialty) && (
                      <p className="mt-1.5 text-xs font-semibold text-brand">
                        {fieldErrors.field || fieldErrors.specialty}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="field-label">
                      Kinh Nghiệm (Số năm) <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      name="experience"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="8"
                      min="0"
                      className="field font-mono font-bold"
                    />
                    {fieldErrors.experience && (
                      <p className="mt-1.5 text-xs font-semibold text-brand">
                        {fieldErrors.experience}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ảnh đại diện */}
                <div>
                  <label className="field-label">Ảnh Đại Diện</label>

                  {isEdit && currentAvatar && (
                    <div className="flex items-center gap-3 mb-4">
                      <img
                        src={currentAvatar}
                        alt={name}
                        className="w-16 h-16 rounded-2xl object-cover border border-line"
                      />
                      <span className="text-xs text-sand-dim">Ảnh hiện tại đang sử dụng</span>
                    </div>
                  )}

                  <div className="dropzone">
                    <input
                      type="file"
                      name="images"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                    <div className="dropzone-icon">
                      <Icon name="upload" cls="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-cream">
                        {isEdit ? 'Tải lên ảnh chân dung mới' : 'Tải lên chân dung đầu bếp'}
                      </p>
                      <p className="text-[11px] text-sand-dim mt-0.5">
                        {isEdit
                          ? 'Để trống nếu muốn giữ nguyên ảnh hiện tại.'
                          : 'Định dạng JPG, PNG, WEBP'}
                      </p>
                    </div>
                    {filePreviews.length > 0 && (
                      <div className="dropzone-previews">
                        {filePreviews.map((p, idx) => (
                          <img key={idx} src={p.url} alt={p.name} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ==========================================================================
                    PHÂN CÔNG MÓN ĂN CHO ĐẦU BẾP (2 LIST TRÊN - DƯỚI THEO ĐÚNG YÊU CẦU)
                    - List trên: Những món ăn đầu bếp đó nấu (món mới chọn sẽ xuất hiện lên đầu)
                    - List dưới: Những món ăn đầu bếp đó không nấu (món bị xóa sẽ di chuyển xuống đây)
                    ========================================================================== */}
                <div className="pt-6 border-t border-line space-y-6">
                  <div>
                    <span className="eyebrow">Thực đơn phụ trách</span>
                    <h3 className="text-lg font-extrabold text-cream mt-1">
                      Phân Công Món Ăn Cho Đầu Bếp
                    </h3>
                    <p className="text-xs text-sand-dim mt-0.5">
                      Khi chọn món mới ở danh sách bên dưới, món ăn sẽ chuyển lên đầu danh sách các món đầu bếp nấu. Khi xóa món ở danh sách trên, món ăn sẽ chuyển xuống danh sách không nấu.
                    </p>
                  </div>

                  {/* BỘ LỌC THỜI GIAN THỰC & DROPDOWN DANH MỤC CHO THỰC ĐƠN (Ảnh 3) */}
                  <div className="p-4 rounded-2xl border border-line bg-white shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-grow min-w-0">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sand-dim">
                          <Icon name="search" cls="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={dishSearchQuery}
                          onChange={(e) => {
                            setDishSearchQuery(e.target.value);
                            setVisibleUncookedLimit(48);
                          }}
                          placeholder="Lọc món ăn theo tên trong thời gian thực..."
                          className="field text-xs sm:text-sm w-full pl-10 pr-10"
                        />
                        {dishSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setDishSearchQuery('');
                              setVisibleUncookedLimit(48);
                            }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sand-dim hover:text-cream transition-colors"
                            aria-label="Xóa từ khóa lọc"
                          >
                            <Icon name="x" cls="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="w-full sm:w-56 flex-shrink-0">
                        <select
                          value={dishCategoryFilter}
                          onChange={(e) => {
                            setDishCategoryFilter(e.target.value);
                            setVisibleUncookedLimit(48);
                          }}
                          className="field text-xs sm:text-sm w-full"
                        >
                          <option value="">Tất cả danh mục ({allDishes.length})</option>
                          {dishCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {(dishSearchQuery || dishCategoryFilter) && (
                        <button
                          type="button"
                          onClick={() => {
                            setDishSearchQuery('');
                            setDishCategoryFilter('');
                            setVisibleUncookedLimit(48);
                          }}
                          className="btn btn-ghost btn-sm text-sand hover:text-cream flex-shrink-0 self-center"
                        >
                          Đặt lại lọc
                        </button>
                      )}
                    </div>
                  </div>

                  {/* LIST 1 (TRÊN): Những món ăn đầu bếp đó nấu */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-brand/25 bg-[#fff8f8] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/15 pb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand flex-shrink-0" />
                        <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-cream break-words">
                          Danh sách món đầu bếp này nấu
                        </h4>
                      </div>
                      <span className="badge badge-ok text-xs">
                        {dishSearchQuery || dishCategoryFilter
                          ? `${filteredCookedDishes.length} / ${cookedDishesList.length} món`
                          : `${cookedDishesList.length} món đang nấu`}
                      </span>
                    </div>

                    {filteredCookedDishes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredCookedDishes.map((dish) => {
                          const thumb = getDishImageUrl(dish);
                          return (
                            <div
                              key={dish.id}
                              className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-brand/30 shadow-sm"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={thumb}
                                  alt={dish.name}
                                  className="w-11 h-11 rounded-xl object-cover border border-line flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = getCategoryImageUrl(dish.category);
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-cream truncate">
                                    {dish.name}
                                  </div>
                                  <div className="text-[11px] font-mono text-ember font-bold whitespace-nowrap">
                                    {Number(dish.price).toLocaleString('vi-VN')}&nbsp;đ
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleRemoveDishFromChef(dish.id)}
                                className="btn btn-danger btn-xs flex-shrink-0"
                                title="Xóa món này khỏi danh sách đầu bếp nấu"
                              >
                                <Icon name="trash" cls="w-3 h-3" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-sand-dim bg-white/70 rounded-xl border border-dashed border-brand/20">
                        {cookedDishesList.length > 0
                          ? 'Không có món nào trong danh sách đang nấu phù hợp với bộ lọc.'
                          : 'Đầu bếp này hiện chưa phụ trách nấu món ăn nào. Hãy chọn món từ danh sách bên dưới.'}
                      </div>
                    )}
                  </div>

                  {/* LIST 2 (DƯỚI): Những món ăn đầu bếp đó không nấu */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-line bg-[#fbf9f6] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-sand-dim flex-shrink-0" />
                        <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-sand break-words">
                          Danh sách món đầu bếp này không nấu
                        </h4>
                      </div>
                      <span className="badge text-xs">
                        {dishSearchQuery || dishCategoryFilter
                          ? `${filteredUncookedDishes.length} / ${uncookedDishesList.length} món`
                          : `${uncookedDishesList.length} món chưa chọn`}
                      </span>
                    </div>

                    {filteredUncookedDishes.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {filteredUncookedDishes.slice(0, visibleUncookedLimit).map((dish) => {
                            const thumb = getDishImageUrl(dish);
                            return (
                              <div
                                key={dish.id}
                                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-line hover:border-line-strong transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <img
                                    src={thumb}
                                    alt={dish.name}
                                    className="w-11 h-11 rounded-xl object-cover border border-line flex-shrink-0 opacity-85"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = getCategoryImageUrl(dish.category);
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-cream truncate">
                                      {dish.name}
                                    </div>
                                    <div className="text-[11px] font-mono text-sand-dim whitespace-nowrap">
                                      {Number(dish.price).toLocaleString('vi-VN')}&nbsp;đ
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() => handleAddDishToChef(dish.id)}
                                  className="btn btn-primary btn-xs flex-shrink-0"
                                  title="Chọn món ăn này cho đầu bếp nấu"
                                >
                                  <Icon name="plus" cls="w-3 h-3" />
                                  <span>Chọn món</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {filteredUncookedDishes.length > visibleUncookedLimit && (
                          <div className="text-center pt-3">
                            <button
                              type="button"
                              onClick={() => setVisibleUncookedLimit((prev) => prev + 48)}
                              className="btn btn-ghost btn-sm text-xs font-bold text-sand hover:text-cream"
                            >
                              Xem thêm món ({filteredUncookedDishes.length - visibleUncookedLimit} món còn lại)...
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-6 text-center text-xs text-sand-dim bg-white/70 rounded-xl border border-dashed border-line">
                        {uncookedDishesList.length > 0
                          ? 'Không có món nào phù hợp với bộ lọc.'
                          : 'Tất cả món ăn trong thực đơn đều đã được phân công cho đầu bếp này.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="pt-6 border-t border-line flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                  <Link
                    to="/admin/chefs"
                    className="btn btn-ghost btn-sm w-full sm:w-auto justify-center"
                  >
                    Hủy bỏ
                  </Link>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary btn-sm px-6 w-full sm:w-auto justify-center"
                  >
                    <Icon name="check" cls="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? 'Đang lưu...'
                        : isEdit
                        ? 'Cập Nhật Đầu Bếp'
                        : 'Lưu Đầu Bếp'}
                    </span>
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
