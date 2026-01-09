-- ============================================
-- ISF Cost Estimator - Initial Database Schema
-- ============================================
-- Run this in Supabase SQL Editor:
-- Supabase Dashboard → SQL Editor → New Query → Paste & Run

-- Enable UUID extension (for generating unique IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table 1: estimations
-- ============================================
-- Main record for each estimation session
-- One estimation can have multiple items

CREATE TABLE estimations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'analyzing', 'review', 'confirmed', 'order_created')),

    -- Customer info (optional - for future Zoko integration)
    customer_phone TEXT,
    customer_name TEXT,

    -- Pricing
    grand_total DECIMAL(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'AED',

    -- Turnaround
    estimated_days INTEGER,
    rush_requested BOOLEAN DEFAULT FALSE,

    -- Shopify integration
    draft_order_id TEXT,
    draft_order_url TEXT,

    -- Output
    customer_message TEXT,
    staff_notes TEXT
);

-- ============================================
-- Table 2: estimation_items
-- ============================================
-- Each item (shoe, bag, etc.) within an estimation
-- Linked to parent estimation

CREATE TABLE estimation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estimation_id UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Image (stored in Supabase Storage)
    image_url TEXT,
    image_path TEXT,  -- Storage path for deletion later

    -- AI Analysis Results
    category TEXT CHECK (category IN ('shoes', 'bags', 'other_leather')),
    sub_type TEXT,    -- e.g., 'mens', 'womens', 'handbag', 'belt'
    material TEXT,    -- e.g., 'smooth_leather', 'suede', 'patent'
    color TEXT,
    brand TEXT,
    condition TEXT CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),

    -- Full AI response (for debugging and future improvements)
    ai_analysis JSONB,
    ai_confidence DECIMAL(3, 2),  -- 0.00 to 1.00

    -- Pricing for this item
    item_subtotal DECIMAL(10, 2) DEFAULT 0,

    -- Notes
    notes TEXT
);

-- ============================================
-- Table 3: item_services
-- ============================================
-- Services selected for each item
-- Links items to Shopify products

CREATE TABLE item_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES estimation_items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Shopify product reference
    shopify_product_id TEXT,
    shopify_variant_id TEXT,
    service_name TEXT NOT NULL,

    -- Pricing
    quantity INTEGER DEFAULT 1,
    base_price DECIMAL(10, 2),
    final_price DECIMAL(10, 2),

    -- Modifiers applied (e.g., material surcharge, rush)
    modifiers JSONB DEFAULT '[]',

    -- AI suggestion metadata
    ai_suggested BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3, 2),
    ai_reason TEXT
);

-- ============================================
-- Indexes for performance
-- ============================================

CREATE INDEX idx_estimations_status ON estimations(status);
CREATE INDEX idx_estimations_created ON estimations(created_at DESC);
CREATE INDEX idx_estimation_items_estimation ON estimation_items(estimation_id);
CREATE INDEX idx_item_services_item ON item_services(item_id);

-- ============================================
-- Updated_at trigger
-- ============================================
-- Automatically update the updated_at timestamp

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

-- ============================================
-- Row Level Security (RLS)
-- ============================================
-- For now, we allow all operations (internal tool)
-- You can add policies later for more security

ALTER TABLE estimations ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_services ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since this is an internal tool with no auth)
CREATE POLICY "Allow all for estimations" ON estimations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for estimation_items" ON estimation_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for item_services" ON item_services FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Done!
-- ============================================
-- You should see:
-- - 3 tables created
-- - Indexes created
-- - Trigger created
-- - RLS policies created
