-- ============================================================
-- Operation Type Codes Migration
-- Creates per-organization tables for operation type shortcodes:
-- - Groove Types (custom organization-defined types with codes)
-- - Hole Types (custom organization-defined hole type codes)
-- - CNC Operation Types (custom organization-defined CNC operation codes)
-- These complement the existing profile tables with simpler shortcode mappings
-- ============================================================

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- GROOVE TYPES TABLE (Custom per-org)
-- Used for shortcode display like GR:D:8x4@W1 where D=Dado
-- ============================================================

-- Note: organization_id is TEXT to match Prisma-created organizations.id (cuid)
CREATE TABLE IF NOT EXISTS public.groove_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Short code for UI display (e.g., 'D', 'R', 'T', 'BP')
  code VARCHAR(20) NOT NULL,
  
  -- Display name (e.g., 'Dado', 'Rabbet', 'Tongue')
  name VARCHAR(100) NOT NULL,
  
  -- Default specifications
  default_width_mm DECIMAL(6,2),
  default_depth_mm DECIMAL(6,2),
  
  -- Optional description
  description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT groove_types_org_code_unique UNIQUE(organization_id, code)
);

-- Indexes for groove_types
CREATE INDEX IF NOT EXISTS idx_groove_types_org ON public.groove_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_groove_types_active ON public.groove_types(is_active) WHERE is_active = true;

-- ============================================================
-- HOLE TYPES TABLE (Custom per-org)
-- Used for shortcode display like H:S32@F where S32=System 32
-- ============================================================

-- Note: organization_id is TEXT to match Prisma-created organizations.id (cuid)
CREATE TABLE IF NOT EXISTS public.hole_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Short code for UI display (e.g., 'S32', 'SP', 'HG35', 'CAM')
  code VARCHAR(20) NOT NULL,
  
  -- Display name (e.g., 'System 32', 'Shelf Pins', 'Hinge 35mm')
  name VARCHAR(100) NOT NULL,
  
  -- Default specifications
  diameter_mm DECIMAL(6,2),
  depth_mm DECIMAL(6,2),
  spacing_mm DECIMAL(6,2),
  
  -- Optional linked pattern_id from hole_patterns table
  pattern_id VARCHAR(50),
  
  -- Optional description
  description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT hole_types_org_code_unique UNIQUE(organization_id, code)
);

-- Indexes for hole_types
CREATE INDEX IF NOT EXISTS idx_hole_types_org ON public.hole_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_hole_types_active ON public.hole_types(is_active) WHERE is_active = true;

-- ============================================================
-- CNC OPERATION TYPES TABLE (Custom per-org)
-- Used for shortcode display like CNC:HINGE
-- ============================================================

-- Note: organization_id is TEXT to match Prisma-created organizations.id (cuid)
CREATE TABLE IF NOT EXISTS public.cnc_operation_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Short code for UI display (e.g., 'HINGE', 'DRAWER', 'PKT', 'SINK')
  code VARCHAR(20) NOT NULL,
  
  -- Display name (e.g., 'Hinge Bore', 'Drawer Slide', 'Handle Pocket')
  name VARCHAR(100) NOT NULL,
  
  -- Operation type category
  op_type VARCHAR(50), -- pocket, profile, drill, engrave, cutout, custom
  
  -- Default parameters as JSON
  default_params JSONB DEFAULT '{}'::jsonb,
  
  -- Optional linked routing_profile_id
  profile_id VARCHAR(50),
  
  -- Optional description
  description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT cnc_operation_types_org_code_unique UNIQUE(organization_id, code)
);

-- Indexes for cnc_operation_types
CREATE INDEX IF NOT EXISTS idx_cnc_operation_types_org ON public.cnc_operation_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_cnc_operation_types_active ON public.cnc_operation_types(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cnc_operation_types_type ON public.cnc_operation_types(op_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS
ALTER TABLE public.groove_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hole_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnc_operation_types ENABLE ROW LEVEL SECURITY;

-- Groove types policies
-- Note: Cast auth.uid() to TEXT to match Prisma users.id type
-- Joins with roles table since Prisma uses role_id FK
CREATE POLICY "Users can view their organization's groove types" ON public.groove_types
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()::text
    )
  );

CREATE POLICY "Org admins can manage groove types" ON public.groove_types
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin', 'manager'))
    )
  );

-- Hole types policies
CREATE POLICY "Users can view their organization's hole types" ON public.hole_types
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()::text
    )
  );

CREATE POLICY "Org admins can manage hole types" ON public.hole_types
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin', 'manager'))
    )
  );

-- CNC operation types policies
CREATE POLICY "Users can view their organization's cnc operation types" ON public.cnc_operation_types
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()::text
    )
  );

CREATE POLICY "Org admins can manage cnc operation types" ON public.cnc_operation_types
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin', 'manager'))
    )
  );

-- ============================================================
-- TRIGGERS FOR updated_at
-- ============================================================

CREATE TRIGGER update_groove_types_updated_at
  BEFORE UPDATE ON public.groove_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hole_types_updated_at
  BEFORE UPDATE ON public.hole_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cnc_operation_types_updated_at
  BEFORE UPDATE ON public.cnc_operation_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DEFAULT TYPES FOR EXISTING ORGANIZATIONS
-- ============================================================

-- Insert default groove types for all organizations
INSERT INTO public.groove_types (organization_id, code, name, default_width_mm, default_depth_mm, description)
SELECT 
  o.id,
  types.code,
  types.name,
  types.width_mm,
  types.depth_mm,
  types.description
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('D', 'Dado', 4.0, 8.0, 'Standard dado groove for panels'),
    ('R', 'Rabbet', 10.0, 10.0, 'Rabbet/rebate for back panels'),
    ('T', 'Tongue', 6.0, 8.0, 'Tongue for tongue & groove joints'),
    ('BP', 'Back Panel', 4.0, 10.0, 'Groove for back panels'),
    ('DB', 'Drawer Bottom', 6.0, 10.0, 'Groove for drawer bottoms'),
    ('C', 'Custom', NULL, NULL, 'Custom groove specifications')
) AS types(code, name, width_mm, depth_mm, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.groove_types gt 
  WHERE gt.organization_id = o.id AND gt.code = types.code
);

-- Insert default hole types for all organizations
INSERT INTO public.hole_types (organization_id, code, name, diameter_mm, depth_mm, spacing_mm, description)
SELECT 
  o.id,
  types.code,
  types.name,
  types.diameter_mm,
  types.depth_mm,
  types.spacing_mm,
  types.description
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('S32', 'System 32', 5.0, 13.0, 32.0, 'System 32 shelf pin holes'),
    ('SP', 'Shelf Pins', 5.0, 13.0, 32.0, 'Standard shelf pin holes'),
    ('HG35', 'Hinge 35mm', 35.0, 13.0, NULL, '35mm European hinge cup'),
    ('HG26', 'Hinge 26mm', 26.0, 13.0, NULL, '26mm compact hinge cup'),
    ('CAM', 'Cam Lock', 15.0, 12.5, NULL, 'Cam lock fastener hole'),
    ('DW', 'Dowel', 8.0, 25.0, NULL, 'Dowel hole for joints'),
    ('HD', 'Handle', 5.0, NULL, NULL, 'Handle mounting holes'),
    ('C', 'Custom', NULL, NULL, NULL, 'Custom hole pattern')
) AS types(code, name, diameter_mm, depth_mm, spacing_mm, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hole_types ht 
  WHERE ht.organization_id = o.id AND ht.code = types.code
);

-- Insert default CNC operation types for all organizations
INSERT INTO public.cnc_operation_types (organization_id, code, name, op_type, description)
SELECT 
  o.id,
  types.code,
  types.name,
  types.op_type,
  types.description
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('HINGE', 'Hinge Bore', 'drill', 'Hinge cup boring operation'),
    ('DRAWER', 'Drawer Slide', 'drill', 'Drawer slide mounting holes'),
    ('SHELF', 'Shelf Pins', 'drill', 'Shelf pin holes (System 32)'),
    ('HDL', 'Handle', 'drill', 'Handle mounting holes'),
    ('PKT', 'Pocket', 'pocket', 'Pocket routing operation'),
    ('SINK', 'Sink Cutout', 'cutout', 'Sink cutout routing'),
    ('HOB', 'Hob Cutout', 'cutout', 'Cooktop/hob cutout'),
    ('RAD', 'Corner Radius', 'profile', 'Corner radius routing'),
    ('ENG', 'Engraving', 'engrave', 'Text or logo engraving'),
    ('C', 'Custom', 'custom', 'Custom CNC operation')
) AS types(code, name, op_type, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cnc_operation_types ct 
  WHERE ct.organization_id = o.id AND ct.code = types.code
);

-- ============================================================
-- FUNCTION: Create default types for new organization
-- ============================================================

CREATE OR REPLACE FUNCTION create_default_operation_types(p_org_id TEXT)
RETURNS VOID AS $$
BEGIN
  -- Insert default groove types
  INSERT INTO public.groove_types (organization_id, code, name, default_width_mm, default_depth_mm, description)
  VALUES 
    (p_org_id, 'D', 'Dado', 4.0, 8.0, 'Standard dado groove for panels'),
    (p_org_id, 'R', 'Rabbet', 10.0, 10.0, 'Rabbet/rebate for back panels'),
    (p_org_id, 'T', 'Tongue', 6.0, 8.0, 'Tongue for tongue & groove joints'),
    (p_org_id, 'BP', 'Back Panel', 4.0, 10.0, 'Groove for back panels'),
    (p_org_id, 'DB', 'Drawer Bottom', 6.0, 10.0, 'Groove for drawer bottoms'),
    (p_org_id, 'C', 'Custom', NULL, NULL, 'Custom groove specifications')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- Insert default hole types
  INSERT INTO public.hole_types (organization_id, code, name, diameter_mm, depth_mm, spacing_mm, description)
  VALUES 
    (p_org_id, 'S32', 'System 32', 5.0, 13.0, 32.0, 'System 32 shelf pin holes'),
    (p_org_id, 'SP', 'Shelf Pins', 5.0, 13.0, 32.0, 'Standard shelf pin holes'),
    (p_org_id, 'HG35', 'Hinge 35mm', 35.0, 13.0, NULL, '35mm European hinge cup'),
    (p_org_id, 'HG26', 'Hinge 26mm', 26.0, 13.0, NULL, '26mm compact hinge cup'),
    (p_org_id, 'CAM', 'Cam Lock', 15.0, 12.5, NULL, 'Cam lock fastener hole'),
    (p_org_id, 'DW', 'Dowel', 8.0, 25.0, NULL, 'Dowel hole for joints'),
    (p_org_id, 'HD', 'Handle', 5.0, NULL, NULL, 'Handle mounting holes'),
    (p_org_id, 'C', 'Custom', NULL, NULL, NULL, 'Custom hole pattern')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- Insert default CNC operation types
  INSERT INTO public.cnc_operation_types (organization_id, code, name, op_type, description)
  VALUES 
    (p_org_id, 'HINGE', 'Hinge Bore', 'drill', 'Hinge cup boring operation'),
    (p_org_id, 'DRAWER', 'Drawer Slide', 'drill', 'Drawer slide mounting holes'),
    (p_org_id, 'SHELF', 'Shelf Pins', 'drill', 'Shelf pin holes (System 32)'),
    (p_org_id, 'HDL', 'Handle', 'drill', 'Handle mounting holes'),
    (p_org_id, 'PKT', 'Pocket', 'pocket', 'Pocket routing operation'),
    (p_org_id, 'SINK', 'Sink Cutout', 'cutout', 'Sink cutout routing'),
    (p_org_id, 'HOB', 'Hob Cutout', 'cutout', 'Cooktop/hob cutout'),
    (p_org_id, 'RAD', 'Corner Radius', 'profile', 'Corner radius routing'),
    (p_org_id, 'ENG', 'Engraving', 'engrave', 'Text or logo engraving'),
    (p_org_id, 'C', 'Custom', 'custom', 'Custom CNC operation')
  ON CONFLICT (organization_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.groove_types IS 'Organization-defined groove type shortcodes for quick UI entry';
COMMENT ON TABLE public.hole_types IS 'Organization-defined hole type shortcodes for quick UI entry';
COMMENT ON TABLE public.cnc_operation_types IS 'Organization-defined CNC operation shortcodes for quick UI entry';

COMMENT ON COLUMN public.groove_types.code IS 'Short code for shortcode display (e.g., D, R, BP)';
COMMENT ON COLUMN public.hole_types.code IS 'Short code for shortcode display (e.g., S32, HG35)';
COMMENT ON COLUMN public.cnc_operation_types.code IS 'Short code for shortcode display (e.g., HINGE, PKT)';

