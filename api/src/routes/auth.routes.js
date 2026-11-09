const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// 1. Đăng ký & Kích hoạt OTP
router.post('/register', (req, res, next) => authController.register(req, res, next));
router.post('/activate', (req, res, next) => authController.activate(req, res, next));
router.post('/resend-otp', (req, res, next) => authController.resendOtp(req, res, next));

// 2. Đăng nhập, Khôi phục phiên & Đăng xuất JWT
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));
router.post('/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));

// 3. Quên mật khẩu & Đặt lại mật khẩu
router.post('/forgot-password', (req, res, next) => authController.forgotPassword(req, res, next));
router.get('/reset-password/verify', (req, res, next) => authController.verifyResetToken(req, res, next));
router.post('/reset-password', (req, res, next) => authController.resetPassword(req, res, next));

module.exports = router;
