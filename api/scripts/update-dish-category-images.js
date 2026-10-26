require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORY_IMAGE_MAP = {
  'Gà Rán': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80',
  'Burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
  'Món Nướng': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
  'Ăn Kèm': 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80',
  'Khai Vị': 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=600&auto=format&fit=crop&q=80',
  'Tráng Miệng': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
  'Nước Uống': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
  'Combo': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
  'Món chính': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
};

async function main() {
  console.log('--- ĐỒNG BỘ HÓA HÌNH ẢNH MÓN ĂN THEO DANH MỤC (BULK) ---');

  for (const [category, targetUrl] of Object.entries(CATEGORY_IMAGE_MAP)) {
    const res = await prisma.dishImage.updateMany({
      where: {
        dish: {
          category: category,
        },
      },
      data: {
        imageUrl: targetUrl,
      },
    });
    console.log(`Đã cập nhật ${res.count} hình ảnh cho danh mục: ${category} -> ${targetUrl}`);
  }

  // Cập nhật các món còn lại không thuộc danh mục trên (nếu có)
  const remaining = await prisma.dishImage.updateMany({
    where: {
      dish: {
        category: {
          notIn: Object.keys(CATEGORY_IMAGE_MAP),
        },
      },
    },
    data: {
      imageUrl: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80',
    },
  });
  if (remaining.count > 0) {
    console.log(`Đã cập nhật ${remaining.count} hình ảnh cho danh mục khác.`);
  }

  console.log('ĐỒNG BỘ HÓA HOÀN TẤT THÀNH CÔNG!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
