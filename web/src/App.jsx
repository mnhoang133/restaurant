import React from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { NotFoundView } from './components/StateViews';
import { AuthProvider } from './context/AuthContext';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import ActivatePage from './pages/auth/ActivatePage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Client Pages
import HomePage from './pages/client/HomePage';
import DishesPage from './pages/client/DishesPage';
import DishDetailPage from './pages/client/DishDetailPage';

// Admin Pages
import AdminDishesListPage from './pages/admin/AdminDishesListPage';
import AdminDishFormPage from './pages/admin/AdminDishFormPage';
import AdminDishDeletePage from './pages/admin/AdminDishDeletePage';
import AdminChefsListPage from './pages/admin/AdminChefsListPage';
import AdminChefFormPage from './pages/admin/AdminChefFormPage';
import AdminChefDeletePage from './pages/admin/AdminChefDeletePage';
import AdminIngredientsListPage from './pages/admin/AdminIngredientsListPage';
import AdminIngredientFormPage from './pages/admin/AdminIngredientFormPage';
import AdminIngredientDeletePage from './pages/admin/AdminIngredientDeletePage';

/**
 * Client-Side Routing sử dụng React Router v6 với Hash Mode (createHashRouter).
 * Mỗi trang là một route độc lập, tự tải dữ liệu riêng khi mở và không chia sẻ state cho trang khác.
 */
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'dishes', element: <DishesPage /> },
      { path: 'dishes/:id', element: <DishDetailPage /> },

      // Auth Routes (theo đúng Hợp đồng API & tương thích cả đường dẫn rút gọn)
      { path: 'login', element: <LoginPage initialTab="login" /> },
      { path: 'register', element: <LoginPage initialTab="register" /> },
      { path: 'auth', element: <LoginPage initialTab="login" /> },
      { path: 'activate', element: <ActivatePage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'forgot', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'reset', element: <ResetPasswordPage /> },

      // Toàn bộ các route /admin/* được bảo vệ bởi ProtectedRoute
      {
        path: 'admin',
        element: <ProtectedRoute />,
        children: [
          // Admin root chuyển hướng thẳng vào Quản lý món ăn
          { index: true, element: <Navigate to="/admin/dishes" replace /> },

          // Admin Dishes CRUD
          { path: 'dishes', element: <AdminDishesListPage /> },
          { path: 'dishes/new', element: <AdminDishFormPage mode="create" key="dish-create" /> },
          { path: 'dishes/:id/edit', element: <AdminDishFormPage mode="edit" key="dish-edit" /> },
          { path: 'dishes/:id/delete', element: <AdminDishDeletePage /> },

          // Admin Chefs CRUD
          { path: 'chefs', element: <AdminChefsListPage /> },
          { path: 'chefs/new', element: <AdminChefFormPage mode="create" key="chef-create" /> },
          { path: 'chefs/:id/edit', element: <AdminChefFormPage mode="edit" key="chef-edit" /> },
          { path: 'chefs/:id/delete', element: <AdminChefDeletePage /> },

          // Admin Ingredients CRUD
          { path: 'ingredients', element: <AdminIngredientsListPage /> },
          {
            path: 'ingredients/new',
            element: <AdminIngredientFormPage mode="create" key="ing-create" />,
          },
          {
            path: 'ingredients/:id/edit',
            element: <AdminIngredientFormPage mode="edit" key="ing-edit" />,
          },
          { path: 'ingredients/:id/delete', element: <AdminIngredientDeletePage /> },
        ],
      },

      // Fallback 404 cho các URL không khớp trong SPA
      {
        path: '*',
        element: (
          <NotFoundView
            title="Không Tìm Thấy Trang"
            message="Đường dẫn bạn vừa truy cập không tồn tại trong ứng dụng."
            backTo="/dishes"
            backLabel="Quay Lại Thực Đơn"
          />
        ),
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
