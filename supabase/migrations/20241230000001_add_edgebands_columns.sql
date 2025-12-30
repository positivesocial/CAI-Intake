-- Add missing columns to edgebands table
-- These columns are expected by the API but were missing from the schema

-- Add material column
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS material TEXT;

-- Add width_mm column
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS width_mm NUMERIC DEFAULT 22;

-- Add color_match_material_id column
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS color_match_material_id TEXT;

-- Add color_code column
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS color_code TEXT;

-- Add finish column  
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS finish TEXT;

-- Add waste_factor_pct column
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS waste_factor_pct NUMERIC DEFAULT 1;

-- Add overhang_mm column
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS overhang_mm NUMERIC DEFAULT 0;

-- Add supplier column
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS supplier TEXT;

-- Add meta column for additional metadata
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS meta JSONB;

-- Add comments for documentation
COMMENT ON COLUMN edgebands.color_code IS 'Color code (hex or name) for the edgeband';
COMMENT ON COLUMN edgebands.finish IS 'Surface finish (matte, gloss, textured, etc.)';
COMMENT ON COLUMN edgebands.waste_factor_pct IS 'Waste factor percentage for calculations';
COMMENT ON COLUMN edgebands.overhang_mm IS 'Overhang in millimeters';
COMMENT ON COLUMN edgebands.supplier IS 'Supplier name';
COMMENT ON COLUMN edgebands.meta IS 'Additional metadata as JSON';

