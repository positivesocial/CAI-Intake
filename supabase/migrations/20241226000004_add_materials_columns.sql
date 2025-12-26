-- Add missing columns to materials table
-- These columns are expected by the UI but were missing from the schema

-- Add grain column (grain direction: none, length, width)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS grain TEXT DEFAULT 'none';

-- Add supplier column (supplier name)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS supplier TEXT;

-- Update existing rows to have sensible defaults
UPDATE materials 
SET grain = COALESCE(grain, 'none')
WHERE grain IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN materials.grain IS 'Grain direction for the material (none, length, width)';
COMMENT ON COLUMN materials.supplier IS 'Supplier name';

-- Add constraint for grain values
ALTER TABLE materials ADD CONSTRAINT materials_grain_check 
  CHECK (grain IS NULL OR grain IN ('none', 'length', 'width'));


