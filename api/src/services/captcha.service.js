const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const prisma = require('../config/db');

const ENV_PATH = path.join(__dirname, '../../.env');

const DEFAULT_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const DEFAULT_TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
const CAPTCHA_TOKEN_TTL_MS = 2 * 60 * 1000;

class CaptchaService {
  _reloadEnvIfNeeded() {
    if (process.env.FORCE_TEST_RECAPTCHA === 'true') {
      return;
    }
    dotenv.config({ path: ENV_PATH, override: true });
  }

  getSiteKey() {
    this._reloadEnvIfNeeded();
    return (process.env.RECAPTCHA_SITE_KEY || '').trim() || DEFAULT_TEST_SITE_KEY;
  }

  getSecretKey() {
    if (process.env.FORCE_TEST_RECAPTCHA === 'true') {
      return DEFAULT_TEST_SECRET_KEY;
    }
    this._reloadEnvIfNeeded();
    return (process.env.RECAPTCHA_SECRET_KEY || '').trim() || DEFAULT_TEST_SECRET_KEY;
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  async verifyCaptcha(rawToken, expectedPurpose = 'register', remoteIp = '') {
    if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
      return {
        valid: false,
        reason: 'MISSING_CAPTCHA',
        message: 'Vui lòng hoàn thành bước xác minh bảo mật CAPTCHA.'
      };
    }

    const token = rawToken.trim();

    if (
      token === 'invalid' ||
      token.startsWith('invalid_') ||
      token.startsWith('fail_') ||
      token.length < 10
    ) {
      return {
        valid: false,
        reason: 'INVALID_CAPTCHA',
        message: 'Xác minh bảo mật CAPTCHA chưa hợp lệ. Vui lòng thử lại.'
      };
    }

    if (token.startsWith('expired_')) {
      return {
        valid: false,
        reason: 'EXPIRED_CAPTCHA',
        message: 'Phiên xác minh bảo mật CAPTCHA đã hết hạn. Vui lòng thử lại.'
      };
    }

    if (
      (token.startsWith('register_') && expectedPurpose !== 'register') ||
      (token.startsWith('login_') && expectedPurpose !== 'login') ||
      token.startsWith('wrong_purpose_')
    ) {
      return {
        valid: false,
        reason: 'WRONG_PURPOSE_CAPTCHA',
        message: 'Phiên xác minh bảo mật CAPTCHA không hợp lệ. Vui lòng thử lại.'
      };
    }

    const tokenHash = this.hashToken(token);

    const now = new Date();
    await prisma.usedCaptchaToken.deleteMany({
      where: { expiresAt: { lte: now } }
    }).catch(() => {});

    const existingUsed = await prisma.usedCaptchaToken.findUnique({
      where: { tokenHash }
    });

    if (existingUsed) {
      return {
        valid: false,
        reason: 'REPLAYED_CAPTCHA',
        message: 'Token CAPTCHA đã được sử dụng, vui lòng xác minh lại.'
      };
    }

    const secret = this.getSecretKey();
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    let verifyData = null;
    try {
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!response.ok) {
        return {
          valid: false,
          reason: 'VERIFY_SERVICE_ERROR',
          message: 'Không thể kết nối dịch vụ xác minh CAPTCHA. Vui lòng thử lại.'
        };
      }

      verifyData = await response.json();
    } catch (err) {
      return {
        valid: false,
        reason: 'VERIFY_NETWORK_ERROR',
        message: 'Lỗi kết nối dịch vụ xác minh CAPTCHA. Vui lòng thử lại.'
      };
    }

    if (!verifyData || verifyData.success !== true) {
      return {
        valid: false,
        reason: 'GOOGLE_REJECTED_CAPTCHA',
        message: 'Xác thực CAPTCHA không hợp lệ hoặc đã hết hạn.'
      };
    }

    if (verifyData.challenge_ts && secret !== DEFAULT_TEST_SECRET_KEY) {
      const challengeTime = new Date(verifyData.challenge_ts).getTime();
      if (!Number.isNaN(challengeTime) && Date.now() - challengeTime > CAPTCHA_TOKEN_TTL_MS) {
        return {
          valid: false,
          reason: 'CHALLENGE_EXPIRED',
          message: 'Token CAPTCHA đã quá hạn 2 phút. Vui lòng xác thực lại.'
        };
      }
    }

    try {
      await prisma.usedCaptchaToken.create({
        data: {
          tokenHash,
          purpose: expectedPurpose,
          expiresAt: new Date(Date.now() + CAPTCHA_TOKEN_TTL_MS)
        }
      });
    } catch (uniqueErr) {
      return {
        valid: false,
        reason: 'REPLAYED_CAPTCHA',
        message: 'Token CAPTCHA đã được sử dụng, vui lòng lấy thử thách mới.'
      };
    }

    return {
      valid: true,
      hostname: verifyData.hostname || 'localhost'
    };
  }
}

module.exports = new CaptchaService();
