require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_BUCKET || 'restaurant-images';

async function downloadImageBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.log(`  [Chu thich] Link goc loi (${err.message}), tu dong lay anh du phong thay the.`);
    const fallbackUrl = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80';
    const fallbackRes = await fetch(fallbackUrl);
    const arrayBuffer = await fallbackRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

async function migrateImages() {
  console.log('--- BAT DAU CHUYEN ANH SANG SUPABASE STORAGE ---');

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your_project_ref') || supabaseKey === 'your_supabase_anon_public_key') {
    console.error('[Loi Cau Hinh] Ban chua cau hinh day du SUPABASE_URL va SUPABASE_ANON_KEY trong file .env');
    console.error('Luu y: SUPABASE_URL phai co dang https://<project-ref>.supabase.co');
    console.error('Luu y: SUPABASE_ANON_KEY phai la chuoi JWT bat dau bang eyJ...');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Xu ly anh Mon An (Dishes)
  console.log('\n[1/2] Dang kiem tra anh mon an...');
  const dishes = await prisma.dish.findMany({
    include: { images: { orderBy: { orderIndex: 'asc' } } },
  });

  for (const dish of dishes) {
    for (const img of dish.images) {
      if (img.imageUrl.includes('.supabase.co')) {
        console.log(`- Mon [${dish.code}] anh thu ${img.orderIndex} da la link Supabase. Bo qua.`);
        continue;
      }

      const fileName = `${dish.code}-${img.orderIndex}.jpg`;
      console.log(`- Dang boc anh tu URL cho mon [${dish.code}] (anh ${img.orderIndex}): ${img.imageUrl}`);

      try {
        const buffer = await downloadImageBuffer(img.imageUrl);
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`  Loi upload len Supabase cho ${fileName}:`, uploadError.message);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        const newUrl = publicUrlData.publicUrl;

        await prisma.dishImage.update({
          where: { id: img.id },
          data: { imageUrl: newUrl },
        });

        console.log(`  Da chuyen thanh cong -> URL Supabase moi: ${newUrl}`);
      } catch (err) {
        console.error(`  Loi xu ly anh ${fileName}:`, err.message);
      }
    }
  }

  // 2. Xu ly anh Dau Bep (Chefs)
  console.log('\n[2/2] Dang kiem tra anh dau bep...');
  const chefs = await prisma.chef.findMany({
    include: { images: { orderBy: { orderIndex: 'asc' } } },
  });

  for (const chef of chefs) {
    for (const img of chef.images) {
      if (img.imageUrl.includes('.supabase.co')) {
        console.log(`- Dau bep [${chef.code}] anh thu ${img.orderIndex} da la link Supabase. Bo qua.`);
        continue;
      }

      const fileName = `${chef.code}-${img.orderIndex}.jpg`;
      console.log(`- Dang boc anh tu URL cho dau bep [${chef.code}] (anh ${img.orderIndex}): ${img.imageUrl}`);

      try {
        const buffer = await downloadImageBuffer(img.imageUrl);
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`  Loi upload len Supabase cho ${fileName}:`, uploadError.message);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        const newUrl = publicUrlData.publicUrl;

        await prisma.chefImage.update({
          where: { id: img.id },
          data: { imageUrl: newUrl },
        });

        console.log(`  Da chuyen thanh cong -> URL Supabase moi: ${newUrl}`);
      } catch (err) {
        console.error(`  Loi xu ly anh ${fileName}:`, err.message);
      }
    }
  }

  console.log('\n--- HOAN TAT TOAN BO QUA TRINH CHUYEN DOI ANH SANG SUPABASE ---');
  await prisma.$disconnect();
}

migrateImages().catch((e) => {
  console.error('Loi tien trinh:', e);
  process.exit(1);
});
