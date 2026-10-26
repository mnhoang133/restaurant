import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import AdminNav from '../../components/AdminNav';
import Icon from '../../components/Icon';
import { ErrorView, LoadingView, NotFoundView } from '../../components/StateViews';

export default function AdminChefDeletePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'notFound' | 'error'
  const [chef, setChef] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchChef = useCallback(
    async (signal) => {
      setStatus('loading');
      setErrorMsg('');
      setDeleteError('');

      const result = await apiClient.chefs.getById(id, signal);
      if (result.isAborted) return;

      if (!result.ok) {
        if (result.error.code === 'NOT_FOUND') {
          setErrorMsg(result.error.message || `Đầu bếp #${id} không tồn tại để xóa.`);
          setStatus('notFound');
        } else {
          setErrorMsg(result.error.message || 'Không thể tải thông tin đầu bếp.');
          setStatus('error');
        }
        return;
      }

      setChef(result.data);
      document.title = `Xác nhận xóa: ${result.data.name} · CRISPY HOUSE`;
      setStatus('ok');
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchChef(controller.signal);
    return () => controller.abort();
  }, [fetchChef]);

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (isDeleting) return;

    setIsDeleting(true);
    setDeleteError('');

    const result = await apiClient.chefs.remove(id);
    setIsDeleting(false);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        setErrorMsg(result.error.message || 'Đầu bếp không tồn tại.');
        setStatus('notFound');
      } else {
        setDeleteError(result.error.message || 'Không thể xóa đầu bếp lúc này.');
      }
      return;
    }

    navigate('/admin/chefs');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AdminNav />

        <main className="flex-1 w-full max-w-xl mx-auto space-y-6 pt-4">
          {status === 'loading' && <LoadingView message="Đang tải thông tin đầu bếp..." />}

          {status === 'notFound' && (
            <NotFoundView
              title="Không Tìm Thấy Đầu Bếp"
              message={errorMsg}
              backTo="/admin/chefs"
              backLabel="Quay Lại Danh Sách"
            />
          )}

          {status === 'error' && (
            <ErrorView
              title="Không Thể Tải Đầu Bếp"
              message={errorMsg}
              onRetry={() => fetchChef()}
              backTo="/admin/chefs"
              backLabel="Quay Lại Danh Sách"
            />
          )}

          {status === 'ok' && chef && (
            <div className="card card-pad text-center space-y-6 border-red-200 bg-gradient-to-b from-[#fff7f7] to-[#ffffff]">
              <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center text-brand mx-auto">
                <Icon name="trash" cls="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold text-cream">Xác Nhận Xóa Đầu Bếp</h1>
                <p className="text-xs text-sand-dim leading-relaxed">
                  Hệ thống sẽ xóa mềm đầu bếp khỏi danh sách nhân sự của nhà hàng.
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

              <div className="p-4 rounded-2xl bg-ink-950/60 border border-line text-left space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-sand-dim font-semibold uppercase">Họ & Tên:</span>
                  <span className="font-bold text-cream">{chef.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sand-dim font-semibold uppercase">Chuyên môn:</span>
                  <span className="text-sand font-medium">{chef.field}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sand-dim font-semibold uppercase">Kinh nghiệm:</span>
                  <span className="font-bold text-cream">{chef.experience} năm</span>
                </div>
              </div>

              <form
                onSubmit={handleConfirmDelete}
                className="flex flex-col-reverse sm:flex-row gap-3 justify-center pt-2"
              >
                <Link
                  to="/admin/chefs"
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
