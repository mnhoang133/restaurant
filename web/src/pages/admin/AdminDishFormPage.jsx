import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient, resolveImageUrl } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView, NotFoundView } from '../../components/StateViews';

const CATEGORIES = [
  'Gà Rán',
  'Burger',
  'Ăn Kèm',
  'Combo',
  'Nước Uống',
];

export default function AdminDishFormPage({ mode = 'create' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';

  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'notFound' | 'error'
  const [pageError, setPageError] = useState('');

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(isEdit ? 'Gà Rán' : '');
  const [isAvailable, setIsAvailable] = useState(true);
  const [description, setDescription] = useState('');
  const [selectedChefIds, setSelectedChefIds] = useState([]);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);

  // Images
  const [existingImages, setExistingImages] = useState([]);
  const [deleteImageIds, setDeleteImageIds] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);

  // Options from API
  const [allChefs, setAllChefs] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);

  // Lọc real-time (typing filter) & dropdown cho Đầu Bếp & Nguyên Liệu (Ảnh 3)
  const [chefSearchQuery, setChefSearchQuery] = useState('');
  const [chefFilterStatus, setChefFilterStatus] = useState('all'); // 'all' | 'selected' | 'unselected'
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');
  const [ingredientFilterStatus, setIngredientFilterStatus] = useState('all'); // 'all' | 'selected' | 'unselected'

  // Submission & validation error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const loadFormData = useCallback(
    async (signal) => {
      setStatus('loading');
      setPageError('');

      if (isEdit) {
        const [dishRes, chefsRes, ingredientsRes] = await Promise.all([
          apiClient.dishes.getById(id, signal),
          apiClient.chefs.list({}, signal),
          apiClient.ingredients.list({}, signal),
        ]);

        if (dishRes.isAborted || chefsRes.isAborted || ingredientsRes.isAborted) return;

        if (!dishRes.ok) {
          if (dishRes.error.code === 'NOT_FOUND') {
            setPageError(dishRes.error.message || `Món ăn #${id} không tồn tại.`);
            setStatus('notFound');
          } else {
            setPageError(dishRes.error.message || 'Không thể tải thông tin món ăn.');
            setStatus('error');
          }
          return;
        }

        if (!chefsRes.ok || !ingredientsRes.ok) {
          setPageError(
            (!chefsRes.ok ? chefsRes.error.message : ingredientsRes.error.message) ||
              'Không thể tải danh sách đầu bếp hoặc nguyên liệu.'
          );
          setStatus('error');
          return;
        }

        const d = dishRes.data;
        setCode(d.code || '');
        setName(d.name || '');
        setPrice(d.price !== undefined ? String(d.price) : '');
        setCategory(d.category || 'Gà rán');
        setIsAvailable(Boolean(d.isAvailable));
        setDescription(d.description || '');
        setExistingImages(Array.isArray(d.images) ? d.images : []);
        setDeleteImageIds([]);
        setSelectedChefIds(
          Array.isArray(d.chefs) ? d.chefs.map((c) => c.chefId) : []
        );
        setSelectedIngredientIds(
          Array.isArray(d.ingredients) ? d.ingredients.map((i) => i.ingredientId) : []
        );
        setAllChefs(Array.isArray(chefsRes.data) ? chefsRes.data : []);
        setAllIngredients(Array.isArray(ingredientsRes.data) ? ingredientsRes.data : []);
        document.title = `Chỉnh sửa: ${d.name} · CRISPY HOUSE`;
        setStatus('ok');
      } else {
        const [chefsRes, ingredientsRes] = await Promise.all([
          apiClient.chefs.list({}, signal),
          apiClient.ingredients.list({}, signal),
        ]);

        if (chefsRes.isAborted || ingredientsRes.isAborted) return;

        if (!chefsRes.ok || !ingredientsRes.ok) {
          setPageError(
            (!chefsRes.ok ? chefsRes.error.message : ingredientsRes.error.message) ||
              'Không thể tải dữ liệu khởi tạo form.'
          );
          setStatus('error');
          return;
        }

        setAllChefs(Array.isArray(chefsRes.data) ? chefsRes.data : []);
        setAllIngredients(Array.isArray(ingredientsRes.data) ? ingredientsRes.data : []);
        document.title = 'Thêm món ăn mới · CRISPY HOUSE';
        setStatus('ok');
      }
    },
    [id, isEdit]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadFormData(controller.signal);
    return () => controller.abort();
  }, [loadFormData]);

  // Preview ảnh khi chọn file
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

  const toggleChefId = (chefId) => {
    setSelectedChefIds((prev) =>
      prev.includes(chefId) ? prev.filter((item) => item !== chefId) : [...prev, chefId]
    );
  };

  const toggleIngredientId = (ingId) => {
    setSelectedIngredientIds((prev) =>
      prev.includes(ingId) ? prev.filter((item) => item !== ingId) : [...prev, ingId]
    );
  };

  const filteredChefs = React.useMemo(() => {
    return allChefs.filter((chef) => {
      const isSelected = selectedChefIds.includes(chef.id);
      if (chefFilterStatus === 'selected' && !isSelected) return false;
      if (chefFilterStatus === 'unselected' && isSelected) return false;

      if (chefSearchQuery.trim()) {
        const q = chefSearchQuery.trim().toLowerCase();
        const nameMatch = chef.name && chef.name.toLowerCase().includes(q);
        const fieldMatch = chef.field && chef.field.toLowerCase().includes(q);
        return Boolean(nameMatch || fieldMatch);
      }
      return true;
    });
  }, [allChefs, selectedChefIds, chefFilterStatus, chefSearchQuery]);

  const filteredIngredients = React.useMemo(() => {
    return allIngredients.filter((ing) => {
      const isSelected = selectedIngredientIds.includes(ing.id);
      if (ingredientFilterStatus === 'selected' && !isSelected) return false;
      if (ingredientFilterStatus === 'unselected' && isSelected) return false;

      if (ingredientSearchQuery.trim()) {
        const q = ingredientSearchQuery.trim().toLowerCase();
        return Boolean(ing.name && ing.name.toLowerCase().includes(q));
      }
      return true;
    });
  }, [allIngredients, selectedIngredientIds, ingredientFilterStatus, ingredientSearchQuery]);

  const toggleDeleteImageId = (imgId) => {
    setDeleteImageIds((prev) =>
      prev.includes(imgId) ? prev.filter((item) => item !== imgId) : [...prev, imgId]
    );
  };

  const handleDeleteImageImmediately = async (imgId) => {
    if (!isEdit) return;
    setSubmitError('');
    const result = await apiClient.dishes.removeImage(id, imgId);
    if (!result.ok) {
      setSubmitError(result.error.message || 'Không thể xóa hình ảnh.');
      return;
    }
    if (result.data && Array.isArray(result.data.images)) {
      setExistingImages(result.data.images);
      setDeleteImageIds((prev) => prev.filter((item) => item !== imgId));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError('');
    setFieldErrors({});
    setIsSubmitting(true);

    // Nếu người dùng có đính kèm file ảnh -> gửi FormData, ngược lại gửi JSON để giữ đúng kiểu dữ liệu (số nguyên cho price)
    let payload;
    const parsedPriceNumber = price === '' ? '' : Number(price);

    if (newFiles.length > 0) {
      const formData = new FormData();
      formData.append('code', code);
      formData.append('name', name);
      formData.append('price', price);
      formData.append('category', category);
      formData.append('isAvailable', String(isAvailable));
      formData.append('description', description);
      formData.append('chefIds', JSON.stringify(selectedChefIds));
      formData.append('ingredientIds', JSON.stringify(selectedIngredientIds));
      if (isEdit && deleteImageIds.length > 0) {
        formData.append('deleteImageIds', JSON.stringify(deleteImageIds));
      }
      newFiles.forEach((f) => formData.append('images', f));
      payload = formData;
    } else {
      payload = {
        code,
        name,
        price: parsedPriceNumber,
        category,
        isAvailable,
        description,
        chefIds: selectedChefIds,
        ingredientIds: selectedIngredientIds,
        ...(isEdit && deleteImageIds.length > 0 ? { deleteImageIds } : {}),
      };
    }

    const result = isEdit
      ? await apiClient.dishes.update(id, payload)
      : await apiClient.dishes.create(payload);

    setIsSubmitting(false);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        setPageError(result.error.message || 'Món ăn không tồn tại.');
        setStatus('notFound');
        return;
      }
      setSubmitError(result.error.message || 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.');
      if (result.error.fields) {
        setFieldErrors(result.error.fields);
      }
      return;
    }

    const targetDishId = result.data?.id || id;
    navigate(`/dishes/${targetDishId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full space-y-6">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
            <div>
              <span className="eyebrow">Thực đơn</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-cream tracking-tight">
                {isEdit ? 'Chỉnh Sửa Món Ăn' : 'Thêm Món Ăn Mới'}
              </h1>
              <p className="text-xs text-sand-dim mt-1">
                {isEdit
                  ? `Cập nhật thông tin cho món ${name || ''}.`
                  : 'Khởi tạo món ăn và liên kết đầu bếp, nguyên liệu chế biến.'}
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
              {isEdit && (
                <Link
                  to={`/dishes/${id}`}
                  className="btn btn-ghost btn-sm flex-1 sm:flex-initial justify-center"
                >
                  <Icon name="eye" cls="w-4 h-4" />
                  <span>Xem trang món</span>
                </Link>
              )}
              <Link
                to="/admin/dishes"
                className="btn btn-ghost btn-sm flex-1 sm:flex-initial justify-center"
              >
                <Icon name="arrow-left" cls="w-4 h-4" />
                <span>{isEdit ? 'Danh sách' : 'Quay lại'}</span>
              </Link>
            </div>
          </div>

          {status === 'loading' && <LoadingView message="Đang tải dữ liệu biểu mẫu..." />}

          {status === 'notFound' && (
            <NotFoundView
              title="Không Tìm Thấy Món Ăn"
              message={pageError}
              backTo="/admin/dishes"
              backLabel="Quay Lại Danh Sách"
            />
          )}

          {status === 'error' && (
            <ErrorView
              title="Không Thể Tải Biểu Mẫu"
              message={pageError}
              onRetry={() => loadFormData()}
              backTo="/admin/dishes"
              backLabel="Quay Lại Danh Sách"
            />
          )}

          {status === 'ok' && (
            <>
              {/* Error Alert */}
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
                  {/* Tên món */}
                  <div>
                    <label className="field-label">
                      Tên Món Ăn <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ví dụ: Cánh Gà Cay Sốt Hàn Quốc"
                      className="field font-semibold"
                    />
                    {fieldErrors.name && (
                      <p className="mt-1.5 text-xs font-semibold text-brand">{fieldErrors.name}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Giá bán */}
                  <div>
                    <label className="field-label">
                      Giá Bán (VNĐ) <span className="req">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="75000"
                        min="0"
                        step="1000"
                        className="field font-mono text-ember font-bold pr-16"
                      />
                      <span className="field-suffix">VNĐ</span>
                    </div>
                    {fieldErrors.price ? (
                      <p className="mt-1.5 text-xs font-semibold text-brand">{fieldErrors.price}</p>
                    ) : (
                      <p className="field-hint">
                        Giá bán là số nguyên không âm (ví dụ: 45000 VNĐ).
                      </p>
                    )}
                  </div>

                  {/* Danh mục */}
                  <div>
                    <label className="field-label">
                      Danh Mục <span className="req">*</span>
                    </label>
                    <select
                      name="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="field"
                    >
                      {!isEdit && <option value="">-- Chọn danh mục --</option>}
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.category && (
                      <p className="mt-1.5 text-xs font-semibold text-brand">
                        {fieldErrors.category}
                      </p>
                    )}
                  </div>
                </div>

                {/* Trạng thái phục vụ */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="isAvailable"
                      checked={isAvailable}
                      onChange={(e) => setIsAvailable(e.target.checked)}
                      className="switch"
                    />
                    <div>
                      <span className="block text-sm font-bold text-cream">
                        Đang phục vụ trong thực đơn
                      </span>
                      <span className="block text-xs text-sand-dim">
                        Khách hàng có thể nhìn thấy và gọi món trên menu.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Mô tả */}
                <div>
                  <label className="field-label">Mô Tả Hương Vị & Thành Phần</label>
                  <textarea
                    name="description"
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả độ giòn, sốt chấm ăn kèm, quy cách phục vụ..."
                    className="field"
                  />
                </div>

                {/* Hình ảnh hiện có (khi sửa) & Tải thêm ảnh */}
                <div className="space-y-4">
                  {isEdit && (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="field-label mb-0">Hình Ảnh Món Ăn Hiện Có</label>
                        {existingImages.length > 0 && (
                          <span className="text-xs text-sand-dim">
                            Có {existingImages.length} hình ảnh
                          </span>
                        )}
                      </div>

                      {existingImages.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {existingImages.map((img, idx) => (
                            <div
                              key={img.id}
                              className="relative rounded-2xl overflow-hidden border border-line bg-surface p-2.5 flex flex-col justify-between shadow-sm"
                            >
                              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-sand-dim/10">
                                <img
                                  src={resolveImageUrl(img.imageUrl)}
                                  alt={`Ảnh ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute top-1.5 left-1.5 badge badge-code text-[10px] px-1.5 py-0.5 bg-ink-950/80 text-white font-mono">
                                  #{img.orderIndex}
                                </span>
                              </div>

                              <div className="mt-2.5 pt-2 border-t border-line/60 flex flex-col gap-2">
                                <label
                                  className="flex items-center gap-1.5 text-[11px] text-sand cursor-pointer hover:text-red transition-colors"
                                  title="Chọn để xóa khi nhấn Cập Nhật Món Ăn"
                                >
                                  <input
                                    type="checkbox"
                                    checked={deleteImageIds.includes(img.id)}
                                    onChange={() => toggleDeleteImageId(img.id)}
                                    className="check check-danger"
                                  />
                                  <span>Đánh dấu xóa</span>
                                </label>

                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() => handleDeleteImageImmediately(img.id)}
                                  className="btn btn-danger btn-xs w-full text-[11px] justify-center"
                                  title="Xóa hình ảnh này ngay lập tức"
                                >
                                  <Icon name="trash" cls="w-3 h-3" />
                                  <span>Xóa ngay</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl border border-dashed border-line text-center text-xs text-sand-dim">
                          Món ăn này chưa có hình ảnh nào. Bạn có thể tải ảnh mới bên dưới.
                        </div>
                      )}
                    </>
                  )}

                  {!isEdit && (
                    <label className="field-label">Hình Ảnh Món Ăn (Tải tối đa 5 tệp)</label>
                  )}

                  <div className="dropzone">
                    <input
                      type="file"
                      name="images"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                    <div className="dropzone-icon">
                      <Icon name="upload" cls="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-cream">
                        {isEdit ? 'Tải thêm ảnh mới cho món ăn' : 'Nhấp hoặc kéo thả ảnh vào đây'}
                      </p>
                      <p className="text-[11px] text-sand-dim mt-0.5">
                        Hỗ trợ định dạng PNG, JPG, WEBP (tối đa 5 tệp)
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

                {/* Đầu bếp phụ trách (N-N) - Có Typing Filter và Dropdown Filter theo yêu cầu Ảnh 3 */}
                {allChefs.length > 0 && (
                  <div className="pt-4 border-t border-line space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="field-label mb-0">Đầu Bếp Phụ Trách</label>
                      <span className="text-xs text-sand-dim">
                        Đã chọn {selectedChefIds.length} / {allChefs.length} đầu bếp
                      </span>
                    </div>

                    {/* Bộ lọc typing filter & status dropdown cho đầu bếp */}
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="relative flex-grow min-w-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-sand-dim">
                          <Icon name="search" cls="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          value={chefSearchQuery}
                          onChange={(e) => setChefSearchQuery(e.target.value)}
                          placeholder="Lọc theo tên đầu bếp, chuyên môn trong thời gian thực..."
                          className="field text-xs w-full pl-9 pr-8 h-10"
                        />
                        {chefSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setChefSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-sand-dim hover:text-cream"
                          >
                            <Icon name="x" cls="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="w-full sm:w-44 flex-shrink-0">
                        <select
                          value={chefFilterStatus}
                          onChange={(e) => setChefFilterStatus(e.target.value)}
                          className="field text-xs w-full h-10"
                        >
                          <option value="all">Tất cả ({allChefs.length})</option>
                          <option value="selected">Đã chọn ({selectedChefIds.length})</option>
                          <option value="unselected">
                            Chưa chọn ({allChefs.length - selectedChefIds.length})
                          </option>
                        </select>
                      </div>
                    </div>

                    {filteredChefs.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredChefs.map((chef) => (
                          <label key={chef.id} className="option-card">
                            <input
                              type="checkbox"
                              checked={selectedChefIds.includes(chef.id)}
                              onChange={() => toggleChefId(chef.id)}
                              className="check"
                            />
                            <div>
                              <span className="opt-title">{chef.name}</span>
                              <span className="opt-sub">{chef.field}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-sand-dim bg-[#fbf9f6] rounded-xl border border-dashed border-line">
                        Không tìm thấy đầu bếp nào phù hợp với bộ lọc.
                      </div>
                    )}
                  </div>
                )}

                {/* Nguyên liệu sử dụng (N-N) - Có Typing Filter và Dropdown Filter theo yêu cầu Ảnh 3 */}
                {allIngredients.length > 0 && (
                  <div className="pt-4 border-t border-line space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="field-label mb-0">Nguyên Liệu Chế Biến</label>
                      <span className="text-xs text-sand-dim">
                        Đã chọn {selectedIngredientIds.length} / {allIngredients.length} nguyên liệu
                      </span>
                    </div>

                    {/* Bộ lọc typing filter & status dropdown cho nguyên liệu */}
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="relative flex-grow min-w-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-sand-dim">
                          <Icon name="search" cls="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          value={ingredientSearchQuery}
                          onChange={(e) => setIngredientSearchQuery(e.target.value)}
                          placeholder="Lọc theo tên nguyên liệu trong thời gian thực..."
                          className="field text-xs w-full pl-9 pr-8 h-10"
                        />
                        {ingredientSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setIngredientSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-sand-dim hover:text-cream"
                          >
                            <Icon name="x" cls="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="w-full sm:w-44 flex-shrink-0">
                        <select
                          value={ingredientFilterStatus}
                          onChange={(e) => setIngredientFilterStatus(e.target.value)}
                          className="field text-xs w-full h-10"
                        >
                          <option value="all">Tất cả ({allIngredients.length})</option>
                          <option value="selected">Đã chọn ({selectedIngredientIds.length})</option>
                          <option value="unselected">
                            Chưa chọn ({allIngredients.length - selectedIngredientIds.length})
                          </option>
                        </select>
                      </div>
                    </div>

                    {filteredIngredients.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredIngredients.map((ing) => (
                          <label key={ing.id} className="option-card">
                            <input
                              type="checkbox"
                              checked={selectedIngredientIds.includes(ing.id)}
                              onChange={() => toggleIngredientId(ing.id)}
                              className="check"
                            />
                            <div>
                              <span className="opt-title">{ing.name}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-sand-dim bg-[#fbf9f6] rounded-xl border border-dashed border-line">
                        Không tìm thấy nguyên liệu nào phù hợp với bộ lọc.
                      </div>
                    )}
                  </div>
                )}

                {/* Form Buttons */}
                <div className="pt-6 border-t border-line flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                  <Link
                    to="/admin/dishes"
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
                        ? 'Cập Nhật Món Ăn'
                        : 'Lưu Món Mới'}
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
