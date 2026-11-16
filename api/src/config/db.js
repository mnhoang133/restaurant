const { PrismaClient } = require('@prisma/client');

/**
 * Chuẩn hóa DATABASE_URL cho Supabase Pooler:
 * Giới hạn connection_limit=3 và tăng pool_timeout=30 để tránh lỗi P1001 / ConnectionReset (10054)
 * khi Frontend gửi nhiều request song song (GET /dishes + GET /dishes/categories + GET /auth/me).
 */
function buildSafeDatabaseUrl(rawUrl) {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '3');
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '30');
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '15');
    }
    return parsed.toString();
  } catch (_) {
    return rawUrl;
  }
}

const safeUrl = buildSafeDatabaseUrl(process.env.DATABASE_URL);

const prisma = new PrismaClient({
  ...(safeUrl ? { datasources: { db: { url: safeUrl } } } : {}),
  log: ['error'],
});

module.exports = prisma;
