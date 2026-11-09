import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

/**
 * Hook tạo tiến độ chạy đều liên tục (không bao giờ đứng im hoàn toàn ở bất kỳ thời điểm nào)
 */
export function useContinuousProgress(isActive = true) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (!isActive) {
      setProgress(100);
      return undefined;
    }

    setProgress(8);
    let current = 8;
    let lastTime = performance.now();
    let rafId;

    const tick = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Tốc độ tăng dần đều liên tục theo từng giai đoạn, luôn dương để thanh tiến trình không bao giờ dừng lại
      let speed;
      if (current < 35) {
        speed = 38; // % / giây
      } else if (current < 65) {
        speed = 18;
      } else if (current < 85) {
        speed = 7.5;
      } else if (current < 96) {
        speed = 2.2;
      } else {
        speed = 0.35;
      }

      current = Math.min(99.4, current + speed * dt);
      setProgress(current);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isActive]);

  return progress;
}

/**
 * Hiển thị trạng thái Loading khi trang đang chờ dữ liệu từ API.
 * Thanh tiến trình và vòng xoay chạy đều liên tục, không bao giờ đứng im.
 */
export function LoadingView({ message = 'Đang tải dữ liệu từ máy chủ...' }) {
  const progress = useContinuousProgress(true);

  return (
    <div className="card card-pad text-center py-12 sm:py-16 px-4 space-y-5 max-w-full overflow-hidden">
      <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 grid place-items-center text-brand mx-auto">
        <div
          className="spa-always-spin w-7 h-7 rounded-full border-[3px] border-brand/25 border-t-brand"
          aria-hidden="true"
        />
      </div>

      <div className="space-y-1.5 max-w-md mx-auto">
        <h3 className="text-sm sm:text-base font-bold text-cream break-words">{message}</h3>
        <p className="text-xs text-sand-dim leading-relaxed break-words">
          Đang đồng bộ dữ liệu với máy chủ, vui lòng đợi trong giây lát...
        </p>
      </div>

      {/* Thanh tiến trình chạy đều dần dần liên tục, không đứng im ở bất kỳ thời điểm nào */}
      <div className="max-w-xs mx-auto w-full space-y-1.5 pt-1">
        <div className="h-2 w-full rounded-full bg-ink-800 overflow-hidden p-[1px] border border-line">
          <div
            className="spa-loading-fill h-full rounded-full"
            style={{ width: `${progress.toFixed(2)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-sand-dim px-0.5">
          <span>Đang tải...</span>
          <span className="font-bold text-brand">{Math.floor(progress)}%</span>
        </div>
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
    <div className="max-w-lg mx-auto py-12 sm:py-16 px-4 text-center space-y-6">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-brand/10 border border-brand/20 text-brand mx-auto grid place-items-center font-mono font-black text-3xl sm:text-4xl shadow-xl shadow-brand/20">
        404
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-cream tracking-tight break-words">
          {title}
        </h1>
        <p className="text-sand text-xs sm:text-sm leading-relaxed max-w-sm mx-auto break-words">
          {message}
        </p>
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
    <div className="max-w-lg mx-auto py-12 sm:py-16 px-4 text-center space-y-6">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-brand/10 border border-brand/20 text-brand mx-auto grid place-items-center font-mono font-black text-3xl shadow-xl shadow-brand/20">
        <Icon name="alert" cls="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-cream tracking-tight break-words">
          {title}
        </h1>
        <p className="text-sand text-xs sm:text-sm leading-relaxed max-w-md mx-auto break-words">
          {message}
        </p>
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
