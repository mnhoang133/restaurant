const prisma = require('../config/db');
const dishService = require('../services/dish.service');
const {
  sendSuccess,
  sendNotFound,
  sendValidationFailed,
  sendDuplicateCode,
  sendRelatedNotFound,
  parseIdArray,
} = require('../utils/response');

/**
 * Validate và chuẩn hóa tham số tìm kiếm & phân trang theo chuẩn Slide 10, 24, 27, 28, 29
 */
function validateSearchParams(query) {
  const errors = {};
  const normalized = {};

  // 1. page (phải là số nguyên dương >= 1)
  if (query.page !== undefined && String(query.page).trim() !== '') {
    const rawPage = String(query.page).trim();
    if (!/^\d+$/.test(rawPage) || Number(rawPage) <= 0) {
      errors.page = 'Số trang (page) phải là số nguyên dương lớn hơn hoặc bằng 1.';
    } else {
      normalized.page = parseInt(rawPage, 10);
    }
  } else {
    normalized.page = 1;
  }

  // 2. pageSize (số nguyên dương từ 1 đến 100, Slide 10)
  if (query.pageSize !== undefined && String(query.pageSize).trim() !== '') {
    const rawSize = String(query.pageSize).trim();
    if (!/^\d+$/.test(rawSize) || Number(rawSize) <= 0 || Number(rawSize) > 100) {
      errors.pageSize = 'Kích thước trang (pageSize) phải là số nguyên dương từ 1 đến 100.';
    } else {
      normalized.pageSize = parseInt(rawSize, 10);
    }
  } else {
    normalized.pageSize = 10;
  }

  // 3. mode: 'basic', 'advanced', 'fulltext', 'fuzzy' (Chuẩn Slide 37)
  const validModes = ['basic', 'advanced', 'fulltext', 'fuzzy'];
  if (query.mode !== undefined && String(query.mode).trim() !== '') {
    const m = String(query.mode).toLowerCase().trim();
    if (!validModes.includes(m)) {
      errors.mode = `Chế độ tìm kiếm (mode) không hợp lệ. Cho phép: ${validModes.join(', ')}.`;
    } else {
      normalized.mode = m;
    }
  } else {
    normalized.mode = 'basic';
  }

  // 4. q (từ khóa tìm kiếm chuỗi)
  const rawQ = query.q !== undefined ? query.q : query.search;
  if (rawQ !== undefined && typeof rawQ === 'string' && rawQ.trim() !== '') {
    normalized.q = rawQ.trim();
  } else {
    normalized.q = null;
  }

  // Slide 21: Với fulltext và fuzzy, q trim rỗng là VALIDATION_FAILED
  if ((normalized.mode === 'fulltext' || normalized.mode === 'fuzzy') && !normalized.q) {
    errors.q = `Từ khóa tìm kiếm (q) là bắt buộc và không được để trống khi dùng chế độ ${normalized.mode}.`;
  }

  // 6. Các tiêu chí mở rộng (chỉ áp dụng khi mode === 'advanced', Slide 29)
  if (normalized.mode === 'advanced') {
    // category
    if (query.category !== undefined && typeof query.category === 'string' && query.category.trim() !== '') {
      normalized.category = query.category.trim();
    } else {
      normalized.category = null;
    }

    // minPrice (Slide 27: minPrice=0 là cận giá hợp lệ, không phải rỗng)
    if (query.minPrice !== undefined && String(query.minPrice).trim() !== '') {
      const rawMin = String(query.minPrice).trim();
      if (!/^\d+$/.test(rawMin) || Number(rawMin) < 0) {
        errors.minPrice = 'Giá tối thiểu (minPrice) phải là số không âm.';
      } else {
        normalized.minPrice = parseInt(rawMin, 10);
      }
    } else {
      normalized.minPrice = null;
    }

    // maxPrice
    if (query.maxPrice !== undefined && String(query.maxPrice).trim() !== '') {
      const rawMax = String(query.maxPrice).trim();
      if (!/^\d+$/.test(rawMax) || Number(rawMax) < 0) {
        errors.maxPrice = 'Giá tối đa (maxPrice) phải là số không âm.';
      } else {
        normalized.maxPrice = parseInt(rawMax, 10);
      }
    } else {
      normalized.maxPrice = null;
    }

    // Kiểm tra minPrice > maxPrice (Slide 27: minPrice > maxPrice -> VALIDATION_FAILED)
    if (normalized.minPrice !== null && normalized.maxPrice !== null && normalized.minPrice > normalized.maxPrice) {
      errors.minPrice = 'Giá tối thiểu (minPrice) không được lớn hơn giá tối đa (maxPrice).';
    }

    // available (Slide 27: available=false là chỉ món không có sẵn, không được bỏ điều kiện)
    const rawAvail = query.available !== undefined ? query.available : query.isAvailable;
    if (rawAvail !== undefined && String(rawAvail).trim() !== '') {
      const val = String(rawAvail).toLowerCase().trim();
      if (val === 'true' || val === '1') {
        normalized.available = true;
      } else if (val === 'false' || val === '0') {
        normalized.available = false;
      } else {
        errors.available = 'Trạng thái món ăn (available) phải là true hoặc false.';
      }
    } else {
      normalized.available = null;
    }

    // chefId
    if (query.chefId !== undefined && String(query.chefId).trim() !== '') {
      const rawCid = String(query.chefId).trim();
      if (!/^\d+$/.test(rawCid) || Number(rawCid) <= 0) {
        errors.chefId = 'ID đầu bếp (chefId) phải là số nguyên dương.';
      } else {
        normalized.chefId = parseInt(rawCid, 10);
      }
    } else {
      normalized.chefId = null;
    }

    // ingredientId
    if (query.ingredientId !== undefined && String(query.ingredientId).trim() !== '') {
      const rawIid = String(query.ingredientId).trim();
      if (!/^\d+$/.test(rawIid) || Number(rawIid) <= 0) {
        errors.ingredientId = 'ID nguyên liệu (ingredientId) phải là số nguyên dương.';
      } else {
        normalized.ingredientId = parseInt(rawIid, 10);
      }
    } else {
      normalized.ingredientId = null;
    }
  } else {
    // Basic mode: Bỏ qua các tiêu chí advanced, chỉ áp dụng q (Slide 29)
    normalized.category = null;
    normalized.minPrice = null;
    normalized.maxPrice = null;
    normalized.available = null;
    normalized.chefId = null;
    normalized.ingredientId = null;
  }

  // 7. sortBy
  const validSortFields = ['id', 'name', 'price', 'createdAt', 'rank', 'similarity'];
  if (query.sortBy !== undefined && String(query.sortBy).trim() !== '') {
    const sb = String(query.sortBy).trim();
    if (!validSortFields.includes(sb)) {
      errors.sortBy = `Trường sắp xếp (sortBy) không hợp lệ. Cho phép: ${validSortFields.join(', ')}.`;
    } else {
      normalized.sortBy = sb;
    }
  } else {
    // Mặc định: fulltext xếp theo rank desc, fuzzy xếp theo similarity desc, còn lại theo id asc
    if (normalized.mode === 'fulltext') {
      normalized.sortBy = 'rank';
    } else if (normalized.mode === 'fuzzy') {
      normalized.sortBy = 'similarity';
    } else {
      normalized.sortBy = 'id';
    }
  }

  // 8. sortOrder
  if (query.sortOrder !== undefined && String(query.sortOrder).trim() !== '') {
    const so = String(query.sortOrder).toLowerCase().trim();
    if (so !== 'asc' && so !== 'desc') {
      errors.sortOrder = 'Chiều sắp xếp (sortOrder) phải là asc hoặc desc.';
    } else {
      normalized.sortOrder = so;
    }
  } else {
    normalized.sortOrder = (normalized.sortBy === 'rank' || normalized.sortBy === 'similarity') ? 'desc' : 'asc';
  }

  return { isValid: Object.keys(errors).length === 0, errors, normalized };
}

class DishController {
  /**
   * GET /api/dishes - Danh sách món ăn
   * Hỗ trợ 2 phương thức:
   * 1. Client-side Paging (Admin CRUD): Khi all=true hoặc không truyền page/pageSize/mode/paginate.
   * 2. Server-side Paging & Search (Khách hàng xem Menu): Khi truyền page, pageSize, mode hoặc paginate=true.
   */
  async getAll(req, res, next) {
    try {
      const { all, page, pageSize, mode, paginate } = req.query;

      // Nhận diện truy vấn không phân trang server (dùng cho Admin Client Paging)
      const isUnpaginated =
        all === 'true' ||
        (page === undefined && pageSize === undefined && mode === undefined && paginate !== 'true');

      if (isUnpaginated) {
        const { q, search, category, isAvailable } = req.query;
        const searchTerm = q !== undefined ? q : search;

        const filter = { search: searchTerm, category };
        if (isAvailable !== undefined && isAvailable !== '') {
          filter.isAvailable = isAvailable === 'true' || isAvailable === '1';
        }

        const dishes = await dishService.findMany(filter);
        return sendSuccess(res, dishes);
      }

      // Phân trang phía Server (Server-side Paging + Search cho Khách hàng)
      const validation = validateSearchParams(req.query);
      if (!validation.isValid) {
        return sendValidationFailed(
          res,
          validation.errors,
          'Tham số phân trang hoặc bộ lọc tìm kiếm không hợp lệ.'
        );
      }

      const result = await dishService.searchAndPaginate(validation.normalized);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dishes/categories - Danh sách danh mục món ăn duy nhất
   */
  async getCategories(req, res, next) {
    try {
      const categories = await dishService.getCategories();
      return sendSuccess(res, categories);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dishes/:id - Chi tiết món ăn
   */
  async getById(req, res, next) {
    try {
      const dish = await dishService.findById(req.parsedId);
      if (!dish) {
        return sendNotFound(res, `Không tìm thấy món ăn với ID ${req.parsedId} hoặc bản ghi đã bị xóa.`);
      }
      return sendSuccess(res, dish);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/dishes - Thêm món ăn mới
   */
  async create(req, res, next) {
    try {
      const { code, name, price, category, description, available, isAvailable, chefIds, ingredientIds } = req.body;

      const fields = {};
      if (!name || !name.trim()) fields.name = 'Tên món ăn là bắt buộc.';
      if (price === undefined || price === null || price === '') {
        fields.price = 'Giá món ăn là bắt buộc.';
      } else {
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          fields.price = 'Giá món ăn phải là một số không âm.';
        }
      }
      if (!category || !category.trim()) fields.category = 'Danh mục món ăn là bắt buộc.';

      if (Object.keys(fields).length > 0) {
        return sendValidationFailed(res, fields, 'Dữ liệu không hợp lệ hoặc thiếu trường bắt buộc.');
      }

      let dishCode = code && code.trim() ? code.trim() : `DISH-${Date.now().toString().slice(-6)}`;
      if (code && code.trim()) {
        const existing = await dishService.findByCode(code.trim());
        if (existing) {
          return sendDuplicateCode(res, code.trim(), 'code', `Mã món ăn '${code.trim()}' đã tồn tại trong hệ thống.`);
        }
      }

      const parsedChefIds = parseIdArray(chefIds) || [];
      const parsedIngredientIds = parseIdArray(ingredientIds) || [];

      if (parsedChefIds.length > 0) {
        const validChefs = await prisma.chef.findMany({
          where: { id: { in: parsedChefIds }, isDeleted: false },
          select: { id: true },
        });
        if (validChefs.length !== parsedChefIds.length) {
          const foundIds = validChefs.map((c) => c.id);
          const missingIds = parsedChefIds.filter((id) => !foundIds.includes(id));
          return sendRelatedNotFound(
            res,
            { chefIds: `ID đầu bếp không tồn tại hoặc đã bị xóa: ${missingIds.join(', ')}` },
            'ID đầu bếp được gửi khi tạo món ăn không tồn tại hoặc đã bị xóa.'
          );
        }
      }

      if (parsedIngredientIds.length > 0) {
        const validIngredients = await prisma.ingredient.findMany({
          where: { id: { in: parsedIngredientIds }, isDeleted: false },
          select: { id: true },
        });
        if (validIngredients.length !== parsedIngredientIds.length) {
          const foundIds = validIngredients.map((i) => i.id);
          const missingIds = parsedIngredientIds.filter((id) => !foundIds.includes(id));
          return sendRelatedNotFound(
            res,
            { ingredientIds: `ID nguyên liệu không tồn tại hoặc đã bị xóa: ${missingIds.join(', ')}` },
            'ID nguyên liệu được gửi khi tạo món ăn không tồn tại hoặc đã bị xóa.'
          );
        }
      }

      const parsedPrice = parseInt(price, 10);
      const activeStatus =
        isAvailable !== undefined
          ? isAvailable === true || isAvailable === 'true' || isAvailable === 'on'
          : available !== undefined
          ? available === true || available === 'true' || available === 'on'
          : true;

      const newDish = await dishService.create(
        {
          code: dishCode,
          name: name.trim(),
          price: parsedPrice,
          category: category.trim(),
          description: description ? description.trim() : null,
          isAvailable: activeStatus,
          chefIds: parsedChefIds,
          ingredientIds: parsedIngredientIds,
        },
        req.files
      );

      return sendSuccess(res, newDish, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/dishes/:id - Cập nhật món ăn
   */
  async update(req, res, next) {
    try {
      const existing = await dishService.findById(req.parsedId);
      if (!existing) {
        return sendNotFound(res, `Không tìm thấy món ăn với ID ${req.parsedId} để cập nhật.`);
      }

      const { code, name, price, category, description, available, isAvailable, chefIds, ingredientIds, deleteImageIds } = req.body;

      const fields = {};
      if (name !== undefined && !name.trim()) fields.name = 'Tên món ăn không được để trống.';
      let parsedPrice = undefined;
      if (price !== undefined && price !== '') {
        parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          fields.price = 'Giá món ăn phải là một số không âm.';
        } else {
          parsedPrice = parseInt(price, 10);
        }
      }
      if (category !== undefined && !category.trim()) fields.category = 'Danh mục không được để trống.';

      if (Object.keys(fields).length > 0) {
        return sendValidationFailed(res, fields, 'Dữ liệu cập nhật món ăn không hợp lệ.');
      }

      if (code !== undefined && code.trim() && code.trim() !== existing.code) {
        const codeCheck = await dishService.findByCode(code.trim());
        if (codeCheck) {
          return sendDuplicateCode(res, code.trim(), 'code', `Mã món ăn '${code.trim()}' đã tồn tại.`);
        }
      }

      const parsedChefIds = chefIds !== undefined ? parseIdArray(chefIds) : null;

      if (parsedChefIds && parsedChefIds.length > 0) {
        const validChefs = await prisma.chef.findMany({
          where: { id: { in: parsedChefIds }, isDeleted: false },
          select: { id: true },
        });
        if (validChefs.length !== parsedChefIds.length) {
          const foundIds = validChefs.map((c) => c.id);
          const missingIds = parsedChefIds.filter((id) => !foundIds.includes(id));
          return sendRelatedNotFound(
            res,
            { chefIds: `ID đầu bếp không tồn tại hoặc đã bị xóa: ${missingIds.join(', ')}` },
            'ID đầu bếp cập nhật không tồn tại hoặc đã bị xóa.'
          );
        }
      }

      const parsedIngredientIds = ingredientIds !== undefined ? parseIdArray(ingredientIds) : null;

      if (parsedIngredientIds && parsedIngredientIds.length > 0) {
        const validIngredients = await prisma.ingredient.findMany({
          where: { id: { in: parsedIngredientIds }, isDeleted: false },
          select: { id: true },
        });
        if (validIngredients.length !== parsedIngredientIds.length) {
          const foundIds = validIngredients.map((i) => i.id);
          const missingIds = parsedIngredientIds.filter((id) => !foundIds.includes(id));
          return sendRelatedNotFound(
            res,
            { ingredientIds: `ID nguyên liệu không tồn tại hoặc đã bị xóa: ${missingIds.join(', ')}` },
            'ID nguyên liệu cập nhật không tồn tại hoặc đã bị xóa.'
          );
        }
      }

      const parsedDeleteImageIds = deleteImageIds !== undefined ? parseIdArray(deleteImageIds) : null;

      let activeStatus = undefined;
      if (isAvailable !== undefined) {
        activeStatus = isAvailable === true || isAvailable === 'true' || isAvailable === 'on';
      } else if (available !== undefined) {
        activeStatus = available === true || available === 'true' || available === 'on';
      }

      const updatedDish = await dishService.update(
        req.parsedId,
        {
          code: code ? code.trim() : undefined,
          name: name ? name.trim() : undefined,
          price: parsedPrice,
          category: category ? category.trim() : undefined,
          description: description !== undefined ? description.trim() : undefined,
          isAvailable: activeStatus,
          chefIds: parsedChefIds,
          ingredientIds: parsedIngredientIds,
          deleteImageIds: parsedDeleteImageIds,
        },
        req.files
      );

      return sendSuccess(res, updatedDish);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/dishes/:id - Xóa món ăn
   */
  async delete(req, res, next) {
    try {
      const existing = await dishService.findById(req.parsedId);
      if (!existing) {
        return sendNotFound(res, `Không tìm thấy món ăn với ID ${req.parsedId} để xóa.`);
      }

      await dishService.softDelete(req.parsedId);
      return sendSuccess(res, null);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/dishes/:id/images/:imageId - Xóa nhanh một hình ảnh của món ăn
   */
  async deleteImage(req, res, next) {
    try {
      const imageId = parseInt(req.params.imageId, 10);
      if (isNaN(imageId) || imageId <= 0) {
        return sendNotFound(res, 'Hình ảnh không tồn tại.');
      }
      const deletedImg = await dishService.deleteImage(req.parsedId, imageId);
      if (!deletedImg) {
        return sendNotFound(res, 'Hình ảnh không tồn tại.');
      }
      const updatedDish = await dishService.findById(req.parsedId);
      return sendSuccess(res, updatedDish);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DishController();
