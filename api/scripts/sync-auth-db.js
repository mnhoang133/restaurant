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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;`,

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

  const seedEmail = (process.env.SEED_USER_EMAIL || 'admin@restaurant.local').toLowerCase();
  const seedPass = process.env.SEED_USER_PASSWORD || 'Restaurant@2026';
  const passwordHash = await bcrypt.hash(seedPass, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: seedEmail },
    update: {
      status: 'active',
      emailVerifiedAt: new Date()
    },
    create: {
      email: seedEmail,
      rawEmail: seedEmail,
      name: 'Quản trị viên',
      passwordHash,
      role: 'admin',
      status: 'active',
      emailVerifiedAt: new Date(),
      tokenVersion: 0
    }
  });

  console.log(`CHECKPOINT_1_OK: email=${adminUser.email} status=${adminUser.status} tokenVersion=${adminUser.tokenVersion}`);
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
