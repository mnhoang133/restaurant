import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView, NotFoundView } from '../../components/StateViews';

export default function AdminIngredientFormPage({ mode = 'create' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';

  const [status, setStatus] = useState(isEdit ? 'loading' : 'ok'); // 'loading' | 'ok' | 'notFound' | 'error'
  const [pageError, setPageError] = useState('');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const loadIngredient = useCallback(
    async (signal) => {
      if (!isEdit) {
        document.title = 'Thêm nguyên liệu mới · CRISPY HOUSE';
        setStatus('ok');
        return;
      }

      setStatus('loading');
      setPageError('');

      const result = await apiClient.ingredients.getById(id, signal);
      if (result.isAborted) return;

      if (!result.ok) {
        if (result.error.code === 'NOT_FOUND') {
          setPageError(result.error.message || `Nguyên liệu #${id} không tồn tại.`);
          setStatus('notFound');
        } else {
          setPageError(result.error.message || 'Không thể tải thông tin nguyên liệu.');
          setStatus('error');
        }
        return;
      }

      const ing = result.data;
      setCode(ing.code || '');
      setName(ing.name || '');
      document.title = `Chỉnh sửa: ${ing.name} · CRISPY HOUSE`;
      setStatus('ok');
    },
    [id, isEdit]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadIngredient(controller.signal);
    return () => controller.abort();
  }, [loadIngredient]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError('');
    setFieldErrors({});
    setIsSubmitting(true);

    const payload = {
      code,
      name,
    };

    const result = isEdit
      ? await apiClient.ingredients.update(id, payload)
      : await apiClient.ingredients.create(payload);

    setIsSubmitting(false);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        setPageError(result.error.message || 'Nguyên liệu không tồn tại.');
        setStatus('notFound');
        return;
      }
      setSubmitError(result.error.message || 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.');
      if (result.error.fields) {
        setFieldErrors(result.error.fields);
      }
      return;
    }

    navigate('/admin/ingredients');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full space-y-6">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
            <div>
              <span className="eyebrow">Nguyên liệu</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-cream tracking-tight">
                {isEdit ? 'Chỉnh Sửa Nguyên Liệu' : 'Thêm Nguyên Liệu Mới'}
              </h1>
              <p className="text-xs text-sand-dim mt-1">
                {isEdit
                  ? `Cập nhật thông tin #${code} (${name}).`
                  : 'Đăng ký tên và mã định danh nguyên vật liệu chế biến.'}
              </p>
            </div>

            <Link
              to="/admin/ingredients"
              className="btn btn-ghost btn-sm w-full sm:w-auto justify-center"
            >
              <Icon name="arrow-left" cls="w-4 h-4" />
              <span>{isEdit ? 'Danh sách' : 'Quay lại'}</span>
            </Link>
          </div>

          {status === 'loading' && <LoadingView message="Đang tải dữ liệu nguyên liệu..." />}

          {status === 'notFound' && (
            <NotFoundView
              title="Không Tìm Thấy Nguyên Liệu"
              message={pageError}
              backTo="/admin/ingredients"
              backLabel="Quay Lại Danh Sách"
            />
          )}

          {status === 'error' && (
            <ErrorView
              title="Không Thể Tải Biểu Mẫu Nguyên Liệu"
              message={pageError}
              onRetry={() => loadIngredient()}
              backTo="/admin/ingredients"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="field-label">
                      Mã Nguyên Liệu <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="ING010 (Hoặc để trống tự sinh)"
                      className="field field-mono"
                    />
                    {fieldErrors.code && (
                      <p className="mt-1.5 text-xs font-semibold text-brand">{fieldErrors.code}</p>
                    )}
                  </div>

                  <div>
                    <label className="field-label">
                      Tên Nguyên Liệu <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Đùi gà tươi CP loại 1"
                      className="field font-semibold"
                    />
                    {fieldErrors.name && (
                      <p className="mt-1.5 text-xs font-semibold text-brand">{fieldErrors.name}</p>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="pt-6 border-t border-line flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                  <Link
                    to="/admin/ingredients"
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
                        ? 'Cập Nhật Nguyên Liệu'
                        : 'Lưu Nguyên Liệu'}
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
