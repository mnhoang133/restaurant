process.env.FORCE_TEST_RECAPTCHA = 'true';
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../src/app');
const prisma = require('../src/config/db');
const authService = require('../src/services/auth.service');

const OUTBOX_FILE = path.join(__dirname, '../.mailbox/outbox.json');

function getLatestOutboxMail(toEmail, type) {
  if (!fs.existsSync(OUTBOX_FILE)) return null;
  const list = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8'));
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].to === toEmail && list[i].type === type) {
      return list[i];
    }
  }
  return null;
}

async function runTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  let passed = 0;
  let failed = 0;

  function assert(cond, label, detail = '') {
    if (cond) {
      passed++;
      console.log(`[PASS] ${label}`);
    } else {
      failed++;
      console.error(`[FAIL] ${label} ${detail}`);
    }
  }

  try {
    const testEmail = `csr.jwt.${Date.now()}@example.com`;
    await prisma.loginAttempt.deleteMany({});

    // 1. Public GET /api/dishes không cần token -> 200
    const resGet = await fetch(`${baseUrl}/dishes`);
    const bodyGet = await resGet.json();
    assert(resGet.status === 200 && bodyGet.ok === true, '1. Public GET /api/dishes hoạt động không cần JWT (200)');

    // 2. Gọi POST /api/dishes không có token -> 401 UNAUTHENTICATED
    const resUnauthPost = await fetch(`${baseUrl}/dishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' })
    });
    const bodyUnauthPost = await resUnauthPost.json();
    assert(
      resUnauthPost.status === 401 && bodyUnauthPost.ok === false && bodyUnauthPost.error.code === 'UNAUTHENTICATED',
      '2. POST /api/dishes không kèm Bearer token bị chặn HTTP 401 UNAUTHENTICATED'
    );

    // 3. CORS Preflight OPTIONS /api/dishes với Authorization -> 204
    const resOptions = await fetch(`${baseUrl}/dishes`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      }
    });
    assert(resOptions.status === 204, '3. CORS Preflight OPTIONS với header Authorization trả HTTP 204');

    // 4. Đăng ký tài khoản mới kèm CAPTCHA
    const resReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'CSR Tester',
        email: testEmail,
        password: 'Password123',
        confirmPassword: 'Password123',
        captchaToken: `register_valid_${Date.now()}`
      })
    });
    const bodyReg = await resReg.json();
    assert(resReg.status === 200 && bodyReg.ok === true, '4. POST /api/auth/register thành công với CAPTCHA hợp lệ');

    // 5. Đăng nhập khi tài khoản đang pending -> bị chặn ACCOUNT_NOT_ACTIVATED, không có accessToken
    const resPendingLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'Password123' })
    });
    const bodyPendingLogin = await resPendingLogin.json();
    assert(
      resPendingLogin.status === 200 &&
        bodyPendingLogin.ok === false &&
        bodyPendingLogin.error.code === 'ACCOUNT_NOT_ACTIVATED' &&
        !bodyPendingLogin.data,
      '5. Đăng nhập tài khoản pending trả ACCOUNT_NOT_ACTIVATED và không cấp JWT'
    );

    // 6. Kích hoạt tài khoản bằng OTP mới nhất trong outbox
    const otpMail = getLatestOutboxMail(testEmail, 'ACTIVATION_OTP');
    const resAct = await fetch(`${baseUrl}/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: otpMail.otpCode })
    });
    const bodyAct = await resAct.json();
    assert(resAct.status === 200 && bodyAct.ok === true, '6. POST /api/auth/activate kích hoạt OTP thành công');

    // 7. Đăng nhập thành công -> nhận accessToken (HS256)
    const resLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'Password123' })
    });
    const bodyLogin = await resLogin.json();
    const token = bodyLogin.data && bodyLogin.data.accessToken;
    assert(
      resLogin.status === 200 && bodyLogin.ok === true && typeof token === 'string' && token.split('.').length === 3,
      '7. POST /api/auth/login trả accessToken JWT hợp lệ'
    );

    // 8. Gọi GET /api/auth/me kèm Bearer token -> 200
    const resMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const bodyMe = await resMe.json();
    assert(
      resMe.status === 200 && bodyMe.ok === true && bodyMe.data.user.email === testEmail,
      '8. GET /api/auth/me khôi phục đúng thông tin user từ Bearer token'
    );

    // 9. Sửa 1 ký tự chữ ký JWT -> 401 UNAUTHENTICATED
    const tamperedToken = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    const resTampered = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tamperedToken}` }
    });
    const bodyTampered = await resTampered.json();
    assert(
      resTampered.status === 401 && bodyTampered.error.code === 'UNAUTHENTICATED',
      '9. Token bị sửa chữ ký bị chặn HTTP 401 UNAUTHENTICATED'
    );

    // 10. Token hết hạn exp -> 401 TOKEN_EXPIRED
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    const expiredToken = authService.issueAccessToken(dbUser, '-5s');
    const resExpired = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    const bodyExpired = await resExpired.json();
    assert(
      resExpired.status === 401 && bodyExpired.error.code === 'TOKEN_EXPIRED',
      '10. Token hết hạn exp trả đúng HTTP 401 TOKEN_EXPIRED'
    );

    // 11. Quên mật khẩu & Đặt lại mật khẩu -> Tăng tokenVersion -> Token cũ bị thu hồi ngay lập tức
    await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    });
    const resetMail = getLatestOutboxMail(testEmail, 'PASSWORD_RESET_LINK');
    const resReset = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetMail.token,
        password: 'NewPassword456',
        confirmPassword: 'NewPassword456'
      })
    });
    const bodyReset = await resReset.json();
    const resOldTokenAfterReset = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(
      resReset.status === 200 && bodyReset.ok === true && resOldTokenAfterReset.status === 401,
      '11. Sau khi Reset Password, JWT cũ đang còn hạn bị thu hồi ngay lập tức (HTTP 401)'
    );

    // 12. Brute-force Login: Sai 3 lần yêu cầu CAPTCHA, sai 5 lần trả HTTP 429 RATE_LIMITED
    const bfEmail = `bf.${Date.now()}@example.com`;
    await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bfEmail, password: 'Wrong1' })
    });
    await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bfEmail, password: 'Wrong2' })
    });
    const resFail3 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bfEmail, password: 'Wrong3' })
    });
    const bodyFail3 = await resFail3.json();

    // Lần 3 gửi thiếu CAPTCHA -> bị chặn CAPTCHA_REQUIRED
    const resNoCaptchaAfter3 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bfEmail, password: 'Wrong4' })
    });
    const bodyNoCaptchaAfter3 = await resNoCaptchaAfter3.json();

    // Lần 4, 5 kèm CAPTCHA nhưng vẫn sai password -> khóa 429
    await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bfEmail,
        password: 'Wrong4',
        captchaToken: `login_valid_4_${Date.now()}`
      })
    });
    const resFail5 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bfEmail,
        password: 'Wrong5',
        captchaToken: `login_valid_5_${Date.now()}`
      })
    });

    assert(
      bodyFail3.error.requireCaptcha === true &&
        bodyNoCaptchaAfter3.error.code === 'CAPTCHA_REQUIRED' &&
        resFail5.status === 429,
      '12. Chống Brute-force: Sai 3 lần bật CAPTCHA_REQUIRED, sai 5 lần khóa HTTP 429 RATE_LIMITED'
    );

    // Dọn dữ liệu test
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.loginAttempt.deleteMany({});

    console.log(`\nCHECKPOINT_3_SUMMARY: PASSED=${passed}/12 FAILED=${failed}`);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('TEST_ERROR:', err);
  process.exit(1);
});
