/**
 * SCRIPT SEED TOÀN DIỆN: 10 ĐẦU BẾP, 30 NGUYÊN LIỆU, 1.000 MÓN ĂN
 * Cho đồ án Restaurant: Tìm kiếm & Phân trang (Supabase Database)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Danh sách 10 Đầu bếp
const CHEFS_DATA = [
  { code: 'CHEF01', name: 'Mark Reynolds', field: 'Bếp Trưởng Chiên Giòn & Bếp Nhanh', experience: 12 },
  { code: 'CHEF02', name: 'Hoàng Minh Tuấn', field: 'Chuyên Gia Burger & Nướng Lửa Hồng', experience: 8 },
  { code: 'CHEF03', name: 'Sarah Jenkins', field: 'Nghệ Nhân Pha Chế Sốt Độc Quyền & Ăn Kèm', experience: 6 },
  { code: 'CHEF04', name: 'Kenji Takahashi', field: 'Bếp Trưởng Khai Vị & Fast Food Nhật Bản', experience: 10 },
  { code: 'CHEF05', name: 'Elena Rostova', field: 'Chuyên Gia Bánh Ngọt & Tráng Miệng Âu', experience: 7 },
  { code: 'CHEF06', name: 'Trần Quốc Bảo', field: 'Bếp Trưởng Gà Rán & Đồ Nướng Cay Hàn Quốc', experience: 9 },
  { code: 'CHEF07', name: 'Michael Chen', field: 'Chuyên Gia Pha Chế Đồ Uống & Trà Trái Cây', experience: 5 },
  { code: 'CHEF08', name: 'Lê Thanh Thảo', field: 'Đầu Bếp Salad Healthy & Khai Vị Thanh Đạm', experience: 6 },
  { code: 'CHEF09', name: 'Antonio Rossi', field: 'Bếp Trưởng Mì Ý & Pizza Fast Food Kiểu Ý', experience: 11 },
  { code: 'CHEF10', name: 'Vũ Đình Khang', field: 'Chuyên Gia Combo & Set Tiệc Gia Đình', experience: 8 },
];

// 2. Danh sách 30 Nguyên liệu
const INGREDIENTS_DATA = [
  { code: 'ING001', name: 'Đùi gà tươi hảo hạng', quantity: 250, unit: 'kg' },
  { code: 'ING002', name: 'Cánh gà tươi loại 1', quantity: 180, unit: 'kg' },
  { code: 'ING003', name: 'Ức gà phi lê tươi', quantity: 200, unit: 'kg' },
  { code: 'ING004', name: 'Thịt bò xay nhập khẩu', quantity: 150, unit: 'kg' },
  { code: 'ING005', name: 'Thịt heo xông khói Bacon', quantity: 90, unit: 'kg' },
  { code: 'ING006', name: 'Tôm sú tươi bóc nõn', quantity: 80, unit: 'kg' },
  { code: 'ING007', name: 'Mực ống giòn tươi', quantity: 70, unit: 'kg' },
  { code: 'ING008', name: 'Khoai tây sợi vàng Bỉ', quantity: 300, unit: 'kg' },
  { code: 'ING009', name: 'Khoai lang kén vàng', quantity: 120, unit: 'kg' },
  { code: 'ING010', name: 'Bột chiên giòn Crispy House', quantity: 200, unit: 'kg' },
  { code: 'ING011', name: 'Phô mai lát Cheddar New Zealand', quantity: 100, unit: 'kg' },
  { code: 'ING012', name: 'Phô mai Mozzarella kéo sợi', quantity: 120, unit: 'kg' },
  { code: 'ING013', name: 'Vỏ bánh Burger rắc vừng', quantity: 500, unit: 'cái' },
  { code: 'ING014', name: 'Vỏ bánh Burger Brioche bơ Pháp', quantity: 400, unit: 'cái' },
  { code: 'ING015', name: 'Dầu thực vật chiên giòn cao cấp', quantity: 250, unit: 'lít' },
  { code: 'ING016', name: 'Sốt ớt cay Volcano bùng nổ', quantity: 80, unit: 'lít' },
  { code: 'ING017', name: 'Sốt Mayo mù tạt mật ong Dijon', quantity: 60, unit: 'lít' },
  { code: 'ING018', name: 'Sốt BBQ khói gỗ sồi Texas', quantity: 90, unit: 'lít' },
  { code: 'ING019', name: 'Sốt phô mai cay Lava béo ngậy', quantity: 70, unit: 'lít' },
  { code: 'ING020', name: 'Sốt Tartar thì là chanh vàng', quantity: 50, unit: 'lít' },
  { code: 'ING021', name: 'Rau xà lách Romaine sạch', quantity: 100, unit: 'kg' },
  { code: 'ING022', name: 'Cà chua bi hữu cơ Đà Lạt', quantity: 90, unit: 'kg' },
  { code: 'ING023', name: 'Dưa chuột muối chua ngọt', quantity: 80, unit: 'kg' },
  { code: 'ING024', name: 'Hành tây trắng xắt lát', quantity: 110, unit: 'kg' },
  { code: 'ING025', name: 'Nấm mỡ tươi xào bơ', quantity: 60, unit: 'kg' },
  { code: 'ING026', name: 'Trứng gà ta chọn lọc', quantity: 600, unit: 'quả' },
  { code: 'ING027', name: 'Cốt trà đào & thảo mộc sả', quantity: 100, unit: 'lít' },
  { code: 'ING028', name: 'Cốt trà xanh Matcha Shizuoka', quantity: 80, unit: 'lít' },
  { code: 'ING029', name: 'Bột cacao socola nguyên chất Bỉ', quantity: 50, unit: 'kg' },
  { code: 'ING030', name: 'Kem tươi whipping béo mịn', quantity: 90, unit: 'lít' },
];

// Danh mục mẫu ảnh chất lượng cao theo danh mục món (Mỗi loại món 1 hình ảnh Unsplash chuẩn duy nhất)
const CATEGORY_IMAGES = {
  'Gà Rán': ['https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80'],
  'Burger': ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80'],
  'Món Nướng': ['https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80'],
  'Ăn Kèm': ['https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80'],
  'Khai Vị': ['https://images.unsplash.com/photo-1541014741259-de529411b96a?w=600&auto=format&fit=crop&q=80'],
  'Tráng Miệng': ['https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80'],
  'Nước Uống': ['https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80'],
  'Combo': ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80'],
};

// Từ vựng sinh tên món và mô tả
const RECIPES_BY_CATEGORY = {
  'Gà Rán': {
    bases: [
      'Đùi Gà Rán', 'Cánh Gà Giòn', 'Gà Rán Không Xương', 'Má Đùi Gà Rán', 'Gà Popcorn Lắc',
      'Ức Gà Chiên Xù', 'Miếng Gà Giòn Cay', 'Phi Lê Gà Hoàng Kim', 'Cánh Gà Tươi Chiên Bơ',
      'Đùi Gà Chiên Giòn Da'
    ],
    flavors: [
      'Volcano Siêu Cay', 'Sốt Bơ Tỏi Mật Ong', 'Lắc Phô Mai Trứng Muối', 'Sốt Cay Ngọt Hàn Quốc',
      'Truyền Thống Nguyên Bản', 'Sốt Tiêu Đen Thượng Hạng', 'Sốt Phô Mai Cheddar', 'Sốt Mayo Mù Tạt Dijon',
      'Phủ Rong Biển Cháy Tỏi', 'Sốt BBQ Gỗ Sồi', 'Vị Cay Tê Tứ Xuyên', 'Sốt Cà Ri Thảo Mộc'
    ],
    modifiers: [
      'Đặc Biệt', 'Hảo Hạng', 'Size Lớn', 'Giòn Tan', 'Mọng Nước', 'Công Thức Bí Truyền',
      'Hai Lớp Bột Xù', 'Cao Cấp', 'Phủ Mè Rang'
    ],
    priceRange: [35000, 149000],
    chefSpecialties: [1, 6], // Mark Reynolds, Trần Quốc Bảo
    primaryIngredients: [1, 2, 3, 10, 15, 16, 17],
  },
  'Burger': {
    bases: [
      'Burger Bò Nướng', 'Burger Bò Wagyu', 'Burger Gà Giòn Rụm', 'Burger Tôm Sú Biển',
      'Burger Hai Tầng Bò', 'Burger Cá Tuyết Phi Lê', 'Burger Thịt Heo Quay Giòn',
      'Burger Nấm Mỡ Bơ Tỏi', 'Burger Ba Tầng Bò Phô Mai', 'Burger Gà Sốt Cay'
    ],
    flavors: [
      'Phô Mai Chảy Lava', 'Sốt BBQ Khói Texas', 'Sốt Mayo Mù Tạt Mật Ong', 'Bacon Xông Khói Giòn',
      'Phô Mai Cheddar Kép', 'Sốt Tartar Thảo Mộc', 'Hành Tây Chiên Giòn', 'Sốt Nấm Truffle',
      'Sốt Tiêu Xanh Phú Quốc', 'Trứng Ốp La Lòng Đào'
    ],
    modifiers: [
      'Bánh Mì Brioche', 'Vỏ Bánh Mè Rang', 'Hảo Hạng', 'Cỡ Đại King Size', 'Đậm Vị',
      'Đặc Biệt Siêu To', 'Nướng Lửa Than', 'Hai Lớp Thịt'
    ],
    priceRange: [45000, 189000],
    chefSpecialties: [2, 1], // Hoàng Minh Tuấn, Mark Reynolds
    primaryIngredients: [4, 5, 6, 11, 13, 14, 21, 22, 23],
  },
  'Món Nướng': {
    bases: [
      'Sườn Heo Nướng', 'Bò Bít Tết Nướng Than', 'Gà Nướng Đốt Lửa', 'Thịt Ba Chỉ Nướng Giòn',
      'Cánh Gà Nướng Mật Ong', 'Đùi Cừu Nướng Thảo Mộc', 'Mực Nướng Muối Ớt', 'Tôm Nướng Bơ Tỏi',
      'Bò Nướng Tảng Sốt Tiêu', 'Gà Nướng Phô Mai'
    ],
    flavors: [
      'Sốt BBQ Khói Gỗ Sồi', 'Sốt Bơ Tỏi Nồng Nàn', 'Sốt Tiêu Đen Cay Nồng', 'Sốt Mật Ong Rừng',
      'Muối Ớt Xanh Nha Trang', 'Thảo Mộc Hương Thảo', 'Sốt Cay Hàn Quốc', 'Phô Mai Nướng Cháy'
    ],
    modifiers: [
      'Nguyên Tảng', 'Cháy Cạnh Giòn Rụm', 'Hảo Hạng', 'Thơm Lừng', 'Bí Truyền Chef',
      'Kèm Salad', 'Đậm Đà Khó Cưỡng'
    ],
    priceRange: [55000, 289000],
    chefSpecialties: [2, 6], // Hoàng Minh Tuấn, Trần Quốc Bảo
    primaryIngredients: [4, 5, 6, 7, 18, 24],
  },
  'Ăn Kèm': {
    bases: [
      'Khoai Tây Sợi Chiên', 'Khoai Lang Kén Vàng', 'Hành Tây Khoanh Vòng Chiên', 'Phô Mai Que Kéo Sợi',
      'Bánh Mì Bơ Tỏi Nướng', 'Bắp Mỹ Xào Bơ Phô Mai', 'Khoai Tây Múi Cau Nướng', 'Bánh Gà Phô Mai',
      'Bánh Xếp Chiên Giòn', 'Xúc Xích Nướng Phô Mai'
    ],
    flavors: [
      'Lắc Phô Mai Béo', 'Lắc Bột Rong Biển', 'Lắc Phô Mai Trứng Muối', 'Chấm Sốt Mù Tạt Mật Ong',
      'Chấm Sốt Ớt Volcano', 'Rắc Muối Tiêu Bỉ', 'Phủ Phô Mai Bột', 'Sốt Mayo Béo Ngậy'
    ],
    modifiers: [
      'Giòn Rụm', 'Vàng Ươm', 'Size Vừa', 'Size Lớn', 'Nóng Hổi', 'Thơm Mùi Bơ'
    ],
    priceRange: [19000, 79000],
    chefSpecialties: [3, 4], // Sarah Jenkins, Kenji Takahashi
    primaryIngredients: [8, 9, 10, 11, 12, 17, 24],
  },
  'Khai Vị': {
    bases: [
      'Salad Gà Nướng Romaine', 'Salad Bò Áp Chảo Caesar', 'Salad Tôm Trái Cây Sốt Mayo',
      'Mực Ống Chiên Giòn Muối Tiêu', 'Tôm Cuộn Bột Xù Giòn', 'Súp Bắp Cua Gà Nấm',
      'Salad Rau Mầm Hạt Óc Chó', 'Bánh Khoai Môn Lệ Phố', 'Bánh Tart Trứng Nướng',
      'Chả Ram Tôm Đất Giòn Rụm'
    ],
    flavors: [
      'Sốt Giấm Balsamic Ý', 'Sốt Mù Tạt Mật Ong', 'Sốt Tartar Thì Là', 'Sốt Mayonnaise Chanh',
      'Sốt Mè Rang Nhật Bản', 'Muối Tiêu Chanh Tươi', 'Thảo Mộc Địa Trung Hải'
    ],
    modifiers: [
      'Tươi Mát', 'Thanh Đạm', 'Kích Thích Vị Giác', 'Bổ Dưỡng', 'Cao Cấp', 'Healthy'
    ],
    priceRange: [25000, 99000],
    chefSpecialties: [8, 4], // Lê Thanh Thảo, Kenji Takahashi
    primaryIngredients: [6, 7, 20, 21, 22, 23, 26],
  },
  'Tráng Miệng': {
    bases: [
      'Kem Sundae Tươi', 'Bánh Táo Nướng Quế', 'Bánh Mousse Socola Bỉ', 'Bánh Phô Mai Nướng Basque',
      'Pudding Xoài Cốt Dừa', 'Bánh Crepe Sầu Riêng Kem', 'Kem Ốc Quế Vani Socola',
      'Panna Cotta Dâu Rừng', 'Bánh Brownie Hạnh Nhân', 'Chè Khúc Bạch Thanh Mát'
    ],
    flavors: [
      'Sốt Dâu Tây Tươi', 'Sốt Socola Bỉ Đậm Đặc', 'Sốt Caramel Muối', 'Sốt Xoài Chanh Leo',
      'Vị Trà Xanh Matcha Nhật', 'Rắc Hạnh Nhân Rang', 'Phủ Dừa Sấy Giòn'
    ],
    modifiers: [
      'Ngọt Ngào', 'Mát Lạnh', 'Béo Bùi', 'Tươi Ngon', 'Mịn Màng', 'Tuyệt Hảo'
    ],
    priceRange: [20000, 85000],
    chefSpecialties: [5], // Elena Rostova
    primaryIngredients: [28, 29, 30],
  },
  'Nước Uống': {
    bases: [
      'Trà Đào Cam Sả', 'Trà Sữa Trân Châu Đường Đen', 'Trà Hoa Cúc Mật Ong', 'Trà Xanh Matcha Latte',
      'Nước Ép Dứa Cam Tươi', 'Nước Chanh Vàng Đá Xay', 'Cà Phê Muối Kem Béo', 'Soda Việt Quất Bạc Hà',
      'Trà Vải Hoa Hồng Thơm', 'Nước Cam Ép Nguyên Chất'
    ],
    flavors: [
      'Kem Phô Mai Macchiato', 'Thảo Mộc Sả Tươi', 'Đá Xay Mát Lạnh', 'Ít Đường Organic',
      'Trân Châu Hoàng Kim', 'Thạch Trái Cây Giòn', 'Lá Bạc Hà Tươi', 'Hạt Chia Bổ Dưỡng'
    ],
    modifiers: [
      'Size Lớn 700ml', 'Size Tiêu Chuẩn', 'Thanh Mát Giải Nhiệt', 'Đậm Vị', 'Tươi Mới Mỗi Ngày'
    ],
    priceRange: [15000, 65000],
    chefSpecialties: [7], // Michael Chen
    primaryIngredients: [27, 28, 29, 30],
  },
  'Combo': {
    bases: [
      'Combo No Nê 1 Người', 'Combo Gà Rán Đôi Bạn', 'Combo Gia Đình Hạnh Phúc', 'Combo Tiệc Sinh Nhật',
      'Combo Siêu Tiết Kiệm Học Sinh', 'Combo Burger & Gà Giòn', 'Combo Nướng Lửa Thần Tốc',
      'Combo Đêm Muộn Cày Phim', 'Combo Cuối Tuần Sum Vầy', 'Combo Đầy Đủ Món Đỉnh'
    ],
    flavors: [
      'Tặng Kèm 2 Pepsi Tươi', 'Tặng Kèm Khoai Tây Lắc', 'Đầy Đủ Món Chính & Ăn Kèm',
      'Kèm Tráng Miệng & Nước Ngọt', 'Phục Vụ Nóng Hổi Ngay', 'Đậm Vị Ngon Trọn Vẹn'
    ],
    modifiers: [
      'Tiết Kiệm 25%', 'Bán Chạy Nhất', 'Siêu To Khổng Lồ', 'Combo Đặc Biệt', 'Trọn Vị Yêu Thương'
    ],
    priceRange: [99000, 450000],
    chefSpecialties: [10, 1], // Vũ Đình Khang, Mark Reynolds
    primaryIngredients: [1, 2, 4, 8, 13, 16, 27],
  },
};

// Hàm sinh 1.000 món độc nhất
function generate1000Dishes() {
  const categories = Object.keys(RECIPES_BY_CATEGORY);
  // Phân bổ tỷ lệ cho 1000 món
  const allocation = {
    'Gà Rán': 200,
    'Burger': 180,
    'Món Nướng': 140,
    'Ăn Kèm': 130,
    'Khai Vị': 110,
    'Tráng Miệng': 100,
    'Nước Uống': 80,
    'Combo': 60,
  };

  const dishes = [];
  const usedNames = new Set();
  let currentCodeNum = 1;

  for (const cat of categories) {
    const targetCount = allocation[cat];
    const conf = RECIPES_BY_CATEGORY[cat];
    let catCount = 0;

    let bIdx = 0;
    let fIdx = 0;
    let mIdx = 0;
    let cycle = 1;

    while (catCount < targetCount) {
      const base = conf.bases[bIdx % conf.bases.length];
      const flavor = conf.flavors[fIdx % conf.flavors.length];
      const mod = conf.modifiers[mIdx % conf.modifiers.length];

      let name = `${base} ${flavor} (${mod})`;
      if (cycle > 1) {
        name = `${base} ${flavor} - Phiên Bản ${mod} ${cycle}`;
      }

      if (!usedNames.has(name)) {
        usedNames.add(name);

        const code = `DISH${String(currentCodeNum).padStart(4, '0')}`;
        currentCodeNum++;

        // Giá tính toán ngẫu nhiên trong khoảng
        const [minP, maxP] = conf.priceRange;
        const rawPrice = Math.floor(minP + Math.random() * (maxP - minP));
        const price = Math.round(rawPrice / 1000) * 1000;

        // Tỷ lệ có sẵn: ~92% true, ~8% false để test filter available
        const isAvailable = Math.random() > 0.08;

        const description = `${base} được chuẩn bị theo phong cách ${flavor}, kết hợp vị ${mod.toLowerCase()}. ` +
          `Nguyên liệu tươi sạch chọn lọc mỗi ngày, nêm nếm đậm đà hợp khẩu vị thực khách. Món ăn thuộc nhóm ${cat} được phục vụ nóng hổi tại bàn.`;

        // Chọn ảnh ngẫu nhiên theo category
        const imgList = CATEGORY_IMAGES[cat];
        const imageUrl = imgList[Math.floor(Math.random() * imgList.length)];

        dishes.push({
          code,
          name,
          description,
          price,
          category: cat,
          isAvailable,
          imageUrl,
          chefSpecialties: conf.chefSpecialties,
          primaryIngredients: conf.primaryIngredients,
        });

        catCount++;
      }

      bIdx++;
      if (bIdx % conf.bases.length === 0) fIdx++;
      if (fIdx % conf.flavors.length === 0) mIdx++;
      if (mIdx % conf.modifiers.length === 0 && fIdx % conf.flavors.length === 0 && bIdx % conf.bases.length === 0) {
        cycle++;
      }
    }
  }

  return dishes;
}

async function main() {
  console.log('========================================================================');
  console.log('🚀 BẮT ĐẦU SEED DỮ LIỆU: 10 ĐẦU BẾP, 30 NGUYÊN LIỆU, 1.000 MÓN ĂN');
  console.log('========================================================================\n');

  // 1. Dọn dẹp sạch toàn bộ dữ liệu cũ
  console.log('🧹 Đang làm sạch các bảng liên kết và dữ liệu cũ...');
  await prisma.dishIngredient.deleteMany();
  await prisma.dishChef.deleteMany();
  await prisma.dishImage.deleteMany();
  await prisma.chefImage.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.chef.deleteMany();
  await prisma.ingredient.deleteMany();
  console.log('✔ Đã xóa sạch dữ liệu cũ.');

  // 2. Tạo 10 Đầu bếp
  console.log('\n👨‍🍳 Đang tạo 10 đầu bếp với chuyên môn khác nhau...');
  const createdChefs = [];
  for (const c of CHEFS_DATA) {
    const chef = await prisma.chef.create({ data: c });
    createdChefs.push(chef);
  }
  console.log(`✔ Đã tạo thành công ${createdChefs.length} đầu bếp.`);

  // 3. Tạo 30 Nguyên liệu
  console.log('\n🥬 Đang tạo 30 nguyên liệu đa dạng...');
  const createdIngredients = [];
  for (const ing of INGREDIENTS_DATA) {
    const ingredient = await prisma.ingredient.create({ data: ing });
    createdIngredients.push(ingredient);
  }
  console.log(`✔ Đã tạo thành công ${createdIngredients.length} nguyên liệu.`);

  // 4. Sinh 1.000 Món ăn
  console.log('\n🍔 Đang sinh cấu trúc 1.000 món ăn phong phú...');
  const rawDishes = generate1000Dishes();
  console.log(`✔ Đã sinh ${rawDishes.length} món ăn duy nhất.`);

  // 5. Thêm 1.000 Món ăn vào DB theo batch để tối ưu tốc độ
  console.log('\n📦 Đang nạp 1.000 món ăn vào Supabase...');
  const BATCH_SIZE = 100;
  for (let i = 0; i < rawDishes.length; i += BATCH_SIZE) {
    const batch = rawDishes.slice(i, i + BATCH_SIZE).map((d) => ({
      code: d.code,
      name: d.name,
      description: d.description,
      price: d.price,
      category: d.category,
      isAvailable: d.isAvailable,
      isDeleted: false,
    }));
    await prisma.dish.createMany({ data: batch });
    process.stdout.write(`  -> Đã nạp ${Math.min(i + BATCH_SIZE, rawDishes.length)} / ${rawDishes.length} món ăn...\r`);
  }
  console.log(`\n✔ Hoàn thành nạp 1.000 món ăn.`);

  // 6. Lấy lại danh sách món ăn từ DB để lấy id gán quan hệ
  console.log('\n🔗 Đang thiết lập quan hệ DishChef, DishIngredient và DishImage...');
  const allDbDishes = await prisma.dish.findMany({
    select: { id: true, code: true },
    orderBy: { id: 'asc' },
  });

  const dishMap = new Map();
  allDbDishes.forEach((d) => dishMap.set(d.code, d.id));

  const dishImagesToInsert = [];
  const dishChefsToInsert = [];
  const dishIngredientsToInsert = [];

  for (const raw of rawDishes) {
    const dishId = dishMap.get(raw.code);
    if (!dishId) continue;

    // Gán 1 ảnh đại diện
    dishImagesToInsert.push({
      dishId,
      imageUrl: raw.imageUrl,
      orderIndex: 1,
    });

    // Gán 1-2 đầu bếp
    // Đầu bếp chuyên trách theo specialty
    const primaryChefIndex = (raw.chefSpecialties[0] - 1) % createdChefs.length;
    const chef1 = createdChefs[primaryChefIndex];
    dishChefsToInsert.push({ dishId, chefId: chef1.id });

    if (raw.chefSpecialties.length > 1 && Math.random() > 0.4) {
      const secondaryChefIndex = (raw.chefSpecialties[1] - 1) % createdChefs.length;
      const chef2 = createdChefs[secondaryChefIndex];
      if (chef2.id !== chef1.id) {
        dishChefsToInsert.push({ dishId, chefId: chef2.id });
      }
    }

    // Gán 2-4 nguyên liệu
    const possibleIngIndexes = raw.primaryIngredients.map((x) => (x - 1) % createdIngredients.length);
    const chosenCount = 2 + Math.floor(Math.random() * 2); // 2 hoặc 3
    const shuffled = [...possibleIngIndexes].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, chosenCount);

    for (const idx of selected) {
      const ing = createdIngredients[idx];
      dishIngredientsToInsert.push({
        dishId,
        ingredientId: ing.id,
        quantityUsed: 1 + Math.floor(Math.random() * 3),
      });
    }
  }

  // Nạp ảnh, chefs, ingredients theo batch
  console.log(`  -> Đang lưu ${dishImagesToInsert.length} hình ảnh...`);
  for (let i = 0; i < dishImagesToInsert.length; i += 200) {
    await prisma.dishImage.createMany({ data: dishImagesToInsert.slice(i, i + 200) });
  }

  console.log(`  -> Đang lưu ${dishChefsToInsert.length} liên kết Đầu bếp - Món ăn...`);
  for (let i = 0; i < dishChefsToInsert.length; i += 200) {
    await prisma.dishChef.createMany({ data: dishChefsToInsert.slice(i, i + 200), skipDuplicates: true });
  }

  console.log(`  -> Đang lưu ${dishIngredientsToInsert.length} liên kết Nguyên liệu - Món ăn...`);
  for (let i = 0; i < dishIngredientsToInsert.length; i += 200) {
    await prisma.dishIngredient.createMany({ data: dishIngredientsToInsert.slice(i, i + 200), skipDuplicates: true });
  }

  // 7. Tạo GIN Index Full Text Search
  console.log('\n🔍 Đang thiết lập PostgreSQL Full-Text Search GIN Index...');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS dishes_fts_idx 
    ON dishes 
    USING GIN (to_tsvector('simple', name || ' ' || coalesce(description, '')));
  `);
  console.log('✔ GIN Index dishes_fts_idx đã sẵn sàng.');

  // 8. Thống kê kết quả
  const [dishCount, chefCount, ingCount, imgCount, linkChefCount, linkIngCount] = await Promise.all([
    prisma.dish.count(),
    prisma.chef.count(),
    prisma.ingredient.count(),
    prisma.dishImage.count(),
    prisma.dishChef.count(),
    prisma.dishIngredient.count(),
  ]);

  console.log('\n========================================================================');
  console.log('🎉 SEED DỮ LIỆU HOÀN TẤT THÀNH CÔNG RỰC RỠ!');
  console.log('========================================================================');
  console.log(`  • Tổng số Món ăn (Dishes):        ${dishCount} món`);
  console.log(`  • Tổng số Đầu bếp (Chefs):         ${chefCount} người`);
  console.log(`  • Tổng số Nguyên liệu (Ingred.):   ${ingCount} loại`);
  console.log(`  • Tổng số Hình ảnh (Images):       ${imgCount} ảnh`);
  console.log(`  • Tổng số Liên kết DishChef:       ${linkChefCount}`);
  console.log(`  • Tổng số Liên kết DishIngredient: ${linkIngCount}`);
  console.log('========================================================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi seed dữ liệu:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
