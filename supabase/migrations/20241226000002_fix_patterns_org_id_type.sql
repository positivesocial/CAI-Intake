-- ============================================================
-- Fix Patterns Tables organization_id Type
-- Changes organization_id from UUID to TEXT to match organizations.id (cuid)
-- ============================================================

-- ============================================================
-- FIX hole_patterns TABLE
-- ============================================================

-- Drop constraints and indexes that depend on organization_id
ALTER TABLE IF EXISTS public.hole_patterns 
  DROP CONSTRAINT IF EXISTS hole_patterns_organization_id_fkey;

-- Alter the column type from UUID to TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'hole_patterns' 
    AND column_name = 'organization_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.hole_patterns 
      ALTER COLUMN organization_id TYPE TEXT USING organization_id::text;
  END IF;
END $$;

-- ============================================================
-- FIX groove_profiles TABLE
-- ============================================================

ALTER TABLE IF EXISTS public.groove_profiles 
  DROP CONSTRAINT IF EXISTS groove_profiles_organization_id_fkey;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'groove_profiles' 
    AND column_name = 'organization_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.groove_profiles 
      ALTER COLUMN organization_id TYPE TEXT USING organization_id::text;
  END IF;
END $$;

-- ============================================================
-- FIX routing_profiles TABLE
-- ============================================================

ALTER TABLE IF EXISTS public.routing_profiles 
  DROP CONSTRAINT IF EXISTS routing_profiles_organization_id_fkey;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'routing_profiles' 
    AND column_name = 'organization_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.routing_profiles 
      ALTER COLUMN organization_id TYPE TEXT USING organization_id::text;
  END IF;
END $$;

-- ============================================================
-- ENSURE RLS POLICIES ARE CORRECT
-- ============================================================

-- Hole patterns policies
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

-- Groove profiles policies
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

-- Routing profiles policies
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

-- ============================================================
-- SEED DEFAULT PATTERNS FOR ALL ORGS (if not already present)
-- ============================================================

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
-- Done
-- ============================================================

