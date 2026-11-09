const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const OUTBOX_DIR = path.join(__dirname, '../../.mailbox');
const OUTBOX_FILE = path.join(OUTBOX_DIR, 'outbox.json');

function ensureOutboxDir() {
  if (!fs.existsSync(OUTBOX_DIR)) {
    fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  }
}

function maskSecret(str, visiblePrefix = 2) {
  if (!str || typeof str !== 'string') return '******';
  if (str.length <= visiblePrefix) return '******';
  return str.slice(0, visiblePrefix) + '*'.repeat(Math.min(8, str.length - visiblePrefix));
}

/**
 * Luôn lưu mọi email (OTP, Reset Link, Thông báo) vào api/.mailbox/outbox.json
 * giúp kiểm tra nhanh mã OTP / link Reset cho cả những địa chỉ email giả / không tồn tại.
 */
function saveToLocalOutbox(mailRecord) {
  try {
    ensureOutboxDir();
    let list = [];
    if (fs.existsSync(OUTBOX_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8'));
        if (!Array.isArray(list)) list = [];
      } catch (_) {
        list = [];
      }
    }
    list.push(mailRecord);
    if (list.length > 100) {
      list = list.slice(list.length - 100);
    }
    fs.writeFileSync(OUTBOX_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (_) {
    // Bỏ qua lỗi ghi file hộp thư cục bộ nếu có
  }
}

/**
 * Khung HTML Marketing Email đồng bộ với bộ nhận diện thương hiệu CRISPY HOUSE (#C00707 & #F4F0EB)
 */
function buildCrispyHouseEmailLayout({ badgeText, title, bodyHtml }) {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f0eb; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1917;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f0eb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e6dfd5; box-shadow: 0 8px 24px rgba(28, 25, 23, 0.06);">
          
          <!-- Thanh Banner Đỏ Thương Hiệu CRISPY HOUSE -->
          <tr>
            <td style="background-color: #c00707; padding: 26px 32px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; letter-spacing: 3px; color: #ffffff; line-height: 1.1;">
                CRISPY HOUSE
              </div>
              <div style="font-size: 10px; font-weight: 600; letter-spacing: 4px; color: #fca5a5; margin-top: 6px; text-transform: uppercase;">
                Signature Fried Chicken &amp; Burgers
              </div>
            </td>
          </tr>

          <!-- Nội dung chính -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <div style="display: inline-block; background-color: #fef2f2; color: #c00707; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; padding: 5px 12px; border-radius: 999px; border: 1px solid #fecaca; margin-bottom: 16px;">
                ${badgeText}
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #1c1917; line-height: 1.35;">
                ${title}
              </h1>
              ${bodyHtml}
            </td>
          </tr>

          <!-- Chân trang (Footer) -->
          <tr>
            <td style="background-color: #faf7f2; border-top: 1px solid #ece5dc; padding: 22px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #44403c; letter-spacing: 0.5px;">
                CRISPY HOUSE VIETNAM
              </p>
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #78716c; line-height: 1.5;">
                Mở cửa: 09:00 - 22:30 mỗi ngày | Hotline miễn phí: 1900 8888
              </p>
              <p style="margin: 0; font-size: 11px; color: #a8a29e;">
                Đây là email tự động từ hệ thống bảo mật tài khoản. Vui lòng không trả lời trực tiếp email này.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

class MailService {
  constructor() {
    this.transporter = null;
    this.isRealSmtp = false;
    this.lastConfigKey = '';
    ensureOutboxDir();
    this._initTransporter();
  }

  _initTransporter() {
    let host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    if (!host || host.includes('@')) {
      host = 'smtp.gmail.com';
    }
    const port = Number(process.env.SMTP_PORT || 587);
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const configKey = `${host}:${port}:${user}:${pass ? 'set' : 'empty'}`;

    if (this.transporter && this.lastConfigKey === configKey) {
      return;
    }
    this.lastConfigKey = configKey;

    if (host && user && pass) {
      this.isRealSmtp = true;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
    } else {
      this.isRealSmtp = false;
      this.transporter = nodemailer.createTransport({
        jsonTransport: true
      });
    }
  }

  getFromAddress() {
    if (process.env.SMTP_FROM && process.env.SMTP_FROM.trim()) {
      return process.env.SMTP_FROM.trim();
    }
    if (process.env.SMTP_USER && process.env.SMTP_USER.trim()) {
      return `"CRISPY HOUSE" <${process.env.SMTP_USER.trim()}>`;
    }
    return '"CRISPY HOUSE" <no-reply@restaurant.local>';
  }

  getFrontendBaseUrl() {
    return (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
  }

  _isTestRecipient(toEmail) {
    const lower = String(toEmail || '').trim().toLowerCase();
    return lower.endsWith('@example.com') || lower.endsWith('.local');
  }

  async _deliverMail(mailOptions) {
    this._initTransporter();
    try {
      const previewPath = path.join(OUTBOX_DIR, 'latest-email-preview.html');
      if (mailOptions.html) {
        fs.writeFileSync(previewPath, mailOptions.html, 'utf8');
      }
    } catch (_) {
      // Bỏ qua nếu không ghi được file preview
    }

    if (this.isRealSmtp && !this._isTestRecipient(mailOptions.to)) {
      try {
        await this.transporter.sendMail(mailOptions);
        return 'SMTP that';
      } catch (smtpErr) {
        console.warn(`[MailService] Gui SMTP that bai (${smtpErr.message}), da luu ban sao tai .mailbox/outbox.json`);
        return 'Local Outbox Fallback (.mailbox/outbox.json)';
      }
    }
    return 'Local Outbox (.mailbox/outbox.json)';
  }

  /**
   * 1. Email gửi mã OTP kích hoạt tài khoản
   */
  async sendActivationOtpEmail(toEmail, otpCode, expiresMinutes = 10) {
    const subject = '[CRISPY HOUSE] Mã xác thực OTP kích hoạt tài khoản';
    const text = [
      'CRISPY HOUSE - XÁC THỰC TÀI KHOẢN',
      `Mã OTP kích hoạt tài khoản của bạn là: ${otpCode}`,
      `Mã có hiệu lực trong ${expiresMinutes} phút và chỉ sử dụng 1 lần duy nhất.`,
      'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.'
    ].join('\n');

    const bodyHtml = `
      <p style="margin: 0 0 18px 0; font-size: 15px; color: #44403c; line-height: 1.65;">
        Chào mừng bạn đến với <strong>CRISPY HOUSE</strong>. Để hoàn tất bước đăng ký và bảo vệ tài khoản của bạn, vui lòng nhập mã xác thực OTP gồm 6 chữ số dưới đây:
      </p>
      <div style="background-color: #fff8f6; border: 2px dashed #c00707; border-radius: 12px; padding: 22px 16px; text-align: center; margin: 24px 0;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #991b1b; margin-bottom: 8px;">
          Mã kích hoạt của bạn
        </div>
        <div style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #c00707; font-family: 'Courier New', Courier, monospace;">
          ${otpCode}
        </div>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #faf7f2; border-left: 4px solid #c00707; border-radius: 6px; padding: 12px 16px; margin-top: 16px;">
        <tr>
          <td style="font-size: 13px; color: #57534e; line-height: 1.55;">
            Mã này chỉ có hiệu lực trong <strong>${expiresMinutes} phút</strong> và tự động hủy sau khi sử dụng. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
          </td>
        </tr>
      </table>
    `;

    const html = buildCrispyHouseEmailLayout({
      badgeText: 'Xác minh tài khoản',
      title: 'Kích hoạt tài khoản CRISPY HOUSE',
      bodyHtml
    });

    saveToLocalOutbox({
      type: 'ACTIVATION_OTP',
      to: toEmail,
      subject,
      otpCode,
      maskedOtp: maskSecret(otpCode, 1),
      sentAt: new Date().toISOString()
    });

    const modeLabel = await this._deliverMail({
      from: this.getFromAddress(),
      to: toEmail,
      subject,
      text,
      html
    });

    console.log(`[MailService] [${modeLabel}] Da gui email OTP kich hoat toi ${toEmail} (OTP: ${maskSecret(otpCode, 1)})`);
  }

  /**
   * 2. Email gửi liên kết đặt lại mật khẩu
   */
  async sendPasswordResetEmail(toEmail, rawToken, expiresMinutes = 15) {
    const baseUrl = this.getFrontendBaseUrl();
    const resetLink = `${baseUrl}/#/reset-password?token=${encodeURIComponent(rawToken)}`;
    const maskedLink = `${baseUrl}/#/reset-password?token=${maskSecret(rawToken, 4)}`;

    const subject = '[CRISPY HOUSE] Yêu cầu đặt lại mật khẩu tài khoản';
    const text = [
      'CRISPY HOUSE - ĐẶT LẠI MẬT KHẨU',
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản gắn với địa chỉ email này.',
      `Mở liên kết sau để thiết lập mật khẩu mới (hiệu lực ${expiresMinutes} phút, chỉ dùng 1 lần):`,
      resetLink,
      'Nếu bạn không thực hiện yêu cầu này, tài khoản của bạn vẫn an toàn và bạn có thể bỏ qua email này.'
    ].join('\n');

    const bodyHtml = `
      <p style="margin: 0 0 18px 0; font-size: 15px; color: #44403c; line-height: 1.65;">
        Hệ thống <strong>CRISPY HOUSE</strong> vừa nhận được yêu cầu khôi phục mật khẩu cho tài khoản liên kết với địa chỉ <strong>${toEmail}</strong>.
      </p>
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #44403c; line-height: 1.65;">
        Nhấn vào nút bên dưới để tiến hành thiết lập mật khẩu mới:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}" style="display: inline-block; background-color: #c00707; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; padding: 14px 32px; border-radius: 999px; box-shadow: 0 4px 12px rgba(192, 7, 7, 0.25);">
          Thiết Lập Mật Khẩu Mới
        </a>
      </div>
      <div style="background-color: #faf7f2; border: 1px solid #ece5dc; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px;">
        <div style="font-size: 12px; font-weight: 700; color: #57534e; margin-bottom: 6px;">
          Hoặc sao chép đường dẫn trực tiếp vào trình duyệt:
        </div>
        <div style="font-size: 12px; color: #c00707; word-break: break-all; font-family: 'Courier New', Courier, monospace;">
          ${resetLink}
        </div>
      </div>
      <p style="margin: 0; font-size: 13px; color: #78716c; line-height: 1.55;">
        Liên kết khôi phục có hiệu lực trong vòng <strong>${expiresMinutes} phút</strong> và chỉ sử dụng được <strong>1 lần duy nhất</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua thư này.
      </p>
    `;

    const html = buildCrispyHouseEmailLayout({
      badgeText: 'Khôi phục bảo mật',
      title: 'Đặt lại mật khẩu của bạn',
      bodyHtml
    });

    saveToLocalOutbox({
      type: 'PASSWORD_RESET_LINK',
      to: toEmail,
      subject,
      token: rawToken,
      resetLink,
      maskedLink,
      sentAt: new Date().toISOString()
    });

    const modeLabel = await this._deliverMail({
      from: this.getFromAddress(),
      to: toEmail,
      subject,
      text,
      html
    });

    console.log(`[MailService] [${modeLabel}] Da gui email reset password toi ${toEmail} (Link: ${maskedLink})`);
  }

  /**
   * 3. Email thông báo mật khẩu đã được thay đổi thành công
   */
  async sendPasswordChangedNotification(toEmail) {
    const subject = '[CRISPY HOUSE] Thông báo thay đổi mật khẩu thành công';
    const text = [
      'CRISPY HOUSE - CẢNH BÁO BẢO MẬT',
      'Mật khẩu tài khoản của bạn tại CRISPY HOUSE vừa được thay đổi thành công.',
      'Toàn bộ các phiên đăng nhập trước đó đã được thu hồi tự động để bảo vệ tài khoản.',
      'Nếu bạn không thực hiện thao tác này, vui lòng liên hệ ngay Hotline 1900 8888.'
    ].join('\n');

    const bodyHtml = `
      <p style="margin: 0 0 18px 0; font-size: 15px; color: #44403c; line-height: 1.65;">
        Mật khẩu cho tài khoản <strong>${toEmail}</strong> tại <strong>CRISPY HOUSE</strong> vừa được cập nhật thành công.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fff8f6; border: 1px solid #fecaca; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
        <tr>
          <td style="font-size: 14px; color: #7f1d1d; line-height: 1.6;">
            <strong>Trạng thái bảo mật:</strong> Toàn bộ các phiên đăng nhập và mã truy cập (JWT) cấp trước thời điểm này đã được thu hồi tự động trên mọi thiết bị.
          </td>
        </tr>
      </table>
      <p style="margin: 0; font-size: 13px; color: #78716c; line-height: 1.55;">
        Nếu chính bạn vừa thực hiện thao tác này, bạn có thể yên tâm tiếp tục sử dụng dịch vụ. Nếu không phải bạn, vui lòng khôi phục mật khẩu ngay lập tức hoặc liên hệ bộ phận hỗ trợ.
      </p>
    `;

    const html = buildCrispyHouseEmailLayout({
      badgeText: 'Thông báo bảo mật',
      title: 'Mật khẩu tài khoản đã được cập nhật',
      bodyHtml
    });

    saveToLocalOutbox({
      type: 'PASSWORD_CHANGED_NOTICE',
      to: toEmail,
      subject,
      sentAt: new Date().toISOString()
    });

    const modeLabel = await this._deliverMail({
      from: this.getFromAddress(),
      to: toEmail,
      subject,
      text,
      html
    });

    console.log(`[MailService] [${modeLabel}] Da gui thong bao doi mat khau thanh cong toi ${toEmail}`);
  }
}

module.exports = new MailService();
