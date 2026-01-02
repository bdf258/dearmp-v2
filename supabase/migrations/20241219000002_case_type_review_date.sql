-- Migration: Add case_type and review_date to cases table
-- These fields support the triage workflow for categorizing and scheduling case reviews

-- Create case_type enum with 8 types (placeholder names for now)
CREATE TYPE case_type AS ENUM (
  'type_1',
  'type_2',
  'type_3',
  'type_4',
  'type_5',
  'type_6',
  'type_7',
  'type_8'
);

-- Add new columns to cases table
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS case_type case_type,
  ADD COLUMN IF NOT EXISTS review_date TIMESTAMPTZ;

-- Add index for filtering by case_type
CREATE INDEX IF NOT EXISTS idx_cases_case_type ON cases(case_type);

-- Add index for review_date for queries like "cases due for review"
CREATE INDEX IF NOT EXISTS idx_cases_review_date ON cases(review_date) WHERE review_date IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN cases.case_type IS 'One of 8 case types for categorization';
COMMENT ON COLUMN cases.review_date IS 'Date when this case should be reviewed';
