-- ============================================
-- ISF Cost Estimator - Complete Database Setup
-- ============================================
-- This script drops existing tables and creates fresh ones
-- Safe to run multiple times

-- Step 1: Drop existing tables
DROP TABLE IF EXISTS item_services CASCADE;
DROP TABLE IF EXISTS estimation_items CASCADE;
DROP TABLE IF EXISTS estimations CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- Step 2: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 3: Create estimations table
CREATE TABLE estimations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'draft',
    customer_phone TEXT,
    customer_name TEXT,
    grand_total DECIMAL(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'AED',
    estimated_days INTEGER,
    rush_requested BOOLEAN DEFAULT FALSE,
    draft_order_id TEXT,
    draft_order_url TEXT,
    customer_message TEXT,
    staff_notes TEXT
);

-- Step 4: Create estimation_items table
CREATE TABLE estimation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estimation_id UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    image_url TEXT,
    image_path TEXT,
    category TEXT,
    sub_type TEXT,
    material TEXT,
    color TEXT,
    brand TEXT,
    condition TEXT,
    ai_analysis JSONB,
    ai_confidence DECIMAL(3, 2),
    item_subtotal DECIMAL(10, 2) DEFAULT 0,
    notes TEXT
);

-- Step 5: Create item_services table
CREATE TABLE item_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES estimation_items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    shopify_product_id TEXT,
    shopify_variant_id TEXT,
    service_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    base_price DECIMAL(10, 2),
    final_price DECIMAL(10, 2),
    modifiers JSONB DEFAULT '[]',
    ai_suggested BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3, 2),
    ai_reason TEXT
);

-- Step 6: Create indexes
CREATE INDEX idx_estimations_created ON estimations(created_at DESC);
CREATE INDEX idx_estimation_items_estimation ON estimation_items(estimation_id);
CREATE INDEX idx_item_services_item ON item_services(item_id);

-- Step 7: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_estimations_updated
    BEFORE UPDATE ON estimations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Step 8: Enable Row Level Security with open policies
ALTER TABLE estimations ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for estimations" ON estimations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for estimation_items" ON estimation_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for item_services" ON item_services FOR ALL USING (true) WITH CHECK (true);

-- Done! Check Table Editor - you should see 3 tables
SELECT 'SUCCESS! Created tables:' as message;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
