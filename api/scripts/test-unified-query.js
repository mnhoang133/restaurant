const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUnifiedQuery() {
  console.log('Testing Unified SQL Query on Supabase...');

  const q = 'gà';
  const searchType = 'fulltext';
  const escaped = '%' + q.replace(/!/g, '!!').replace(/%/g, '!%').replace(/_/g, '!_') + '%';
  const category = 'Gà Rán';
  const minPrice = 30000;
  const maxPrice = 120000;
  const available = true;
  const chefId = null;
  const ingredientId = null;
  const pageSize = 5;
  const offset = 0;

  // 1. Count
  const countSql = `
    SELECT COUNT(*)::int as total
    FROM dishes d
    WHERE d."isDeleted" = false
      AND (
        $1::text IS NULL
        OR (
          $2::text = 'fulltext' AND to_tsvector('simple', d.name || ' ' || coalesce(d.description, '')) @@ plainto_tsquery('simple', $1)
        )
        OR (
          $2::text = 'ilike' AND (d.name ILIKE $3 ESCAPE '!' OR coalesce(d.description, '') ILIKE $3 ESCAPE '!')
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

  const countResult = await prisma.$queryRawUnsafe(
    countSql,
    q,
    searchType,
    escaped,
    category,
    minPrice,
    maxPrice,
    available,
    chefId,
    ingredientId
  );
  console.log('Count Result:', countResult[0].total);

  // 2. Items
  const itemsSql = `
    SELECT d.id
    FROM dishes d
    WHERE d."isDeleted" = false
      AND (
        $1::text IS NULL
        OR (
          $2::text = 'fulltext' AND to_tsvector('simple', d.name || ' ' || coalesce(d.description, '')) @@ plainto_tsquery('simple', $1)
        )
        OR (
          $2::text = 'ilike' AND (d.name ILIKE $3 ESCAPE '!' OR coalesce(d.description, '') ILIKE $3 ESCAPE '!')
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
    ORDER BY d.id ASC
    LIMIT $10 OFFSET $11
  `;

  const itemsResult = await prisma.$queryRawUnsafe(
    itemsSql,
    q,
    searchType,
    escaped,
    category,
    minPrice,
    maxPrice,
    available,
    chefId,
    ingredientId,
    pageSize,
    offset
  );
  console.log('Items IDs Result:', itemsResult.map((r) => r.id));

  // 3. Test with ILIKE searchType
  const countIlike = await prisma.$queryRawUnsafe(
    countSql,
    'gà',
    'ilike',
    '%' + 'gà' + '%',
    null,
    null,
    null,
    null,
    null,
    null
  );
  console.log('Count with ILIKE:', countIlike[0].total);

  await prisma.$disconnect();
}

testUnifiedQuery().catch((e) => {
  console.error(e);
  process.exit(1);
});
