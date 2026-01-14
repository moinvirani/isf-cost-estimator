-- Email/Password Authentication for Customer App
-- Allows customers to login with email/password instead of phone OTP

-- Add password_hash column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Make phone optional (was required before, now email can be primary)
ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;

-- Add unique constraint on email for email-based auth
-- Note: email column already exists but is not unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_email_unique'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_email_unique UNIQUE (email);
  END IF;
END $$;

-- Add index for email lookups if not exists
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
