-- ==============================================================================
-- HE THONG QUAN LY NHA HANG VIET NAM (RESTAURANT MANAGEMENT)
-- DATABASE SCHEMA DDL SCRIPT (POSTGRESQL / SUPABASE)
-- Duoc sinh tu Prisma Schema: prisma/schema.prisma
-- ==============================================================================

-- 1. Tao bang Mon An (dishes)
CREATE TABLE "dishes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- 2. Tao bang Hinh Anh Mon An (dish_images)
CREATE TABLE "dish_images" (
    "id" SERIAL NOT NULL,
    "dishId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dish_images_pkey" PRIMARY KEY ("id")
);

-- 3. Tao bang Dau Bep (chefs)
CREATE TABLE "chefs" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "experience" INTEGER NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chefs_pkey" PRIMARY KEY ("id")
);

-- 4. Tao bang Hinh Anh Dau Bep (chef_images)
CREATE TABLE "chef_images" (
    "id" SERIAL NOT NULL,
    "chefId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chef_images_pkey" PRIMARY KEY ("id")
);

-- 5. Tao bang Nguyen Lieu (ingredients)
CREATE TABLE "ingredients" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- 6. Tao bang lien ket Mon An - Dau Bep (dish_chefs)
CREATE TABLE "dish_chefs" (
    "dishId" INTEGER NOT NULL,
    "chefId" INTEGER NOT NULL,

    CONSTRAINT "dish_chefs_pkey" PRIMARY KEY ("dishId","chefId")
);

-- 7. Tao bang lien ket Mon An - Nguyen Lieu (dish_ingredients)
CREATE TABLE "dish_ingredients" (
    "dishId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantityUsed" INTEGER,

    CONSTRAINT "dish_ingredients_pkey" PRIMARY KEY ("dishId","ingredientId")
);

-- ==============================================================================
-- RANG BUOC UNIQUE (UNIQUE INDEXES)
-- ==============================================================================
CREATE UNIQUE INDEX "dishes_code_key" ON "dishes"("code");
CREATE UNIQUE INDEX "chefs_code_key" ON "chefs"("code");
CREATE UNIQUE INDEX "ingredients_code_key" ON "ingredients"("code");

-- ==============================================================================
-- RANG BUOC KHOA NGOAI (FOREIGN KEYS WITH CASCADE)
-- ==============================================================================
ALTER TABLE "dish_images" 
    ADD CONSTRAINT "dish_images_dishId_fkey" 
    FOREIGN KEY ("dishId") REFERENCES "dishes"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chef_images" 
    ADD CONSTRAINT "chef_images_chefId_fkey" 
    FOREIGN KEY ("chefId") REFERENCES "chefs"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dish_chefs" 
    ADD CONSTRAINT "dish_chefs_dishId_fkey" 
    FOREIGN KEY ("dishId") REFERENCES "dishes"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dish_chefs" 
    ADD CONSTRAINT "dish_chefs_chefId_fkey" 
    FOREIGN KEY ("chefId") REFERENCES "chefs"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dish_ingredients" 
    ADD CONSTRAINT "dish_ingredients_dishId_fkey" 
    FOREIGN KEY ("dishId") REFERENCES "dishes"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dish_ingredients" 
    ADD CONSTRAINT "dish_ingredients_ingredientId_fkey" 
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
