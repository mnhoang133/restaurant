const authService = require('../services/auth.service');
const captchaService = require('../services/captcha.service');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

class AuthController {
  /**
   * 1. POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const ip = getClientIp(req);
      const { name, email, password, confirmPassword } = req.body || {};
      const captchaToken =
        (req.body && (req.body.captchaToken || req.body['g-recaptcha-response'])) || '';
      const hasConfirmField =
        req.body && Object.prototype.hasOwnProperty.call(req.body, 'confirmPassword');

      const captchaResult = await captchaService.verifyCaptcha(captchaToken, 'register', ip);
      if (!captchaResult.valid) {
        return res.status(200).json({
          ok: false,
          error: {
            code: 'INVALID_CAPTCHA',
            reason: captchaResult.reason,
            message: captchaResult.message
          }
        });
      }

      const result = await authService.registerUser({
        rawEmail: email,
        password,
        confirmPassword,
        hasConfirmField,
        name,
        ip
      });

      if (result.status === 429) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: result.message
          }
        });
      }

      if (result.code !== 'REGISTER_ACCEPTED') {
        return res.status(200).json({
          ok: false,
          error: {
            code: result.code,
            message: result.message
          }
        });
      }

      return res.status(200).json({
        ok: true,
        data: {
          code: result.code,
          email: result.email,
          message: result.message
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 2. POST /api/auth/activate
   */
  async activate(req, res, next) {
    try {
      const { email, otp, otpCode } = req.body || {};
      const result = await authService.activateAccount({
        rawEmail: email,
        otpCode: otp !== undefined ? otp : otpCode
      });

      if (result.status === 429) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: result.message
          }
        });
      }

      if (result.code !== 'ACTIVATED') {
        return res.status(200).json({
          ok: false,
          error: {
            code: result.code || 'INVALID_OTP',
            message: result.message
          }
        });
      }

      return res.status(200).json({
        ok: true,
        data: {
          code: result.code,
          email: result.email,
          message: result.message
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 3. POST /api/auth/resend-otp
   */
  async resendOtp(req, res, next) {
    try {
      const { email } = req.body || {};
      const result = await authService.resendActivationOtp({ rawEmail: email });

      if (result.status === 429) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: result.message
          }
        });
      }

      return res.status(200).json({
        ok: true,
        data: {
          code: result.code,
          message: result.message
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 4. POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const ip = getClientIp(req);
      const { email, password } = req.body || {};
      const captchaToken =
        (req.body && (req.body.captchaToken || req.body['g-recaptcha-response'])) || '';

      const securityState = await authService.getLoginSecurityState(email, ip);

      if (securityState.isLocked) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            requireCaptcha: true,
            message: 'Tài khoản hoặc địa chỉ IP tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau 5 phút.'
          }
        });
      }

      // Khi đã sai từ lần thứ 3 trở đi, bắt buộc kiểm tra CAPTCHA trước khi kiểm tra mật khẩu (Slide 34, 64)
      if (securityState.requireCaptcha) {
        if (!captchaToken || !String(captchaToken).trim()) {
          return res.status(200).json({
            ok: false,
            error: {
              code: 'CAPTCHA_REQUIRED',
              requireCaptcha: true,
              message: 'Vui lòng hoàn thành xác minh bảo mật CAPTCHA để tiếp tục đăng nhập.'
            }
          });
        }

        const captchaResult = await captchaService.verifyCaptcha(captchaToken, 'login', ip);
        if (!captchaResult.valid) {
          return res.status(200).json({
            ok: false,
            error: {
              code: 'INVALID_CAPTCHA',
              requireCaptcha: true,
              message: captchaResult.message
            }
          });
        }
      }

      const result = await authService.verifyLoginCredentials({
        rawEmail: email,
        password,
        ip
      });

      if (result.status === 429) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            requireCaptcha: true,
            email: result.email,
            message: result.message
          }
        });
      }

      if (result.code === 'ACCOUNT_PENDING') {
        return res.status(200).json({
          ok: false,
          error: {
            code: 'ACCOUNT_NOT_ACTIVATED',
            subCode: 'ACCOUNT_PENDING',
            email: result.email,
            requireCaptcha: Boolean(result.requireCaptcha),
            message: result.message
          }
        });
      }

      if (result.code !== 'LOGIN_SUCCESS') {
        return res.status(200).json({
          ok: false,
          error: {
            code: result.code || 'INVALID_CREDENTIALS',
            requireCaptcha: Boolean(result.requireCaptcha),
            message: result.message
          }
        });
      }

      return res.status(200).json({
        ok: true,
        data: {
          accessToken: result.accessToken,
          user: result.user
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 5. GET /api/auth/me (Đã đi qua middleware requireAuth)
   */
  async me(req, res) {
    return res.status(200).json({
      ok: true,
      data: {
        user: req.user
      }
    });
  }

  /**
   * 6. POST /api/auth/logout (Đã đi qua middleware requireAuth)
   */
  async logout(req, res, next) {
    try {
      if (req.user && req.user.id) {
        await authService.revokeUserTokens(req.user.id);
      }
      return res.status(200).json({
        ok: true,
        data: {
          message: 'Đã đăng xuất thành công.'
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 7. POST /api/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const ip = getClientIp(req);
      const { email } = req.body || {};
      const result = await authService.requestPasswordReset({ rawEmail: email, ip });

      if (result.status === 429) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: result.message
          }
        });
      }

      return res.status(200).json({
        ok: true,
        data: {
          code: result.code,
          message: result.message
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 8. GET /api/auth/reset-password/verify?token=...
   */
  async verifyResetToken(req, res, next) {
    try {
      const rawToken = (req.query && req.query.token) || '';
      const result = await authService.inspectResetToken(rawToken);

      if (!result.valid) {
        return res.status(200).json({
          ok: false,
          error: {
            code: 'INVALID_TOKEN',
            message: result.message
          }
        });
      }

      return res.status(200).json({
        ok: true,
        data: {
          valid: true
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 9. POST /api/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const ip = getClientIp(req);
      const { token, password, newPassword, confirmPassword } = req.body || {};
      const hasConfirmField =
        req.body && Object.prototype.hasOwnProperty.call(req.body, 'confirmPassword');

      const result = await authService.confirmPasswordReset({
        rawToken: token,
        newPassword: password !== undefined ? password : newPassword,
        confirmPassword,
        hasConfirmField,
        ip
      });

      if (result.status === 429) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: result.message
          }
        });
      }

      if (result.code !== 'RESET_SUCCESS') {
        return res.status(200).json({
          ok: false,
          error: {
            code: result.code,
            message: result.message
          }
        });
      }

      return res.status(200).json({
        ok: true,
        data: {
          code: result.code,
          message: result.message
        }
      });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new AuthController();
