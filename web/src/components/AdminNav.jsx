import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';

export default function AdminNav() {
  const { pathname } = useLocation();

  const navItems = [
    { to: '/admin/dishes', label: 'Món ăn', icon: 'dish', active: pathname.startsWith('/admin/dishes') },
    { to: '/admin/chefs', label: 'Đầu bếp', icon: 'chef', active: pathname.startsWith('/admin/chefs') },
    {
      to: '/admin/ingredients',
      label: 'Nguyên liệu',
      icon: 'box',
      active: pathname.startsWith('/admin/ingredients'),
    },
  ];

  return (
    <aside className="admin-side w-full lg:w-64 flex-shrink-0 space-y-6">
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
    </aside>
  );
}
