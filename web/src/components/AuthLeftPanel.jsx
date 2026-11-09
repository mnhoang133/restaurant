import React from 'react';

/**
 * Phần nền toàn màn hình & tiêu đề thương hiệu bên trái của các trang Auth.
 * Giữ nguyên 100% cấu trúc DOM và class từ src/views/partials/auth-left-panel.ejs (Block 8).
 */
export default function AuthLeftPanel() {
  return (
    <>
      {/* Lớp nền đỏ studio & ảnh Burger mở rộng toàn bộ màn hình */}
      <div className="auth-bg-stage" aria-hidden="true">
        <img
          src="/images/auth-burger.png"
          alt=""
          className="auth-visual-img"
          loading="eager"
        />
        <div className="auth-visual-scrim" />

        {/* Đường cung tròn mảnh trang trí góc dưới bên trái */}
        <svg className="auth-visual-arcs" viewBox="0 0 360 360" fill="none">
          <circle cx="128" cy="246" r="158" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1.25" />
          <circle cx="164" cy="264" r="158" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1.25" />
        </svg>
      </div>

      {/* Khối tiêu đề thương hiệu phía trên bên trái */}
      <div className="auth-visual">
        <div className="auth-visual-content">
          <h2 className="auth-visual-title">Crispy House</h2>
          <p className="auth-visual-sub">
            Thưởng thức burger thủ công &amp; gà rán giòn tan nóng hổi mỗi ngày
          </p>
        </div>
      </div>
    </>
  );
}
