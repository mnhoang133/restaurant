const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const prisma = require('../config/db');
const mailService = require('./mail.service');

const SALT_ROUNDS = 10;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Chính sách bảo mật công bố (Khối 8 & Bài 2 Khối 9 - Slide 34, 41, 50-56, 61, 64)
const POLICY = {
  OTP_EXPIRES_MS: 10 * 60 * 1000,          // Hạn OTP kích hoạt: 10 phút
  OTP_MAX_ATTEMPTS: 5,                     // Tối đa 5 lần nhập sai OTP
  OTP_LOCK_DURATION_MS: 15 * 60 * 1000,    // Khóa tạm kích hoạt 15 phút khi sai quá 5 lần
  OTP_RESEND_COOLDOWN_MS: Number(process.env.OTP_RESEND_COOLDOWN_MS || 60 * 1000), // Chờ 60s giữa 2 lần gửi OTP
  OTP_MAX_SEND_COUNT: 5,                   // Tối đa 5 lần gửi OTP cho một tài khoản

  LOGIN_WINDOW_MS: 15 * 60 * 1000,         // Cửa sổ đếm đăng nhập sai: 15 phút
  LOGIN_CAPTCHA_THRESHOLD: 3,              // Từ 3 lần sai theo Email yêu cầu CAPTCHA
  LOGIN_CAPTCHA_THRESHOLD_IP: 12,          // Theo IP dùng chung Wi-Fi/NAT: từ 12 lần sai mới ép CAPTCHA toàn IP
  LOGIN_MAX_ATTEMPTS_EMAIL: 5,             // Đủ 5 lần sai theo Email -> khóa riêng Email đó 5 phút (429)
  LOGIN_MAX_ATTEMPTS_IP: 50,               // Đủ 50 lần sai theo IP -> mới khóa toàn IP (tránh khóa nhầm máy cùng mạng)
  LOGIN_LOCK_DURATION_MS: 5 * 60 * 1000,   // Thời gian khóa tạm theo Email: 5 phút
  IP_LOCK_DURATION_MS: 2 * 60 * 1000,      // Thời gian khóa tạm theo IP: 2 phút

  REGISTER_WINDOW_MS: 15 * 60 * 1000,      // Cửa sổ giới hạn đăng ký theo IP: 15 phút
  REGISTER_MAX_PER_IP: 50,                 // Tối đa 50 lần gửi đăng ký / 15 phút / IP

  FORGOT_WINDOW_MS: 15 * 60 * 1000,        // Cửa sổ giới hạn yêu cầu quên mật khẩu: 15 phút
  FORGOT_MAX_PER_EMAIL: 3,                 // Tối đa 3 yêu cầu /forgot-password cho mỗi Email trong 15 phút
  FORGOT_MAX_PER_IP: 50,                   // Tối đa 50 yêu cầu /forgot-password cho mỗi IP trong 15 phút
  RESET_TOKEN_EXPIRES_MS: 15 * 60 * 1000,  // Hạn dùng Reset Token: 15 phút

  MFA_CHALLENGE_EXPIRES_IN: '5m',          // Hạn dùng MFA Challenge ở bước chờ MFA: 5 phút
  MFA_WINDOW_MS: 15 * 60 * 1000,           // Cửa sổ đếm thử sai mã MFA: 15 phút
  MFA_MAX_ATTEMPTS: 5,                     // Tối đa 5 lần nhập sai TOTP/Recovery Code -> khóa tạm 5 phút
  MFA_LOCK_DURATION_MS: 5 * 60 * 1000,     // Thời gian khóa tạm bước MFA: 5 phút
  RECOVERY_CODES_COUNT: 8                  // Số lượng Recovery Code phát hành mỗi lần bật/sinh mới
};

const DUMMY_BCRYPT_HASH = bcrypt.hashSync('DummyPasswordForTimingProtection123', SALT_ROUNDS);

class AuthService {
  getPolicy() {
    return POLICY;
  }

  getJwtSecret() {
    return process.env.JWT_SECRET || 'csr-restaurant-jwt-secret-hs256-key-2026';
  }

  getJwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || '15m';
  }

  /**
   * Phát hành Access Token (Stateless JWT) ký bằng HS256 (Slide 34, 41, 42, 62)
   * Payload tối giản: chỉ chứa sub, email, role, tv (tokenVersion). Tuyệt đối không chứa passwordHash.
   */
  issueAccessToken(user, customExpiresIn) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role || 'viewer',
      tv: typeof user.tokenVersion === 'number' ? user.tokenVersion : 0
    };

    return jwt.sign(payload, this.getJwtSecret(), {
      algorithm: 'HS256',
      expiresIn: customExpiresIn || this.getJwtExpiresIn()
    });
  }

  /**
   * Xác minh Access Token tại Gate 1 (Slide 11, 36, 41, 44, 62, 64)
   * - Cố định algorithms: ['HS256'] để chặn alg: "none"
   * - Kiểm tra chữ ký & hạn dùng (exp)
   * - Truy vấn User từ DB kiểm tra status === 'active' và tokenVersion khớp với payload.tv
   */
  async verifyAccessToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
      return {
        valid: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Thiếu token xác thực. Vui lòng đăng nhập.'
      };
    }

    let payload;
    try {
      payload = jwt.verify(rawToken.trim(), this.getJwtSecret(), {
        algorithms: ['HS256']
      });
    } catch (err) {
      if (err && err.name === 'TokenExpiredError') {
        return {
          valid: false,
          status: 401,
          code: 'TOKEN_EXPIRED',
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        };
      }
      return {
        valid: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Token xác thực không hợp lệ hoặc đã bị thay đổi.'
      };
    }

    // Chặn việc dùng MFA challenge token để gọi vào các route cần Bearer Access Token (Slide 56)
    if (payload && payload.purpose && payload.purpose !== 'access') {
      return {
        valid: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Token chờ xác thực MFA không được phép truy cập tài nguyên này.'
      };
    }

    const userId = Number(payload && payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      return {
        valid: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Định danh trong token không hợp lệ.'
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.status !== 'active') {
      return {
        valid: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Tài khoản không tồn tại hoặc chưa được kích hoạt.'
      };
    }

    const currentTv = typeof user.tokenVersion === 'number' ? user.tokenVersion : 0;
    const tokenTv = typeof payload.tv === 'number' ? payload.tv : 0;
    if (currentTv !== tokenTv) {
      return {
        valid: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.'
      };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        rawEmail: user.rawEmail || user.email,
        name: user.name || user.email.split('@')[0],
        role: user.role,
        chefId: user.chefId || null,
        mfaEnabled: Boolean(user.mfaEnabled),
        status: user.status
      }
    };
  }

  /**
   * Thu hồi hiệu lực của các JWT hiện tại bằng cách tăng tokenVersion (dùng khi Logout hoặc Reset Password)
   */
  async revokeUserTokens(userId) {
    await prisma.user.update({
      where: { id: Number(userId) },
      data: {
        tokenVersion: { increment: 1 }
      }
    });
  }

  normalizeEmail(rawEmail) {
    if (!rawEmail || typeof rawEmail !== 'string') return '';
    const trimmed = rawEmail.trim();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === trimmed.length - 1) {
      return trimmed.toLowerCase();
    }
    const localPart = trimmed.slice(0, atIndex).trim().toLowerCase();
    const domainPart = trimmed.slice(atIndex + 1).trim().toLowerCase();
    return `${localPart}@${domainPart}`;
  }

  validateEmail(rawEmail) {
    if (!rawEmail || typeof rawEmail !== 'string') return false;
    const normalized = this.normalizeEmail(rawEmail);
    if (normalized.length < 5 || normalized.length > 254) return false;
    const parts = normalized.split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (!local || !domain || local.length > 64) return false;
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return false;
    return true;
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') return false;
    if (password.length < 8 || password.length > 72) return false;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasLetter && hasNumber;
  }

  generateOtpCode() {
    return String(crypto.randomInt(100000, 1000000));
  }

  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  hashResetToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
  }

  async getRateRecord(targetKey, windowMs) {
    const now = new Date();
    const record = await prisma.loginAttempt.findUnique({
      where: { targetKey }
    });

    if (!record) {
      return { attempts: 0, lockedUntil: null, isLocked: false };
    }

    if (record.lockedUntil && record.lockedUntil > now) {
      return {
        attempts: record.attempts,
        lockedUntil: record.lockedUntil,
        isLocked: true
      };
    }

    const windowExpired = now.getTime() - new Date(record.windowStart).getTime() > windowMs;
    if (windowExpired) {
      return { attempts: 0, lockedUntil: null, isLocked: false };
    }

    return {
      attempts: record.attempts,
      lockedUntil: null,
      isLocked: false
    };
  }

  async incrementRateRecord(targetKey, windowMs, maxAttempts, lockDurationMs) {
    const now = new Date();
    const existing = await prisma.loginAttempt.findUnique({
      where: { targetKey }
    });

    if (!existing) {
      const lockedUntil = maxAttempts <= 1 ? new Date(now.getTime() + lockDurationMs) : null;
      return prisma.loginAttempt.create({
        data: {
          targetKey,
          attempts: 1,
          windowStart: now,
          lockedUntil
        }
      });
    }

    const windowExpired =
      now.getTime() - new Date(existing.windowStart).getTime() > windowMs &&
      (!existing.lockedUntil || existing.lockedUntil <= now);

    const newAttempts = windowExpired ? 1 : existing.attempts + 1;
    const newWindowStart = windowExpired ? now : existing.windowStart;
    let newLockedUntil = existing.lockedUntil && existing.lockedUntil > now ? existing.lockedUntil : null;

    if (newAttempts >= maxAttempts && !newLockedUntil) {
      newLockedUntil = new Date(now.getTime() + lockDurationMs);
    }

    return prisma.loginAttempt.update({
      where: { targetKey },
      data: {
        attempts: newAttempts,
        windowStart: newWindowStart,
        lockedUntil: newLockedUntil
      }
    });
  }

  async resetRateRecord(targetKey) {
    await prisma.loginAttempt.deleteMany({
      where: { targetKey }
    });
  }

  async getLoginSecurityState(rawEmail, ip) {
    const normalizedEmail = this.normalizeEmail(rawEmail);
    const emailKey = normalizedEmail ? `login:email:${normalizedEmail}` : null;
    const ipKey = `login:ip:${ip || 'unknown'}`;

    const [emailState, ipState] = await Promise.all([
      emailKey ? this.getRateRecord(emailKey, POLICY.LOGIN_WINDOW_MS) : { attempts: 0, isLocked: false },
      this.getRateRecord(ipKey, POLICY.LOGIN_WINDOW_MS)
    ]);

    // Chỉ khóa 429 theo từng Email cá nhân (tránh khóa nhầm các máy/tài khoản khác dùng chung IP Wi-Fi/NAT).
    // Bộ đếm IP vẫn được lưu trong DB đúng theo Slide và chỉ dùng để bật CAPTCHA (phạt nhẹ) khi IP spam quá nhiều.
    const isLocked = Boolean(emailState.isLocked);
    const requireCaptcha =
      emailState.attempts >= POLICY.LOGIN_CAPTCHA_THRESHOLD ||
      ipState.attempts >= POLICY.LOGIN_CAPTCHA_THRESHOLD_IP;

    return {
      normalizedEmail,
      emailAttempts: emailState.attempts,
      ipAttempts: ipState.attempts,
      isLocked,
      lockedUntil: emailState.lockedUntil || null,
      requireCaptcha
    };
  }

  async recordFailedLogin(rawEmail, ip) {
    const normalizedEmail = this.normalizeEmail(rawEmail);
    const emailKey = normalizedEmail ? `login:email:${normalizedEmail}` : null;
    const ipKey = `login:ip:${ip || 'unknown'}`;

    const tasks = [
      this.incrementRateRecord(
        ipKey,
        POLICY.LOGIN_WINDOW_MS,
        999999, // Không bao giờ khóa cứng 429 theo IP ở bước Login, chỉ đếm số lần vào DB
        0
      )
    ];

    if (emailKey) {
      tasks.push(
        this.incrementRateRecord(
          emailKey,
          POLICY.LOGIN_WINDOW_MS,
          POLICY.LOGIN_MAX_ATTEMPTS_EMAIL,
          POLICY.LOGIN_LOCK_DURATION_MS
        )
      );
    }

    const results = await Promise.all(tasks);
    const ipUpdated = results[0];
    const emailUpdated = results[1] || { attempts: 0, lockedUntil: null };
    const now = new Date();

    const isLocked = Boolean(emailUpdated.lockedUntil && emailUpdated.lockedUntil > now);

    return {
      emailAttempts: emailUpdated.attempts,
      ipAttempts: ipUpdated.attempts,
      isLocked,
      requireCaptcha:
        emailUpdated.attempts >= POLICY.LOGIN_CAPTCHA_THRESHOLD ||
        ipUpdated.attempts >= POLICY.LOGIN_CAPTCHA_THRESHOLD_IP
    };
  }

  async registerUser({ rawEmail, password, confirmPassword, hasConfirmField = false, name, ip }) {
    const ipKey = `register:ip:${ip || 'unknown'}`;
    const ipRate = await this.getRateRecord(ipKey, POLICY.REGISTER_WINDOW_MS);
    if (ipRate.isLocked || ipRate.attempts >= POLICY.REGISTER_MAX_PER_IP) {
      return { status: 429, code: 'RATE_LIMITED', message: 'Quá giới hạn yêu cầu đăng ký. Vui lòng thử lại sau.' };
    }

    await this.incrementRateRecord(
      ipKey,
      POLICY.REGISTER_WINDOW_MS,
      POLICY.REGISTER_MAX_PER_IP,
      POLICY.LOGIN_LOCK_DURATION_MS
    );

    if (hasConfirmField && password !== confirmPassword) {
      return {
        status: 200,
        code: 'VALIDATION_FAILED',
        message: 'Mật khẩu xác nhận không khớp.'
      };
    }

    if (this.validateEmail(rawEmail)) {
      const normalizedCheck = this.normalizeEmail(rawEmail.trim());
      const activeCheck = await prisma.user.findUnique({
        where: { email: normalizedCheck }
      });
      if (activeCheck && activeCheck.status === 'active') {
        return {
          status: 200,
          code: 'EMAIL_ALREADY_ACTIVE',
          message: 'Email này đã được kích hoạt.'
        };
      }
    }

    if (!this.validateEmail(rawEmail) || !this.validatePassword(password)) {
      return {
        status: 200,
        code: 'VALIDATION_FAILED',
        message: 'Email không hợp lệ hoặc mật khẩu chưa đạt quy tắc (tối thiểu 8 ký tự, gồm cả chữ và số).'
      };
    }

    const cleanRawEmail = rawEmail.trim();
    const normalizedEmail = this.normalizeEmail(cleanRawEmail);
    const cleanName = name && String(name).trim() ? String(name).trim().slice(0, 100) : null;

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { activationChallenge: true }
    });

    const genericSuccessMessage =
      'Yêu cầu đăng ký đã được tiếp nhận. Nếu email hợp lệ và chưa được kích hoạt, mã OTP kích hoạt đã được gửi tới hộp thư của bạn.';

    if (existingUser) {
      if (existingUser.status === 'active') {
        return {
          status: 200,
          code: 'EMAIL_ALREADY_ACTIVE',
          message: 'Email này đã được kích hoạt.'
        };
      }
      return {
        status: 200,
        code: 'REGISTER_ACCEPTED',
        email: normalizedEmail,
        message: genericSuccessMessage
      };
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const otpCode = this.generateOtpCode();
    const otpHash = await bcrypt.hash(otpCode, SALT_ROUNDS);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + POLICY.OTP_EXPIRES_MS);

    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          rawEmail: cleanRawEmail,
          name: cleanName,
          passwordHash,
          role: 'viewer',
          status: 'pending',
          emailVerifiedAt: null,
          tokenVersion: 0
        }
      });

      await tx.activationChallenge.create({
        data: {
          userId: newUser.id,
          purpose: 'activation',
          otpHash,
          expiresAt,
          attempts: 0,
          sendCount: 1,
          lockedUntil: null,
          lastSentAt: now,
          usedAt: null
        }
      });
    });

    await mailService.sendActivationOtpEmail(cleanRawEmail, otpCode, 10);

    return {
      status: 200,
      code: 'REGISTER_ACCEPTED',
      email: normalizedEmail,
      message: genericSuccessMessage
    };
  }

  async activateAccount({ rawEmail, otpCode }) {
    const normalizedEmail = this.normalizeEmail(rawEmail);
    const cleanOtp = otpCode ? String(otpCode).trim() : '';
    const invalidOtpMessage = 'Mã kích hoạt không hợp lệ, đã hết hạn hoặc đã được sử dụng.';

    if (!normalizedEmail || !cleanOtp) {
      return { status: 200, code: 'INVALID_OTP', message: invalidOtpMessage };
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { activationChallenge: true }
    });

    if (!user || user.status !== 'pending' || !user.activationChallenge) {
      await bcrypt.compare(cleanOtp || '000000', DUMMY_BCRYPT_HASH);
      return { status: 200, code: 'INVALID_OTP', message: invalidOtpMessage };
    }

    const challenge = user.activationChallenge;
    const now = new Date();

    if (
      (challenge.lockedUntil && challenge.lockedUntil > now) ||
      challenge.attempts >= POLICY.OTP_MAX_ATTEMPTS
    ) {
      if (!challenge.lockedUntil || challenge.lockedUntil <= now) {
        await prisma.activationChallenge.update({
          where: { id: challenge.id },
          data: { lockedUntil: new Date(now.getTime() + POLICY.OTP_LOCK_DURATION_MS) }
        });
      }
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Tài khoản đã vượt quá số lần thử OTP cho phép. Vui lòng thử lại sau.'
      };
    }

    const isPurposeValid = challenge.purpose === 'activation';
    const isUnused = challenge.usedAt === null;
    const isNotExpired = new Date(challenge.expiresAt) > now;
    const isHashMatch = await bcrypt.compare(cleanOtp, challenge.otpHash);

    if (!isPurposeValid || !isUnused || !isNotExpired || !isHashMatch) {
      const nextAttempts = challenge.attempts + 1;
      const lockedUntil =
        nextAttempts >= POLICY.OTP_MAX_ATTEMPTS
          ? new Date(now.getTime() + POLICY.OTP_LOCK_DURATION_MS)
          : challenge.lockedUntil;

      await prisma.activationChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: { increment: 1 },
          lockedUntil
        }
      });

      return { status: 200, code: 'INVALID_OTP', message: invalidOtpMessage };
    }

    const activated = await prisma.$transaction(async (tx) => {
      const updatedChallenge = await tx.activationChallenge.updateMany({
        where: {
          id: challenge.id,
          userId: user.id,
          purpose: 'activation',
          usedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: POLICY.OTP_MAX_ATTEMPTS }
        },
        data: {
          usedAt: now
        }
      });

      if (updatedChallenge.count !== 1) {
        return false;
      }

      const updatedUser = await tx.user.updateMany({
        where: {
          id: user.id,
          status: 'pending'
        },
        data: {
          status: 'active',
          emailVerifiedAt: now
        }
      });

      return updatedUser.count === 1;
    });

    if (!activated) {
      return { status: 200, code: 'INVALID_OTP', message: invalidOtpMessage };
    }

    return {
      status: 200,
      code: 'ACTIVATED',
      email: normalizedEmail,
      message: 'Kích hoạt tài khoản thành công. Vui lòng đăng nhập để sử dụng hệ thống.'
    };
  }

  async resendActivationOtp({ rawEmail, bypassCooldownForTest = false }) {
    const normalizedEmail = this.normalizeEmail(rawEmail);
    const genericResendMessage =
      'Nếu địa chỉ email đang ở trạng thái chờ kích hoạt, mã OTP mới đã được gửi tới hộp thư của bạn.';

    if (!normalizedEmail || !this.validateEmail(normalizedEmail)) {
      return { status: 200, code: 'RESEND_ACCEPTED', message: genericResendMessage };
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { activationChallenge: true }
    });

    if (!user || user.status !== 'pending' || !user.activationChallenge) {
      return { status: 200, code: 'RESEND_ACCEPTED', message: genericResendMessage };
    }

    const challenge = user.activationChallenge;
    const now = new Date();

    if (
      (challenge.lockedUntil && challenge.lockedUntil > now) ||
      challenge.attempts >= POLICY.OTP_MAX_ATTEMPTS ||
      challenge.sendCount >= POLICY.OTP_MAX_SEND_COUNT
    ) {
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Đã vượt quá giới hạn gửi hoặc thử mã OTP. Vui lòng thử lại sau.'
      };
    }

    const elapsedMs = now.getTime() - new Date(challenge.lastSentAt).getTime();
    if (!bypassCooldownForTest && elapsedMs < POLICY.OTP_RESEND_COOLDOWN_MS) {
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Vui lòng chờ 60 giây trước khi yêu cầu gửi lại mã OTP mới.'
      };
    }

    const newOtpCode = this.generateOtpCode();
    const newOtpHash = await bcrypt.hash(newOtpCode, SALT_ROUNDS);
    const newExpiresAt = new Date(now.getTime() + POLICY.OTP_EXPIRES_MS);

    await prisma.activationChallenge.update({
      where: { id: challenge.id },
      data: {
        otpHash: newOtpHash,
        expiresAt: newExpiresAt,
        lastSentAt: now,
        sendCount: { increment: 1 },
        usedAt: null
      }
    });

    await mailService.sendActivationOtpEmail(user.rawEmail || user.email, newOtpCode, 10);

    return {
      status: 200,
      code: 'RESEND_ACCEPTED',
      message: genericResendMessage
    };
  }

  async verifyLoginCredentials({ rawEmail, password, ip }) {
    const normalizedEmail = this.normalizeEmail(rawEmail);
    const genericLoginError = 'Email hoặc mật khẩu không đúng.';

    if (!normalizedEmail || !password || typeof password !== 'string') {
      const failState = await this.recordFailedLogin(normalizedEmail, ip);
      if (failState.isLocked) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          requireCaptcha: true,
          message: 'Tài khoản hoặc địa chỉ IP tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau 5 phút.'
        };
      }
      return {
        status: 200,
        code: 'INVALID_CREDENTIALS',
        requireCaptcha: failState.requireCaptcha,
        message: genericLoginError
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      const failState = await this.recordFailedLogin(normalizedEmail, ip);
      if (failState.isLocked) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          requireCaptcha: true,
          message: 'Tài khoản hoặc địa chỉ IP tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau 5 phút.'
        };
      }
      return {
        status: 200,
        code: 'INVALID_CREDENTIALS',
        requireCaptcha: failState.requireCaptcha,
        message: genericLoginError
      };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const failState = await this.recordFailedLogin(normalizedEmail, ip);
      if (failState.isLocked) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          requireCaptcha: true,
          message: 'Tài khoản hoặc địa chỉ IP tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau 5 phút.'
        };
      }
      return {
        status: 200,
        code: 'INVALID_CREDENTIALS',
        requireCaptcha: failState.requireCaptcha,
        message: genericLoginError
      };
    }

    // Mật khẩu đúng nhưng tài khoản đang pending: tuyệt đối KHÔNG cấp JWT
    if (user.status !== 'active') {
      const currentState = await this.getLoginSecurityState(normalizedEmail, ip);
      const challenge = await prisma.activationChallenge.findUnique({
        where: { userId: user.id }
      });
      const now = new Date();

      if (
        challenge &&
        ((challenge.lockedUntil && challenge.lockedUntil > now) ||
          challenge.attempts >= POLICY.OTP_MAX_ATTEMPTS)
      ) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          email: normalizedEmail,
          requireCaptcha: currentState.requireCaptcha,
          message: 'Tài khoản đã vượt quá số lần thử mã xác thực cho phép. Vui lòng thử lại sau.'
        };
      }

      const newOtpCode = this.generateOtpCode();
      const newOtpHash = await bcrypt.hash(newOtpCode, SALT_ROUNDS);
      const newExpiresAt = new Date(now.getTime() + POLICY.OTP_EXPIRES_MS);

      if (challenge) {
        await prisma.activationChallenge.update({
          where: { id: challenge.id },
          data: {
            otpHash: newOtpHash,
            expiresAt: newExpiresAt,
            lastSentAt: now,
            sendCount: { increment: 1 },
            usedAt: null
          }
        });
      } else {
        await prisma.activationChallenge.create({
          data: {
            userId: user.id,
            purpose: 'activation',
            otpHash: newOtpHash,
            expiresAt: newExpiresAt,
            attempts: 0,
            sendCount: 1,
            lockedUntil: null,
            lastSentAt: now,
            usedAt: null
          }
        });
      }

      await mailService.sendActivationOtpEmail(user.rawEmail || user.email, newOtpCode, 10);

      return {
        status: 200,
        code: 'ACCOUNT_PENDING',
        email: normalizedEmail,
        requireCaptcha: currentState.requireCaptcha,
        message: 'Tài khoản của bạn chưa được kích hoạt. Mã xác thực mới vừa được gửi tới email của bạn.'
      };
    }

    await this.resetRateRecord(`login:email:${normalizedEmail}`);

    // Nếu tài khoản đã bật MFA (Slide 51, 52, 56, 64):
    // Tuyệt đối KHÔNG cấp accessToken ngay sau bước password.
    // Trả về trạng thái chờ MFA (next: "mfa", kèm challenge ngắn hạn chỉ dùng cho bước xác thực MFA).
    if (user.mfaEnabled) {
      const mfaRate = await this.getRateRecord(`mfa:user:${user.id}`, POLICY.MFA_WINDOW_MS);
      if (mfaRate.isLocked) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          email: user.email,
          message: 'Tài khoản đang tạm khóa xác thực MFA do nhập sai mã nhiều lần. Vui lòng thử lại sau 5 phút.'
        };
      }

      const challenge = this.issueMfaChallengeToken(user);
      return {
        status: 200,
        code: 'MFA_REQUIRED',
        next: 'mfa',
        challenge,
        mfaToken: challenge,
        email: user.email,
        message: 'Mật khẩu hợp lệ. Vui lòng nhập mã xác thực 2 lớp (TOTP 6 số hoặc Recovery Code).'
      };
    }

    const accessToken = this.issueAccessToken(user);

    return {
      status: 200,
      code: 'LOGIN_SUCCESS',
      next: 'done',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        rawEmail: user.rawEmail || user.email,
        name: user.name || user.email.split('@')[0],
        role: user.role,
        chefId: user.chefId || null,
        mfaEnabled: Boolean(user.mfaEnabled),
        status: user.status
      }
    };
  }

  async requestPasswordReset({ rawEmail, ip }) {
    const normalizedEmail = this.normalizeEmail(rawEmail);
    const emailKey = normalizedEmail ? `forgot:email:${normalizedEmail}` : null;
    const ipKey = `forgot:ip:${ip || 'unknown'}`;

    const [emailRate, ipRate] = await Promise.all([
      emailKey ? this.getRateRecord(emailKey, POLICY.FORGOT_WINDOW_MS) : { attempts: 0, isLocked: false },
      this.getRateRecord(ipKey, POLICY.FORGOT_WINDOW_MS)
    ]);

    if (
      emailRate.isLocked ||
      ipRate.isLocked ||
      emailRate.attempts >= POLICY.FORGOT_MAX_PER_EMAIL ||
      ipRate.attempts >= POLICY.FORGOT_MAX_PER_IP
    ) {
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Quá giới hạn số lần yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.'
      };
    }

    await Promise.all([
      this.incrementRateRecord(
        ipKey,
        POLICY.FORGOT_WINDOW_MS,
        POLICY.FORGOT_MAX_PER_IP,
        POLICY.LOGIN_LOCK_DURATION_MS
      ),
      emailKey
        ? this.incrementRateRecord(
            emailKey,
            POLICY.FORGOT_WINDOW_MS,
            POLICY.FORGOT_MAX_PER_EMAIL,
            POLICY.LOGIN_LOCK_DURATION_MS
          )
        : Promise.resolve()
    ]);

    const genericForgotMessage = 'Nếu email đã đăng ký, hướng dẫn đặt lại mật khẩu đã được gửi.';

    if (!normalizedEmail || !this.validateEmail(normalizedEmail)) {
      return {
        status: 200,
        code: 'FORGOT_ACCEPTED',
        message: genericForgotMessage
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      return {
        status: 200,
        code: 'FORGOT_ACCEPTED',
        message: genericForgotMessage
      };
    }

    const rawToken = this.generateResetToken();
    const tokenHash = this.hashResetToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + POLICY.RESET_TOKEN_EXPIRES_MS);

    await prisma.$transaction([
      prisma.passwordReset.updateMany({
        where: {
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      }),
      prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          usedAt: null
        }
      })
    ]);

    await mailService.sendPasswordResetEmail(user.rawEmail || user.email, rawToken, 15);

    return {
      status: 200,
      code: 'FORGOT_ACCEPTED',
      message: genericForgotMessage
    };
  }

  async inspectResetToken(rawToken) {
    const invalidLinkMessage = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 32) {
      return { valid: false, message: invalidLinkMessage };
    }

    const tokenHash = this.hashResetToken(rawToken.trim());
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    const now = new Date();
    if (
      !resetRecord ||
      resetRecord.usedAt !== null ||
      new Date(resetRecord.expiresAt) <= now ||
      !resetRecord.user
    ) {
      return { valid: false, message: invalidLinkMessage };
    }

    return {
      valid: true,
      resetId: resetRecord.id,
      userId: resetRecord.userId
    };
  }

  async confirmPasswordReset({ rawToken, newPassword, confirmPassword, hasConfirmField = false, ip }) {
    const invalidLinkMessage = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';

    const ipKey = `reset:ip:${ip || 'unknown'}`;
    const ipRate = await this.getRateRecord(ipKey, POLICY.FORGOT_WINDOW_MS);
    if (ipRate.isLocked || ipRate.attempts >= 20) {
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Quá giới hạn số lần thử đặt lại mật khẩu. Vui lòng thử lại sau.'
      };
    }

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 32) {
      await this.incrementRateRecord(ipKey, POLICY.FORGOT_WINDOW_MS, 20, POLICY.LOGIN_LOCK_DURATION_MS);
      return { status: 200, code: 'INVALID_TOKEN', message: invalidLinkMessage };
    }

    const tokenHash = this.hashResetToken(rawToken.trim());
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    const now = new Date();
    if (
      !resetRecord ||
      resetRecord.usedAt !== null ||
      new Date(resetRecord.expiresAt) <= now ||
      !resetRecord.user
    ) {
      await this.incrementRateRecord(ipKey, POLICY.FORGOT_WINDOW_MS, 20, POLICY.LOGIN_LOCK_DURATION_MS);
      return { status: 200, code: 'INVALID_TOKEN', message: invalidLinkMessage };
    }

    if (!this.validatePassword(newPassword)) {
      return {
        status: 200,
        code: 'VALIDATION_FAILED',
        tokenValid: true,
        message: 'Mật khẩu mới chưa đạt quy tắc (tối thiểu 8 ký tự, gồm cả chữ và số).'
      };
    }

    const isSameAsOldPassword = await bcrypt.compare(newPassword, resetRecord.user.passwordHash);
    if (isSameAsOldPassword) {
      return {
        status: 200,
        code: 'SAME_AS_OLD_PASSWORD',
        tokenValid: true,
        message: 'Mật khẩu mới không được trùng với mật khẩu cũ. Vui lòng chọn mật khẩu khác.'
      };
    }

    if (hasConfirmField && newPassword !== confirmPassword) {
      return {
        status: 200,
        code: 'VALIDATION_FAILED',
        tokenValid: true,
        message: 'Mật khẩu xác nhận không khớp.'
      };
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Thao tác nguyên tử: tiêu thụ token + đổi passwordHash + tăng tokenVersion để thu hồi toàn bộ JWT cũ (Slide 41, 64)
    const consumed = await prisma.$transaction(async (tx) => {
      const updatedToken = await tx.passwordReset.updateMany({
        where: {
          id: resetRecord.id,
          userId: resetRecord.userId,
          usedAt: null,
          expiresAt: { gt: now }
        },
        data: {
          usedAt: now
        }
      });

      if (updatedToken.count !== 1) {
        return false;
      }

      await tx.passwordReset.updateMany({
        where: {
          userId: resetRecord.userId,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      });

      await tx.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: newPasswordHash,
          tokenVersion: { increment: 1 }
        }
      });

      return true;
    });

    if (!consumed) {
      return { status: 200, code: 'INVALID_TOKEN', message: invalidLinkMessage };
    }

    await mailService.sendPasswordChangedNotification(resetRecord.user.rawEmail || resetRecord.user.email);

    return {
      status: 200,
      code: 'RESET_SUCCESS',
      userId: resetRecord.userId,
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.'
    };
  }

  // =========================================================================
  // BÀI 2 KHỐI 9: MFA (TOTP RFC 6238, AES-256 SECRET, CHỐNG REPLAY & RECOVERY CODE)
  // =========================================================================

  getMfaEncryptionKey() {
    const rawKey = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'csr-restaurant-mfa-aes256-secret-key-2026';
    return crypto.createHash('sha256').update(String(rawKey)).digest();
  }

  /**
   * Mã hóa đối xứng AES-256-GCM cho TOTP Secret trước khi lưu vào DB (Slide 50 Speaker Note & Slide 66)
   * Không băm 1 chiều vì server cần lấy lại secret gốc để tính HMAC-SHA1; không lưu dạng rõ.
   */
  encryptMfaSecret(plainBase32) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getMfaEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plainBase32), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptMfaSecret(storedValue) {
    if (!storedValue || typeof storedValue !== 'string') return null;
    if (!storedValue.startsWith('enc:v1:')) {
      return storedValue;
    }
    const parts = storedValue.split(':');
    if (parts.length !== 5) return null;
    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encrypted = Buffer.from(parts[4], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.getMfaEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Sinh chuỗi Secret ngẫu nhiên ở định dạng Base32 (16 ký tự = 80 bit)
   */
  generateBase32Secret(length = 16) {
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += BASE32_ALPHABET[crypto.randomInt(0, BASE32_ALPHABET.length)];
    }
    return secret;
  }

  base32ToBuffer(base32Str) {
    const cleaned = String(base32Str || '')
      .replace(/[\s=]/g, '')
      .toUpperCase();
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const ch of cleaned) {
      const idx = BASE32_ALPHABET.indexOf(ch);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  /**
   * Tính mã TOTP 6 chữ số tại một bước thời gian (step = floor(t / 30)) theo chuẩn RFC 6238 & RFC 4226
   */
  computeTotpAtStep(base32Secret, step) {
    const key = this.base32ToBuffer(base32Secret);
    const msg = Buffer.alloc(8);
    const high = Math.floor(step / 0x100000000);
    const low = step >>> 0;
    msg.writeUInt32BE(high, 0);
    msg.writeUInt32BE(low, 4);

    const hmac = crypto.createHmac('sha1', key).update(msg).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    return String(binary % 1000000).padStart(6, '0');
  }

  /**
   * Kiểm tra mã TOTP 6 số (Slide 48, 53, 64):
   * - Chấp nhận bước hiện tại (0) và tối đa ±1 bước lân cận (-1, +1) để bù lệch đồng hồ
   * - Chống dùng lại mã (Replay Attack): nếu matchedStep <= lastTotpStep thì từ chối ngay
   */
  verifyTotpCode(base32Secret, rawCode, lastTotpStep = null, customUnixSec = null) {
    const cleanCode = String(rawCode || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      return { valid: false, reason: 'INVALID_FORMAT' };
    }

    const nowSec = customUnixSec !== null ? Number(customUnixSec) : Math.floor(Date.now() / 1000);
    const currentStep = Math.floor(nowSec / 30);

    for (const delta of [0, -1, 1]) {
      const candidateStep = currentStep + delta;
      const expectedCode = this.computeTotpAtStep(base32Secret, candidateStep);
      if (expectedCode === cleanCode) {
        if (typeof lastTotpStep === 'number' && candidateStep <= lastTotpStep) {
          return {
            valid: false,
            reason: 'REPLAYED',
            matchedStep: candidateStep
          };
        }
        return {
          valid: true,
          matchedStep: candidateStep
        };
      }
    }

    return { valid: false, reason: 'MISMATCH' };
  }

  /**
   * Sinh danh sách Recovery Code dạng XXXX-XXXX (Slide 54)
   */
  generateRecoveryCodes(count = POLICY.RECOVERY_CODES_COUNT) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      let part1 = '';
      let part2 = '';
      for (let j = 0; j < 4; j++) {
        part1 += RECOVERY_ALPHABET[crypto.randomInt(0, RECOVERY_ALPHABET.length)];
        part2 += RECOVERY_ALPHABET[crypto.randomInt(0, RECOVERY_ALPHABET.length)];
      }
      codes.push(`${part1}-${part2}`);
    }
    return codes;
  }

  normalizeRecoveryCode(rawCode) {
    const alnum = String(rawCode || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (alnum.length === 8) {
      return `${alnum.slice(0, 4)}-${alnum.slice(4)}`;
    }
    return String(rawCode || '').trim().toUpperCase();
  }

  hashRecoveryCode(rawCode) {
    const normalized = this.normalizeRecoveryCode(rawCode);
    return crypto.createHash('sha256').update(`recovery:${normalized}`).digest('hex');
  }

  /**
   * Cấp MFA Challenge ngắn hạn (thay cho phiên mfaPending ở SPA - Slide 56)
   * Mang purpose: 'mfa_challenge' nên bị requireAuth từ chối (401) nếu gửi tới các route CRUD.
   */
  issueMfaChallengeToken(user, customExpiresIn) {
    const payload = {
      sub: user.id,
      email: user.email,
      purpose: 'mfa_challenge',
      tv: typeof user.tokenVersion === 'number' ? user.tokenVersion : 0
    };

    return jwt.sign(payload, this.getJwtSecret(), {
      algorithm: 'HS256',
      expiresIn: customExpiresIn || POLICY.MFA_CHALLENGE_EXPIRES_IN
    });
  }

  async verifyMfaChallengeToken(rawChallenge) {
    if (!rawChallenge || typeof rawChallenge !== 'string' || !rawChallenge.trim()) {
      return { valid: false, message: 'Thiếu mã phiên chờ MFA (challenge).' };
    }

    let payload;
    try {
      payload = jwt.verify(rawChallenge.trim(), this.getJwtSecret(), {
        algorithms: ['HS256']
      });
    } catch (_) {
      return { valid: false, message: 'Phiên chờ MFA đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' };
    }

    if (!payload || payload.purpose !== 'mfa_challenge' || !payload.sub) {
      return { valid: false, message: 'Mã phiên chờ MFA không hợp lệ.' };
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) }
    });

    if (!user || user.status !== 'active') {
      return { valid: false, message: 'Tài khoản không tồn tại hoặc chưa kích hoạt.' };
    }

    const currentTv = typeof user.tokenVersion === 'number' ? user.tokenVersion : 0;
    const tokenTv = typeof payload.tv === 'number' ? payload.tv : 0;
    if (currentTv !== tokenTv) {
      return { valid: false, message: 'Phiên chờ MFA đã bị hủy.' };
    }

    return { valid: true, user };
  }

  /**
   * Kiểm tra yếu tố thứ hai (chấp nhận cả mã TOTP 6 số hoặc Recovery Code dùng 1 lần)
   */
  async verifyMfaFactor(user, rawCode) {
    const cleaned = String(rawCode || '').trim();
    if (!cleaned) {
      return { valid: false, reason: 'EMPTY' };
    }

    const digitsOnly = cleaned.replace(/\s+/g, '');
    if (/^\d{6}$/.test(digitsOnly)) {
      if (!user.mfaSecret) {
        return { valid: false, reason: 'NO_SECRET' };
      }
      const plainSecret = this.decryptMfaSecret(user.mfaSecret);
      if (!plainSecret) {
        return { valid: false, reason: 'DECRYPT_ERROR' };
      }

      const totpCheck = this.verifyTotpCode(plainSecret, digitsOnly, user.lastTotpStep);
      if (!totpCheck.valid) {
        return { valid: false, reason: totpCheck.reason };
      }

      // Cập nhật nguyên tử lastTotpStep để chặn dùng lại cùng mã trong cửa sổ 30s
      const updated = await prisma.user.updateMany({
        where: {
          id: user.id,
          OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: totpCheck.matchedStep } }]
        },
        data: {
          lastTotpStep: totpCheck.matchedStep
        }
      });

      if (updated.count !== 1) {
        return { valid: false, reason: 'REPLAYED' };
      }

      return {
        valid: true,
        method: 'totp',
        matchedStep: totpCheck.matchedStep
      };
    }

    // Nếu không phải 6 chữ số -> kiểm tra trong bảng RecoveryCode (mã dự phòng dùng 1 lần)
    const codeHash = this.hashRecoveryCode(cleaned);
    const now = new Date();

    const recoveryRecord = await prisma.recoveryCode.findFirst({
      where: {
        userId: user.id,
        codeHash,
        usedAt: null
      }
    });

    if (!recoveryRecord) {
      return { valid: false, reason: 'INVALID_RECOVERY_CODE' };
    }

    const consumed = await prisma.recoveryCode.updateMany({
      where: {
        id: recoveryRecord.id,
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: now
      }
    });

    if (consumed.count !== 1) {
      return { valid: false, reason: 'RECOVERY_CODE_ALREADY_USED' };
    }

    return {
      valid: true,
      method: 'recovery_code'
    };
  }

  /**
   * Bước 1 & 2 Thiết lập TOTP (Slide 50):
   * - Sinh secret ngẫu nhiên, lưu mã hóa AES-256 vào DB, giữ mfaEnabled = false
   * - Trả về secret nhập tay, otpauthUrl và ảnh QR dạng Data URL
   */
  async setupMfa(userId) {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user || user.status !== 'active') {
      return { status: 401, code: 'UNAUTHENTICATED', message: 'Tài khoản không hợp lệ.' };
    }

    if (user.mfaEnabled) {
      return {
        status: 200,
        code: 'MFA_ALREADY_ENABLED',
        message: 'Tài khoản của bạn đã bật xác thực 2 lớp (MFA).'
      };
    }

    const plainSecret = this.generateBase32Secret(16);
    const encryptedSecret = this.encryptMfaSecret(plainSecret);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: encryptedSecret,
        mfaEnabled: false,
        lastTotpStep: null
      }
    });

    const issuer = 'CrispyHouse';
    const label = `${issuer}:${user.email}`;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${plainSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      status: 200,
      code: 'MFA_SETUP_READY',
      data: {
        secret: plainSecret,
        otpauthUrl,
        qrCodeDataUrl
      }
    };
  }

  /**
   * Bước 3 & 4 Thiết lập TOTP (Slide 50, 54):
   * - Xác nhận bằng 1 mã 6 số từ ứng dụng Authenticator
   * - Mã đúng mới đặt mfaEnabled = true và phát hành 8 Recovery Code (chỉ hiện 1 lần, DB lưu hash)
   */
  async enableMfa(userId, rawCode) {
    const mfaKey = `mfa:user:${userId}`;
    const rateState = await this.getRateRecord(mfaKey, POLICY.MFA_WINDOW_MS);
    if (rateState.isLocked) {
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Bạn đã nhập sai mã quá nhiều lần. Vui lòng thử lại sau 5 phút.'
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user || user.status !== 'active') {
      return { status: 401, code: 'UNAUTHENTICATED', message: 'Tài khoản không hợp lệ.' };
    }

    if (user.mfaEnabled) {
      return {
        status: 200,
        code: 'MFA_ALREADY_ENABLED',
        message: 'Tài khoản đã bật xác thực 2 lớp (MFA).'
      };
    }

    if (!user.mfaSecret) {
      return {
        status: 200,
        code: 'MFA_NOT_INITIALIZED',
        message: 'Vui lòng khởi tạo mã QR trước khi xác nhận bật MFA.'
      };
    }

    const plainSecret = this.decryptMfaSecret(user.mfaSecret);
    const verifyRes = this.verifyTotpCode(plainSecret, rawCode, user.lastTotpStep);

    if (!verifyRes.valid) {
      const updatedRate = await this.incrementRateRecord(
        mfaKey,
        POLICY.MFA_WINDOW_MS,
        POLICY.MFA_MAX_ATTEMPTS,
        POLICY.MFA_LOCK_DURATION_MS
      );
      if (updatedRate.lockedUntil && updatedRate.lockedUntil > new Date()) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Bạn đã nhập sai mã quá 5 lần. Tài khoản tạm khóa thao tác MFA trong 5 phút.'
        };
      }
      return {
        status: 200,
        code: 'INVALID_MFA_CODE',
        message: 'Mã xác thực 6 số không đúng hoặc đã hết hạn. MFA chưa được bật.'
      };
    }

    const recoveryCodes = this.generateRecoveryCodes(POLICY.RECOVERY_CODES_COUNT);
    const recoveryRecords = recoveryCodes.map((c) => ({
      userId: user.id,
      codeHash: this.hashRecoveryCode(c),
      usedAt: null
    }));

    await prisma.$transaction([
      prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
      prisma.recoveryCode.createMany({ data: recoveryRecords }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          lastTotpStep: verifyRes.matchedStep
        }
      })
    ]);

    await this.resetRateRecord(mfaKey);

    return {
      status: 200,
      code: 'MFA_ENABLED',
      data: {
        mfaEnabled: true,
        recoveryCodes,
        message: 'Đã bật xác thực 2 lớp (MFA) thành công. Hãy lưu lại các mã dự phòng (chỉ hiển thị một lần duy nhất).'
      }
    };
  }

  /**
   * Bước 2 Đăng nhập với MFA (Slide 51, 52, 53, 54, 56):
   * - Nhận challenge + code (TOTP 6 số hoặc Recovery Code)
   * - Giới hạn 5 lần sai -> khóa tạm 5 phút (429 RATE_LIMITED)
   * - Chặn dùng lại cùng mã TOTP trong 30 giây và chặn dùng lại Recovery Code lần 2
   * - Thành công mới cấp accessToken đầy đủ
   */
  async verifyMfaLogin({ challenge, code }) {
    const challengeCheck = await this.verifyMfaChallengeToken(challenge);
    if (!challengeCheck.valid) {
      return {
        status: 200,
        code: 'MFA_CHALLENGE_EXPIRED',
        message: challengeCheck.message
      };
    }

    const user = challengeCheck.user;
    const mfaKey = `mfa:user:${user.id}`;
    const rateState = await this.getRateRecord(mfaKey, POLICY.MFA_WINDOW_MS);

    if (rateState.isLocked) {
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Tài khoản tạm thời bị khóa xác thực MFA do nhập sai quá 5 lần. Vui lòng thử lại sau 5 phút.'
      };
    }

    const factorRes = await this.verifyMfaFactor(user, code);
    if (!factorRes.valid) {
      const updatedRate = await this.incrementRateRecord(
        mfaKey,
        POLICY.MFA_WINDOW_MS,
        POLICY.MFA_MAX_ATTEMPTS,
        POLICY.MFA_LOCK_DURATION_MS
      );
      if (updatedRate.lockedUntil && updatedRate.lockedUntil > new Date()) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Tài khoản tạm thời bị khóa xác thực MFA do nhập sai quá 5 lần. Vui lòng thử lại sau 5 phút.'
        };
      }
      return {
        status: 200,
        code: 'INVALID_MFA_CODE',
        message:
          factorRes.reason === 'REPLAYED'
            ? 'Mã TOTP này đã được sử dụng trong bước 30 giây hiện tại. Vui lòng đợi mã mới.'
            : 'Mã xác thực TOTP hoặc Recovery Code không hợp lệ hoặc đã được sử dụng.'
      };
    }

    await this.resetRateRecord(mfaKey);
    const accessToken = this.issueAccessToken(user);

    return {
      status: 200,
      code: 'LOGIN_SUCCESS',
      accessToken,
      usedRecoveryCode: factorRes.method === 'recovery_code',
      user: {
        id: user.id,
        email: user.email,
        rawEmail: user.rawEmail || user.email,
        name: user.name || user.email.split('@')[0],
        role: user.role,
        chefId: user.chefId || null,
        mfaEnabled: Boolean(user.mfaEnabled),
        status: user.status
      }
    };
  }

  /**
   * Tắt MFA (Slide 55):
   * - Yêu cầu xác thực lại bằng cả Password hiện tại VÀ một mã TOTP hoặc Recovery Code
   */
  async disableMfa({ userId, password, code }) {
    const mfaKey = `mfa:user:${userId}`;
    const rateState = await this.getRateRecord(mfaKey, POLICY.MFA_WINDOW_MS);
    if (rateState.isLocked) {
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Tài khoản đang tạm khóa thao tác MFA. Vui lòng thử lại sau 5 phút.'
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user || user.status !== 'active') {
      return { status: 401, code: 'UNAUTHENTICATED', message: 'Tài khoản không hợp lệ.' };
    }

    if (!user.mfaEnabled) {
      return {
        status: 200,
        code: 'MFA_NOT_ENABLED',
        message: 'Tài khoản chưa bật MFA.'
      };
    }

    if (!password || typeof password !== 'string') {
      return {
        status: 200,
        code: 'INVALID_CREDENTIALS',
        message: 'Vui lòng nhập mật khẩu hiện tại để xác nhận tắt MFA.'
      };
    }

    const isPasswordOk = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordOk) {
      const updatedRate = await this.incrementRateRecord(
        mfaKey,
        POLICY.MFA_WINDOW_MS,
        POLICY.MFA_MAX_ATTEMPTS,
        POLICY.MFA_LOCK_DURATION_MS
      );
      if (updatedRate.lockedUntil && updatedRate.lockedUntil > new Date()) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Đã vượt quá số lần thử xác thực. Vui lòng thử lại sau 5 phút.'
        };
      }
      return {
        status: 200,
        code: 'INVALID_CREDENTIALS',
        message: 'Mật khẩu hiện tại không đúng.'
      };
    }

    const factorRes = await this.verifyMfaFactor(user, code);
    if (!factorRes.valid) {
      const updatedRate = await this.incrementRateRecord(
        mfaKey,
        POLICY.MFA_WINDOW_MS,
        POLICY.MFA_MAX_ATTEMPTS,
        POLICY.MFA_LOCK_DURATION_MS
      );
      if (updatedRate.lockedUntil && updatedRate.lockedUntil > new Date()) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Đã vượt quá số lần thử xác thực. Vui lòng thử lại sau 5 phút.'
        };
      }
      return {
        status: 200,
        code: 'INVALID_MFA_CODE',
        message: 'Mã xác thực TOTP hoặc Recovery Code không hợp lệ.'
      };
    }

    await prisma.$transaction([
      prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          lastTotpStep: null
        }
      })
    ]);

    await this.resetRateRecord(mfaKey);

    return {
      status: 200,
      code: 'MFA_DISABLED',
      data: {
        mfaEnabled: false,
        message: 'Đã tắt xác thực 2 lớp (MFA) thành công.'
      }
    };
  }

  /**
   * Tạo lại bộ Recovery Code mới (Slide 54, 55):
   * - Yêu cầu nhập lại Password hiện tại + Mã TOTP hoặc Recovery Code
   * - Sinh bộ mới thì xóa toàn bộ bộ cũ trong DB
   */
  async regenerateRecoveryCodes({ userId, password, code }) {
    const mfaKey = `mfa:user:${userId}`;
    const rateState = await this.getRateRecord(mfaKey, POLICY.MFA_WINDOW_MS);
    if (rateState.isLocked) {
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Tài khoản đang tạm khóa thao tác MFA. Vui lòng thử lại sau 5 phút.'
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user || user.status !== 'active') {
      return { status: 401, code: 'UNAUTHENTICATED', message: 'Tài khoản không hợp lệ.' };
    }

    if (!user.mfaEnabled) {
      return {
        status: 200,
        code: 'MFA_NOT_ENABLED',
        message: 'Tài khoản chưa bật MFA.'
      };
    }

    if (!password || typeof password !== 'string') {
      return {
        status: 200,
        code: 'INVALID_CREDENTIALS',
        message: 'Vui lòng nhập mật khẩu hiện tại để tạo lại mã dự phòng.'
      };
    }

    const isPasswordOk = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordOk) {
      const updatedRate = await this.incrementRateRecord(
        mfaKey,
        POLICY.MFA_WINDOW_MS,
        POLICY.MFA_MAX_ATTEMPTS,
        POLICY.MFA_LOCK_DURATION_MS
      );
      if (updatedRate.lockedUntil && updatedRate.lockedUntil > new Date()) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Đã vượt quá số lần thử xác thực. Vui lòng thử lại sau 5 phút.'
        };
      }
      return {
        status: 200,
        code: 'INVALID_CREDENTIALS',
        message: 'Mật khẩu hiện tại không đúng.'
      };
    }

    const factorRes = await this.verifyMfaFactor(user, code);
    if (!factorRes.valid) {
      const updatedRate = await this.incrementRateRecord(
        mfaKey,
        POLICY.MFA_WINDOW_MS,
        POLICY.MFA_MAX_ATTEMPTS,
        POLICY.MFA_LOCK_DURATION_MS
      );
      if (updatedRate.lockedUntil && updatedRate.lockedUntil > new Date()) {
        return {
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Đã vượt quá số lần thử xác thực. Vui lòng thử lại sau 5 phút.'
        };
      }
      return {
        status: 200,
        code: 'INVALID_MFA_CODE',
        message: 'Mã xác thực TOTP hoặc Recovery Code không hợp lệ.'
      };
    }

    const newCodes = this.generateRecoveryCodes(POLICY.RECOVERY_CODES_COUNT);
    const records = newCodes.map((c) => ({
      userId: user.id,
      codeHash: this.hashRecoveryCode(c),
      usedAt: null
    }));

    await prisma.$transaction([
      prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
      prisma.recoveryCode.createMany({ data: records })
    ]);

    await this.resetRateRecord(mfaKey);

    return {
      status: 200,
      code: 'RECOVERY_CODES_REGENERATED',
      data: {
        recoveryCodes: newCodes,
        message: 'Đã tạo bộ mã dự phòng mới. Toàn bộ mã dự phòng cũ đã bị vô hiệu hóa.'
      }
    };
  }
}

module.exports = new AuthService();
