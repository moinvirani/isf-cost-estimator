-- Training Examples Table
-- Stores image + service pairs for AI training
-- Staff can review Zoko conversations and mark correct services

CREATE TABLE IF NOT EXISTS training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Image data
  image_url TEXT NOT NULL,              -- URL to the image (from Zoko or uploaded)
  image_source TEXT NOT NULL,           -- 'zoko' or 'manual'

  -- Zoko reference (if from Zoko)
  zoko_customer_id TEXT,
  zoko_message_id TEXT,
  zoko_customer_name TEXT,

  -- AI analysis of the image
  ai_category TEXT,                     -- shoes, bags, other_leather
  ai_sub_type TEXT,                     -- mens, womens, etc.
  ai_material TEXT,                     -- smooth_leather, suede, etc.
  ai_condition TEXT,                    -- excellent, good, fair, poor
  ai_issues JSONB DEFAULT '[]',         -- Array of detected issues

  -- Correct services (verified by staff)
  correct_services JSONB NOT NULL DEFAULT '[]',  -- Array of service names/IDs

  -- Staff verification
  verified_by TEXT,                     -- Staff email or name
  verified_at TIMESTAMPTZ,
  notes TEXT,                           -- Any notes from staff

  -- Status
  status TEXT DEFAULT 'pending'         -- pending, verified, rejected
);

-- Index for quick lookups
CREATE INDEX idx_training_examples_status ON training_examples(status);
CREATE INDEX idx_training_examples_category ON training_examples(ai_category);

-- RLS policies (allow all for now - internal tool)
ALTER TABLE training_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to training_examples"
  ON training_examples FOR ALL
  USING (true)
  WITH CHECK (true);
