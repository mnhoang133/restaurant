import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import AuthLeftPanel from '../../components/AuthLeftPanel';
import Icon from '../../components/Icon';

/**
 * Trang Kích hoạt tài khoản bằng OTP 6 chữ số (/activate?email=...).
 * Giữ nguyên 100% cấu trúc DOM và class từ src/views/auth/activate.ejs (Block 8).
 */
export default function ActivatePage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const rawEmail = searchParams.get('email') || '';
  const email = rawEmail.trim().toLowerCase();

  const [otp, setOtp] = useState('');
  const [infoMessage, setInfoMessage] = useState(
    () => (location.state && location.state.infoMessage) || ''
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState(
    () => (location.state && location.state.errorCode) || ''
  );

  useEffect(() => {
    document.title = 'Xác thực tài khoản · CRISPY HOUSE';
  }, []);

  if (!email) {
    return <Navigate to="/login" replace />;
  }

  const handleActivateSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const res = await apiClient.auth.activate({
      email,
      otp: otp.trim(),
    });

    if (res.ok) {
      const successMsg =
        (res.data && res.data.message) ||
        'Kích hoạt tài khoản thành công. Vui lòng đăng nhập để tiếp tục.';
      navigate(`/login?activated=1&email=${encodeURIComponent(email)}`, {
        replace: true,
        state: {
          successMessage: successMsg,
        },
      });
      return;
    }

    const err = res.error || {};
    setErrorCode(err.code || 'INVALID_OTP');
    setErrorMessage(
      err.message || 'Mã xác thực OTP không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.'
    );
  };

  const handleResendSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const res = await apiClient.auth.resendOtp({ email });

    if (res.ok) {
      setErrorCode('');
      setInfoMessage(
        (res.data && res.data.message) ||
          'Mã xác thực OTP mới gồm 6 chữ số đã được gửi tới hộp thư của bạn.'
      );
      return;
    }

    const err = res.error || {};
    setErrorCode(err.code || 'RATE_LIMITED');
    setErrorMessage(
      err.message ||
        'Vui lòng đợi ít nhất 60 giây trước khi yêu cầu gửi lại mã xác thực mới.'
    );
  };

  return (
    <section className="auth-section">
      <div className="auth-card">
        {/* Phần nền toàn màn hình & tiêu đề thương hiệu bên trái */}
        <AuthLeftPanel />

        {/* Phần bên phải: Thẻ trắng nổi lên cho bước nhập mã OTP */}
        <div className="auth-panel">
          <div className="auth-form-box space-y-6">
            <div>
              <h1 className="auth-heading">Xác thực tài khoản</h1>
              <p className="auth-subheading">
                {email ? (
                  <>
                    Mã xác thực gồm 6 chữ số đã được gửi tới{' '}
                    <span className="font-semibold text-[#1f1919] break-all">{email}</span>
                  </>
                ) : (
                  'Nhập mã xác thực gồm 6 chữ số đã được gửi tới hộp thư của bạn'
                )}
              </p>
            </div>

            {infoMessage && (
              <div
                className="auth-alert auth-alert-info"
                role="status"
                data-error-code={errorCode || undefined}
              >
                {infoMessage}
              </div>
            )}

            {errorMessage && (
              <div
                className="auth-alert auth-alert-error"
                role="alert"
                data-error-code={errorCode || 'INVALID_OTP'}
              >
                {errorMessage}
              </div>
            )}

            {/* Form 1: Xác nhận mã OTP (POST /api/auth/activate) - giữ email dạng ẩn, không cho nhập lại */}
            <form
              onSubmit={handleActivateSubmit}
              className="space-y-4"
              noValidate
              id="activate-otp-form"
            >
              <input type="hidden" name="email" value={email} />

              <div className="auth-pill-group">
                <label htmlFor="activate-otp" className="sr-only">
                  Mã xác thực 6 chữ số
                </label>
                <span className="auth-pill-icon">
                  <Icon name="key" cls="w-[18px] h-[18px]" sw={1.8} />
                </span>
                <input
                  type="text"
                  id="activate-otp"
                  name="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="Nhập mã xác thực 6 chữ số"
                  className="auth-pill-input"
                />
              </div>

              <div className="pt-1">
                <button type="submit" id="activate-submit-btn" className="auth-btn-primary">
                  Xác nhận
                </button>
              </div>
            </form>

            {/* Form 2: Gửi lại mã OTP (POST /api/auth/resend-otp) */}
            <div className="pt-3 border-t border-[#f1ecea] space-y-3">
              <form onSubmit={handleResendSubmit} id="resend-otp-form">
                <input type="hidden" name="email" value={email} />
                <button type="submit" id="resend-otp-btn" className="auth-btn-outline w-full">
                  Gửi lại mã mới
                </button>
              </form>

              <div className="text-center pt-1">
                <Link to="/login" className="auth-link-muted">
                  Quay lại Đăng nhập
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
