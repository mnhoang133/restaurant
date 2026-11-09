import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { subscribeApiLoading } from '../api/client';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'home', to: '/', label: 'Trang chủ' },
  { id: 'menu', to: '/dishes', label: 'Menu' },
  { id: 'admin', to: '/admin/dishes', label: 'Quản lý' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [barProgress, setBarProgress] = useState(0);
  const { user, logout } = useAuth();

  const desktopNavRef = useRef(null);
  const mobileNavRef = useRef(null);

  const isAuthPath =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/auth' ||
    pathname.startsWith('/activate') ||
    pathname.startsWith('/forgot') ||
    pathname.startsWith('/reset');

  const activeTab =
    pathname === '/'
      ? 'home'
      : pathname.startsWith('/dishes')
      ? 'menu'
      : pathname.startsWith('/admin')
      ? 'admin'
      : isAuthPath
      ? 'auth'
      : '';

  const handleLogout = async () => {
    await logout();
    navigate('/login?loggedOut=1', { replace: true });
  };

  // Lắng nghe trạng thái đang gọi API để hiện loading indicator và khóa toàn bộ nút bấm
  useEffect(() => {
    return subscribeApiLoading((loading) => {
      setIsApiLoading(loading);
    });
  }, []);

  // Điều khiển thanh loading trên cùng chạy đều liên tục (không bao giờ đứng im ở bất kỳ thời điểm nào)
  useEffect(() => {
    let rafId;
    let hideTimer;

    if (isApiLoading) {
      setBarVisible(true);
      let current = 8;
      setBarProgress(current);
      let lastTime = performance.now();

      const step = (now) => {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        let speed;
        if (current < 35) {
          speed = 42;
        } else if (current < 65) {
          speed = 20;
        } else if (current < 85) {
          speed = 8;
        } else if (current < 96) {
          speed = 2.5;
        } else {
          speed = 0.4;
        }

        current = Math.min(99.5, current + speed * dt);
        setBarProgress(current);
        rafId = requestAnimationFrame(step);
      };

      rafId = requestAnimationFrame(step);
    } else if (barVisible) {
      setBarProgress(100);
      hideTimer = setTimeout(() => {
        setBarVisible(false);
        setBarProgress(0);
      }, 220);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isApiLoading, barVisible]);

  // Hiệu ứng trượt trang từ trái sang phải khi chuyển trang (giữ nguyên từ app.js cũ)
  useEffect(() => {
    document.body.setAttribute('data-page', activeTab || 'other');
    document.body.classList.add('page-slide-in');
    const htmlEl = document.documentElement;
    const prevBehavior = htmlEl.style.scrollBehavior;
    htmlEl.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    htmlEl.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
      htmlEl.style.scrollBehavior = prevBehavior;
    });

    const timer = setTimeout(() => {
      document.body.classList.remove('page-slide-in');
      document.body.classList.add('page-ready');
    }, 550);

    return () => clearTimeout(timer);
  }, [pathname, activeTab]);

  // Cập nhật thanh chỉ mục (nav-indicator) cố định tại tab đang active
  useEffect(() => {
    function setupNavIndicator(navEl) {
      if (!navEl) return () => {};
      const indicator = navEl.querySelector('.nav-indicator');
      const activeLink = navEl.querySelector('a[aria-current="page"]');

      function update(link) {
        if (!indicator || !link) {
          if (indicator) indicator.classList.remove('is-ready');
          return;
        }
        const navRect = navEl.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        if (linkRect.width === 0) return;
        indicator.style.left = `${linkRect.left - navRect.left}px`;
        indicator.style.width = `${linkRect.width}px`;
        indicator.classList.add('is-ready');
      }

      const rafId = requestAnimationFrame(() => update(activeLink));
      const onResize = () => update(activeLink);
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', onResize);
      };
    }

    const cleanDesktop = setupNavIndicator(desktopNavRef.current);
    const cleanMobile = setupNavIndicator(mobileNavRef.current);

    return () => {
      cleanDesktop();
      cleanMobile();
    };
  }, [activeTab]);

  return (
    <>
      {/* Global API Loading Bar chạy đều liên tục từ 8% -> 99.5% -> 100% */}
      {barVisible && (
        <div
          className="spa-loading-bar"
          role="progressbar"
          aria-valuenow={Math.round(barProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Đang tải dữ liệu từ máy chủ"
        >
          <div
            className="spa-loading-fill"
            style={{ width: `${barProgress.toFixed(2)}%` }}
          />
        </div>
      )}

      <header id="site-header" className="site-header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex md:grid md:grid-cols-[1fr_auto_1fr] items-center justify-between gap-2 sm:gap-4 h-[60px] sm:h-[72px] md:h-20">
            {/* Tabs (desktop) */}
            <nav
              ref={desktopNavRef}
              className="nav-tabs hidden md:inline-flex justify-self-start"
              data-nav
              aria-label="Điều hướng chính"
            >
              <span className="nav-indicator" aria-hidden="true" />
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  id={`nav-${t.id}`}
                  to={t.to}
                  data-tab={t.id}
                  aria-current={activeTab === t.id ? 'page' : undefined}
                >
                  {t.label}
                </Link>
              ))}
            </nav>

            {/* Logo */}
            <Link
              to="/"
              className="brand md:justify-self-center flex-shrink-0"
              aria-label="CRISPY HOUSE - Trang chủ"
            >
              <span className="brand-word">
                <b>CRISPY</b>
                <small>HOUSE</small>
              </span>
            </Link>

            {/* Actions & Auth Status */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 md:justify-self-end min-w-0">
              {user ? (
                <>
                  <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-ink-850 border border-ink-700 text-xs min-w-0">
                    <span
                      className="font-semibold text-cream truncate max-w-[92px] sm:max-w-[160px]"
                      title={user.rawEmail || user.email}
                    >
                      {user.rawEmail || user.email}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-ink-800 text-sand uppercase text-[9.5px] sm:text-[10px] font-semibold flex-shrink-0">
                      {user.role}
                    </span>
                  </div>
                  <button
                    type="button"
                    id="header-logout-btn"
                    onClick={handleLogout}
                    className="btn btn-ghost btn-sm text-[11.5px] sm:text-xs px-2.5 sm:px-3 py-1.5 flex-shrink-0"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : !isAuthPath ? (
                <Link
                  to="/login"
                  id="header-auth-link"
                  className="btn btn-primary btn-sm text-[11.5px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 flex-shrink-0"
                >
                  Đăng nhập / Đăng ký
                </Link>
              ) : null}
            </div>
          </div>

          {/* Tabs (mobile) */}
          <nav
            ref={mobileNavRef}
            className="nav-tabs md:hidden flex w-full mb-2.5"
            data-nav
            aria-label="Điều hướng chính (di động)"
          >
            <span className="nav-indicator" aria-hidden="true" />
            {TABS.map((t) => (
              <Link
                key={t.id}
                to={t.to}
                className="flex-1 text-center justify-center whitespace-nowrap"
                data-tab={t.id}
                aria-current={activeTab === t.id ? 'page' : undefined}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1 min-w-0 max-w-full">
        <Outlet />
      </main>

      {/* Modern Luxury Minimalist Footer */}
      <footer className="mt-auto border-t border-[rgba(0,0,0,0.06)] bg-[#f4f0eb] text-sand py-10 sm:py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[rgba(0,0,0,0.06)]">
            {/* Brand Info */}
            <div className="space-y-4 md:col-span-1">
              <Link
                to="/"
                className="brand inline-flex items-center gap-2.5 text-cream"
                aria-label="CRISPY HOUSE - Trang chủ"
              >
                <span className="brand-word leading-none">
                  <b className="font-extrabold text-base tracking-wider">CRISPY</b>
                  <small className="block text-[9px] font-semibold tracking-[0.35em] text-sand">
                    HOUSE
                  </small>
                </span>
              </Link>
              <p className="text-xs text-sand-dim leading-relaxed">
                Hương vị gà rán giòn rụm hảo hạng, ướp gia vị bí truyền 24 giờ và phục vụ tươi nóng theo từng mẻ.
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cream">Khám phá</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link to="/" className="hover:text-cream transition-colors">
                    Trang chủ
                  </Link>
                </li>
                <li>
                  <Link to="/dishes" className="hover:text-cream transition-colors">
                    Thực đơn Menu
                  </Link>
                </li>
                <li>
                  <Link to="/dishes?q=Gà" className="hover:text-cream transition-colors">
                    Gà rán giòn
                  </Link>
                </li>
                <li>
                  <Link to="/dishes?q=Burger" className="hover:text-cream transition-colors">
                    Burger & Combo
                  </Link>
                </li>
              </ul>
            </div>

            {/* System & Management */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cream">Hệ thống</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link to="/admin/dishes" className="hover:text-cream transition-colors">
                    Quản lý món ăn
                  </Link>
                </li>
                <li>
                  <Link to="/admin/chefs" className="hover:text-cream transition-colors">
                    Đội ngũ đầu bếp
                  </Link>
                </li>
                <li>
                  <Link to="/admin/ingredients" className="hover:text-cream transition-colors">
                    Danh mục nguyên liệu
                  </Link>
                </li>
              </ul>
            </div>

            {/* Opening Hours & Note */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cream">Phục vụ</h4>
              <p className="text-xs text-sand-dim leading-relaxed">
                Mở cửa: 09:00 - 22:30 mỗi ngày
                <br />
                Hotline: 1900 8888 (Miễn phí)
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-[rgba(0,0,0,0.08)] text-[11px] text-cream">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Đang mở cửa phục vụ
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sand-dim text-center sm:text-left">
            <p className="break-words">
              © 2026 CRISPY HOUSE. All rights reserved. Single-Page Application (React & REST API).
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <span className="text-sand/50">Tông màu chủ đạo #C00707</span>
              <Link
                to="/admin/dishes"
                className="text-sand hover:text-cream transition-colors flex items-center gap-1.5"
              >
                <Icon name="dish" cls="w-3.5 h-3.5" />
                <span>Trang Quản lý</span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
