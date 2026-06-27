-- ============================================================
-- CLEANUP SCRIPT: Remove all dummy services, products, prices
-- Run this on your PostgreSQL database to clear dummy data.
-- ============================================================

-- Step 1: Delete all service prices (must go first due to FK)
DELETE FROM "service_prices";

-- Step 2: Delete all products
DELETE FROM "products";

-- Step 3: Delete all services
DELETE FROM "services";

-- Step 4: Delete dummy customer (optional - remove if you have real customers)
-- DELETE FROM "customers" WHERE email = 'customer@laundry.com';

-- Step 5: Verify cleanup
SELECT COUNT(*) as services_count FROM "services";
SELECT COUNT(*) as products_count FROM "products";
SELECT COUNT(*) as prices_count FROM "service_prices";

-- Done! Now add your real services from the Admin Panel.
