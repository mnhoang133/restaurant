import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import AuthLeftPanel from '../../components/AuthLeftPanel';
import Icon from '../../components/Icon';

/**
 * Trang Quên mật khẩu (/forgot-password, /forgot).
 * Giữ nguyên 100% cấu trúc DOM và class từ src/views/auth/forgot-password.ejs (Block 8).
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'Quên mật khẩu · CRISPY HOUSE';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setInfoMessage('');
    setErrorMessage('');

    const trimmedEmail = email.trim();
    const res = await apiClient.auth.forgotPassword({ email: trimmedEmail });

    if (res.ok) {
      setInfoMessage(
        (res.data && res.data.message) ||
          'Nếu địa chỉ email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi tới hộp thư của bạn.'
      );
      return;
    }

    const err = res.error || {};
    setErrorMessage(
      err.message || 'Không thể xử lý yêu cầu đặt lại mật khẩu lúc này. Vui lòng thử lại sau.'
    );
  };

  return (
    <section className="auth-section">
      <div className="auth-card">
        {/* Phần bên trái: Ảnh Burger trên nền đỏ studio (Ảnh 2) + Brand CTA (Hình 1) */}
        <AuthLeftPanel />

        {/* Phần bên phải: Biểu mẫu Quên mật khẩu tối giản (Hình 1) */}
        <div className="auth-panel">
          <div className="auth-form-box space-y-6">
            <div>
              <h1 className="auth-heading">Quên mật khẩu?</h1>
              <p className="auth-subheading">
                Nhập email đã đăng ký để nhận liên kết khôi phục mật khẩu
              </p>
            </div>

            {infoMessage && (
              <div className="auth-alert auth-alert-info" role="status" id="forgot-generic-notice">
                {infoMessage}
              </div>
            )}

            {errorMessage && (
              <div className="auth-alert auth-alert-error" role="alert">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="auth-pill-group">
                <label htmlFor="forgot-email" className="sr-only">
                  Địa chỉ Email
                </label>
                <span className="auth-pill-icon">
                  <Icon name="mail" cls="w-[18px] h-[18px]" sw={1.8} />
                </span>
                <input
                  type="email"
                  id="forgot-email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Địa chỉ Email"
                  className="auth-pill-input"
                />
              </div>

              <div className="pt-1">
                <button type="submit" id="forgot-submit-btn" className="auth-btn-primary">
                  Gửi liên kết đặt lại
                </button>
              </div>

              <div className="text-center pt-1">
                <Link to="/login" className="auth-link-muted">
                  Quay lại Đăng nhập
                </Link>
              </div>

              <div className="pt-3 border-t border-[#f1ecea] text-center">
                <p className="text-[13.5px] text-[#7c726d]">
                  Chưa có tài khoản?
                  <Link to="/register" className="auth-link-accent ml-1">
                    Đăng ký ngay
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
