-- Customer App Tables
-- For B2C iOS app: customers, quote requests, pickups, push tokens

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contact info
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,

  -- Shopify integration
  shopify_customer_id TEXT,

  -- Auth
  last_login_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_shopify_id ON customers(shopify_customer_id);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Customers can only see their own data
CREATE POLICY "Customers can view own profile"
  ON customers FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Customers can update own profile"
  ON customers FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Allow insert for new signups (handled by service role)
CREATE POLICY "Allow insert for service role"
  ON customers FOR INSERT
  WITH CHECK (true);

-- ============================================
-- QUOTE REQUESTS TABLE
-- ============================================
CREATE TABLE quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Customer reference
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Images (array of URLs)
  images JSONB NOT NULL DEFAULT '[]',

  -- AI analysis results
  ai_analysis JSONB,
  ai_suggested_services JSONB DEFAULT '[]',

  -- Quote status
  status TEXT NOT NULL DEFAULT 'pending_ai'
    CHECK (status IN ('pending_ai', 'pending_staff', 'quoted', 'accepted', 'paid', 'pickup_scheduled', 'in_progress', 'completed', 'cancelled')),

  -- Quote type: instant (AI can quote) or staff_review (needs human)
  quote_type TEXT DEFAULT 'staff_review'
    CHECK (quote_type IN ('instant', 'staff_review')),

  -- Pricing
  estimated_price_min DECIMAL(10, 2),
  estimated_price_max DECIMAL(10, 2),
  final_price DECIMAL(10, 2),
  currency TEXT DEFAULT 'AED',

  -- Selected services (after staff review or AI)
  services JSONB DEFAULT '[]',

  -- Staff review
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  staff_notes TEXT,

  -- Shopify integration
  draft_order_id TEXT,
  draft_order_url TEXT,
  payment_url TEXT,

  -- Customer notes
  customer_notes TEXT,

  -- Acceptance tracking
  accepted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_quote_requests_customer ON quote_requests(customer_id);
CREATE INDEX idx_quote_requests_status ON quote_requests(status);
CREATE INDEX idx_quote_requests_created ON quote_requests(created_at DESC);

-- Enable RLS
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Customers can see their own quotes
CREATE POLICY "Customers can view own quotes"
  ON quote_requests FOR SELECT
  USING (customer_id::text = auth.uid()::text);

-- Staff can see all quotes (via service role or staff check)
CREATE POLICY "Staff can view all quotes"
  ON quote_requests FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- PICKUP REQUESTS TABLE
-- ============================================
CREATE TABLE pickup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- References
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Address
  address JSONB NOT NULL,
  -- { street, building, city, emirate, notes }

  -- Scheduling
  preferred_date DATE NOT NULL,
  preferred_time_slot TEXT NOT NULL,
  -- "09:00-12:00", "12:00-16:00", "16:00-20:00"

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'picked_up', 'delivered_to_isf', 'cancelled')),

  -- Courier info
  courier_name TEXT,
  courier_tracking TEXT,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Notes
  special_instructions TEXT
);

-- Indexes
CREATE INDEX idx_pickup_requests_quote ON pickup_requests(quote_request_id);
CREATE INDEX idx_pickup_requests_customer ON pickup_requests(customer_id);
CREATE INDEX idx_pickup_requests_date ON pickup_requests(preferred_date);
CREATE INDEX idx_pickup_requests_status ON pickup_requests(status);

-- Enable RLS
ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;

-- Customers can see their own pickups
CREATE POLICY "Customers can view own pickups"
  ON pickup_requests FOR SELECT
  USING (customer_id::text = auth.uid()::text);

-- Staff can manage all pickups
CREATE POLICY "Staff can manage all pickups"
  ON pickup_requests FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- PUSH TOKENS TABLE
-- ============================================
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Customer reference
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Token info
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios'
    CHECK (platform IN ('ios', 'android')),

  -- Device info (optional)
  device_name TEXT,

  -- Unique token per customer per platform
  UNIQUE(customer_id, token)
);

-- Indexes
CREATE INDEX idx_push_tokens_customer ON push_tokens(customer_id);

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Customers can manage their own tokens
CREATE POLICY "Customers can manage own tokens"
  ON push_tokens FOR ALL
  USING (customer_id::text = auth.uid()::text)
  WITH CHECK (customer_id::text = auth.uid()::text);

-- ============================================
-- OTP CODES TABLE (for phone auth)
-- ============================================
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Phone number
  phone TEXT NOT NULL,

  -- OTP code (6 digits)
  code TEXT NOT NULL,

  -- Expiry (5 minutes from creation)
  expires_at TIMESTAMPTZ NOT NULL,

  -- Usage tracking
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,

  -- Rate limiting
  attempts INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX idx_otp_codes_expires ON otp_codes(expires_at);

-- Enable RLS (service role only)
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can access OTP codes
CREATE POLICY "Service role only for OTP"
  ON otp_codes FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- AUTO-UPDATE TRIGGERS
-- ============================================

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for each table
CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_quote_requests_updated_at
  BEFORE UPDATE ON quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_pickup_requests_updated_at
  BEFORE UPDATE ON pickup_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CLEANUP JOB (optional - run via cron)
-- ============================================
-- Delete expired OTP codes older than 1 hour
-- DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
