/**
 * SCRIPT KIỂM THỬ NGHIỆM THU BÀI 2 KHỐI 9: PHÂN QUYỀN (RBAC + ABAC 4 CỔNG) & MFA (TOTP + RECOVERY CODE)
 * Chạy độc lập bằng request HTTP trực tiếp tới Express Server (không qua giao diện) theo đúng yêu cầu Slide 66, 67, 68.
 */

require('dotenv').config();
const assert = require('assert');
const app = require('../src/app');
const prisma = require('../src/config/db');
const authService = require('../src/services/auth.service');

async function runTests() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(method, path, { token = null, body = undefined } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let json = null;
    try {
      json = await res.json();
    } catch (_) {
      json = null;
    }

    return { status: res.status, json };
  }

  console.log('================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ NGHIỆM THU BÀI 2: PHÂN QUYỀN (RBAC/ABAC) & MFA');
  console.log('================================================================');

  try {
    const pass = process.env.SEED_USER_PASSWORD || 'Restaurant@2026';

    // Chuẩn bị sạch trạng thái MFA và Rate Limit cho 4 tài khoản seed trước khi test
    const seedEmails = [
      'admin@restaurant.local',
      'editor1@restaurant.local',
      'editor2@restaurant.local',
      'viewer@restaurant.local',
    ];

    for (const email of seedEmails) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) {
        await prisma.recoveryCode.deleteMany({ where: { userId: u.id } });
        await prisma.user.update({
          where: { id: u.id },
          data: { mfaEnabled: false, mfaSecret: null, lastTotpStep: null },
        });
        await authService.resetRateRecord(`login:email:${email}`);
        await authService.resetRateRecord(`mfa:user:${u.id}`);
      }
    }

    // ----------------------------------------------------------------
    // PHẦN A: NGHIỆM THU PHÂN QUYỀN RBAC & ABAC (4 CỔNG - SLIDE 67)
    // ----------------------------------------------------------------
    console.log('\n--- [PHẦN A] KIỂM THỬ PHÂN QUYỀN RBAC & ABAC (4 CỔNG) ---');

    // 1. Đăng nhập lấy token của 4 role
    const loginAdmin = await request('POST', '/api/auth/login', {
      body: { email: 'admin@restaurant.local', password: pass },
    });
    const loginEd1 = await request('POST', '/api/auth/login', {
      body: { email: 'editor1@restaurant.local', password: pass },
    });
    const loginEd2 = await request('POST', '/api/auth/login', {
      body: { email: 'editor2@restaurant.local', password: pass },
    });
    const loginViewer = await request('POST', '/api/auth/login', {
      body: { email: 'viewer@restaurant.local', password: pass },
    });

    assert.strictEqual(loginAdmin.json.ok, true, 'Admin login failed');
    assert.strictEqual(loginEd1.json.ok, true, 'Editor 1 login failed');
    assert.strictEqual(loginEd2.json.ok, true, 'Editor 2 login failed');
    assert.strictEqual(loginViewer.json.ok, true, 'Viewer login failed');

    const tAdmin = loginAdmin.json.data.accessToken;
    const tEd1 = loginEd1.json.data.accessToken;
    const tEd2 = loginEd2.json.data.accessToken;
    const tViewer = loginViewer.json.data.accessToken;
    const ed1ChefId = loginEd1.json.data.user.chefId;
    const ed2ChefId = loginEd2.json.data.user.chefId;

    // Kịch bản A1 (Cổng 1): Chưa đăng nhập gọi thao tác ghi -> 401 UNAUTHENTICATED
    const a1 = await request('POST', '/api/dishes', {
      body: { name: 'Món Không Token', price: 50000, category: 'Gà Rán' },
    });
    assert.strictEqual(a1.status, 401);
    assert.strictEqual(a1.json.error.code, 'UNAUTHENTICATED');
    console.log('✔ [A1 - Cổng 1] Chưa đăng nhập gọi POST /api/dishes -> 401 UNAUTHENTICATED');

    // Kịch bản A2 (Cổng 2 RBAC): Viewer cố tình Thêm / Sửa / Xóa -> 403 FORBIDDEN
    const a2Post = await request('POST', '/api/dishes', {
      token: tViewer,
      body: { name: 'Viewer Tạo Món', price: 50000, category: 'Gà Rán' },
    });
    assert.strictEqual(a2Post.status, 403);
    assert.strictEqual(a2Post.json.error.code, 'FORBIDDEN');
    console.log('✔ [A2 - Cổng 2 RBAC] Viewer gửi POST /api/dishes -> 403 FORBIDDEN');

    // Kịch bản A3 (Mass Assignment): Editor 1 tạo món cố tình gửi kèm status="published" và chefId của Editor 2
    const a3Create = await request('POST', '/api/dishes', {
      token: tEd1,
      body: {
        name: 'Gà Giòn Thử Nghiệm ABAC',
        price: 69000,
        category: 'Gà Rán',
        chefId: ed2ChefId,
        status: 'published',
      },
    });
    assert.strictEqual(a3Create.status, 200);
    assert.strictEqual(a3Create.json.ok, true);
    assert.strictEqual(a3Create.json.data.chefId, ed1ChefId, 'Server phải ép chefId theo tài khoản Editor 1');
    assert.strictEqual(a3Create.json.data.status, 'draft', 'Server phải ép status="draft" khi Editor tạo món');
    const testDishId = a3Create.json.data.id;
    console.log(`✔ [A3 - Chống Mass Assignment] Editor 1 tạo món kèm chefId=${ed2ChefId}, status="published" -> Server ép về chefId=${ed1ChefId}, status="draft"`);

    // Kịch bản A4 (Cổng 2 RBAC): Editor 1 cố tình Xóa món của chính mình -> 403 FORBIDDEN
    const a4Del = await request('DELETE', `/api/dishes/${testDishId}`, { token: tEd1 });
    assert.strictEqual(a4Del.status, 403);
    assert.strictEqual(a4Del.json.error.code, 'FORBIDDEN');
    console.log('✔ [A4 - Cổng 2 RBAC] Editor 1 gửi DELETE /api/dishes/:id -> 403 FORBIDDEN');

    // Kịch bản A5 (Cổng 3): Editor 1 sửa món không tồn tại -> 200 NOT_FOUND
    const a5NotFound = await request('PATCH', '/api/dishes/9999999', {
      token: tEd1,
      body: { name: 'Không tồn tại' },
    });
    assert.strictEqual(a5NotFound.status, 200);
    assert.strictEqual(a5NotFound.json.ok, false);
    assert.strictEqual(a5NotFound.json.error.code, 'NOT_FOUND');
    console.log('✔ [A5 - Cổng 3] Sửa món không tồn tại -> NOT_FOUND');

    // Kịch bản A6 (Cổng 4 ABAC - Khác chủ): Editor 2 cố tình sửa món draft của Editor 1 -> 403 FORBIDDEN
    const a6WrongOwner = await request('PATCH', `/api/dishes/${testDishId}`, {
      token: tEd2,
      body: { name: 'Editor 2 Sửa Trộm' },
    });
    assert.strictEqual(a6WrongOwner.status, 403);
    assert.strictEqual(a6WrongOwner.json.error.code, 'FORBIDDEN');
    console.log('✔ [A6 - Cổng 4 ABAC] Editor 2 sửa món draft của Editor 1 -> 403 FORBIDDEN');

    // Kịch bản A7 (Cổng 4 ABAC - Đúng chủ + còn draft):
    // - A7a: Editor 1 sửa tên/giá món draft của mình -> 200 OK
    // - A7b: Editor 1 cố sửa status của món mình sở hữu -> 403 FORBIDDEN (Thiếu quyền)
    // - A7c: Editor 1 cố đổi chefId của món mình sở hữu -> 403 FORBIDDEN (Thiếu quyền)
    const a7OwnDraft = await request('PATCH', `/api/dishes/${testDishId}`, {
      token: tEd1,
      body: { name: 'Gà Giòn Đã Sửa Hợp Lệ' },
    });
    assert.strictEqual(a7OwnDraft.status, 200);
    assert.strictEqual(a7OwnDraft.json.ok, true);
    assert.strictEqual(a7OwnDraft.json.data.name, 'Gà Giòn Đã Sửa Hợp Lệ');
    assert.strictEqual(a7OwnDraft.json.data.status, 'draft');
    assert.strictEqual(a7OwnDraft.json.data.chefId, ed1ChefId);

    const a7ChangeStatus = await request('PATCH', `/api/dishes/${testDishId}`, {
      token: tEd1,
      body: { status: 'published' },
    });
    assert.strictEqual(a7ChangeStatus.status, 403);
    assert.strictEqual(a7ChangeStatus.json.error.code, 'FORBIDDEN');

    const a7ChangeChefId = await request('PATCH', `/api/dishes/${testDishId}`, {
      token: tEd1,
      body: { chefId: ed2ChefId },
    });
    assert.strictEqual(a7ChangeChefId.status, 403);
    assert.strictEqual(a7ChangeChefId.json.error.code, 'FORBIDDEN');
    console.log('✔ [A7 - Cổng 4 ABAC] Editor 1 sửa thông tin món draft của mình -> 200 OK; cố đổi status hoặc chefId -> 403 FORBIDDEN (Thiếu quyền)');

    // Kịch bản A8 (TOCTOU Race Condition): Editor 1 đang mở form sửa, Admin đổi món sang published, Editor 1 bấm PATCH -> 403 FORBIDDEN
    const adminPublish = await request('PATCH', `/api/dishes/${testDishId}`, {
      token: tAdmin,
      body: { status: 'published' },
    });
    assert.strictEqual(adminPublish.status, 200);
    assert.strictEqual(adminPublish.json.data.status, 'published');

    const a8Toctou = await request('PATCH', `/api/dishes/${testDishId}`, {
      token: tEd1,
      body: { name: 'Editor 1 Cố Sửa Sau Khi Published' },
    });
    assert.strictEqual(a8Toctou.status, 403);
    assert.strictEqual(a8Toctou.json.error.code, 'FORBIDDEN');
    console.log('✔ [A8 - Cổng 4 ABAC & TOCTOU] Admin đổi món sang published -> Editor 1 gửi PATCH bị chặn 403 FORBIDDEN');

    // Kịch bản A9: Admin sửa được cả món đã published của đầu bếp khác và xóa được món
    const a9AdminEdit = await request('PATCH', `/api/dishes/${testDishId}`, {
      token: tAdmin,
      body: { name: 'Admin Sửa Món Published', chefId: ed2ChefId },
    });
    assert.strictEqual(a9AdminEdit.status, 200);
    assert.strictEqual(a9AdminEdit.json.data.chefId, ed2ChefId);

    const a9AdminDel = await request('DELETE', `/api/dishes/${testDishId}`, { token: tAdmin });
    assert.strictEqual(a9AdminDel.status, 200);
    assert.strictEqual(a9AdminDel.json.ok, true);
    console.log('✔ [A9 - Quyền Admin] Admin sửa món published của bếp khác và xóa món -> 200 OK');

    // ----------------------------------------------------------------
    // PHẦN B: NGHIỆM THU MFA (TOTP + RECOVERY CODE - SLIDE 68)
    // ----------------------------------------------------------------
    console.log('\n--- [PHẦN B] KIỂM THỬ XÁC THỰC NHIỀU YẾU TỐ (MFA TOTP & RECOVERY CODE) ---');

    // Dùng tài khoản viewer@restaurant.local để kiểm thử vòng đời MFA
    const viewerUser = await prisma.user.findUnique({ where: { email: 'viewer@restaurant.local' } });

    // Kịch bản B1: Khởi tạo Setup MFA (Bước 1 & 2) -> mfaEnabled vẫn là false, mfaSecret lưu mã hóa AES-256
    const b1Setup = await request('POST', '/api/auth/mfa/setup', { token: tViewer, body: {} });
    assert.strictEqual(b1Setup.status, 200);
    assert.strictEqual(b1Setup.json.ok, true);
    assert.ok(b1Setup.json.data.secret, 'Phải trả về secret Base32');
    assert.ok(b1Setup.json.data.qrCodeDataUrl.startsWith('data:image/png;base64,'), 'Phải trả về ảnh QR');

    const dbUserAfterSetup = await prisma.user.findUnique({ where: { id: viewerUser.id } });
    assert.strictEqual(dbUserAfterSetup.mfaEnabled, false, 'mfaEnabled phải là false khi chưa xác nhận mã');
    assert.ok(dbUserAfterSetup.mfaSecret.startsWith('enc:v1:'), 'mfaSecret trong DB phải được mã hóa AES-256');
    console.log('✔ [B1 - Thiết lập MFA Bước 1&2] Tạo QR & Secret mã hóa AES-256, giữ mfaEnabled = false');

    // Kịch bản B2: Nhập sai mã xác nhận bật MFA -> từ chối, mfaEnabled vẫn false
    const b2WrongEnable = await request('POST', '/api/auth/mfa/enable', {
      token: tViewer,
      body: { code: '000000' },
    });
    assert.strictEqual(b2WrongEnable.status, 200);
    assert.strictEqual(b2WrongEnable.json.ok, false);
    assert.strictEqual(b2WrongEnable.json.error.code, 'INVALID_MFA_CODE');
    await authService.resetRateRecord(`mfa:user:${viewerUser.id}`);

    // Kịch bản B3: Nhập đúng mã 6 số ở bước (nowStep - 1) -> Bật MFA = true & phát 8 Recovery Code
    const nowStep = Math.floor(Date.now() / 1000 / 30);
    const codeStepMinus1 = authService.computeTotpAtStep(b1Setup.json.data.secret, nowStep - 1);
    const b3Enable = await request('POST', '/api/auth/mfa/enable', {
      token: tViewer,
      body: { code: codeStepMinus1 },
    });
    assert.strictEqual(b3Enable.status, 200);
    assert.strictEqual(b3Enable.json.ok, true);
    assert.strictEqual(b3Enable.json.data.mfaEnabled, true);
    assert.strictEqual(b3Enable.json.data.recoveryCodes.length, 8);
    const recoveryCodes = b3Enable.json.data.recoveryCodes;
    console.log('✔ [B2 & B3 - Bật MFA Bước 3&4] Xác nhận đúng mã 6 số -> mfaEnabled = true, cấp 8 Recovery Code (lưu hash trong DB)');

    // Kịch bản B4: Đăng nhập bước 1 (đúng password) -> KHÔNG có accessToken, chỉ trả next: "mfa" và challenge
    const b4Login1 = await request('POST', '/api/auth/login', {
      body: { email: 'viewer@restaurant.local', password: pass },
    });
    assert.strictEqual(b4Login1.status, 200);
    assert.strictEqual(b4Login1.json.ok, true);
    assert.strictEqual(b4Login1.json.data.next, 'mfa');
    assert.strictEqual(b4Login1.json.data.accessToken, undefined, 'Tuyệt đối không được trả accessToken trước MFA');
    assert.ok(b4Login1.json.data.challenge, 'Phải trả về challenge');
    const mfaChallenge = b4Login1.json.data.challenge;
    console.log('✔ [B4 - Trạng thái chờ MFA] Password đúng nhưng chưa OTP -> Không có accessToken, trả next: "mfa" + challenge');

    // Kịch bản B5: Cố tình dùng challenge như Bearer token gọi vào route bảo vệ (/api/auth/me hoặc /api/chefs POST) -> Bị chặn 401
    const b5Bypass = await request('GET', '/api/auth/me', { token: mfaChallenge });
    assert.strictEqual(b5Bypass.status, 401);
    assert.strictEqual(b5Bypass.json.error.code, 'UNAUTHENTICATED');
    console.log('✔ [B5 - Chặn đường vòng MFA] Gửi challenge vào route bảo vệ -> Bị từ chối 401 UNAUTHENTICATED');

    // Kịch bản B6: Chống dùng lại mã TOTP (Replay Attack) -> Nhập lại mã codeStepMinus1 vừa dùng -> Bị từ chối
    const b6Replay = await request('POST', '/api/auth/mfa', {
      body: { challenge: mfaChallenge, code: codeStepMinus1 },
    });
    assert.strictEqual(b6Replay.status, 200);
    assert.strictEqual(b6Replay.json.ok, false);
    assert.strictEqual(b6Replay.json.error.code, 'INVALID_MFA_CODE');
    await authService.resetRateRecord(`mfa:user:${viewerUser.id}`);
    console.log('✔ [B6 - Chống Replay TOTP] Dùng lại mã TOTP đã chấp nhận trong cùng cửa sổ -> Bị từ chối INVALID_MFA_CODE');

    // Kịch bản B7: Nhập mã TOTP của bước hiện tại (nowStep) -> Thành công, cấp accessToken đầy đủ
    const codeStepNow = authService.computeTotpAtStep(b1Setup.json.data.secret, nowStep);
    const b7MfaOk = await request('POST', '/api/auth/mfa', {
      body: { challenge: mfaChallenge, code: codeStepNow },
    });
    assert.strictEqual(b7MfaOk.status, 200);
    assert.strictEqual(b7MfaOk.json.ok, true);
    assert.ok(b7MfaOk.json.data.accessToken, 'Phải cấp accessToken khi TOTP hợp lệ');
    console.log('✔ [B7 - Hoàn tất MFA bằng TOTP] Nhập mã TOTP hợp lệ -> Cấp accessToken đầy đủ');

    // Kịch bản B8: Recovery Code dùng lần 1 thành công, dùng lại lần 2 bị từ chối
    const b8UsedOnce = await request('POST', '/api/auth/mfa', {
      body: { challenge: mfaChallenge, code: recoveryCodes[0] },
    });
    assert.strictEqual(b8UsedOnce.status, 200);
    assert.strictEqual(b8UsedOnce.json.ok, true);
    assert.strictEqual(b8UsedOnce.json.data.usedRecoveryCode, true);

    const b8UsedTwice = await request('POST', '/api/auth/mfa', {
      body: { challenge: mfaChallenge, code: recoveryCodes[0] },
    });
    assert.strictEqual(b8UsedTwice.status, 200);
    assert.strictEqual(b8UsedTwice.json.ok, false);
    assert.strictEqual(b8UsedTwice.json.error.code, 'INVALID_MFA_CODE');
    await authService.resetRateRecord(`mfa:user:${viewerUser.id}`);
    console.log('✔ [B8 - Recovery Code 1 lần] Dùng Recovery Code lần 1 thành công (ghi usedAt), dùng lần 2 bị từ chối');

    // Kịch bản B9: Brute-force nhập sai mã MFA 5 lần -> Lần thứ 5 trả 429 RATE_LIMITED (Khóa tạm)
    for (let i = 1; i <= 4; i++) {
      const wrongTry = await request('POST', '/api/auth/mfa', {
        body: { challenge: mfaChallenge, code: '999999' },
      });
      assert.strictEqual(wrongTry.status, 200);
      assert.strictEqual(wrongTry.json.error.code, 'INVALID_MFA_CODE');
    }
    const fifthTry = await request('POST', '/api/auth/mfa', {
      body: { challenge: mfaChallenge, code: '999999' },
    });
    assert.strictEqual(fifthTry.status, 429);
    assert.strictEqual(fifthTry.json.error.code, 'RATE_LIMITED');

    // Ngay cả khi nhập Recovery Code đúng trong lúc đang bị khóa tạm cũng phải bị từ chối 429
    const lockedTryWithValidCode = await request('POST', '/api/auth/mfa', {
      body: { challenge: mfaChallenge, code: recoveryCodes[1] },
    });
    assert.strictEqual(lockedTryWithValidCode.status, 429);
    assert.strictEqual(lockedTryWithValidCode.json.error.code, 'RATE_LIMITED');
    await authService.resetRateRecord(`mfa:user:${viewerUser.id}`);
    console.log('✔ [B9 - Chống Brute-force MFA] Nhập sai 5 lần -> Khóa tạm 429 RATE_LIMITED (kể cả nhập mã đúng ngay sau đó)');

    // Kịch bản B10: Sinh bộ Recovery Code mới -> Bộ cũ vô hiệu hoàn toàn
    const regenRes = await request('POST', '/api/auth/mfa/recovery-codes', {
      token: b7MfaOk.json.data.accessToken,
      body: { password: pass, code: recoveryCodes[1] },
    });
    assert.strictEqual(regenRes.status, 200);
    assert.strictEqual(regenRes.json.ok, true);
    const newRecoveryCodes = regenRes.json.data.recoveryCodes;
    assert.strictEqual(newRecoveryCodes.length, 8);

    // Thử dùng mã chưa dùng của bộ cũ (recoveryCodes[2]) -> Phải bị từ chối
    const oldCodeTry = await request('POST', '/api/auth/mfa', {
      body: { challenge: mfaChallenge, code: recoveryCodes[2] },
    });
    assert.strictEqual(oldCodeTry.status, 200);
    assert.strictEqual(oldCodeTry.json.ok, false);
    assert.strictEqual(oldCodeTry.json.error.code, 'INVALID_MFA_CODE');
    await authService.resetRateRecord(`mfa:user:${viewerUser.id}`);
    console.log('✔ [B10 - Sinh mới Recovery Code] Tạo bộ mã mới -> Các mã chưa dùng của bộ cũ lập tức bị vô hiệu hóa');

    // Kịch bản B11: Reset Password xong đăng nhập lại -> Vẫn phải qua bước MFA (Reset không tắt MFA)
    const rawResetToken = authService.generateResetToken();
    await prisma.passwordReset.create({
      data: {
        userId: viewerUser.id,
        tokenHash: authService.hashResetToken(rawResetToken),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      },
    });
    const newTempPass = 'NewPass@2026';
    const resetRes = await request('POST', '/api/auth/reset-password', {
      body: { token: rawResetToken, password: newTempPass, confirmPassword: newTempPass },
    });
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.json.ok, true);

    const loginAfterReset = await request('POST', '/api/auth/login', {
      body: { email: 'viewer@restaurant.local', password: newTempPass },
    });
    assert.strictEqual(loginAfterReset.status, 200);
    assert.strictEqual(loginAfterReset.json.ok, true);
    assert.strictEqual(loginAfterReset.json.data.next, 'mfa', 'Sau khi Reset Password vẫn phải yêu cầu MFA');
    assert.strictEqual(loginAfterReset.json.data.accessToken, undefined);
    console.log('✔ [B11 - Reset Password không tắt MFA] Đặt lại mật khẩu thành công, đăng nhập bằng mật khẩu mới vẫn qua bước chờ MFA');

    // Đăng nhập hoàn tất với newRecoveryCodes[0] và khôi phục mật khẩu + tắt MFA cho viewer
    const mfaAfterReset = await request('POST', '/api/auth/mfa', {
      body: { challenge: loginAfterReset.json.data.challenge, code: newRecoveryCodes[0] },
    });
    assert.strictEqual(mfaAfterReset.json.ok, true);
    const freshToken = mfaAfterReset.json.data.accessToken;

    // Kịch bản B12: Tắt MFA thiếu password hoặc sai mã -> Bị từ chối; đúng cả password + mã -> Tắt thành công
    const disableWrongPw = await request('POST', '/api/auth/mfa/disable', {
      token: freshToken,
      body: { password: 'WrongPassword123', code: newRecoveryCodes[1] },
    });
    assert.strictEqual(disableWrongPw.json.ok, false);
    assert.strictEqual(disableWrongPw.json.error.code, 'INVALID_CREDENTIALS');
    await authService.resetRateRecord(`mfa:user:${viewerUser.id}`);

    const disableOk = await request('POST', '/api/auth/mfa/disable', {
      token: freshToken,
      body: { password: newTempPass, code: newRecoveryCodes[1] },
    });
    assert.strictEqual(disableOk.status, 200);
    assert.strictEqual(disableOk.json.ok, true);
    assert.strictEqual(disableOk.json.data.mfaEnabled, false);
    console.log('✔ [B12 - Tắt MFA an toàn] Yêu cầu xác thực lại cả Password + Mã MFA mới cho phép tắt MFA');

    // Khôi phục lại mật khẩu gốc cho viewer@restaurant.local
    const origHash = await require('bcryptjs').hash(pass, 10);
    await prisma.user.update({
      where: { id: viewerUser.id },
      data: { passwordHash: origHash, tokenVersion: 0 },
    });

    console.log('\n================================================================');
    console.log('🎉 CHECKPOINT_4_OK: TẤT CẢ 21 TIÊU CHÍ NGHIỆM THU BÀI 2 PASS 100%!');
    console.log('================================================================');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
