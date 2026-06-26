-- Migration: add_laundry_shop
-- Run this SQL against your PostgreSQL database when the DB server is available.
-- This adds the laundry_shops table and the laundryShopId column to orders.

-- CreateTable: laundry_shops
CREATE TABLE "laundry_shops" (
    "id" SERIAL NOT NULL,
    "shopName" TEXT NOT NULL,
    "shopCode" TEXT NOT NULL,
    "ownerName" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laundry_shops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique shopCode
CREATE UNIQUE INDEX "laundry_shops_shopCode_key" ON "laundry_shops"("shopCode");

-- AlterTable: add laundryShopId to orders (nullable, backward compatible)
ALTER TABLE "orders" ADD COLUMN "laundryShopId" INTEGER;

-- AddForeignKey: orders -> laundry_shops
ALTER TABLE "orders" ADD CONSTRAINT "orders_laundryShopId_fkey"
  FOREIGN KEY ("laundryShopId") REFERENCES "laundry_shops"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
