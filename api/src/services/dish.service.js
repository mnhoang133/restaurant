const prisma = require('../config/db');
const storageService = require('./storage.service');

class DishService {
  /**
   * Lấy danh sách món ăn kèm bộ lọc search query & category
   */
  async findMany({ search = '', category = '', isAvailable = undefined, includeDeleted = false } = {}) {
    const whereClause = {
      ...(includeDeleted ? {} : { isDeleted: false }),
    };

    if (search && search.trim() !== '') {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (category && category.trim() !== '') {
      whereClause.category = { equals: category.trim(), mode: 'insensitive' };
    }

    if (typeof isAvailable === 'boolean') {
      whereClause.isAvailable = isAvailable;
    }

    return await prisma.dish.findMany({
      where: whereClause,
      include: {
        images: {
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  /**
   * Phân trang và tìm kiếm phía Server (Server-side Pagination & Search)
   * Theo chuẩn slide 'Tìm kiếm và phân trang' (Slide 20, 21, 23, 27, 30, 37, 38):
   * - Hỗ trợ 4 mode độc lập: 'basic', 'advanced', 'fulltext', 'fuzzy'.
   * - 'basic' & 'advanced': dùng ILIKE với ký tự đặc biệt được escape (! -> !!, % -> !%, _ -> !_).
   * - 'fulltext': dùng to_tsvector('simple', ...) @@ plainto_tsquery('simple', ...) tối ưu bằng GIN index idx_dishes_fts_gin.
   * - 'fuzzy': dùng similarity(d.name, $1) >= 0.3 tối ưu bằng GIN index idx_dishes_name_trgm_gin.
   * - Hiệu năng cao: đếm total bằng COUNT(*) trực tiếp tại PostgreSQL index.
   * - Phân trang LIMIT $pageSize OFFSET $offset với tie-breaker cố định d.id ASC.
   */
  async searchAndPaginate({
    page = 1,
    pageSize = 10,
    mode = 'basic',
    q = null,
    category = null,
    minPrice = null,
    maxPrice = null,
    available = null,
    chefId = null,
    ingredientId = null,
    sortBy = 'id',
    sortOrder = 'asc',
    total: providedTotal = null,
    skipCount = false,
  }) {
    const offset = (page - 1) * pageSize;

    // Chuẩn bị pattern cho ILIKE khi có q (escape '!' -> '!!', '%' -> '!%', '_' -> '!_')
    let ilikePattern = null;
    if (q) {
      const escaped = q.replace(/!/g, '!!').replace(/%/g, '!%').replace(/_/g, '!_');
      ilikePattern = `%${escaped}%`;
    }

    // Câu lệnh WHERE dùng chung cho cả COUNT và SELECT items (đảm bảo predicate đồng nhất theo Slide 29)
    const baseWhereClause = `
      WHERE d."isDeleted" = false
        AND (
          -- 1. Mode basic hoặc advanced: tích hợp tìm kiếm thông minh bao gồm ILIKE tên, Full-Text Search mô tả & Fuzzy pg_trgm
          (
            ($2::text = 'basic' OR $2::text = 'advanced')
            AND (
              $1::text IS NULL 
              OR d.name ILIKE $3 ESCAPE '!'
              OR ($1::text IS NOT NULL AND to_tsvector('simple', d.name || ' ' || coalesce(d.description, '')) @@ plainto_tsquery('simple', $1))
              OR ($1::text IS NOT NULL AND (similarity(d.name, $1) >= 0.3 OR word_similarity($1, d.name) >= 0.3))
            )
          )
          -- 2. Mode fulltext: tìm PostgreSQL FTS trên name và description (ăn GIN index idx_dishes_fts_gin)
          OR (
            $2::text = 'fulltext'
            AND to_tsvector('simple', d.name || ' ' || coalesce(d.description, '')) @@ plainto_tsquery('simple', $1)
          )
          -- 3. Mode fuzzy: tìm gần đúng theo pg_trgm trên name với ngưỡng similarity >= 0.3 (ăn GIN index idx_dishes_name_trgm_gin)
          OR (
            $2::text = 'fuzzy'
            AND (similarity(d.name, $1) >= 0.3 OR word_similarity($1, d.name) >= 0.3)
          )
        )
        AND ($4::text IS NULL OR lower(d.category) = lower($4))
        AND ($5::int IS NULL OR d.price >= $5)
        AND ($6::int IS NULL OR d.price <= $6)
        AND ($7::boolean IS NULL OR d."isAvailable" = $7)
        AND ($8::int IS NULL OR EXISTS (
          SELECT 1 FROM dish_chefs dc 
          JOIN chefs c ON c.id = dc."chefId" 
          WHERE dc."dishId" = d.id AND dc."chefId" = $8 AND c."isDeleted" = false
        ))
        AND ($9::int IS NULL OR EXISTS (
          SELECT 1 FROM dish_ingredients di 
          JOIN ingredients i ON i.id = di."ingredientId" 
          WHERE di."dishId" = d.id AND di."ingredientId" = $9 AND i."isDeleted" = false
        ))
    `;

    // 1. Truy vấn COUNT(*) trực tiếp tại database để xác định total (hoặc dùng total đã biết từ client để tối ưu infinite scroll)
    let countPromise;
    if (providedTotal !== null && providedTotal !== undefined && !isNaN(Number(providedTotal))) {
      countPromise = Promise.resolve([{ total: Number(providedTotal) }]);
    } else if (skipCount) {
      countPromise = Promise.resolve([{ total: 0 }]);
    } else {
      const countSql = `SELECT COUNT(*)::int as total FROM dishes d ${baseWhereClause}`;
      countPromise = prisma.$queryRawUnsafe(
        countSql,
        q,
        mode,
        ilikePattern,
        category,
        minPrice,
        maxPrice,
        available,
        chefId,
        ingredientId
      );
    }

    // 2. Xác định ORDER BY có tie-breaker cố định (d.id ASC)
    let orderByClause = '';
    const upperOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    if (sortBy === 'rank' && q && mode === 'fulltext') {
      orderByClause = `ORDER BY ts_rank(to_tsvector('simple', d.name || ' ' || coalesce(d.description, '')), plainto_tsquery('simple', $1)) ${upperOrder}, d.id ASC`;
    } else if (sortBy === 'similarity' && q && mode === 'fuzzy') {
      orderByClause = `ORDER BY GREATEST(similarity(d.name, $1), word_similarity($1, d.name)) ${upperOrder}, d.id ASC`;
    } else if (sortBy === 'price') {
      orderByClause = `ORDER BY d.price ${upperOrder}, d.id ASC`;
    } else if (sortBy === 'name') {
      orderByClause = `ORDER BY d.name ${upperOrder}, d.id ASC`;
    } else if (sortBy === 'createdAt') {
      orderByClause = `ORDER BY d."createdAt" ${upperOrder}, d.id ASC`;
    } else {
      orderByClause = `ORDER BY d.id ${upperOrder}`;
    }

    // 3. Truy vấn danh sách món ăn đầy đủ kèm images trong 1 câu SQL duy nhất bằng json_agg
    // Tối ưu hóa triệt để: loại bỏ over-fetching chefs & ingredients để tăng tốc tối đa
    const itemsSql = `
      SELECT d.id, d.code, d.name, d.description, d.price, d.category, d."isAvailable", d."createdAt", d."updatedAt",
             COALESCE(
               (
                 SELECT json_agg(json_build_object('id', di.id, 'imageUrl', di."imageUrl", 'orderIndex', di."orderIndex"))
                 FROM (
                   SELECT id, "imageUrl", "orderIndex"
                   FROM dish_images
                   WHERE "dishId" = d.id
                   ORDER BY "orderIndex" ASC
                 ) di
               ),
               '[]'::json
             ) as images
      FROM dishes d
      ${baseWhereClause}
      ${orderByClause}
      LIMIT $10 OFFSET $11
    `;

    const itemsPromise = prisma.$queryRawUnsafe(
      itemsSql,
      q,
      mode,
      ilikePattern,
      category,
      minPrice,
      maxPrice,
      available,
      chefId,
      ingredientId,
      pageSize,
      offset
    );

    // Thực hiện song song đếm và lấy món tại PostgreSQL
    const [countResult, items] = await Promise.all([countPromise, itemsPromise]);
    const total = countResult && countResult[0] ? countResult[0].total : 0;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    return {
      items: items || [],
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Lấy danh sách các danh mục món ăn duy nhất đang có trong hệ thống
   */
  async getCategories() {
    const categories = await prisma.dish.findMany({
      where: { isDeleted: false },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return categories.map((c) => c.category);
  }

  /**
   * Tìm món ăn theo ID (trả về null nếu không có hoặc đã bị soft-delete)
   */
  async findById(id, { includeDeleted = false } = {}) {
    return await prisma.dish.findFirst({
      where: {
        id: Number(id),
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      include: {
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        chefs: {
          where: { chef: { isDeleted: false } },
          include: {
            chef: true,
          },
        },
        ingredients: {
          where: { ingredient: { isDeleted: false } },
          include: {
            ingredient: true,
          },
        },
      },
    });
  }

  /**
   * Kiểm tra trùng mã món ăn (Unique code check)
   */
  async findByCode(code) {
    return await prisma.dish.findUnique({
      where: { code: code.trim() },
    });
  }

  /**
   * Tạo món ăn mới, hỗ trợ upload nhiều ảnh và liên kết đầu bếp, nguyên liệu
   */
  async create(data, imageFiles = []) {
    const {
      code,
      name,
      description,
      price,
      category,
      isAvailable,
      chefIds = [],
      ingredientIds = [],
    } = data;

    // 1. Tạo bản ghi Dish
    const dish = await prisma.dish.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        description: description ? description.trim() : null,
        price: parseInt(price, 10),
        category: category.trim(),
        isAvailable: isAvailable === true || isAvailable === 'true' || isAvailable === 'on',
      },
    });

    // 2. Upload ảnh và lưu vào bảng DishImage
    if (imageFiles && imageFiles.length > 0) {
      const uploadedImages = await storageService.uploadMultipleImages(imageFiles, dish.code, 1);
      if (uploadedImages.length > 0) {
        await prisma.dishImage.createMany({
          data: uploadedImages.map((img) => ({
            dishId: dish.id,
            imageUrl: img.imageUrl,
            orderIndex: img.orderIndex,
          })),
        });
      }
    }

    // 3. Liên kết N - N với Đầu bếp
    if (chefIds && chefIds.length > 0) {
      const chefLinks = chefIds.map((cId) => ({
        dishId: dish.id,
        chefId: parseInt(cId, 10),
      }));
      await prisma.dishChef.createMany({
        data: chefLinks,
        skipDuplicates: true,
      });
    }

    // 4. Liên kết N - N với Nguyên liệu
    if (ingredientIds && ingredientIds.length > 0) {
      const ingredientLinks = ingredientIds.map((ingId) => ({
        dishId: dish.id,
        ingredientId: parseInt(ingId, 10),
      }));
      await prisma.dishIngredient.createMany({
        data: ingredientLinks,
        skipDuplicates: true,
      });
    }

    return await this.findById(dish.id);
  }

  /**
   * Cập nhật món ăn
   */
  async update(id, data, newImageFiles = []) {
    const dishId = Number(id);
    const existingDish = await this.findById(dishId);
    if (!existingDish) return null;

    const {
      code,
      name,
      description,
      price,
      category,
      isAvailable,
      chefIds = null,
      ingredientIds = null,
      deleteImageIds = null,
    } = data;

    const updatePayload = {};
    if (code) updatePayload.code = code.trim();
    if (name) updatePayload.name = name.trim();
    if (description !== undefined) updatePayload.description = description ? description.trim() : null;
    if (price !== undefined) updatePayload.price = parseInt(price, 10);
    if (category) updatePayload.category = category.trim();
    if (isAvailable !== undefined) {
      updatePayload.isAvailable = isAvailable === true || isAvailable === 'true' || isAvailable === 'on';
    }

    await prisma.dish.update({
      where: { id: dishId },
      data: updatePayload,
    });

    // Xóa các hình ảnh được đánh dấu xóa (nếu có)
    if (deleteImageIds) {
      const idsToDelete = (Array.isArray(deleteImageIds) ? deleteImageIds : [deleteImageIds])
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0);

      if (idsToDelete.length > 0) {
        const imagesToDelete = await prisma.dishImage.findMany({
          where: { id: { in: idsToDelete }, dishId },
        });

        for (const img of imagesToDelete) {
          await storageService.deleteFile(img.imageUrl);
        }

        await prisma.dishImage.deleteMany({
          where: { id: { in: idsToDelete }, dishId },
        });
      }
    }

    // Upload thêm ảnh mới nếu có
    if (newImageFiles && newImageFiles.length > 0) {
      const currentImageCount = existingDish.images.length;
      const uploadedImages = await storageService.uploadMultipleImages(
        newImageFiles,
        existingDish.code,
        currentImageCount + 1
      );
      if (uploadedImages.length > 0) {
        await prisma.dishImage.createMany({
          data: uploadedImages.map((img) => ({
            dishId: dishId,
            imageUrl: img.imageUrl,
            orderIndex: img.orderIndex,
          })),
        });
      }
    }

    // Cập nhật lại danh sách Chef nếu được truyền vào
    if (chefIds !== null) {
      await prisma.dishChef.deleteMany({ where: { dishId } });
      if (chefIds.length > 0) {
        await prisma.dishChef.createMany({
          data: chefIds.map((cId) => ({ dishId, chefId: parseInt(cId, 10) })),
          skipDuplicates: true,
        });
      }
    }

    // Cập nhật lại danh sách Nguyên liệu nếu được truyền vào
    if (ingredientIds !== null) {
      await prisma.dishIngredient.deleteMany({ where: { dishId } });
      if (ingredientIds.length > 0) {
        await prisma.dishIngredient.createMany({
          data: ingredientIds.map((ingId) => ({ dishId, ingredientId: parseInt(ingId, 10) })),
          skipDuplicates: true,
        });
      }
    }

    return await this.findById(dishId);
  }

  /**
   * Xóa một hình ảnh cụ thể của món ăn
   */
  async deleteImage(dishId, imageId) {
    const imgId = Number(imageId);
    const dId = Number(dishId);
    if (isNaN(imgId) || isNaN(dId)) return null;

    const image = await prisma.dishImage.findFirst({
      where: { id: imgId, dishId: dId },
    });

    if (!image) return null;

    await storageService.deleteFile(image.imageUrl);

    return await prisma.dishImage.delete({
      where: { id: imgId },
    });
  }

  /**
   * Soft Delete món ăn (đánh dấu isDeleted = true)
   */
  async softDelete(id) {
    const dishId = Number(id);
    const existing = await this.findById(dishId);
    if (!existing) return null;

    return await prisma.dish.update({
      where: { id: dishId },
      data: { isDeleted: true },
    });
  }

  /**
   * Dựng điều kiện where dùng chung cho phân trang & thống kê danh mục
   */
  _buildWhere({ search = '', category = '', isAvailable = undefined } = {}) {
    const where = { isDeleted: false };

    if (search && search.trim() !== '') {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    if (category && category.trim() !== '') where.category = category.trim();
    if (typeof isAvailable === 'boolean') where.isAvailable = isAvailable;

    return where;
  }

  /**
   * Lấy danh sách món ăn có phân trang phía server (skip / take)
   */
  async findPaginated({ search = '', category = '', isAvailable = undefined, page = 1, pageSize = 6 } = {}) {
    const where = this._buildWhere({ search, category, isAvailable });
    const total = await prisma.dish.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);

    const items = await prisma.dish.findMany({
      where,
      include: { images: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { id: 'desc' },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      total,
      page: currentPage,
      pageSize,
      totalPages,
      from: total === 0 ? 0 : (currentPage - 1) * pageSize + 1,
      to: Math.min(currentPage * pageSize, total),
    };
  }

  /**
   * Danh mục kèm số lượng món và ảnh đại diện (dùng cho thanh phân loại cuộn ngang)
   */
  async getCategories({ isAvailable = undefined } = {}) {
    const where = this._buildWhere({ isAvailable });
    const groups = await prisma.dish.groupBy({
      by: ['category'],
      where,
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });

    const covers = await Promise.all(
      groups.map((g) =>
        prisma.dishImage.findFirst({
          where: { dish: { ...where, category: g.category } },
          orderBy: [{ dishId: 'desc' }, { orderIndex: 'asc' }],
          select: { imageUrl: true },
        })
      )
    );

    return groups.map((g, i) => ({
      name: g.category,
      count: g._count._all,
      cover: covers[i] ? covers[i].imageUrl : null,
    }));
  }

  /**
   * Tên các danh mục đang tồn tại (dùng cho ô chọn danh mục trong form quản lý)
   */
  async getCategoryNames() {
    const rows = await prisma.dish.findMany({
      where: { isDeleted: false },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }
}

module.exports = new DishService();
