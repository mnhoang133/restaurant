const prisma = require('../config/db');
const storageService = require('./storage.service');

class ChefService {
  async findMany({ search = '', includeDeleted = false } = {}) {
    const whereClause = {
      ...(includeDeleted ? {} : { isDeleted: false }),
    };

    if (search && search.trim() !== '') {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
        { field: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    return await prisma.chef.findMany({
      where: whereClause,
      include: {
        images: { orderBy: { orderIndex: 'asc' } },
        dishes: {
          where: { dish: { isDeleted: false } },
          include: {
            dish: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async findById(id, { includeDeleted = false } = {}) {
    return await prisma.chef.findFirst({
      where: {
        id: Number(id),
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      include: {
        images: { orderBy: { orderIndex: 'asc' } },
        dishes: {
          where: { dish: { isDeleted: false } },
          include: {
            dish: true,
          },
        },
      },
    });
  }

  async findByCode(code) {
    return await prisma.chef.findUnique({
      where: { code: code.trim() },
    });
  }

  async create(data, imageFiles = []) {
    const { code, name, field, experience, dishIds = [] } = data;

    const chef = await prisma.chef.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        field: field.trim(),
        experience: parseInt(experience, 10),
      },
    });

    if (imageFiles && imageFiles.length > 0) {
      const uploadedImages = await storageService.uploadMultipleImages(imageFiles, chef.code, 1);
      if (uploadedImages.length > 0) {
        await prisma.chefImage.createMany({
          data: uploadedImages.map((img) => ({
            chefId: chef.id,
            imageUrl: img.imageUrl,
            orderIndex: img.orderIndex,
          })),
        });
      }
    }

    if (dishIds && dishIds.length > 0) {
      const dishLinks = dishIds.map((dId) => ({
        chefId: chef.id,
        dishId: parseInt(dId, 10),
      }));
      await prisma.dishChef.createMany({
        data: dishLinks,
        skipDuplicates: true,
      });
    }

    return await this.findById(chef.id);
  }

  async update(id, data, newImageFiles = []) {
    const chefId = Number(id);
    const existing = await this.findById(chefId);
    if (!existing) return null;

    const { code, name, field, experience, dishIds = null } = data;
    const updatePayload = {};
    if (code) updatePayload.code = code.trim();
    if (name) updatePayload.name = name.trim();
    if (field) updatePayload.field = field.trim();
    if (experience !== undefined) updatePayload.experience = parseInt(experience, 10);

    await prisma.chef.update({
      where: { id: chefId },
      data: updatePayload,
    });

    if (newImageFiles && newImageFiles.length > 0) {
      const currentCount = existing.images.length;
      const uploadedImages = await storageService.uploadMultipleImages(
        newImageFiles,
        existing.code,
        currentCount + 1
      );
      if (uploadedImages.length > 0) {
        await prisma.chefImage.createMany({
          data: uploadedImages.map((img) => ({
            chefId,
            imageUrl: img.imageUrl,
            orderIndex: img.orderIndex,
          })),
        });
      }
    }

    if (dishIds !== null) {
      await prisma.dishChef.deleteMany({ where: { chefId } });
      if (dishIds.length > 0) {
        await prisma.dishChef.createMany({
          data: dishIds.map((dId) => ({ chefId, dishId: parseInt(dId, 10) })),
          skipDuplicates: true,
        });
      }
    }

    return await this.findById(chefId);
  }

  async softDelete(id) {
    const chefId = Number(id);
    const existing = await this.findById(chefId);
    if (!existing) return null;

    return await prisma.chef.update({
      where: { id: chefId },
      data: { isDeleted: true },
    });
  }
}

module.exports = new ChefService();
