-- ============================================================
-- Edgeband Material Adjustments
-- 
-- Adds waste_factor_pct and overhang_mm fields for edgebanding
-- material length calculations. Removes cost fields from materials
-- and edgebands as CAI Intake is not a cost calculation tool.
-- ============================================================

-- Add new adjustment fields to edgebands
ALTER TABLE public.edgebands
ADD COLUMN IF NOT EXISTS waste_factor_pct DECIMAL(5,2) DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS overhang_mm DECIMAL(6,2) DEFAULT 0 NOT NULL;

-- Add comments explaining the fields
COMMENT ON COLUMN public.edgebands.waste_factor_pct IS 'Percentage added for waste/trim during edgebanding (default: 1%)';
COMMENT ON COLUMN public.edgebands.overhang_mm IS 'Extra length on each end for flush trimming. Adds 2× this value to total length (default: 0mm)';

-- Drop cost columns from edgebands (if they exist)
ALTER TABLE public.edgebands
DROP COLUMN IF EXISTS cost_per_meter;

-- Drop cost columns from materials (if they exist)
ALTER TABLE public.materials
DROP COLUMN IF EXISTS cost_per_sqm;

-- ============================================================
-- Utility function to calculate adjusted edgeband length
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_edgeband_length(
  part_length_mm DECIMAL,
  part_width_mm DECIMAL,
  edges_l1 BOOLEAN DEFAULT FALSE,
  edges_l2 BOOLEAN DEFAULT FALSE,
  edges_w1 BOOLEAN DEFAULT FALSE,
  edges_w2 BOOLEAN DEFAULT FALSE,
  waste_factor_pct DECIMAL DEFAULT 1,
  overhang_mm DECIMAL DEFAULT 0
) RETURNS DECIMAL AS $$
DECLARE
  base_length DECIMAL := 0;
  adjusted_length DECIMAL;
  total_edges INT := 0;
BEGIN
  -- Calculate base length from selected edges
  IF edges_l1 THEN 
    base_length := base_length + part_length_mm;
    total_edges := total_edges + 1;
  END IF;
  IF edges_l2 THEN 
    base_length := base_length + part_length_mm;
    total_edges := total_edges + 1;
  END IF;
  IF edges_w1 THEN 
    base_length := base_length + part_width_mm;
    total_edges := total_edges + 1;
  END IF;
  IF edges_w2 THEN 
    base_length := base_length + part_width_mm;
    total_edges := total_edges + 1;
  END IF;
  
  -- Add overhang (2× per edge for both ends)
  base_length := base_length + (overhang_mm * 2 * total_edges);
  
  -- Apply waste factor
  adjusted_length := base_length * (1 + waste_factor_pct / 100);
  
  RETURN ROUND(adjusted_length, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_edgeband_length IS 'Calculates total edgeband length including overhang and waste factor. Overhang is added to both ends of each edge. Waste factor is a percentage increase.';




