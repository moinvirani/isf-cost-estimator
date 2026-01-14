-- Zoko Lead Queue System
-- Stores leads from Zoko conversations with product images

CREATE TABLE zoko_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Zoko customer info
  zoko_customer_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,

  -- Images (array of image objects)
  -- [{url, messageId, timestamp, caption}]
  images JSONB NOT NULL DEFAULT '[]',

  -- Context messages from conversation
  -- [{direction, text, timestamp}]
  context_messages JSONB DEFAULT '[]',

  -- Lead status: 'new', 'claimed', 'analyzed', 'quoted', 'completed', 'skipped'
  status TEXT NOT NULL DEFAULT 'new',

  -- Assignment
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,

  -- Analysis results (when AI analysis is done)
  analysis_result JSONB,
  selected_services JSONB,

  -- Draft order (when quote is sent)
  estimation_id UUID REFERENCES estimations(id),
  draft_order_id TEXT,
  draft_order_url TEXT,

  -- Timestamps
  first_image_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,

  -- Notes/skip reason
  notes TEXT,

  -- Prevent duplicates: same customer + same image session
  UNIQUE(zoko_customer_id, first_image_at)
);

-- Indexes for common queries
CREATE INDEX idx_zoko_leads_status ON zoko_leads(status);
CREATE INDEX idx_zoko_leads_claimed_by ON zoko_leads(claimed_by);
CREATE INDEX idx_zoko_leads_first_image_at ON zoko_leads(first_image_at DESC);
CREATE INDEX idx_zoko_leads_customer_phone ON zoko_leads(customer_phone);

-- Enable Row Level Security
ALTER TABLE zoko_leads ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (internal tool)
CREATE POLICY "Allow all operations on zoko_leads"
  ON zoko_leads
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_zoko_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_zoko_leads_updated_at
  BEFORE UPDATE ON zoko_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_zoko_leads_updated_at();
