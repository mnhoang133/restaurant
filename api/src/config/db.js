const { PrismaClient } = require('@prisma/client');

// Khởi tạo Prisma Client dạng Singleton để tránh tạo nhiều connection pool trong quá trình dev/reload
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

module.exports = prisma;
