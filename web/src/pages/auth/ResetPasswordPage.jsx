import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import AuthLeftPanel from '../../components/AuthLeftPanel';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';

/**
 * Trang Đặt mật khẩu mới (/reset-password?token=..., /reset?token=...).
 * Giữ nguyên 100% cấu trúc DOM và class từ src/views/auth/reset-password.ejs (Block 8).
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearAuth } = useAuth();

  const token = (searchParams.get('token') || '').trim();

  const [isVerifying, setIsVerifying] = useState(Boolean(token));
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');

  const newPwInputRef = useRef(null);

  useEffect(() => {
    document.title = 'Đặt lại mật khẩu mới · CRISPY HOUSE';
  }, []);

  // Gọi verifyResetToken lúc vừa mở trang để kiểm tra link còn hạn không trước khi hiện form nhập mật khẩu mới
  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setTokenValid(false);
      setErrorCode('INVALID_TOKEN');
      setErrorMessage('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
      return undefined;
    }

    const controller = new AbortController();
    setIsVerifying(true);

    apiClient.auth.verifyResetToken(token, controller.signal).then((res) => {
      if (res.isAborted) return;

      if (res.ok) {
        if (res.data && res.data.valid === false) {
          setTokenValid(false);
          setErrorCode(res.data.code || 'INVALID_TOKEN');
          setErrorMessage(
            res.data.message || 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
          );
        } else {
          setTokenValid(true);
          setErrorCode('');
          setErrorMessage('');
        }
      } else {
        const err = res.error || {};
        setTokenValid(false);
        setErrorCode(err.code || 'INVALID_TOKEN');
        setErrorMessage(
          err.message || 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
        );
      }
      setIsVerifying(false);
    });

    return () => controller.abort();
  }, [token]);

  const sameOldPw = errorCode === 'SAME_AS_OLD_PASSWORD';

  useEffect(() => {
    if (sameOldPw && newPwInputRef.current) {
      newPwInputRef.current.focus();
    }
  }, [sameOldPw]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setErrorCode('');

    const res = await apiClient.auth.resetPassword({
      token,
      password,
      confirmPassword,
    });

    if (res.ok) {
      // Nếu trình duyệt đang giữ accessToken cũ thì xóa luôn và không tự đăng nhập
      clearAuth();
      const successMsg =
        (res.data && res.data.message) ||
        'Đặt lại mật khẩu thành công. Toàn bộ phiên cũ đã được hủy, vui lòng đăng nhập lại.';
      navigate('/login?reset=1', {
        replace: true,
        state: {
          successMessage: successMsg,
        },
      });
      return;
    }

    // Xóa mật khẩu vừa nhập khi gặp lỗi
    setPassword('');
    setConfirmPassword('');

    const err = res.error || {};
    const code = err.code || 'ERROR';
    setErrorCode(code);
    setErrorMessage(
      err.message || 'Không thể cập nhật mật khẩu mới. Vui lòng kiểm tra lại thông tin.'
    );

    if (code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED') {
      setTokenValid(false);
    }
  };

  return (
    <section className="auth-section">
      <div className="auth-card">
        {/* Phần bên trái: Ảnh Burger trên nền đỏ studio (Ảnh 2) + Brand CTA (Hình 1) */}
        <AuthLeftPanel />

        {/* Phần bên phải: Biểu mẫu Đặt mật khẩu mới tối giản (Hình 1) */}
        <div className="auth-panel">
          <div className="auth-form-box space-y-6">
            <div>
              <h1 className="auth-heading">Đặt mật khẩu mới</h1>
              <p className="auth-subheading">
                Thiết lập mật khẩu an toàn mới cho tài khoản của bạn
              </p>
            </div>

            {errorMessage && (
              <div
                className="auth-alert auth-alert-error"
                role="alert"
                id="reset-error-alert"
                data-error-code={errorCode || 'ERROR'}
              >
                {errorMessage}
              </div>
            )}

            {isVerifying ? (
              <div className="auth-alert auth-alert-info" role="status">
                Đang kiểm tra tính hợp lệ của liên kết đặt lại mật khẩu...
              </div>
            ) : tokenValid ? (
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                noValidate
                id="reset-password-form"
              >
                <input type="hidden" name="token" value={token} />

                <div className="auth-pill-group">
                  <label htmlFor="reset-new-password" className="sr-only">
                    Mật khẩu mới
                  </label>
                  <span className="auth-pill-icon">
                    <Icon name="lock-solid" cls="w-[18px] h-[18px]" filled />
                  </span>
                  <input
                    ref={newPwInputRef}
                    type={showNewPw ? 'text' : 'password'}
                    id="reset-new-password"
                    name="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (sameOldPw) setErrorCode('');
                    }}
                    required
                    autoComplete="new-password"
                    placeholder="Mật khẩu mới (ít nhất 8 ký tự, gồm chữ và số)"
                    aria-invalid={sameOldPw ? 'true' : undefined}
                    className={`auth-pill-input has-toggle${sameOldPw ? ' is-invalid' : ''}`}
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    data-pw-toggle="reset-new-password"
                    aria-label={showNewPw ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                    aria-pressed={showNewPw}
                    onClick={() => setShowNewPw((v) => !v)}
                  >
                    <span data-eye-open className={showNewPw ? 'hidden' : ''}>
                      <Icon name="eye" cls="w-[17px] h-[17px]" />
                    </span>
                    <span data-eye-off className={showNewPw ? '' : 'hidden'}>
                      <Icon name="eye-off" cls="w-[17px] h-[17px]" />
                    </span>
                  </button>
                </div>

                <div className="auth-pill-group">
                  <label htmlFor="reset-confirm-password" className="sr-only">
                    Nhập lại mật khẩu mới
                  </label>
                  <span className="auth-pill-icon">
                    <Icon name="shield-check" cls="w-[18px] h-[18px]" sw={1.8} />
                  </span>
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    id="reset-confirm-password"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Xác nhận mật khẩu mới"
                    className="auth-pill-input has-toggle"
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    data-pw-toggle="reset-confirm-password"
                    aria-label={showConfirmPw ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                    aria-pressed={showConfirmPw}
                    onClick={() => setShowConfirmPw((v) => !v)}
                  >
                    <span data-eye-open className={showConfirmPw ? 'hidden' : ''}>
                      <Icon name="eye" cls="w-[17px] h-[17px]" />
                    </span>
                    <span data-eye-off className={showConfirmPw ? '' : 'hidden'}>
                      <Icon name="eye-off" cls="w-[17px] h-[17px]" />
                    </span>
                  </button>
                </div>

                <div className="pt-1">
                  <button type="submit" id="reset-submit-btn" className="auth-btn-primary">
                    Cập nhật mật khẩu
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <Link to="/forgot-password" className="auth-btn-outline w-full">
                  Yêu cầu liên kết đặt lại mới
                </Link>
              </div>
            )}

            <div className="pt-2 border-t border-[#f1ecea] text-center">
              <Link to="/login" className="auth-link-muted">
                Quay lại Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
