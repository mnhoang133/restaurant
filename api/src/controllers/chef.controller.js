const prisma = require('../config/db');
const chefService = require('../services/chef.service');
const {
  sendSuccess,
  sendNotFound,
  sendValidationFailed,
  sendDuplicateCode,
  sendRelatedNotFound,
  parseIdArray,
} = require('../utils/response');

class ChefController {
  /**
   * GET /api/chefs - Danh sách đầu bếp
   */
  async getAll(req, res, next) {
    try {
      const { q, search } = req.query;
      const chefs = await chefService.findMany({ search: q !== undefined ? q : search });
      return sendSuccess(res, chefs);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/chefs/:id - Chi tiết đầu bếp
   */
  async getById(req, res, next) {
    try {
      const chef = await chefService.findById(req.parsedId);
      if (!chef) {
        return sendNotFound(res, `Không tìm thấy đầu bếp với ID ${req.parsedId} hoặc bản ghi đã bị xóa.`);
      }
      return sendSuccess(res, chef);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/chefs - Thêm đầu bếp mới (kèm danh sách món ăn phụ trách nếu có)
   */
  async create(req, res, next) {
    try {
      const { code, name, specialty, field, experience, dishIds } = req.body;
      const chefField = field !== undefined ? field : specialty;

      const fields = {};
      if (!name || !name.trim()) fields.name = 'Tên đầu bếp là bắt buộc.';
      if (!chefField || !chefField.trim()) {
        fields.specialty = 'Lĩnh vực chuyên môn là bắt buộc.';
        fields.field = 'Lĩnh vực chuyên môn là bắt buộc.';
      }

      let parsedExp = 1;
      if (experience !== undefined && experience !== '') {
        parsedExp = Number(experience);
        if (isNaN(parsedExp) || parsedExp < 0) {
          fields.experience = 'Kinh nghiệm phải là số năm không âm.';
        }
      }

      if (Object.keys(fields).length > 0) {
        return sendValidationFailed(res, fields, 'Dữ liệu đầu bếp không hợp lệ hoặc thiếu trường bắt buộc.');
      }

      let chefCode = code && code.trim() ? code.trim() : `CHEF-${Date.now().toString().slice(-6)}`;
      if (code && code.trim()) {
        const existing = await chefService.findByCode(code.trim());
        if (existing) {
          return sendDuplicateCode(res, code.trim(), 'code', `Mã đầu bếp '${code.trim()}' đã tồn tại.`);
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
            'ID món ăn được gửi khi tạo đầu bếp không tồn tại hoặc đã bị xóa.'
          );
        }
      }

      const newChef = await chefService.create(
        {
          code: chefCode,
          name: name.trim(),
          field: chefField.trim(),
          experience: parsedExp,
          dishIds: parsedDishIds,
        },
        req.files
      );

      return sendSuccess(res, newChef, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/chefs/:id - Sửa thông tin đầu bếp (và cập nhật các món ăn phụ trách)
   */
  async update(req, res, next) {
    try {
      const existing = await chefService.findById(req.parsedId);
      if (!existing) {
        return sendNotFound(res, `Không tìm thấy đầu bếp với ID ${req.parsedId} để cập nhật.`);
      }

      const { code, name, specialty, field, experience, dishIds } = req.body;
      const chefField = field !== undefined ? field : specialty;

      const fields = {};
      if (name !== undefined && !name.trim()) fields.name = 'Tên không được để trống.';
      if (chefField !== undefined && !chefField.trim()) {
        fields.specialty = 'Lĩnh vực không được để trống.';
        fields.field = 'Lĩnh vực không được để trống.';
      }

      let parsedExp = undefined;
      if (experience !== undefined && experience !== '') {
        parsedExp = Number(experience);
        if (isNaN(parsedExp) || parsedExp < 0) {
          fields.experience = 'Kinh nghiệm phải là số năm không âm.';
        }
      }

      if (Object.keys(fields).length > 0) {
        return sendValidationFailed(res, fields, 'Dữ liệu cập nhật đầu bếp không hợp lệ.');
      }

      if (code !== undefined && code.trim() && code.trim() !== existing.code) {
        const codeCheck = await chefService.findByCode(code.trim());
        if (codeCheck) {
          return sendDuplicateCode(res, code.trim(), 'code', `Mã đầu bếp '${code.trim()}' đã tồn tại.`);
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
            'ID món ăn cập nhật cho đầu bếp không tồn tại hoặc đã bị xóa.'
          );
        }
      }

      const updatedChef = await chefService.update(
        req.parsedId,
        {
          code: code ? code.trim() : undefined,
          name: name ? name.trim() : undefined,
          field: chefField ? chefField.trim() : undefined,
          experience: parsedExp,
          dishIds: parsedDishIds,
        },
        req.files
      );

      return sendSuccess(res, updatedChef);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/chefs/:id - Xóa đầu bếp
   */
  async delete(req, res, next) {
    try {
      const existing = await chefService.findById(req.parsedId);
      if (!existing) {
        return sendNotFound(res, `Không tìm thấy đầu bếp với ID ${req.parsedId} để xóa.`);
      }

      await chefService.softDelete(req.parsedId);
      return sendSuccess(res, null);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ChefController();
