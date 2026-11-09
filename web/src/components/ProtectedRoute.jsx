import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingView } from './StateViews';

/**
 * Bảo vệ các route yêu cầu đăng nhập (/admin/*).
 * Nếu đang kiểm tra token từ localStorage -> hiển thị LoadingView.
 * Nếu chưa có user hợp lệ -> chuyển hướng về /login.
 */
export default function ProtectedRoute({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <LoadingView message="Đang xác thực phiên đăng nhập..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
}
