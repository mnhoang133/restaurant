import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';

export default function AdminNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const navItems = [
    { to: '/admin/dishes', label: 'Món ăn', icon: 'dish', active: pathname.startsWith('/admin/dishes') },
    { to: '/admin/chefs', label: 'Đầu bếp', icon: 'chef', active: pathname.startsWith('/admin/chefs') },
    {
      to: '/admin/ingredients',
      label: 'Nguyên liệu',
      icon: 'box',
      active: pathname.startsWith('/admin/ingredients'),
    },
    {
      to: '/admin/mfa',
      label: 'Bảo mật MFA',
      icon: 'shield-check',
      active: pathname.startsWith('/admin/mfa') || pathname.startsWith('/admin/security'),
    },
  ];

  const roleDesc =
    user?.role === 'admin'
      ? 'Toàn quyền (Xem, Thêm, Sửa, Xóa & Xuất bản)'
      : user?.role === 'editor'
      ? `Đọc, Tạo & Sửa món nháp của Chef #${user?.chefId ?? '?'}`
      : 'Chỉ có quyền xem (Read-only)';

  return (
    <aside className="admin-side w-full lg:w-64 flex-shrink-0 space-y-4">
      <div className="card p-4 space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-sand-dim">
          Phân hệ quản trị
        </div>

        <nav className="admin-nav" aria-label="Menu quản lý">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={item.active ? 'page' : undefined}
            >
              <Icon name={item.icon} cls="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {user && (
        <div className="card p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sand-dim">
              Phiên hiện tại
            </span>
            <span className="badge text-[10px] uppercase font-bold">
              {user.role}
            </span>
          </div>

          <div className="font-bold text-cream break-all leading-snug">
            {user.rawEmail || user.email}
          </div>

          {user.role === 'editor' && (
            <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-ink-850 border border-line/60">
              <span className="text-sand-dim">Mã đầu bếp (ABAC):</span>
              <span className="font-mono font-bold text-brand">
                {user.chefId ? `chefId = ${user.chefId}` : 'Chưa gán'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-ink-850 border border-line/60">
            <span className="text-sand-dim">Xác thực 2 lớp:</span>
            {user.mfaEnabled ? (
              <span className="badge badge-ok text-[10px] px-2 py-0.5">Đã bật MFA</span>
            ) : (
              <Link
                to="/admin/mfa"
                className="text-[11px] font-bold text-brand hover:underline"
              >
                Chưa bật →
              </Link>
            )}
          </div>

          <p className="text-[11px] text-sand-dim leading-relaxed pt-0.5">
            {roleDesc}
          </p>
        </div>
      )}
    </aside>
  );
}
