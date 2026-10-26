import React from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import { NotFoundView } from './components/StateViews';

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

      // Admin root chuyển hướng thẳng vào Quản lý món ăn (đã loại bỏ tab Tổng quan)
      { path: 'admin', element: <Navigate to="/admin/dishes" replace /> },

      // Admin Dishes CRUD
      { path: 'admin/dishes', element: <AdminDishesListPage /> },
      { path: 'admin/dishes/new', element: <AdminDishFormPage mode="create" key="dish-create" /> },
      { path: 'admin/dishes/:id/edit', element: <AdminDishFormPage mode="edit" key="dish-edit" /> },
      { path: 'admin/dishes/:id/delete', element: <AdminDishDeletePage /> },

      // Admin Chefs CRUD
      { path: 'admin/chefs', element: <AdminChefsListPage /> },
      { path: 'admin/chefs/new', element: <AdminChefFormPage mode="create" key="chef-create" /> },
      { path: 'admin/chefs/:id/edit', element: <AdminChefFormPage mode="edit" key="chef-edit" /> },
      { path: 'admin/chefs/:id/delete', element: <AdminChefDeletePage /> },

      // Admin Ingredients CRUD
      { path: 'admin/ingredients', element: <AdminIngredientsListPage /> },
      {
        path: 'admin/ingredients/new',
        element: <AdminIngredientFormPage mode="create" key="ing-create" />,
      },
      {
        path: 'admin/ingredients/:id/edit',
        element: <AdminIngredientFormPage mode="edit" key="ing-edit" />,
      },
      { path: 'admin/ingredients/:id/delete', element: <AdminIngredientDeletePage /> },

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
  return <RouterProvider router={router} />;
}
