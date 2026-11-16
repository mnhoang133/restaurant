const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// 1. Đăng ký & Kích hoạt OTP
router.post('/register', (req, res, next) => authController.register(req, res, next));
router.post('/activate', (req, res, next) => authController.activate(req, res, next));
router.post('/resend-otp', (req, res, next) => authController.resendOtp(req, res, next));
router.post('/activate/resend', (req, res, next) => authController.resendOtp(req, res, next)); // alias theo Slide 17

// 2. Đăng nhập, Khôi phục phiên & Đăng xuất JWT
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));
router.post('/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));

// 3. Quên mật khẩu & Đặt lại mật khẩu (hỗ trợ cả /forgot-password và alias /forgot, /reset)
router.post('/forgot-password', (req, res, next) => authController.forgotPassword(req, res, next));
router.post('/forgot', (req, res, next) => authController.forgotPassword(req, res, next)); // alias theo Slide 18
router.get('/reset-password/verify', (req, res, next) => authController.verifyResetToken(req, res, next));
router.post('/reset-password', (req, res, next) => authController.resetPassword(req, res, next));
router.post('/reset', (req, res, next) => authController.resetPassword(req, res, next)); // alias theo Slide 18

// 4. Xác thực nhiều yếu tố MFA / TOTP & Recovery Code (Bài 2 Khối 9 - Slide 50-56, 64)
router.post('/mfa', (req, res, next) => authController.verifyMfa(req, res, next));
router.post('/mfa/verify', (req, res, next) => authController.verifyMfa(req, res, next)); // alias
router.post('/mfa/setup', requireAuth, (req, res, next) => authController.setupMfa(req, res, next));
router.post('/mfa/enable', requireAuth, (req, res, next) => authController.enableMfa(req, res, next));
router.post('/mfa/disable', requireAuth, (req, res, next) => authController.disableMfa(req, res, next));
router.post('/mfa/recovery-codes', requireAuth, (req, res, next) => authController.regenerateRecoveryCodes(req, res, next));
router.post('/mfa/recovery-codes/regenerate', requireAuth, (req, res, next) => authController.regenerateRecoveryCodes(req, res, next)); // alias

module.exports = router;
