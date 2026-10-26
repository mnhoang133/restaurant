import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

/**
 * Hiển thị trạng thái Loading khi trang đang chờ dữ liệu từ API
 */
export function LoadingView({ message = 'Đang tải dữ liệu từ máy chủ...' }) {
  return (
    <div className="card card-pad text-center py-16 space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center text-brand mx-auto">
        <div
          className="w-7 h-7 rounded-full border-[3px] border-brand/25 border-t-brand animate-spin"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-cream">{message}</h3>
        <p className="text-xs text-sand-dim">
          Các nút thao tác tạm thời được khóa cho đến khi dữ liệu phản hồi hoàn tất.
        </p>
      </div>
    </div>
  );
}

/**
 * Hiển thị trạng thái Không tìm thấy (NOT_FOUND từ API hoặc route không khớp)
 */
export function NotFoundView({
  title = 'Không Tìm Thấy',
  message = 'Địa chỉ bạn vừa truy cập không tồn tại hoặc dữ liệu đã bị xóa khỏi hệ thống.',
  backTo = '/dishes',
  backLabel = 'Quay Lại Thực Đơn',
}) {
  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6">
      <div className="w-24 h-24 rounded-3xl bg-brand/10 border border-brand/20 text-brand mx-auto grid place-items-center font-mono font-black text-4xl shadow-xl shadow-brand/20">
        404
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-cream tracking-tight">{title}</h1>
        <p className="text-sand text-xs sm:text-sm leading-relaxed max-w-sm mx-auto">{message}</p>
      </div>

      <div className="pt-4 flex flex-col-reverse sm:flex-row justify-center gap-3">
        <Link to={backTo} className="btn btn-primary btn-sm px-6 w-full sm:w-auto justify-center">
          <Icon name="arrow-left" cls="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>
        <Link to="/" className="btn btn-ghost btn-sm px-6 w-full sm:w-auto justify-center">
          Trang Chủ
        </Link>
      </div>
    </div>
  );
}

/**
 * Hiển thị trạng thái Lỗi (Lỗi kỹ thuật tầng 1/2 hoặc Lỗi nghiệp vụ ok: false khi tải dữ liệu)
 */
export function ErrorView({
  title = 'Không Thể Tải Dữ Liệu',
  message = 'Đã xảy ra lỗi khi giao tiếp với máy chủ. Vui lòng thử lại.',
  onRetry = null,
  backTo = '/dishes',
  backLabel = 'Quay Lại',
}) {
  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6">
      <div className="w-24 h-24 rounded-3xl bg-brand/10 border border-brand/20 text-brand mx-auto grid place-items-center font-mono font-black text-3xl shadow-xl shadow-brand/20">
        <Icon name="alert" cls="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-cream tracking-tight">{title}</h1>
        <p className="text-sand text-xs sm:text-sm leading-relaxed max-w-md mx-auto">{message}</p>
      </div>

      <div className="pt-4 flex flex-col-reverse sm:flex-row justify-center gap-3">
        <Link to={backTo} className="btn btn-ghost btn-sm px-6 w-full sm:w-auto justify-center">
          <Icon name="arrow-left" cls="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="btn btn-primary btn-sm px-6 w-full sm:w-auto justify-center"
          >
            <span>Thử Lại</span>
          </button>
        )}
      </div>
    </div>
  );
}
