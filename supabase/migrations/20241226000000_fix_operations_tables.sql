-- ============================================================
-- Fix Operations Tables Migration
-- Ensures all operations-related tables exist with correct types
-- and proper RLS policies
-- ============================================================

-- Create uuid extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- HOLE PATTERNS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hole_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL,
  
  pattern_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  kind VARCHAR(50) NOT NULL,
  holes JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  ref_edge VARCHAR(10),
  ref_corner VARCHAR(20),
  parametric_config JSONB,
  
  hardware_id VARCHAR(100),
  hardware_brand VARCHAR(100),
  hardware_model VARCHAR(100),
  
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(organization_id, pattern_id)
);

-- Create indexes for hole_patterns
CREATE INDEX IF NOT EXISTS idx_hole_patterns_org ON public.hole_patterns(organization_id);
CREATE INDEX IF NOT EXISTS idx_hole_patterns_kind ON public.hole_patterns(kind);
CREATE INDEX IF NOT EXISTS idx_hole_patterns_active ON public.hole_patterns(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.hole_patterns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view their organization's hole patterns" ON public.hole_patterns;
DROP POLICY IF EXISTS "Org admins can manage hole patterns" ON public.hole_patterns;

CREATE POLICY "Users can view their organization's hole patterns" ON public.hole_patterns
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()::text
    )
  );

CREATE POLICY "Org admins can manage hole patterns" ON public.hole_patterns
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin', 'manager'))
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_hole_patterns_updated_at ON public.hole_patterns;
CREATE TRIGGER update_hole_patterns_updated_at
  BEFORE UPDATE ON public.hole_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GROOVE PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.groove_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL,
  
  profile_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  width_mm DECIMAL(6,2) NOT NULL,
  depth_mm DECIMAL(6,2) NOT NULL,
  
  purpose VARCHAR(50),
  default_offset_mm DECIMAL(6,2) DEFAULT 10,
  default_face VARCHAR(10) DEFAULT 'back',
  
  allow_stopped BOOLEAN DEFAULT TRUE,
  default_start_offset_mm DECIMAL(6,2) DEFAULT 0,
  default_end_offset_mm DECIMAL(6,2) DEFAULT 0,
  
  tool_dia_mm DECIMAL(6,2),
  tool_id VARCHAR(100),
  feed_rate INT,
  
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(organization_id, profile_id)
);

-- Create indexes for groove_profiles
CREATE INDEX IF NOT EXISTS idx_groove_profiles_org ON public.groove_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_groove_profiles_purpose ON public.groove_profiles(purpose);
CREATE INDEX IF NOT EXISTS idx_groove_profiles_active ON public.groove_profiles(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.groove_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view their organization's groove profiles" ON public.groove_profiles;
DROP POLICY IF EXISTS "Org admins can manage groove profiles" ON public.groove_profiles;

CREATE POLICY "Users can view their organization's groove profiles" ON public.groove_profiles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()::text
    )
  );

CREATE POLICY "Org admins can manage groove profiles" ON public.groove_profiles
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin', 'manager'))
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_groove_profiles_updated_at ON public.groove_profiles;
CREATE TRIGGER update_groove_profiles_updated_at
  BEFORE UPDATE ON public.groove_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROUTING PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.routing_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL,
  
  profile_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  profile_type VARCHAR(50) NOT NULL,
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  tool_dia_mm DECIMAL(6,2),
  tool_id VARCHAR(100),
  tool_type VARCHAR(50),
  feed_rate INT,
  plunge_rate INT,
  spindle_speed INT,
  step_down_mm DECIMAL(6,2),
  
  dxf_layer VARCHAR(50),
  gcode_template TEXT,
  
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(organization_id, profile_id)
);

-- Create indexes for routing_profiles
CREATE INDEX IF NOT EXISTS idx_routing_profiles_org ON public.routing_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_routing_profiles_type ON public.routing_profiles(profile_type);
CREATE INDEX IF NOT EXISTS idx_routing_profiles_active ON public.routing_profiles(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.routing_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view their organization's routing profiles" ON public.routing_profiles;
DROP POLICY IF EXISTS "Org admins can manage routing profiles" ON public.routing_profiles;

CREATE POLICY "Users can view their organization's routing profiles" ON public.routing_profiles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()::text
    )
  );

CREATE POLICY "Org admins can manage routing profiles" ON public.routing_profiles
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin', 'manager'))
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_routing_profiles_updated_at ON public.routing_profiles;
CREATE TRIGGER update_routing_profiles_updated_at
  BEFORE UPDATE ON public.routing_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GROOVE TYPES TABLE (Custom per-org shortcodes)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.groove_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL,
  
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  default_width_mm DECIMAL(6,2),
  default_depth_mm DECIMAL(6,2),
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT groove_types_org_code_unique UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_groove_types_org ON public.groove_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_groove_types_active ON public.groove_types(is_active) WHERE is_active = true;

ALTER TABLE public.groove_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organization's groove types" ON public.groove_types;
DROP POLICY IF EXISTS "Org admins can manage groove types" ON public.groove_types;

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

DROP TRIGGER IF EXISTS update_groove_types_updated_at ON public.groove_types;
CREATE TRIGGER update_groove_types_updated_at
  BEFORE UPDATE ON public.groove_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- HOLE TYPES TABLE (Custom per-org shortcodes)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hole_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL,
  
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  diameter_mm DECIMAL(6,2),
  depth_mm DECIMAL(6,2),
  spacing_mm DECIMAL(6,2),
  pattern_id VARCHAR(50),
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT hole_types_org_code_unique UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hole_types_org ON public.hole_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_hole_types_active ON public.hole_types(is_active) WHERE is_active = true;

ALTER TABLE public.hole_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organization's hole types" ON public.hole_types;
DROP POLICY IF EXISTS "Org admins can manage hole types" ON public.hole_types;

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

DROP TRIGGER IF EXISTS update_hole_types_updated_at ON public.hole_types;
CREATE TRIGGER update_hole_types_updated_at
  BEFORE UPDATE ON public.hole_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CNC OPERATION TYPES TABLE (Custom per-org shortcodes)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cnc_operation_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL,
  
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  op_type VARCHAR(50),
  default_params JSONB DEFAULT '{}'::jsonb,
  profile_id VARCHAR(50),
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT cnc_operation_types_org_code_unique UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cnc_operation_types_org ON public.cnc_operation_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_cnc_operation_types_active ON public.cnc_operation_types(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cnc_operation_types_type ON public.cnc_operation_types(op_type);

ALTER TABLE public.cnc_operation_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organization's cnc operation types" ON public.cnc_operation_types;
DROP POLICY IF EXISTS "Org admins can manage cnc operation types" ON public.cnc_operation_types;

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

DROP TRIGGER IF EXISTS update_cnc_operation_types_updated_at ON public.cnc_operation_types;
CREATE TRIGGER update_cnc_operation_types_updated_at
  BEFORE UPDATE ON public.cnc_operation_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Note: shortcode_configs table uses org_id (not organization_id) per existing migration
-- Skipping re-creation as it already exists with proper schema in 20241222110000_shortcode_configs.sql

-- ============================================================
-- SEED DEFAULT DATA FOR ALL ORGANIZATIONS
-- ============================================================

-- Seed default groove types
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
ON CONFLICT (organization_id, code) DO NOTHING;

-- Seed default hole types
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
ON CONFLICT (organization_id, code) DO NOTHING;

-- Seed default CNC operation types
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
ON CONFLICT (organization_id, code) DO NOTHING;

-- Seed default hole patterns
INSERT INTO public.hole_patterns (organization_id, pattern_id, name, kind, holes, is_system, description)
SELECT 
  o.id,
  patterns.pattern_id,
  patterns.name,
  patterns.kind,
  patterns.holes::jsonb,
  true,
  patterns.description
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('HINGE_35', 'Hinge 35mm Cup', 'hinge', '[{"x":0,"y":0,"dia_mm":35,"depth_mm":13}]', 'Standard 35mm European hinge cup'),
    ('HINGE_26', 'Hinge 26mm Cup', 'hinge', '[{"x":0,"y":0,"dia_mm":26,"depth_mm":13}]', 'Compact 26mm hinge cup'),
    ('SYS32_5H', 'System 32 - 5 Holes', 'shelf_pins', '[{"x":37,"y":0,"dia_mm":5,"depth_mm":13},{"x":37,"y":32,"dia_mm":5,"depth_mm":13},{"x":37,"y":64,"dia_mm":5,"depth_mm":13},{"x":37,"y":96,"dia_mm":5,"depth_mm":13},{"x":37,"y":128,"dia_mm":5,"depth_mm":13}]', 'System 32 vertical row of 5 shelf pin holes'),
    ('CAM_LOCK', 'Cam Lock Pair', 'cam_lock', '[{"x":0,"y":0,"dia_mm":15,"depth_mm":12.5},{"x":34,"y":0,"dia_mm":8,"depth_mm":35,"through":true}]', 'Cam lock fitting hole pair'),
    ('HANDLE_CC96', 'Handle CC96', 'handle', '[{"x":0,"y":0,"dia_mm":5,"depth_mm":25},{"x":96,"y":0,"dia_mm":5,"depth_mm":25}]', 'Handle holes at 96mm centers'),
    ('HANDLE_CC128', 'Handle CC128', 'handle', '[{"x":0,"y":0,"dia_mm":5,"depth_mm":25},{"x":128,"y":0,"dia_mm":5,"depth_mm":25}]', 'Handle holes at 128mm centers')
) AS patterns(pattern_id, name, kind, holes, description)
ON CONFLICT (organization_id, pattern_id) DO NOTHING;

-- Seed default groove profiles
INSERT INTO public.groove_profiles (organization_id, profile_id, name, width_mm, depth_mm, purpose, is_system, description)
SELECT 
  o.id,
  profiles.profile_id,
  profiles.name,
  profiles.width_mm,
  profiles.depth_mm,
  profiles.purpose,
  true,
  profiles.description
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('BP_4x10', 'Back Panel 4x10', 4.0, 10.0, 'back_panel', 'Standard groove for 4mm back panels'),
    ('BP_6x10', 'Back Panel 6x10', 6.0, 10.0, 'back_panel', 'Groove for 6mm back panels'),
    ('DB_6x10', 'Drawer Bottom 6x10', 6.0, 10.0, 'drawer_bottom', 'Standard groove for drawer bottoms'),
    ('DADO_18', 'Dado for 18mm', 18.0, 10.0, 'divider', 'Dado for 18mm dividers/shelves'),
    ('TONGUE_6x8', 'Tongue 6x8', 6.0, 8.0, 'custom', 'Tongue for T&G joints')
) AS profiles(profile_id, name, width_mm, depth_mm, purpose, description)
ON CONFLICT (organization_id, profile_id) DO NOTHING;

-- Seed default routing profiles
INSERT INTO public.routing_profiles (organization_id, profile_id, name, profile_type, specifications, is_system, description)
SELECT 
  o.id,
  profiles.profile_id,
  profiles.name,
  profiles.profile_type,
  profiles.specifications::jsonb,
  true,
  profiles.description
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('EDGE_ROUND_3', 'Edge Round 3mm', 'edge_profile', '{"shape":"round","radius_mm":3}', '3mm radius edge profile'),
    ('EDGE_CHAMFER_2x45', 'Chamfer 2x45°', 'chamfer', '{"width_mm":2,"angle_deg":45}', '2mm 45 degree chamfer'),
    ('SINK_CUTOUT', 'Sink Cutout', 'cutout', '{"shape":"rect","purpose":"sink","corner_radius_mm":25}', 'Rectangular sink cutout with rounded corners'),
    ('POCKET_STD', 'Standard Pocket', 'pocket', '{"default_depth_mm":10,"through_allowed":false}', 'Standard pocket routing'),
    ('CORNER_RAD_10', 'Corner Radius 10mm', 'radius', '{"radius_mm":10,"corners":"all"}', '10mm radius on all corners')
) AS profiles(profile_id, name, profile_type, specifications, description)
ON CONFLICT (organization_id, profile_id) DO NOTHING;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE public.hole_patterns IS 'Hole drilling patterns for CNC machines';
COMMENT ON TABLE public.groove_profiles IS 'Groove/dado profiles for routing operations';
COMMENT ON TABLE public.routing_profiles IS 'CNC routing profiles (edges, pockets, cutouts)';
COMMENT ON TABLE public.groove_types IS 'Organization-defined groove type shortcodes';
COMMENT ON TABLE public.hole_types IS 'Organization-defined hole type shortcodes';
COMMENT ON TABLE public.cnc_operation_types IS 'Organization-defined CNC operation shortcodes';

