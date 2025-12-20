-- =============================================================================
-- CAI Intake - Row Level Security Policies
-- =============================================================================
-- This migration enables RLS on all tables and creates policies for
-- multi-tenant data isolation and access control.
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get the current user's organization ID from JWT
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    (SELECT organization_id FROM users WHERE id = auth.uid()::text)
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to check if current user is a super admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM users WHERE id = auth.uid()::text),
    false
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION auth.user_has_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT auth.is_super_admin() OR EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()::text
    AND r.name = ANY(required_roles)
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- =============================================================================
-- ORGANIZATIONS TABLE
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Super admins can see all organizations
CREATE POLICY "Super admins can view all organizations"
ON organizations FOR SELECT
TO authenticated
USING (auth.is_super_admin());

-- Users can view their own organization
CREATE POLICY "Users can view their organization"
ON organizations FOR SELECT
TO authenticated
USING (id = auth.user_organization_id());

-- Super admins can manage all organizations
CREATE POLICY "Super admins can manage organizations"
ON organizations FOR ALL
TO authenticated
USING (auth.is_super_admin());

-- Org admins can update their organization
CREATE POLICY "Org admins can update their organization"
ON organizations FOR UPDATE
TO authenticated
USING (
  id = auth.user_organization_id() 
  AND auth.user_has_role(ARRAY['org_admin'])
);

-- =============================================================================
-- USERS TABLE
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Super admins can see all users
CREATE POLICY "Super admins can view all users"
ON users FOR SELECT
TO authenticated
USING (auth.is_super_admin());

-- Users can see members of their organization
CREATE POLICY "Users can view organization members"
ON users FOR SELECT
TO authenticated
USING (organization_id = auth.user_organization_id());

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
TO authenticated
USING (id = auth.uid()::text);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
TO authenticated
USING (id = auth.uid()::text);

-- Org admins can manage users in their organization
CREATE POLICY "Org admins can manage organization users"
ON users FOR ALL
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin', 'manager'])
);

-- Super admins can manage all users
CREATE POLICY "Super admins can manage all users"
ON users FOR ALL
TO authenticated
USING (auth.is_super_admin());

-- =============================================================================
-- ROLES TABLE
-- =============================================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view roles
CREATE POLICY "Authenticated users can view roles"
ON roles FOR SELECT
TO authenticated
USING (true);

-- Only super admins can manage roles
CREATE POLICY "Super admins can manage roles"
ON roles FOR ALL
TO authenticated
USING (auth.is_super_admin());

-- =============================================================================
-- CUTLISTS TABLE
-- =============================================================================

ALTER TABLE cutlists ENABLE ROW LEVEL SECURITY;

-- Super admins can see all cutlists
CREATE POLICY "Super admins can view all cutlists"
ON cutlists FOR SELECT
TO authenticated
USING (auth.is_super_admin());

-- Users can view cutlists in their organization
CREATE POLICY "Users can view organization cutlists"
ON cutlists FOR SELECT
TO authenticated
USING (organization_id = auth.user_organization_id());

-- Users can create cutlists in their organization
CREATE POLICY "Users can create cutlists"
ON cutlists FOR INSERT
TO authenticated
WITH CHECK (organization_id = auth.user_organization_id());

-- Users can update cutlists they own or in their org (with role)
CREATE POLICY "Users can update own cutlists"
ON cutlists FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()::text
  OR (
    organization_id = auth.user_organization_id()
    AND auth.user_has_role(ARRAY['org_admin', 'manager'])
  )
);

-- Users can delete cutlists they own or in their org (with role)
CREATE POLICY "Users can delete own cutlists"
ON cutlists FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()::text
  OR (
    organization_id = auth.user_organization_id()
    AND auth.user_has_role(ARRAY['org_admin', 'manager'])
  )
);

-- =============================================================================
-- CUT_PARTS TABLE
-- =============================================================================

ALTER TABLE cut_parts ENABLE ROW LEVEL SECURITY;

-- Parts inherit access from their cutlist
CREATE POLICY "Users can view parts of accessible cutlists"
ON cut_parts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cutlists c
    WHERE c.id = cutlist_id
    AND (
      c.organization_id = auth.user_organization_id()
      OR auth.is_super_admin()
    )
  )
);

CREATE POLICY "Users can manage parts of accessible cutlists"
ON cut_parts FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cutlists c
    WHERE c.id = cutlist_id
    AND (
      c.user_id = auth.uid()::text
      OR (
        c.organization_id = auth.user_organization_id()
        AND auth.user_has_role(ARRAY['org_admin', 'manager', 'operator'])
      )
      OR auth.is_super_admin()
    )
  )
);

-- =============================================================================
-- MATERIALS TABLE
-- =============================================================================

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Users can view materials in their organization
CREATE POLICY "Users can view organization materials"
ON materials FOR SELECT
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  OR auth.is_super_admin()
);

-- Managers+ can create materials
CREATE POLICY "Managers can create materials"
ON materials FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin', 'manager'])
);

-- Managers+ can update materials
CREATE POLICY "Managers can update materials"
ON materials FOR UPDATE
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin', 'manager'])
);

-- Managers+ can delete materials
CREATE POLICY "Managers can delete materials"
ON materials FOR DELETE
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin', 'manager'])
);

-- =============================================================================
-- EDGEBANDS TABLE
-- =============================================================================

ALTER TABLE edgebands ENABLE ROW LEVEL SECURITY;

-- Same policies as materials
CREATE POLICY "Users can view organization edgebands"
ON edgebands FOR SELECT
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  OR auth.is_super_admin()
);

CREATE POLICY "Managers can manage edgebands"
ON edgebands FOR ALL
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin', 'manager'])
);

-- =============================================================================
-- PARSE_JOBS TABLE
-- =============================================================================

ALTER TABLE parse_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization parse jobs"
ON parse_jobs FOR SELECT
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  OR auth.is_super_admin()
);

CREATE POLICY "Users can create parse jobs"
ON parse_jobs FOR INSERT
TO authenticated
WITH CHECK (organization_id = auth.user_organization_id());

CREATE POLICY "Users can update own parse jobs"
ON parse_jobs FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()::text
  OR auth.is_super_admin()
);

-- =============================================================================
-- OPTIMIZE_JOBS TABLE
-- =============================================================================

ALTER TABLE optimize_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization optimize jobs"
ON optimize_jobs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cutlists c
    WHERE c.id = cutlist_id
    AND (
      c.organization_id = auth.user_organization_id()
      OR auth.is_super_admin()
    )
  )
);

CREATE POLICY "Users can create optimize jobs"
ON optimize_jobs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cutlists c
    WHERE c.id = cutlist_id
    AND c.organization_id = auth.user_organization_id()
  )
);

-- =============================================================================
-- UPLOADED_FILES TABLE
-- =============================================================================

ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization files"
ON uploaded_files FOR SELECT
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  OR auth.is_super_admin()
);

CREATE POLICY "Users can upload files"
ON uploaded_files FOR INSERT
TO authenticated
WITH CHECK (organization_id = auth.user_organization_id());

CREATE POLICY "Users can delete own files"
ON uploaded_files FOR DELETE
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin', 'manager'])
);

-- =============================================================================
-- EXPORTS TABLE
-- =============================================================================

ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization exports"
ON exports FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cutlists c
    WHERE c.id = cutlist_id
    AND (
      c.organization_id = auth.user_organization_id()
      OR auth.is_super_admin()
    )
  )
);

CREATE POLICY "Users can create exports"
ON exports FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cutlists c
    WHERE c.id = cutlist_id
    AND c.organization_id = auth.user_organization_id()
  )
);

-- =============================================================================
-- TEMPLATES TABLE
-- =============================================================================

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization templates"
ON templates FOR SELECT
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  OR auth.is_super_admin()
);

CREATE POLICY "Managers can manage templates"
ON templates FOR ALL
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin', 'manager'])
);

-- =============================================================================
-- INVITATIONS TABLE
-- =============================================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view invitations"
ON invitations FOR SELECT
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin', 'manager'])
);

CREATE POLICY "Org admins can create invitations"
ON invitations FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin', 'manager'])
);

CREATE POLICY "Org admins can delete invitations"
ON invitations FOR DELETE
TO authenticated
USING (
  organization_id = auth.user_organization_id()
  AND auth.user_has_role(ARRAY['org_admin'])
);

-- =============================================================================
-- SESSIONS TABLE
-- =============================================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
ON sessions FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own sessions"
ON sessions FOR DELETE
TO authenticated
USING (user_id = auth.uid()::text);

-- =============================================================================
-- AUDIT_LOGS TABLE
-- =============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Org admins can view audit logs for their organization
CREATE POLICY "Org admins can view audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  (
    organization_id = auth.user_organization_id()
    AND auth.user_has_role(ARRAY['org_admin'])
  )
  OR auth.is_super_admin()
);

-- System can insert audit logs (via service role)
CREATE POLICY "Service can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- =============================================================================
-- PLATFORM_SETTINGS TABLE
-- =============================================================================

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can access platform settings
CREATE POLICY "Super admins can manage platform settings"
ON platform_settings FOR ALL
TO authenticated
USING (auth.is_super_admin());

