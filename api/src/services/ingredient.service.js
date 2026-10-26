const prisma = require('../config/db');

class IngredientService {
  async findMany({ search = '', includeDeleted = false } = {}) {
    const whereClause = {
      ...(includeDeleted ? {} : { isDeleted: false }),
    };

    if (search && search.trim() !== '') {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    return await prisma.ingredient.findMany({
      where: whereClause,
      include: {
        dishes: {
          include: {
            dish: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async findById(id, { includeDeleted = false } = {}) {
    return await prisma.ingredient.findFirst({
      where: {
        id: Number(id),
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      include: {
        dishes: {
          include: {
            dish: true,
          },
        },
      },
    });
  }

  async findByCode(code) {
    return await prisma.ingredient.findUnique({
      where: { code: code.trim() },
    });
  }

  async create(data) {
    const { code, name, quantity, unit, dishIds = [] } = data;

    const ingredient = await prisma.ingredient.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        quantity: parseInt(quantity, 10),
        unit: unit.trim(),
      },
    });

    if (dishIds && dishIds.length > 0) {
      await prisma.dishIngredient.createMany({
        data: dishIds.map((dId) => ({
          ingredientId: ingredient.id,
          dishId: parseInt(dId, 10),
        })),
        skipDuplicates: true,
      });
    }

    return await this.findById(ingredient.id);
  }

  async update(id, data) {
    const ingredientId = Number(id);
    const existing = await this.findById(ingredientId);
    if (!existing) return null;

    const { code, name, quantity, unit, dishIds = null } = data;
    const updatePayload = {};
    if (code) updatePayload.code = code.trim();
    if (name) updatePayload.name = name.trim();
    if (quantity !== undefined) updatePayload.quantity = parseInt(quantity, 10);
    if (unit) updatePayload.unit = unit.trim();

    await prisma.ingredient.update({
      where: { id: ingredientId },
      data: updatePayload,
    });

    if (dishIds !== null) {
      await prisma.dishIngredient.deleteMany({ where: { ingredientId } });
      if (dishIds.length > 0) {
        await prisma.dishIngredient.createMany({
          data: dishIds.map((dId) => ({
            ingredientId,
            dishId: parseInt(dId, 10),
          })),
          skipDuplicates: true,
        });
      }
    }

    return await this.findById(ingredientId);
  }

  async softDelete(id) {
    const ingredientId = Number(id);
    const existing = await this.findById(ingredientId);
    if (!existing) return null;

    return await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { isDeleted: true },
    });
  }
}

module.exports = new IngredientService();
