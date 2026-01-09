-- ============================================
-- FRESH START - Drop and Recreate Tables
-- ============================================
-- Run this if you need to start fresh

-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS item_services CASCADE;
DROP TABLE IF EXISTS estimation_items CASCADE;
DROP TABLE IF EXISTS estimations CASCADE;

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- Now run the create statements
-- (Copy from 001_initial_schema.sql or run that file after this)
