const express = require('express');
const router = express.Router();

// Import API controllers
const dishController = require('../controllers/dish.controller');
const chefController = require('../controllers/chef.controller');
const ingredientController = require('../controllers/ingredient.controller');

// Import Auth routes & middlewares (Gate 1: requireAuth, Gate 2: requireRole)
const authRoutes = require('./auth.routes');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Import middlewares
const { handleUpload } = require('../middlewares/upload.middleware');
const { parseIntegerId } = require('../middlewares/id-parser.middleware');

// ==========================================
// 0. AUTHENTICATION API (/api/auth/*)
// ==========================================
router.use('/auth', authRoutes);

// ==========================================
// 1. DISHES API (/api/dishes)
// - GET: Công khai (Public Read)
// - POST/PATCH/PUT: Gate 1 (requireAuth) + Gate 2 RBAC (editor, admin) + Gate 3 & 4 ABAC (trong controller)
// - DELETE: Gate 1 (requireAuth) + Gate 2 RBAC (chỉ admin)
// ==========================================
router.get('/dishes', dishController.getAll);
router.get('/dishes/categories', dishController.getCategories);
router.get('/dishes/:id', parseIntegerId('id'), dishController.getById);
router.post('/dishes', requireAuth, requireRole('editor', 'admin'), handleUpload('images', 5), dishController.create);
router.patch('/dishes/:id', requireAuth, requireRole('editor', 'admin'), parseIntegerId('id'), handleUpload('images', 5), dishController.update);
router.put('/dishes/:id', requireAuth, requireRole('editor', 'admin'), parseIntegerId('id'), handleUpload('images', 5), dishController.update); // alias
router.delete('/dishes/:id', requireAuth, requireRole('admin'), parseIntegerId('id'), dishController.delete);
router.delete('/dishes/:id/images/:imageId', requireAuth, requireRole('editor', 'admin'), parseIntegerId('id'), dishController.deleteImage);

// ==========================================
// 2. CHEFS API (/api/chefs)
// - GET: Công khai
// - POST/PATCH/PUT: Gate 1 + Gate 2 (editor, admin)
// - DELETE: Gate 1 + Gate 2 (chỉ admin)
// ==========================================
router.get('/chefs', chefController.getAll);
router.get('/chefs/:id', parseIntegerId('id'), chefController.getById);
router.post('/chefs', requireAuth, requireRole('editor', 'admin'), handleUpload('images', 5), chefController.create);
router.patch('/chefs/:id', requireAuth, requireRole('editor', 'admin'), parseIntegerId('id'), handleUpload('images', 5), chefController.update);
router.put('/chefs/:id', requireAuth, requireRole('editor', 'admin'), parseIntegerId('id'), handleUpload('images', 5), chefController.update); // alias
router.delete('/chefs/:id', requireAuth, requireRole('admin'), parseIntegerId('id'), chefController.delete);

// ==========================================
// 3. INGREDIENTS API (/api/ingredients)
// - GET: Công khai
// - POST/PATCH/PUT: Gate 1 + Gate 2 (editor, admin)
// - DELETE: Gate 1 + Gate 2 (chỉ admin)
// ==========================================
router.get('/ingredients', ingredientController.getAll);
router.get('/ingredients/:id', parseIntegerId('id'), ingredientController.getById);
router.post('/ingredients', requireAuth, requireRole('editor', 'admin'), ingredientController.create);
router.patch('/ingredients/:id', requireAuth, requireRole('editor', 'admin'), parseIntegerId('id'), ingredientController.update);
router.put('/ingredients/:id', requireAuth, requireRole('editor', 'admin'), parseIntegerId('id'), ingredientController.update); // alias
router.delete('/ingredients/:id', requireAuth, requireRole('admin'), parseIntegerId('id'), ingredientController.delete);

module.exports = router;
