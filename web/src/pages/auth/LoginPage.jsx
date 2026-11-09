import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import AuthLeftPanel from '../../components/AuthLeftPanel';
import Icon from '../../components/Icon';
import RecaptchaWidget from '../../components/RecaptchaWidget';
import { useAuth } from '../../context/AuthContext';

/**
 * Trang Đăng nhập & Đăng ký hợp nhất (/login, /register).
 * Giữ nguyên 100% giao diện, bố cục và hiệu ứng từ src/views/auth/auth.ejs (Block 8)
 * và kết nối chặt chẽ theo đúng Hợp đồng API CSR.
 */
export default function LoginPage({ initialTab = 'login' }) {
  const { user, isLoadingAuth, loginSuccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const resolvedInitialTab =
    initialTab === 'register' ||
    location.pathname === '/register' ||
    searchParams.get('tab') === 'register'
      ? 'register'
      : 'login';

  const [activeTab, setActiveTab] = useState(resolvedInitialTab);

  // Trạng thái Form Đăng nhập
  const [loginEmail, setLoginEmail] = useState(() => searchParams.get('email') || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [requireLoginCaptcha, setRequireLoginCaptcha] = useState(false);
  const [loginCaptchaToken, setLoginCaptchaToken] = useState('');
  const [loginCaptchaReset, setLoginCaptchaReset] = useState(0);

  // Trạng thái Form Đăng ký
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);
  const [regCaptchaToken, setRegCaptchaToken] = useState('');
  const [regCaptchaReset, setRegCaptchaReset] = useState(0);

  // Thông báo lỗi / thành công
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const regEmailInputRef = useRef(null);

  // Đồng bộ tab khi route đổi giữa /login và /register
  useEffect(() => {
    if (location.pathname === '/register') {
      setActiveTab('register');
    } else if (location.pathname === '/login' && searchParams.get('tab') !== 'register') {
      setActiveTab('login');
    }
  }, [location.pathname, searchParams]);

  // Đọc thông báo từ query params (?activated=1, ?reset=1, ?loggedOut=1, ?email=...) hoặc location.state
  useEffect(() => {
    const emailFromQuery = searchParams.get('email');
    if (emailFromQuery) {
      setLoginEmail(emailFromQuery.trim());
    }

    if (location.state && location.state.successMessage) {
      setSuccessMessage(location.state.successMessage);
    } else if (searchParams.get('activated') === '1') {
      setSuccessMessage('Kích hoạt tài khoản thành công. Vui lòng đăng nhập để tiếp tục.');
    } else if (searchParams.get('reset') === '1') {
      setSuccessMessage(
        'Đặt lại mật khẩu thành công. Toàn bộ phiên cũ đã được hủy, vui lòng đăng nhập lại.'
      );
    } else if (searchParams.get('loggedOut') === '1') {
      setSuccessMessage('Bạn đã đăng xuất khỏi hệ thống an toàn.');
    }
  }, [searchParams, location.state]);

  // Cập nhật tiêu đề trang theo tab đang mở
  useEffect(() => {
    if (activeTab === 'register') {
      document.title = 'Đăng ký tài khoản · CRISPY HOUSE';
    } else {
      document.title = 'Đăng nhập & Đăng ký · CRISPY HOUSE';
    }
  }, [activeTab]);

  // Tự động focus vào ô email đăng ký khi có lỗi EMAIL_ALREADY_ACTIVE
  useEffect(() => {
    if (emailError && regEmailInputRef.current) {
      regEmailInputRef.current.focus();
    }
  }, [emailError]);

  if (!isLoadingAuth && user) {
    const redirectTo = location.state?.from?.pathname || '/admin/dishes';
    return <Navigate to={redirectTo} replace />;
  }

  const switchAuthTab = (tab) => {
    setErrorMessage('');
    setErrorCode('');
    setSuccessMessage('');
    setEmailError('');
    setActiveTab(tab);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setErrorCode('');
    setSuccessMessage('');

    const trimmedEmail = loginEmail.trim();
    const res = await apiClient.auth.login({
      email: trimmedEmail,
      password: loginPassword,
      captchaToken: loginCaptchaToken,
    });

    if (res.ok && res.data) {
      const accessToken = res.data.accessToken;
      const userData = res.data.user || res.data;
      loginSuccess(accessToken, userData);
      const redirectTo = location.state?.from?.pathname || '/admin/dishes';
      navigate(redirectTo, { replace: true });
      return;
    }

    // Xóa mật khẩu trên form khi đăng nhập thất bại (giống hành vi SSR)
    setLoginPassword('');

    const err = res.error || {};
    const code = err.code || 'ERROR';

    // 1. Tài khoản đang ở trạng thái pending -> đã tự gửi OTP mới, chuyển sang /activate?email=...
    if (code === 'ACCOUNT_PENDING' || code === 'ACCOUNT_NOT_ACTIVATED') {
      const targetEmail = err.email || trimmedEmail;
      navigate(`/activate?email=${encodeURIComponent(targetEmail)}`, {
        state: {
          infoMessage:
            err.message ||
            'Tài khoản của bạn chưa được kích hoạt. Mã xác thực OTP mới đã được gửi tới email của bạn.',
          errorCode: 'ACCOUNT_PENDING',
        },
      });
      return;
    }

    // 2. Yêu cầu hiển thị khung Google reCAPTCHA v2 trên form Login
    if (
      err.requireCaptcha === true ||
      code === 'CAPTCHA_REQUIRED' ||
      code === 'CAPTCHA_FAILED' ||
      code === 'INVALID_CAPTCHA'
    ) {
      setRequireLoginCaptcha(true);
      setLoginCaptchaReset((c) => c + 1);
    } else if (requireLoginCaptcha) {
      setLoginCaptchaReset((c) => c + 1);
    }

    // 3. Hiển thị thông báo lỗi (INVALID_CREDENTIALS, CAPTCHA_REQUIRED, RATE_LIMITED 429...)
    setErrorCode(code);
    setErrorMessage(
      err.message ||
        (code === 'RATE_LIMITED'
          ? 'Tài khoản hoặc địa chỉ IP đã vượt ngưỡng đăng nhập sai cho phép. Vui lòng chờ 5 phút trước khi thử lại.'
          : 'Email hoặc mật khẩu không chính xác.')
    );
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setErrorCode('');
    setSuccessMessage('');
    setEmailError('');

    const trimmedEmail = regEmail.trim();
    const trimmedName = regName.trim();

    const res = await apiClient.auth.register({
      name: trimmedName,
      email: trimmedEmail,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      captchaToken: regCaptchaToken,
    });

    if (res.ok) {
      const targetEmail = (res.data && res.data.email) || trimmedEmail.toLowerCase();
      const infoMessage =
        (res.data && res.data.message) ||
        'Nếu địa chỉ email hợp lệ, mã xác thực OTP gồm 6 chữ số đã được gửi tới hộp thư của bạn.';
      navigate(`/activate?email=${encodeURIComponent(targetEmail)}`, {
        state: {
          infoMessage,
        },
      });
      return;
    }

    // Làm mới CAPTCHA sau mỗi lần đăng ký thất bại
    setRegCaptchaReset((c) => c + 1);

    const err = res.error || {};
    const code = err.code || 'ERROR';

    // Nếu email đã được kích hoạt -> hiển thị lỗi ngay dưới trường email giống hệt auth.ejs
    if (code === 'EMAIL_ALREADY_ACTIVE') {
      setRegEmail('');
      setErrorCode('EMAIL_ALREADY_ACTIVE');
      setEmailError(
        err.message ||
          'Địa chỉ email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.'
      );
      return;
    }

    setErrorCode(code);
    setErrorMessage(
      err.message || 'Không thể xử lý yêu cầu đăng ký. Vui lòng kiểm tra lại thông tin.'
    );
  };

  return (
    <section className="auth-section">
      <div className="auth-card">
        {/* Phần nền toàn màn hình & tiêu đề thương hiệu bên trái */}
        <AuthLeftPanel />

        {/* Phần bên phải: Thẻ nền trắng nổi lên với các component bo tròn dạng Pill */}
        <div className="auth-panel">
          <div className="auth-form-box space-y-6">
            <div>
              <h1 id="auth-heading" className="auth-heading">
                {activeTab === 'register' ? 'Tạo tài khoản mới' : 'Chào mừng trở lại!'}
              </h1>
              <p id="auth-subheading" className="auth-subheading">
                {activeTab === 'register'
                  ? 'Đăng ký thành viên Crispy House'
                  : 'Đăng nhập tài khoản để tiếp tục'}
              </p>
            </div>

            {errorMessage && (
              <div
                className="auth-alert auth-alert-error"
                role="alert"
                data-auth-alert
                data-error-code={errorCode || 'ERROR'}
              >
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="auth-alert auth-alert-success" role="status" data-auth-alert>
                {successMessage}
              </div>
            )}

            {/* ================================================================ */}
            {/* PANEL 1: FORM ĐĂNG NHẬP (POST /api/auth/login)                   */}
            {/* ================================================================ */}
            <div
              id="auth-panel-login"
              className={activeTab === 'login' ? 'block' : 'hidden'}
            >
              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                <div className="auth-pill-group">
                  <label htmlFor="login-email" className="sr-only">
                    Địa chỉ Email
                  </label>
                  <span className="auth-pill-icon">
                    <Icon name="mail" cls="w-[18px] h-[18px]" sw={1.8} />
                  </span>
                  <input
                    type="email"
                    id="login-email"
                    name="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="Địa chỉ Email"
                    className="auth-pill-input"
                  />
                </div>

                <div className="auth-pill-group">
                  <label htmlFor="login-password" className="sr-only">
                    Mật khẩu
                  </label>
                  <span className="auth-pill-icon">
                    <Icon name="lock-solid" cls="w-[18px] h-[18px]" filled />
                  </span>
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    id="login-password"
                    name="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Mật khẩu"
                    className="auth-pill-input has-toggle"
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    data-pw-toggle="login-password"
                    aria-label={showLoginPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showLoginPw}
                    onClick={() => setShowLoginPw((v) => !v)}
                  >
                    <span data-eye-open className={showLoginPw ? 'hidden' : ''}>
                      <Icon name="eye" cls="w-[17px] h-[17px]" />
                    </span>
                    <span data-eye-off className={showLoginPw ? '' : 'hidden'}>
                      <Icon name="eye-off" cls="w-[17px] h-[17px]" />
                    </span>
                  </button>
                </div>

                {requireLoginCaptcha && (
                  <div className="auth-captcha-wrap" id="login-captcha-box">
                    <div className="text-xs text-[#5c524d] text-center">
                      Vui lòng hoàn thành bước xác minh bảo mật để tiếp tục
                    </div>
                    <RecaptchaWidget
                      onChange={setLoginCaptchaToken}
                      resetSignal={loginCaptchaReset}
                    />
                  </div>
                )}

                <div className="pt-1">
                  <button type="submit" id="login-submit-btn" className="auth-btn-primary">
                    Đăng nhập
                  </button>
                </div>

                <div className="text-center pt-1">
                  <Link to="/forgot-password" className="auth-link-muted">
                    Quên mật khẩu?
                  </Link>
                </div>

                <div className="pt-3 border-t border-[#f1ecea] text-center">
                  <p className="text-[13.5px] text-[#7c726d]">
                    Chưa có tài khoản?
                    <a
                      href="#/register"
                      id="tab-btn-register"
                      onClick={(e) => {
                        e.preventDefault();
                        switchAuthTab('register');
                      }}
                      className="auth-link-accent ml-1"
                    >
                      Đăng ký ngay
                    </a>
                  </p>
                </div>
              </form>
            </div>

            {/* ================================================================ */}
            {/* PANEL 2: FORM ĐĂNG KÝ (POST /api/auth/register)                  */}
            {/* ================================================================ */}
            <div
              id="auth-panel-register"
              className={activeTab === 'register' ? 'block' : 'hidden'}
            >
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5" noValidate>
                <div className="auth-pill-group">
                  <label htmlFor="register-name" className="sr-only">
                    Họ và tên hiển thị
                  </label>
                  <span className="auth-pill-icon">
                    <Icon name="user" cls="w-[18px] h-[18px]" sw={1.8} />
                  </span>
                  <input
                    type="text"
                    id="register-name"
                    name="name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    maxLength={100}
                    placeholder="Họ và tên (tùy chọn)"
                    className="auth-pill-input"
                  />
                </div>

                <div>
                  <div className="auth-pill-group">
                    <label htmlFor="register-email" className="sr-only">
                      Địa chỉ Email
                    </label>
                    <span className="auth-pill-icon">
                      <Icon name="mail" cls="w-[18px] h-[18px]" sw={1.8} />
                    </span>
                    <input
                      ref={regEmailInputRef}
                      type="email"
                      id="register-email"
                      name="email"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        if (emailError) setEmailError('');
                      }}
                      required
                      autoComplete="email"
                      placeholder="Địa chỉ Email"
                      aria-invalid={emailError ? 'true' : undefined}
                      className={`auth-pill-input${emailError ? ' is-invalid' : ''}`}
                    />
                  </div>
                  {emailError && (
                    <p
                      id="register-email-error"
                      className="auth-field-error"
                      role="alert"
                      data-auth-alert
                      data-error-code={errorCode || 'EMAIL_ALREADY_ACTIVE'}
                    >
                      {emailError}
                    </p>
                  )}
                </div>

                <div className="auth-pill-group">
                  <label htmlFor="register-password" className="sr-only">
                    Mật khẩu
                  </label>
                  <span className="auth-pill-icon">
                    <Icon name="lock-solid" cls="w-[18px] h-[18px]" filled />
                  </span>
                  <input
                    type={showRegPw ? 'text' : 'password'}
                    id="register-password"
                    name="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Mật khẩu (ít nhất 8 ký tự, gồm chữ và số)"
                    className="auth-pill-input has-toggle"
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    data-pw-toggle="register-password"
                    aria-label={showRegPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showRegPw}
                    onClick={() => setShowRegPw((v) => !v)}
                  >
                    <span data-eye-open className={showRegPw ? 'hidden' : ''}>
                      <Icon name="eye" cls="w-[17px] h-[17px]" />
                    </span>
                    <span data-eye-off className={showRegPw ? '' : 'hidden'}>
                      <Icon name="eye-off" cls="w-[17px] h-[17px]" />
                    </span>
                  </button>
                </div>

                <div className="auth-pill-group">
                  <label htmlFor="register-confirm-password" className="sr-only">
                    Xác nhận lại mật khẩu
                  </label>
                  <span className="auth-pill-icon">
                    <Icon name="shield-check" cls="w-[18px] h-[18px]" sw={1.8} />
                  </span>
                  <input
                    type={showRegConfirmPw ? 'text' : 'password'}
                    id="register-confirm-password"
                    name="confirmPassword"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Xác nhận lại mật khẩu"
                    className="auth-pill-input has-toggle"
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    data-pw-toggle="register-confirm-password"
                    aria-label={
                      showRegConfirmPw ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'
                    }
                    aria-pressed={showRegConfirmPw}
                    onClick={() => setShowRegConfirmPw((v) => !v)}
                  >
                    <span data-eye-open className={showRegConfirmPw ? 'hidden' : ''}>
                      <Icon name="eye" cls="w-[17px] h-[17px]" />
                    </span>
                    <span data-eye-off className={showRegConfirmPw ? '' : 'hidden'}>
                      <Icon name="eye-off" cls="w-[17px] h-[17px]" />
                    </span>
                  </button>
                </div>

                <div className="auth-captcha-wrap" id="register-captcha-box">
                  <RecaptchaWidget
                    onChange={setRegCaptchaToken}
                    resetSignal={regCaptchaReset}
                  />
                </div>

                <div className="pt-1">
                  <button type="submit" id="register-submit-btn" className="auth-btn-primary">
                    Đăng ký
                  </button>
                </div>

                <div className="pt-3 border-t border-[#f1ecea] text-center">
                  <p className="text-[13.5px] text-[#7c726d]">
                    Đã có tài khoản?
                    <a
                      href="#/login"
                      id="tab-btn-login"
                      onClick={(e) => {
                        e.preventDefault();
                        switchAuthTab('login');
                      }}
                      className="auth-link-accent ml-1"
                    >
                      Đăng nhập
                    </a>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
