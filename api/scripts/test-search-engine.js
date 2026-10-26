const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Testing SQL searches on Supabase:');

  // Test 1: Full-Text Search
  const ftsCount = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as total
    FROM dishes d
    WHERE d."isDeleted" = false
      AND to_tsvector('simple', d.name || ' ' || coalesce(d.description, '')) @@ plainto_tsquery('simple', $1)
  `, 'gà rán');
  console.log('FTS Count for "gà rán":', ftsCount[0].total);

  // Test 2: Full-Text Search with ranking
  const ftsItems = await prisma.$queryRawUnsafe(`
    SELECT d.id, d.code, d.name, d.price, d.category,
           ts_rank(to_tsvector('simple', d.name || ' ' || coalesce(d.description, '')), plainto_tsquery('simple', $1)) as rank
    FROM dishes d
    WHERE d."isDeleted" = false
      AND to_tsvector('simple', d.name || ' ' || coalesce(d.description, '')) @@ plainto_tsquery('simple', $1)
    ORDER BY rank DESC, d.id ASC
    LIMIT 3 OFFSET 0;
  `, 'gà rán');
  console.log('FTS Top 3 Items:', ftsItems);

  // Test 3: ILIKE with ESCAPE '!'
  const query = 'gà';
  const pattern = '%' + query.replace(/!/g, '!!').replace(/%/g, '!%').replace(/_/g, '!_') + '%';
  const ilikeCount = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as total
    FROM dishes d
    WHERE d."isDeleted" = false
      AND (d.name ILIKE $1 ESCAPE '!' OR coalesce(d.description, '') ILIKE $1 ESCAPE '!')
  `, pattern);
  console.log('ILIKE Count for "gà":', ilikeCount[0].total);

  // Test 4: Advanced Search filter with relations (Chef & Ingredient)
  const advCount = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as total
    FROM dishes d
    WHERE d."isDeleted" = false
      AND ($1::text IS NULL OR d.category = $1)
      AND ($2::int IS NULL OR d.price >= $2)
      AND ($3::int IS NULL OR d.price <= $3)
      AND ($4::boolean IS NULL OR d."isAvailable" = $4)
      AND ($5::int IS NULL OR EXISTS (SELECT 1 FROM dish_chefs dc WHERE dc."dishId" = d.id AND dc."chefId" = $5))
      AND ($6::int IS NULL OR EXISTS (SELECT 1 FROM dish_ingredients di WHERE di."dishId" = d.id AND di."ingredientId" = $6))
  `, 'Gà Rán', 40000, 100000, true, null, null);
  console.log('Advanced Search Count for Gà Rán [40k-100k], Available=true:', advCount[0].total);

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
