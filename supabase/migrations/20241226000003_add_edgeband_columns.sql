-- Add missing columns to edgebands table
-- These columns are expected by the UI but were missing from the schema

-- Add width_mm column (edgeband width in millimeters)
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS width_mm DOUBLE PRECISION DEFAULT 22;

-- Add material column (material type e.g., PVC, ABS, Melamine)
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS material TEXT DEFAULT 'PVC';

-- Add color_code column (hex color code for display)
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS color_code TEXT DEFAULT '#FFFFFF';

-- Add waste_factor_pct column (percentage of waste, default 1%)
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS waste_factor_pct DOUBLE PRECISION DEFAULT 1;

-- Add overhang_mm column (overhang in millimeters, default 0)
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS overhang_mm DOUBLE PRECISION DEFAULT 0;

-- Add supplier column (supplier name)
ALTER TABLE edgebands ADD COLUMN IF NOT EXISTS supplier TEXT;

-- Update existing rows to have sensible defaults
UPDATE edgebands 
SET 
  width_mm = COALESCE(width_mm, 22),
  material = COALESCE(material, 'PVC'),
  color_code = COALESCE(color_code, '#FFFFFF'),
  waste_factor_pct = COALESCE(waste_factor_pct, 1),
  overhang_mm = COALESCE(overhang_mm, 0)
WHERE width_mm IS NULL OR material IS NULL OR color_code IS NULL OR waste_factor_pct IS NULL OR overhang_mm IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN edgebands.width_mm IS 'Width of the edgeband in millimeters';
COMMENT ON COLUMN edgebands.material IS 'Material type (e.g., PVC, ABS, Melamine, Veneer)';
COMMENT ON COLUMN edgebands.color_code IS 'Hex color code for UI display';
COMMENT ON COLUMN edgebands.waste_factor_pct IS 'Waste factor percentage for calculations';
COMMENT ON COLUMN edgebands.overhang_mm IS 'Overhang in millimeters for trimming';
COMMENT ON COLUMN edgebands.supplier IS 'Supplier name';


