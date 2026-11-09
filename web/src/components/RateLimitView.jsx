import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

/**
 * Giao diện thông báo giới hạn tần suất (429 Too Many Requests).
 * Giữ nguyên 100% cấu trúc và giao diện từ src/views/errors/429.ejs (Block 8).
 */
export default function RateLimitView({
  title = 'Tạm thời gián đoạn',
  errorCode = 'RATE_LIMITED',
  message = 'Bạn đã thao tác quá nhanh trong thời gian ngắn. Vui lòng đợi ít phút rồi thử lại.',
  onBack = null,
}) {
  const cleanTitle = String(title || 'Tạm thời gián đoạn').replace(/\s*\(\d+\)\s*$/, '');

  return (
    <section className="py-14 px-4">
      <div className="max-w-lg mx-auto">
        <div
          className="card p-6 sm:p-8 space-y-5 text-center"
          data-error-code={errorCode || 'RATE_LIMITED'}
        >
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-brand mx-auto grid place-items-center">
            <Icon name="clock" cls="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-cream">{cleanTitle}</h1>
          <p className="text-sm text-sand leading-relaxed">{message}</p>
          <div className="pt-2 flex items-center justify-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="btn btn-primary text-xs px-5 py-2.5"
              >
                Quay lại Đăng nhập
              </button>
            ) : (
              <Link to="/login" className="btn btn-primary text-xs px-5 py-2.5">
                Quay lại Đăng nhập
              </Link>
            )}
            <Link to="/" className="btn btn-ghost text-xs px-5 py-2.5">
              Về Trang chủ
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
