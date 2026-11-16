require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "rawEmail" TEXT,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "emailVerifiedAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "chefId" INTEGER,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "lastTotpStep" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "chefId" INTEGER;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastTotpStep" INTEGER;`,

  `ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "chefId" INTEGER;`,
  `ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';`,

  `CREATE TABLE IF NOT EXISTS "recovery_codes" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS "recovery_codes_userId_idx" ON "recovery_codes"("userId");`,

  `CREATE TABLE IF NOT EXISTS "activation_challenges" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'activation',
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "lockedUntil" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activation_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activation_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "activation_challenges_userId_key" ON "activation_challenges"("userId");`,

  `CREATE TABLE IF NOT EXISTS "password_resets" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "password_resets_tokenHash_key" ON "password_resets"("tokenHash");`,
  `CREATE INDEX IF NOT EXISTS "password_resets_userId_idx" ON "password_resets"("userId");`,

  `CREATE TABLE IF NOT EXISTS "login_attempts" (
    "id" SERIAL NOT NULL,
    "targetKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "login_attempts_targetKey_key" ON "login_attempts"("targetKey");`,

  `CREATE TABLE IF NOT EXISTS "used_captcha_tokens" (
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "used_captcha_tokens_pkey" PRIMARY KEY ("tokenHash")
  );`
];

async function syncAuthDb() {
  for (const sql of DDL_STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }

  // Đảm bảo có ít nhất 2 đầu bếp active để gắn cho Editor 1 và Editor 2
  let activeChefs = await prisma.chef.findMany({
    where: { isDeleted: false },
    orderBy: { id: 'asc' },
    take: 2
  });

  if (activeChefs.length < 2) {
    const c1 = await prisma.chef.upsert({
      where: { code: 'CHEF01' },
      update: { isDeleted: false },
      create: {
        code: 'CHEF01',
        name: 'Mark Reynolds',
        field: 'Bếp Trưởng Chiên Giòn & Bếp Nhanh',
        experience: 12,
        isDeleted: false
      }
    });
    const c2 = await prisma.chef.upsert({
      where: { code: 'CHEF02' },
      update: { isDeleted: false },
      create: {
        code: 'CHEF02',
        name: 'Hoàng Minh Tuấn',
        field: 'Chuyên Gia Burger & Nướng Lửa Hồng',
        experience: 8,
        isDeleted: false
      }
    });
    activeChefs = [c1, c2];
  }

  const chef1Id = activeChefs[0].id;
  const chef2Id = activeChefs[1].id;

  const seedPass = process.env.SEED_USER_PASSWORD || 'Restaurant@2026';
  const passwordHash = await bcrypt.hash(seedPass, 10);
  const now = new Date();

  // Seed đủ 4 tài khoản chuẩn theo Slide 61 Speaker Note:
  // 1. Admin
  // 2. Editor 1 (gắn chef1Id)
  // 3. Editor 2 (gắn chef2Id)
  // 4. Viewer
  const seedUsersConfig = [
    {
      email: (process.env.SEED_USER_EMAIL || 'admin@restaurant.local').toLowerCase(),
      name: 'Quản trị viên (Admin)',
      role: 'admin',
      chefId: null
    },
    {
      email: 'editor1@restaurant.local',
      name: `Biên tập viên Bếp 1 (${activeChefs[0].name})`,
      role: 'editor',
      chefId: chef1Id
    },
    {
      email: 'editor2@restaurant.local',
      name: `Biên tập viên Bếp 2 (${activeChefs[1].name})`,
      role: 'editor',
      chefId: chef2Id
    },
    {
      email: 'viewer@restaurant.local',
      name: 'Người xem (Viewer)',
      role: 'viewer',
      chefId: null
    }
  ];

  const seededUsers = [];
  for (const u of seedUsersConfig) {
    const upserted = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        chefId: u.chefId,
        status: 'active',
        emailVerifiedAt: now
      },
      create: {
        email: u.email,
        rawEmail: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        chefId: u.chefId,
        status: 'active',
        emailVerifiedAt: now,
        tokenVersion: 0,
        mfaEnabled: false,
        mfaSecret: null,
        lastTotpStep: null
      }
    });
    seededUsers.push(upserted);
  }

  // Gán chefId và status (draft / published) cho các món ăn để kịch bản nghiệm thu ABAC có kết quả dự đoán được
  const dishes = await prisma.dish.findMany({
    where: { isDeleted: false },
    orderBy: { id: 'asc' },
    select: { id: true, chefId: true, status: true }
  });

  // Phân bổ rõ ràng trên trang đầu tiên (20 món đầu) để mở /admin/dishes thấy ngay đủ 4 tổ hợp:
  // - Chef 1 + draft
  // - Chef 1 + published
  // - Chef 2 + draft
  // - Chef 2 + published
  for (let i = 0; i < Math.min(dishes.length, 40); i++) {
    const d = dishes[i];
    const fixedChefId = i % 2 === 0 ? chef1Id : chef2Id;
    const fixedStatus = i % 4 < 2 ? 'draft' : 'published';
    if (d.chefId !== fixedChefId || d.status !== fixedStatus) {
      await prisma.dish.update({
        where: { id: d.id },
        data: { chefId: fixedChefId, status: fixedStatus }
      });
    }
  }

  // Các món còn lại chưa có chefId thì gán nốt
  await prisma.dish.updateMany({
    where: { isDeleted: false, chefId: null },
    data: { chefId: chef1Id }
  });

  const [c1Draft, c1Pub, c2Draft, c2Pub] = await Promise.all([
    prisma.dish.count({ where: { isDeleted: false, chefId: chef1Id, status: 'draft' } }),
    prisma.dish.count({ where: { isDeleted: false, chefId: chef1Id, status: 'published' } }),
    prisma.dish.count({ where: { isDeleted: false, chefId: chef2Id, status: 'draft' } }),
    prisma.dish.count({ where: { isDeleted: false, chefId: chef2Id, status: 'published' } })
  ]);

  console.log('=== SEEDED USERS ===');
  for (const u of seededUsers) {
    console.log(`- [${u.role.toUpperCase()}] ${u.email} | id=${u.id} | chefId=${u.chefId} | mfaEnabled=${u.mfaEnabled}`);
  }
  console.log('=== DISHES ABAC SUMMARY ===');
  console.log(`- Chef #${chef1Id}: draft=${c1Draft}, published=${c1Pub}`);
  console.log(`- Chef #${chef2Id}: draft=${c2Draft}, published=${c2Pub}`);
  console.log(`CHECKPOINT_1_OK: users=${seededUsers.length} chef1=${chef1Id} chef2=${chef2Id}`);
}

syncAuthDb()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('CHECKPOINT_1_ERR:', err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
