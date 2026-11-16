import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import AuthLeftPanel from '../../components/AuthLeftPanel';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';

/**
 * Trang Xác thực bước 2 MFA (/mfa, /mfa/verify).
 * Nhận challenge ngắn hạn từ Bước 1 (POST /api/auth/login) khi tài khoản có mfaEnabled = true.
 * Cho phép nhập mã 6 chữ số từ ứng dụng Authenticator (TOTP) HOẶC mã dự phòng Recovery Code (dạng XXXX-XXXX).
 */
export default function MfaVerifyPage() {
  const { user, isLoadingAuth, loginSuccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Khôi phục trạng thái chờ MFA từ location.state hoặc sessionStorage (chống mất khi F5)
  const storedPending = (() => {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('mfaPendingState');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  })();

  const challenge =
    location.state?.challenge ||
    location.state?.mfaToken ||
    searchParams.get('challenge') ||
    storedPending?.challenge ||
    storedPending?.mfaToken ||
    '';

  const email =
    location.state?.email ||
    searchParams.get('email') ||
    storedPending?.email ||
    '';

  const redirectTo = location.state?.from || storedPending?.from || '/admin/dishes';

  const [useRecoveryMode, setUseRecoveryMode] = useState(false);
  const [code, setCode] = useState('');
  const [infoMessage, setInfoMessage] = useState(
    () =>
      location.state?.message ||
      storedPending?.message ||
      'Mật khẩu hợp lệ. Vui lòng nhập mã xác thực 2 lớp (TOTP 6 số hoặc Recovery Code) để hoàn tất đăng nhập.'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    document.title = 'Xác thực 2 lớp (MFA) · CRISPY HOUSE';
  }, []);

  // Nếu đã có phiên đăng nhập đầy đủ thì chuyển thẳng tới trang đích
  if (!isLoadingAuth && user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Nếu truy cập thẳng /mfa mà chưa qua bước nhập mật khẩu (không có challenge) -> đẩy về /login
  if (!challenge) {
    return <Navigate to="/login" replace />;
  }

  const handleSwitchMode = (recoveryMode) => {
    setUseRecoveryMode(recoveryMode);
    setCode('');
    setErrorMessage('');
    setErrorCode('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setErrorCode('');
    setInfoMessage('');

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setErrorCode('INVALID_MFA_CODE');
      setErrorMessage(
        useRecoveryMode
          ? 'Vui lòng nhập mã dự phòng Recovery Code (ví dụ: 7KQ2-M9XD).'
          : 'Vui lòng nhập mã xác thực 6 chữ số từ ứng dụng Authenticator.'
      );
      return;
    }

    const res = await apiClient.auth.verifyMfa({
      challenge,
      mfaToken: challenge,
      code: trimmedCode,
    });

    if (res.ok && res.data && res.data.accessToken) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('mfaPendingState');
      }
      const resolvedUser = res.data.user || res.data;
      loginSuccess(res.data.accessToken, resolvedUser);

      if (res.data.usedRecoveryCode) {
        navigate('/admin/mfa', {
          replace: true,
          state: {
            recoveryUsedNotice:
              'Bạn vừa đăng nhập bằng mã dự phòng (Recovery Code). Mã vừa dùng đã hết hiệu lực, hãy kiểm tra hoặc tạo lại bộ mã dự phòng mới nếu cần.',
          },
        });
      } else {
        navigate(redirectTo, { replace: true });
      }
      return;
    }

    const err = res.error || {};
    const errCode = err.code || 'INVALID_MFA_CODE';
    setErrorCode(errCode);

    if (errCode === 'MFA_CHALLENGE_EXPIRED') {
      setIsExpired(true);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('mfaPendingState');
      }
      setErrorMessage(
        err.message || 'Phiên chờ MFA đã hết hạn. Vui lòng quay lại đăng nhập từ đầu.'
      );
      return;
    }

    if (errCode === 'RATE_LIMITED' || err.status === 429) {
      setErrorMessage(
        err.message ||
          'Bạn đã nhập sai mã MFA quá 5 lần. Tài khoản tạm khóa 5 phút trước khi có thể thử lại.'
      );
      return;
    }

    setErrorMessage(
      err.message || 'Mã xác thực không đúng hoặc đã được sử dụng. Vui lòng kiểm tra lại.'
    );
  };

  const handleBackToLogin = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('mfaPendingState');
    }
    navigate('/login', { replace: true });
  };

  return (
    <section className="auth-section">
      <div className="auth-card">
        <AuthLeftPanel />

        <div className="auth-panel">
          <div className="auth-form-box space-y-6">
            <div>
              <h1 className="auth-heading">Xác thực 2 lớp (MFA)</h1>
              <p className="auth-subheading">
                {email ? (
                  <>
                    Tài khoản{' '}
                    <span className="font-semibold text-[#1f1919] break-all">{email}</span> yêu cầu
                    bước xác minh bảo mật thứ hai
                  </>
                ) : (
                  'Nhập mã từ ứng dụng Authenticator hoặc mã dự phòng Recovery Code'
                )}
              </p>
            </div>

            {/* Thanh chuyển đổi chế độ nhập: Mã TOTP 6 số vs Recovery Code */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#f7f2f0] border border-[#eadfdc]">
              <button
                type="button"
                id="mfa-tab-totp"
                onClick={() => handleSwitchMode(false)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  !useRecoveryMode
                    ? 'bg-[#ad2b32] text-white shadow-sm'
                    : 'text-[#6c605b] hover:text-[#1f1919]'
                }`}
              >
                <Icon name="smartphone" cls="w-3.5 h-3.5" />
                <span>Mã 6 số (TOTP)</span>
              </button>
              <button
                type="button"
                id="mfa-tab-recovery"
                onClick={() => handleSwitchMode(true)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  useRecoveryMode
                    ? 'bg-[#ad2b32] text-white shadow-sm'
                    : 'text-[#6c605b] hover:text-[#1f1919]'
                }`}
              >
                <Icon name="key" cls="w-3.5 h-3.5" />
                <span>Recovery Code</span>
              </button>
            </div>

            {infoMessage && !errorMessage && (
              <div className="auth-alert auth-alert-info" role="status">
                {infoMessage}
              </div>
            )}

            {errorMessage && (
              <div
                className="auth-alert auth-alert-error"
                role="alert"
                data-error-code={errorCode || 'INVALID_MFA_CODE'}
              >
                {errorMessage}
              </div>
            )}

            {!isExpired ? (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate id="mfa-verify-form">
                <div className="auth-pill-group">
                  <label htmlFor="mfa-code-input" className="sr-only">
                    {useRecoveryMode ? 'Mã dự phòng Recovery Code' : 'Mã TOTP 6 chữ số'}
                  </label>
                  <span className="auth-pill-icon">
                    <Icon
                      name={useRecoveryMode ? 'key' : 'shield-check'}
                      cls="w-[18px] h-[18px]"
                      sw={1.8}
                    />
                  </span>
                  <input
                    type="text"
                    id="mfa-code-input"
                    name="code"
                    value={code}
                    onChange={(e) =>
                      setCode(
                        useRecoveryMode
                          ? e.target.value.toUpperCase()
                          : e.target.value.trim()
                      )
                    }
                    maxLength={useRecoveryMode ? 12 : 12}
                    inputMode={useRecoveryMode ? 'text' : 'numeric'}
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    placeholder={
                      useRecoveryMode
                        ? 'Nhập mã dự phòng (VD: 7KQ2-M9XD)'
                        : 'Nhập mã 6 chữ số (VD: 123456) hoặc mã dự phòng'
                    }
                    className="auth-pill-input font-mono tracking-wider"
                  />
                </div>

                <p className="text-[12px] text-[#7c726d] text-center">
                  {useRecoveryMode
                    ? 'Mỗi mã dự phòng chỉ sử dụng được 1 lần duy nhất.'
                    : 'Mã 6 số trên Google Authenticator / Authy tự động đổi sau mỗi 30 giây.'}
                </p>

                <div className="pt-1">
                  <button type="submit" id="mfa-submit-btn" className="auth-btn-primary">
                    Xác nhận đăng nhập
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="auth-btn-primary"
                >
                  Đăng nhập lại từ đầu
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-[#f1ecea] text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="auth-link-muted bg-transparent border-0 cursor-pointer"
              >
                ← Quay lại màn hình Đăng nhập
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
