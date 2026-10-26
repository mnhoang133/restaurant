const prisma = require('../config/db');
const ingredientService = require('../services/ingredient.service');
const {
  sendSuccess,
  sendNotFound,
  sendValidationFailed,
  sendDuplicateCode,
  sendRelatedNotFound,
  parseIdArray,
} = require('../utils/response');

class IngredientController {
  /**
   * GET /api/ingredients - Danh sách nguyên liệu
   */
  async getAll(req, res, next) {
    try {
      const { q, search } = req.query;
      const ingredients = await ingredientService.findMany({ search: q !== undefined ? q : search });
      return sendSuccess(res, ingredients);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/ingredients/:id - Chi tiết nguyên liệu
   */
  async getById(req, res, next) {
    try {
      const ingredient = await ingredientService.findById(req.parsedId);
      if (!ingredient) {
        return sendNotFound(res, `Không tìm thấy nguyên liệu với ID ${req.parsedId} hoặc bản ghi đã bị xóa.`);
      }
      return sendSuccess(res, ingredient);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/ingredients - Thêm nguyên liệu mới (hỗ trợ liên kết món ăn; unit & quantity tùy chọn cho SPA chỉ yêu cầu tên)
   */
  async create(req, res, next) {
    try {
      const { code, name, quantity, unit, dishIds } = req.body;

      const fields = {};
      if (!name || !name.trim()) fields.name = 'Tên nguyên liệu là bắt buộc.';
      // Nếu client có truyền trường unit nhưng để chuỗi rỗng thì báo lỗi, còn nếu không truyền (SPA bỏ tồn kho/đơn vị) thì mặc định ''
      if (unit !== undefined && typeof unit === 'string' && unit.trim() === '') {
        fields.unit = 'Đơn vị tính không được để trống.';
      }

      let parsedQty = 0;
      if (quantity !== undefined && quantity !== '') {
        parsedQty = Number(quantity);
        if (isNaN(parsedQty) || parsedQty < 0) {
          fields.quantity = 'Số lượng phải là số không âm.';
        }
      }

      if (Object.keys(fields).length > 0) {
        return sendValidationFailed(res, fields, 'Dữ liệu nguyên liệu không hợp lệ hoặc thiếu trường bắt buộc.');
      }

      let ingCode = code && code.trim() ? code.trim() : `ING-${Date.now().toString().slice(-6)}`;
      if (code && code.trim()) {
        const existing = await ingredientService.findByCode(code.trim());
        if (existing) {
          return sendDuplicateCode(res, code.trim(), 'code', `Mã nguyên liệu '${code.trim()}' đã tồn tại.`);
        }
      }

      const parsedDishIds = parseIdArray(dishIds) || [];

      if (parsedDishIds.length > 0) {
        const validDishes = await prisma.dish.findMany({
          where: { id: { in: parsedDishIds }, isDeleted: false },
          select: { id: true },
        });
        if (validDishes.length !== parsedDishIds.length) {
          const foundIds = validDishes.map((d) => d.id);
          const missingIds = parsedDishIds.filter((id) => !foundIds.includes(id));
          return sendRelatedNotFound(
            res,
            { dishIds: `ID món ăn không tồn tại hoặc đã bị xóa: ${missingIds.join(', ')}` },
            'ID món ăn được gửi khi tạo nguyên liệu không tồn tại hoặc đã bị xóa.'
          );
        }
      }

      const newIngredient = await ingredientService.create({
        code: ingCode,
        name: name.trim(),
        unit: unit ? unit.trim() : '',
        quantity: parsedQty,
        dishIds: parsedDishIds,
      });

      return sendSuccess(res, newIngredient, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/ingredients/:id - Sửa nguyên liệu (và cập nhật món ăn liên kết)
   */
  async update(req, res, next) {
    try {
      const existing = await ingredientService.findById(req.parsedId);
      if (!existing) {
        return sendNotFound(res, `Không tìm thấy nguyên liệu với ID ${req.parsedId} để cập nhật.`);
      }

      const { code, name, quantity, unit, dishIds } = req.body;

      const fields = {};
      if (name !== undefined && !name.trim()) fields.name = 'Tên không được để trống.';
      if (unit !== undefined && !unit.trim()) fields.unit = 'Đơn vị tính không được để trống.';

      let parsedQty = undefined;
      if (quantity !== undefined && quantity !== '') {
        parsedQty = Number(quantity);
        if (isNaN(parsedQty) || parsedQty < 0) {
          fields.quantity = 'Số lượng phải là số không âm.';
        }
      }

      if (Object.keys(fields).length > 0) {
        return sendValidationFailed(res, fields, 'Dữ liệu cập nhật nguyên liệu không hợp lệ.');
      }

      if (code !== undefined && code.trim() && code.trim() !== existing.code) {
        const codeCheck = await ingredientService.findByCode(code.trim());
        if (codeCheck) {
          return sendDuplicateCode(res, code.trim(), 'code', `Mã nguyên liệu '${code.trim()}' đã tồn tại.`);
        }
      }

      const parsedDishIds = dishIds !== undefined ? parseIdArray(dishIds) : null;

      if (parsedDishIds && parsedDishIds.length > 0) {
        const validDishes = await prisma.dish.findMany({
          where: { id: { in: parsedDishIds }, isDeleted: false },
          select: { id: true },
        });
        if (validDishes.length !== parsedDishIds.length) {
          const foundIds = validDishes.map((d) => d.id);
          const missingIds = parsedDishIds.filter((id) => !foundIds.includes(id));
          return sendRelatedNotFound(
            res,
            { dishIds: `ID món ăn không tồn tại hoặc đã bị xóa: ${missingIds.join(', ')}` },
            'ID món ăn cập nhật cho nguyên liệu không tồn tại hoặc đã bị xóa.'
          );
        }
      }

      const updatedIngredient = await ingredientService.update(req.parsedId, {
        code: code ? code.trim() : undefined,
        name: name ? name.trim() : undefined,
        unit: unit !== undefined ? unit.trim() : undefined,
        quantity: parsedQty,
        dishIds: parsedDishIds,
      });

      return sendSuccess(res, updatedIngredient);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/ingredients/:id - Xóa nguyên liệu
   */
  async delete(req, res, next) {
    try {
      const existing = await ingredientService.findById(req.parsedId);
      if (!existing) {
        return sendNotFound(res, `Không tìm thấy nguyên liệu với ID ${req.parsedId} để xóa.`);
      }

      await ingredientService.softDelete(req.parsedId);
      return sendSuccess(res, null);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new IngredientController();
