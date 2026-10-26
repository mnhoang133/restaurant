import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView, NotFoundView } from '../../components/StateViews';

export default function AdminDishDeletePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'notFound' | 'error'
  const [dish, setDish] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDish = useCallback(
    async (signal) => {
      setStatus('loading');
      setErrorMsg('');
      setDeleteError('');

      const result = await apiClient.dishes.getById(id, signal);
      if (result.isAborted) return;

      if (!result.ok) {
        if (result.error.code === 'NOT_FOUND') {
          setErrorMsg(result.error.message || `Món ăn #${id} không tồn tại để xóa.`);
          setStatus('notFound');
        } else {
          setErrorMsg(result.error.message || 'Không thể tải thông tin món ăn.');
          setStatus('error');
        }
        return;
      }

      setDish(result.data);
      document.title = `Xác nhận xóa: ${result.data.name} · CRISPY HOUSE`;
      setStatus('ok');
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDish(controller.signal);
    return () => controller.abort();
  }, [fetchDish]);

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (isDeleting) return;

    setIsDeleting(true);
    setDeleteError('');

    const result = await apiClient.dishes.remove(id);
    setIsDeleting(false);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        setErrorMsg(result.error.message || 'Món ăn không tồn tại.');
        setStatus('notFound');
      } else {
        setDeleteError(result.error.message || 'Không thể xóa món ăn lúc này.');
      }
      return;
    }

    navigate('/admin/dishes');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full max-w-xl mx-auto space-y-6 pt-4">
          {status === 'loading' && <LoadingView message="Đang tải thông tin món ăn..." />}

          {status === 'notFound' && (
            <NotFoundView
              title="Không Tìm Thấy Món Ăn"
              message={errorMsg}
              backTo="/admin/dishes"
              backLabel="Quay Lại Danh Sách"
            />
          )}

          {status === 'error' && (
            <ErrorView
              title="Không Thể Tải Món Ăn"
              message={errorMsg}
              onRetry={() => fetchDish()}
              backTo="/admin/dishes"
              backLabel="Quay Lại Danh Sách"
            />
          )}

          {status === 'ok' && dish && (
            <div className="card card-pad text-center space-y-6 border-red-200 bg-gradient-to-b from-[#fff7f7] to-[#ffffff]">
              <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center text-brand mx-auto">
                <Icon name="trash" cls="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold text-cream">Xác Nhận Xóa Món Ăn</h1>
                <p className="text-xs text-sand-dim leading-relaxed">
                  Hệ thống sẽ thực hiện xóa mềm (soft-delete), món ăn sẽ không còn xuất hiện trong thực đơn phục vụ của khách hàng.
                </p>
              </div>

              {deleteError && (
                <div className="alert alert-error text-left">
                  <Icon name="alert" cls="w-5 h-5" />
                  <div>
                    <b>Lỗi khi xóa:</b>
                    <p className="mt-0.5 text-xs">{deleteError}</p>
                  </div>
                </div>
              )}

              {/* Dish Summary Box */}
              <div className="p-4 rounded-2xl bg-ink-950/60 border border-line text-left space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-sand-dim font-semibold uppercase">Tên món:</span>
                  <span className="font-bold text-cream">{dish.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sand-dim font-semibold uppercase">Danh mục:</span>
                  <span className="badge text-[11px]">{dish.category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sand-dim font-semibold uppercase">Giá bán:</span>
                  <span className="font-mono font-bold text-ember whitespace-nowrap">
                    {Number(dish.price).toLocaleString('vi-VN')}&nbsp;đ
                  </span>
                </div>
              </div>

              {/* Chỉ nút Xác Nhận Xóa mới gọi DELETE */}
              <form
                onSubmit={handleConfirmDelete}
                className="flex flex-col-reverse sm:flex-row gap-3 justify-center pt-2"
              >
                <Link
                  to="/admin/dishes"
                  className="btn btn-ghost btn-sm px-6 w-full sm:w-auto justify-center"
                >
                  Hủy bỏ
                </Link>
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="btn btn-danger btn-sm px-6 w-full sm:w-auto justify-center"
                >
                  <Icon name="trash" cls="w-4 h-4" />
                  <span>{isDeleting ? 'Đang xóa...' : 'Xác Nhận Xóa'}</span>
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
