const express = require('express');
const router = express.Router();

// Import API controllers
const dishController = require('../controllers/dish.controller');
const chefController = require('../controllers/chef.controller');
const ingredientController = require('../controllers/ingredient.controller');

// Import middlewares
const { handleUpload } = require('../middlewares/upload.middleware');
const { parseIntegerId } = require('../middlewares/id-parser.middleware');

// ==========================================
// 1. DISHES API (/api/dishes)
// ==========================================
router.get('/dishes', dishController.getAll);
router.get('/dishes/categories', dishController.getCategories);
router.get('/dishes/:id', parseIntegerId('id'), dishController.getById);
router.post('/dishes', handleUpload('images', 5), dishController.create);
router.patch('/dishes/:id', parseIntegerId('id'), handleUpload('images', 5), dishController.update);
router.put('/dishes/:id', parseIntegerId('id'), handleUpload('images', 5), dishController.update); // alias
router.delete('/dishes/:id', parseIntegerId('id'), dishController.delete);
router.delete('/dishes/:id/images/:imageId', parseIntegerId('id'), dishController.deleteImage);

// ==========================================
// 2. CHEFS API (/api/chefs)
// ==========================================
router.get('/chefs', chefController.getAll);
router.get('/chefs/:id', parseIntegerId('id'), chefController.getById);
router.post('/chefs', handleUpload('images', 5), chefController.create);
router.patch('/chefs/:id', parseIntegerId('id'), handleUpload('images', 5), chefController.update);
router.put('/chefs/:id', parseIntegerId('id'), handleUpload('images', 5), chefController.update); // alias
router.delete('/chefs/:id', parseIntegerId('id'), chefController.delete);

// ==========================================
// 3. INGREDIENTS API (/api/ingredients)
// ==========================================
router.get('/ingredients', ingredientController.getAll);
router.get('/ingredients/:id', parseIntegerId('id'), ingredientController.getById);
router.post('/ingredients', ingredientController.create);
router.patch('/ingredients/:id', parseIntegerId('id'), ingredientController.update);
router.put('/ingredients/:id', parseIntegerId('id'), ingredientController.update); // alias
router.delete('/ingredients/:id', parseIntegerId('id'), ingredientController.delete);

module.exports = router;
