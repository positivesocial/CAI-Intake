-- ============================================================
-- Operations Libraries Migration
-- Creates per-organization tables for:
-- - Hole Patterns (drilling patterns like hinges, shelf pins)
-- - Groove Profiles (groove specifications like back panel, drawer bottom)
-- - Routing Profiles (CNC operations like cutouts, edge profiles, radii)
-- ============================================================

-- ============================================================
-- HOLE PATTERNS TABLE
-- ============================================================

CREATE TABLE public.hole_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Identifiers
  pattern_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Pattern type
  kind VARCHAR(50) NOT NULL, -- hinge, shelf_pins, handle, knob, drawer_slide, cam_lock, dowel, system32, custom
  
  -- Hole specifications (JSONB array of holes)
  -- Each hole: { x: number, y: number, dia_mm: number, depth_mm?: number, through?: boolean }
  holes JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Reference positioning
  ref_edge VARCHAR(10), -- L1, L2, W1, W2 (which edge the pattern is relative to)
  ref_corner VARCHAR(20), -- top_left, top_right, bottom_left, bottom_right
  
  -- System 32 / parametric settings
  parametric_config JSONB, -- { spacing_mm: 32, margin_mm: 37, rows: 'auto' }
  
  -- Hardware reference
  hardware_id VARCHAR(100),
  hardware_brand VARCHAR(100),
  hardware_model VARCHAR(100),
  
  -- Metadata
  is_system BOOLEAN DEFAULT FALSE, -- System-provided patterns (cannot be deleted by org)
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT hole_patterns_org_pattern_id_unique UNIQUE(organization_id, pattern_id)
);

-- Indexes for hole_patterns
CREATE INDEX idx_hole_patterns_org ON public.hole_patterns(organization_id);
CREATE INDEX idx_hole_patterns_kind ON public.hole_patterns(kind);
CREATE INDEX idx_hole_patterns_active ON public.hole_patterns(is_active) WHERE is_active = true;
CREATE INDEX idx_hole_patterns_usage ON public.hole_patterns(usage_count DESC);

-- ============================================================
-- GROOVE PROFILES TABLE
-- ============================================================

CREATE TABLE public.groove_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Identifiers
  profile_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Groove specifications
  width_mm DECIMAL(6,2) NOT NULL,
  depth_mm DECIMAL(6,2) NOT NULL,
  
  -- Purpose/type
  purpose VARCHAR(50), -- back_panel, drawer_bottom, light_profile, glass_panel, divider, custom
  
  -- Default positioning
  default_offset_mm DECIMAL(6,2) DEFAULT 10,
  default_face VARCHAR(10) DEFAULT 'back', -- front, back
  
  -- Stopped groove settings
  allow_stopped BOOLEAN DEFAULT TRUE,
  default_start_offset_mm DECIMAL(6,2) DEFAULT 0,
  default_end_offset_mm DECIMAL(6,2) DEFAULT 0,
  
  -- Tooling
  tool_dia_mm DECIMAL(6,2),
  tool_id VARCHAR(100),
  feed_rate INT,
  
  -- Metadata
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT groove_profiles_org_profile_id_unique UNIQUE(organization_id, profile_id)
);

-- Indexes for groove_profiles
CREATE INDEX idx_groove_profiles_org ON public.groove_profiles(organization_id);
CREATE INDEX idx_groove_profiles_purpose ON public.groove_profiles(purpose);
CREATE INDEX idx_groove_profiles_active ON public.groove_profiles(is_active) WHERE is_active = true;
CREATE INDEX idx_groove_profiles_usage ON public.groove_profiles(usage_count DESC);

-- ============================================================
-- ROUTING PROFILES TABLE
-- ============================================================

CREATE TABLE public.routing_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Identifiers
  profile_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Profile type
  profile_type VARCHAR(50) NOT NULL, -- edge_profile, pocket, cutout, rebate, chamfer, radius, contour, drill_array, text, custom
  
  -- Profile specifications (JSONB for flexibility based on type)
  -- edge_profile: { shape: 'ogee'|'bevel'|'round'|'custom', radius_mm?: number, angle_deg?: number, depth_mm?: number }
  -- pocket: { default_depth_mm: number, through_allowed: boolean, corner_radius_mm?: number }
  -- cutout: { shape: 'rect'|'circle'|'oval'|'custom', purpose?: 'sink'|'hob'|'vent'|'socket', corner_radius_mm?: number }
  -- radius: { radius_mm: number, corners: 'all'|'front'|'back'|'left'|'right'|string[] }
  -- chamfer: { width_mm: number, angle_deg: number }
  -- rebate: { width_mm: number, depth_mm: number }
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Tooling
  tool_dia_mm DECIMAL(6,2),
  tool_id VARCHAR(100),
  tool_type VARCHAR(50), -- straight, spiral_up, spiral_down, compression, vbit, ballnose, ogee
  feed_rate INT,
  plunge_rate INT,
  spindle_speed INT,
  step_down_mm DECIMAL(6,2),
  
  -- Output/export
  dxf_layer VARCHAR(100),
  gcode_template TEXT,
  
  -- Metadata
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT routing_profiles_org_profile_id_unique UNIQUE(organization_id, profile_id)
);

-- Indexes for routing_profiles
CREATE INDEX idx_routing_profiles_org ON public.routing_profiles(organization_id);
CREATE INDEX idx_routing_profiles_type ON public.routing_profiles(profile_type);
CREATE INDEX idx_routing_profiles_active ON public.routing_profiles(is_active) WHERE is_active = true;
CREATE INDEX idx_routing_profiles_usage ON public.routing_profiles(usage_count DESC);

-- ============================================================
-- SYSTEM SEED DATA - Hole Patterns
-- ============================================================

-- Create a system organization ID for global patterns (using a constant UUID)
-- These patterns will be visible to all orgs but owned by system

-- Hinge patterns (Blum-style)
INSERT INTO public.hole_patterns (organization_id, pattern_id, name, description, kind, holes, ref_edge, hardware_brand, is_system)
SELECT 
  o.id,
  'H2-110',
  '2 Hinges @ 110mm',
  'Standard 2-hinge setup for doors 400-900mm tall, 110mm from top/bottom',
  'hinge',
  '[
    {"x": 21.5, "y": 110, "dia_mm": 35, "depth_mm": 13},
    {"x": 21.5, "y": -110, "dia_mm": 35, "depth_mm": 13}
  ]'::jsonb,
  'L1',
  'Blum',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.hole_patterns hp WHERE hp.organization_id = o.id AND hp.pattern_id = 'H2-110');

INSERT INTO public.hole_patterns (organization_id, pattern_id, name, description, kind, holes, ref_edge, hardware_brand, is_system)
SELECT 
  o.id,
  'H3-100',
  '3 Hinges @ 100mm',
  'Standard 3-hinge setup for doors 900-1200mm tall',
  'hinge',
  '[
    {"x": 21.5, "y": 100, "dia_mm": 35, "depth_mm": 13},
    {"x": 21.5, "y": 0, "dia_mm": 35, "depth_mm": 13, "note": "center"},
    {"x": 21.5, "y": -100, "dia_mm": 35, "depth_mm": 13}
  ]'::jsonb,
  'L1',
  'Blum',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.hole_patterns hp WHERE hp.organization_id = o.id AND hp.pattern_id = 'H3-100');

-- Shelf pin patterns
INSERT INTO public.hole_patterns (organization_id, pattern_id, name, description, kind, holes, ref_edge, parametric_config, is_system)
SELECT 
  o.id,
  'SP-32',
  'System 32 Shelf Pins',
  '32mm system shelf pin column',
  'shelf_pins',
  '[]'::jsonb,
  'L1',
  '{"spacing_mm": 32, "margin_mm": 37, "rows": "auto", "hole_dia_mm": 5, "hole_depth_mm": 13}'::jsonb,
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.hole_patterns hp WHERE hp.organization_id = o.id AND hp.pattern_id = 'SP-32');

-- Handle patterns
INSERT INTO public.hole_patterns (organization_id, pattern_id, name, description, kind, holes, ref_edge, is_system)
SELECT 
  o.id,
  'HD-CC96',
  'Handle 96mm Centers',
  'Two holes with 96mm center-to-center spacing for standard handles',
  'handle',
  '[
    {"x": 0, "y": -48, "dia_mm": 5, "through": true},
    {"x": 0, "y": 48, "dia_mm": 5, "through": true}
  ]'::jsonb,
  null,
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.hole_patterns hp WHERE hp.organization_id = o.id AND hp.pattern_id = 'HD-CC96');

INSERT INTO public.hole_patterns (organization_id, pattern_id, name, description, kind, holes, ref_edge, is_system)
SELECT 
  o.id,
  'HD-CC128',
  'Handle 128mm Centers',
  'Two holes with 128mm center-to-center spacing for handles',
  'handle',
  '[
    {"x": 0, "y": -64, "dia_mm": 5, "through": true},
    {"x": 0, "y": 64, "dia_mm": 5, "through": true}
  ]'::jsonb,
  null,
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.hole_patterns hp WHERE hp.organization_id = o.id AND hp.pattern_id = 'HD-CC128');

-- Knob pattern
INSERT INTO public.hole_patterns (organization_id, pattern_id, name, description, kind, holes, is_system)
SELECT 
  o.id,
  'KN-CTR',
  'Knob Center',
  'Single centered hole for knob',
  'knob',
  '[{"x": 0, "y": 0, "dia_mm": 5, "through": true}]'::jsonb,
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.hole_patterns hp WHERE hp.organization_id = o.id AND hp.pattern_id = 'KN-CTR');

-- Cam lock pattern
INSERT INTO public.hole_patterns (organization_id, pattern_id, name, description, kind, holes, ref_edge, is_system)
SELECT 
  o.id,
  'CAM-STD',
  'Standard Cam Lock',
  'Cam lock with 8mm dowel and 15mm cam hole',
  'cam_lock',
  '[
    {"x": 37, "y": 0, "dia_mm": 8, "depth_mm": 25, "note": "dowel"},
    {"x": 37, "y": 34, "dia_mm": 15, "depth_mm": 13, "note": "cam"}
  ]'::jsonb,
  'W1',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.hole_patterns hp WHERE hp.organization_id = o.id AND hp.pattern_id = 'CAM-STD');

-- ============================================================
-- SYSTEM SEED DATA - Groove Profiles
-- ============================================================

INSERT INTO public.groove_profiles (organization_id, profile_id, name, description, purpose, width_mm, depth_mm, default_offset_mm, default_face, tool_dia_mm, is_system)
SELECT 
  o.id,
  'BACK-4x10',
  'Back Panel Groove',
  'Standard 4mm groove for 3mm back panels',
  'back_panel',
  4.0,
  10.0,
  10.0,
  'back',
  4.0,
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.groove_profiles gp WHERE gp.organization_id = o.id AND gp.profile_id = 'BACK-4x10');

INSERT INTO public.groove_profiles (organization_id, profile_id, name, description, purpose, width_mm, depth_mm, default_offset_mm, default_face, tool_dia_mm, is_system)
SELECT 
  o.id,
  'DRAWER-4x8',
  'Drawer Bottom Groove',
  'Standard 4mm groove for drawer bottoms at 12mm from edge',
  'drawer_bottom',
  4.0,
  8.0,
  12.0,
  'back',
  4.0,
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.groove_profiles gp WHERE gp.organization_id = o.id AND gp.profile_id = 'DRAWER-4x8');

INSERT INTO public.groove_profiles (organization_id, profile_id, name, description, purpose, width_mm, depth_mm, default_offset_mm, default_face, allow_stopped, is_system)
SELECT 
  o.id,
  'LIGHT-18x12',
  'Light Profile Groove',
  'Wide groove for LED light profiles',
  'light_profile',
  18.0,
  12.0,
  30.0,
  'front',
  true,
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.groove_profiles gp WHERE gp.organization_id = o.id AND gp.profile_id = 'LIGHT-18x12');

INSERT INTO public.groove_profiles (organization_id, profile_id, name, description, purpose, width_mm, depth_mm, default_offset_mm, default_face, is_system)
SELECT 
  o.id,
  'GLASS-4x12',
  'Glass Panel Groove',
  'Standard groove for 4mm glass panels',
  'glass_panel',
  4.0,
  12.0,
  15.0,
  'front',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.groove_profiles gp WHERE gp.organization_id = o.id AND gp.profile_id = 'GLASS-4x12');

INSERT INTO public.groove_profiles (organization_id, profile_id, name, description, purpose, width_mm, depth_mm, default_offset_mm, default_face, is_system)
SELECT 
  o.id,
  'DIVIDER-6x10',
  'Divider Groove',
  '6mm groove for vertical dividers',
  'divider',
  6.0,
  10.0,
  0.0,
  'front',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.groove_profiles gp WHERE gp.organization_id = o.id AND gp.profile_id = 'DIVIDER-6x10');

-- ============================================================
-- SYSTEM SEED DATA - Routing Profiles
-- ============================================================

INSERT INTO public.routing_profiles (organization_id, profile_id, name, description, profile_type, specifications, tool_dia_mm, tool_type, is_system)
SELECT 
  o.id,
  'CUTOUT-SINK',
  'Sink Cutout',
  'Rectangular cutout for undermount sink',
  'cutout',
  '{"shape": "rect", "purpose": "sink", "corner_radius_mm": 25, "through": true}'::jsonb,
  6.0,
  'spiral_down',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.routing_profiles rp WHERE rp.organization_id = o.id AND rp.profile_id = 'CUTOUT-SINK');

INSERT INTO public.routing_profiles (organization_id, profile_id, name, description, profile_type, specifications, tool_dia_mm, tool_type, is_system)
SELECT 
  o.id,
  'CUTOUT-HOB',
  'Hob Cutout',
  'Rectangular cutout for cooktop/hob',
  'cutout',
  '{"shape": "rect", "purpose": "hob", "corner_radius_mm": 10, "through": true}'::jsonb,
  6.0,
  'spiral_down',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.routing_profiles rp WHERE rp.organization_id = o.id AND rp.profile_id = 'CUTOUT-HOB');

INSERT INTO public.routing_profiles (organization_id, profile_id, name, description, profile_type, specifications, tool_dia_mm, tool_type, is_system)
SELECT 
  o.id,
  'RADIUS-25',
  'Corner Radius 25mm',
  'Standard 25mm radius on corners',
  'radius',
  '{"radius_mm": 25, "corners": "all"}'::jsonb,
  6.0,
  'spiral_down',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.routing_profiles rp WHERE rp.organization_id = o.id AND rp.profile_id = 'RADIUS-25');

INSERT INTO public.routing_profiles (organization_id, profile_id, name, description, profile_type, specifications, tool_dia_mm, tool_type, is_system)
SELECT 
  o.id,
  'RADIUS-10',
  'Corner Radius 10mm',
  'Small 10mm radius on corners',
  'radius',
  '{"radius_mm": 10, "corners": "all"}'::jsonb,
  6.0,
  'spiral_down',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.routing_profiles rp WHERE rp.organization_id = o.id AND rp.profile_id = 'RADIUS-10');

INSERT INTO public.routing_profiles (organization_id, profile_id, name, description, profile_type, specifications, tool_dia_mm, tool_type, is_system)
SELECT 
  o.id,
  'POCKET-HINGE',
  'Hinge Pocket',
  'Pocket for concealed hinge cup mounting plate',
  'pocket',
  '{"default_depth_mm": 2, "through_allowed": false, "width_mm": 48, "height_mm": 12}'::jsonb,
  6.0,
  'straight',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.routing_profiles rp WHERE rp.organization_id = o.id AND rp.profile_id = 'POCKET-HINGE');

INSERT INTO public.routing_profiles (organization_id, profile_id, name, description, profile_type, specifications, tool_dia_mm, tool_type, is_system)
SELECT 
  o.id,
  'EDGE-ROUND-3',
  'Round Over 3mm',
  '3mm round over edge profile',
  'edge_profile',
  '{"shape": "round", "radius_mm": 3}'::jsonb,
  6.0,
  'ballnose',
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.routing_profiles rp WHERE rp.organization_id = o.id AND rp.profile_id = 'EDGE-ROUND-3');

INSERT INTO public.routing_profiles (organization_id, profile_id, name, description, profile_type, specifications, is_system)
SELECT 
  o.id,
  'CHAMFER-45-3',
  '45° Chamfer 3mm',
  '3mm 45-degree chamfer',
  'chamfer',
  '{"angle_deg": 45, "width_mm": 3}'::jsonb,
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.routing_profiles rp WHERE rp.organization_id = o.id AND rp.profile_id = 'CHAMFER-45-3');

INSERT INTO public.routing_profiles (organization_id, profile_id, name, description, profile_type, specifications, tool_dia_mm, is_system)
SELECT 
  o.id,
  'REBATE-18x10',
  'Rebate 18×10',
  '18mm wide × 10mm deep rebate for back panels',
  'rebate',
  '{"width_mm": 18, "depth_mm": 10}'::jsonb,
  6.0,
  false
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.routing_profiles rp WHERE rp.organization_id = o.id AND rp.profile_id = 'REBATE-18x10');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS
ALTER TABLE public.hole_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groove_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_profiles ENABLE ROW LEVEL SECURITY;

-- Hole patterns policies
CREATE POLICY "Users can view their organization's hole patterns" ON public.hole_patterns
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM public.organizations 
      WHERE id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Org admins can manage hole patterns" ON public.hole_patterns
  FOR ALL
  USING (
    organization_id IN (
      SELECT o.id FROM public.organizations o
      JOIN public.users u ON u.organization_id = o.id
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'org_admin'
    )
  );

-- Groove profiles policies
CREATE POLICY "Users can view their organization's groove profiles" ON public.groove_profiles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM public.organizations 
      WHERE id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Org admins can manage groove profiles" ON public.groove_profiles
  FOR ALL
  USING (
    organization_id IN (
      SELECT o.id FROM public.organizations o
      JOIN public.users u ON u.organization_id = o.id
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'org_admin'
    )
  );

-- Routing profiles policies
CREATE POLICY "Users can view their organization's routing profiles" ON public.routing_profiles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM public.organizations 
      WHERE id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Org admins can manage routing profiles" ON public.routing_profiles
  FOR ALL
  USING (
    organization_id IN (
      SELECT o.id FROM public.organizations o
      JOIN public.users u ON u.organization_id = o.id
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'org_admin'
    )
  );

-- ============================================================
-- TRIGGERS FOR updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hole_patterns_updated_at
  BEFORE UPDATE ON public.hole_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groove_profiles_updated_at
  BEFORE UPDATE ON public.groove_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routing_profiles_updated_at
  BEFORE UPDATE ON public.routing_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTION: Clone system patterns for new organization
-- ============================================================

CREATE OR REPLACE FUNCTION clone_system_operations_for_org(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  v_source_org_id UUID;
BEGIN
  -- Get any existing organization that has patterns (to clone from)
  SELECT organization_id INTO v_source_org_id 
  FROM public.hole_patterns 
  WHERE is_system = false 
  LIMIT 1;
  
  -- If no source found, use the first org
  IF v_source_org_id IS NULL THEN
    SELECT id INTO v_source_org_id FROM public.organizations LIMIT 1;
  END IF;
  
  -- Don't clone if it's the same org or no source
  IF v_source_org_id IS NULL OR v_source_org_id = p_org_id THEN
    RETURN;
  END IF;
  
  -- Clone hole patterns
  INSERT INTO public.hole_patterns (
    organization_id, pattern_id, name, description, kind, holes, ref_edge, ref_corner,
    parametric_config, hardware_id, hardware_brand, hardware_model, is_system, is_active, metadata
  )
  SELECT 
    p_org_id, pattern_id, name, description, kind, holes, ref_edge, ref_corner,
    parametric_config, hardware_id, hardware_brand, hardware_model, false, true, metadata
  FROM public.hole_patterns
  WHERE organization_id = v_source_org_id
    AND NOT EXISTS (
      SELECT 1 FROM public.hole_patterns hp2 
      WHERE hp2.organization_id = p_org_id AND hp2.pattern_id = hole_patterns.pattern_id
    );
  
  -- Clone groove profiles
  INSERT INTO public.groove_profiles (
    organization_id, profile_id, name, description, width_mm, depth_mm, purpose,
    default_offset_mm, default_face, allow_stopped, default_start_offset_mm, default_end_offset_mm,
    tool_dia_mm, tool_id, feed_rate, is_system, is_active, metadata
  )
  SELECT 
    p_org_id, profile_id, name, description, width_mm, depth_mm, purpose,
    default_offset_mm, default_face, allow_stopped, default_start_offset_mm, default_end_offset_mm,
    tool_dia_mm, tool_id, feed_rate, false, true, metadata
  FROM public.groove_profiles
  WHERE organization_id = v_source_org_id
    AND NOT EXISTS (
      SELECT 1 FROM public.groove_profiles gp2 
      WHERE gp2.organization_id = p_org_id AND gp2.profile_id = groove_profiles.profile_id
    );
  
  -- Clone routing profiles
  INSERT INTO public.routing_profiles (
    organization_id, profile_id, name, description, profile_type, specifications,
    tool_dia_mm, tool_id, tool_type, feed_rate, plunge_rate, spindle_speed, step_down_mm,
    dxf_layer, gcode_template, is_system, is_active, metadata
  )
  SELECT 
    p_org_id, profile_id, name, description, profile_type, specifications,
    tool_dia_mm, tool_id, tool_type, feed_rate, plunge_rate, spindle_speed, step_down_mm,
    dxf_layer, gcode_template, false, true, metadata
  FROM public.routing_profiles
  WHERE organization_id = v_source_org_id
    AND NOT EXISTS (
      SELECT 1 FROM public.routing_profiles rp2 
      WHERE rp2.organization_id = p_org_id AND rp2.profile_id = routing_profiles.profile_id
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Increment usage count
-- ============================================================

CREATE OR REPLACE FUNCTION increment_hole_pattern_usage(p_org_id UUID, p_pattern_id VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE public.hole_patterns
  SET usage_count = usage_count + 1
  WHERE organization_id = p_org_id AND pattern_id = p_pattern_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_groove_profile_usage(p_org_id UUID, p_profile_id VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE public.groove_profiles
  SET usage_count = usage_count + 1
  WHERE organization_id = p_org_id AND profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_routing_profile_usage(p_org_id UUID, p_profile_id VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE public.routing_profiles
  SET usage_count = usage_count + 1
  WHERE organization_id = p_org_id AND profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.hole_patterns IS 'Per-organization library of reusable drilling patterns (hinges, shelf pins, handles, etc.)';
COMMENT ON TABLE public.groove_profiles IS 'Per-organization library of groove specifications (back panels, drawer bottoms, light profiles)';
COMMENT ON TABLE public.routing_profiles IS 'Per-organization library of CNC routing operations (cutouts, pockets, edge profiles, radii)';

COMMENT ON COLUMN public.hole_patterns.kind IS 'Pattern category: hinge, shelf_pins, handle, knob, drawer_slide, cam_lock, dowel, system32, custom';
COMMENT ON COLUMN public.hole_patterns.holes IS 'Array of hole definitions: [{x, y, dia_mm, depth_mm?, through?}]. Coordinates relative to ref_edge/ref_corner';
COMMENT ON COLUMN public.hole_patterns.parametric_config IS 'For system32/parametric patterns: {spacing_mm, margin_mm, rows, hole_dia_mm, hole_depth_mm}';

COMMENT ON COLUMN public.groove_profiles.purpose IS 'Groove usage: back_panel, drawer_bottom, light_profile, glass_panel, divider, custom';
COMMENT ON COLUMN public.groove_profiles.default_face IS 'Default groove face: front or back';

COMMENT ON COLUMN public.routing_profiles.profile_type IS 'Operation type: edge_profile, pocket, cutout, rebate, chamfer, radius, contour, drill_array, text, custom';
COMMENT ON COLUMN public.routing_profiles.specifications IS 'Type-specific JSON config. See migration comments for structure per type.';



