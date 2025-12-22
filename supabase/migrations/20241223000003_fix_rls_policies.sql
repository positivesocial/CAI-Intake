-- ============================================================
-- Fix RLS Policies for Shortcode Configs and Operation Types
-- Corrects role name mismatches between policies and user_role enum
-- ============================================================

-- ============================================================
-- FIX SHORTCODE_CONFIGS RLS POLICIES
-- The original policies used 'admin' and 'owner' which don't exist
-- Correct roles are: super_admin, org_admin, manager, operator, viewer
-- ============================================================

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Admins can create shortcode configs" ON shortcode_configs;
DROP POLICY IF EXISTS "Admins can update shortcode configs" ON shortcode_configs;
DROP POLICY IF EXISTS "Admins can delete shortcode configs" ON shortcode_configs;

-- Create corrected policies with valid role names
CREATE POLICY "Admins can create shortcode configs"
ON shortcode_configs FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT organization_id FROM users 
    WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin', 'manager')
  )
);

CREATE POLICY "Admins can update shortcode configs"
ON shortcode_configs FOR UPDATE
USING (
  org_id IN (
    SELECT organization_id FROM users 
    WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin', 'manager')
  )
);

CREATE POLICY "Admins can delete shortcode configs"
ON shortcode_configs FOR DELETE
USING (
  org_id IN (
    SELECT organization_id FROM users 
    WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin', 'manager')
  )
);

-- ============================================================
-- FIX GROOVE_TYPES RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Org admins can manage groove types" ON public.groove_types;

CREATE POLICY "Org admins can manage groove types" ON public.groove_types
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('org_admin', 'super_admin', 'manager')
    )
  );

-- ============================================================
-- FIX HOLE_TYPES RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Org admins can manage hole types" ON public.hole_types;

CREATE POLICY "Org admins can manage hole types" ON public.hole_types
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('org_admin', 'super_admin', 'manager')
    )
  );

-- ============================================================
-- FIX CNC_OPERATION_TYPES RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Org admins can manage cnc operation types" ON public.cnc_operation_types;

CREATE POLICY "Org admins can manage cnc operation types" ON public.cnc_operation_types
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('org_admin', 'super_admin', 'manager')
    )
  );

-- ============================================================
-- ADD SUPER ADMIN BYPASS POLICIES
-- Super admins should be able to access all organization data
-- ============================================================

-- Allow super_admin to view all shortcode configs
CREATE POLICY "Super admins can view all shortcode configs"
ON shortcode_configs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow super_admin to view all groove types
CREATE POLICY "Super admins can view all groove types" ON public.groove_types
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow super_admin to view all hole types
CREATE POLICY "Super admins can view all hole types" ON public.hole_types
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow super_admin to view all CNC operation types
CREATE POLICY "Super admins can view all cnc operation types" ON public.cnc_operation_types
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);


