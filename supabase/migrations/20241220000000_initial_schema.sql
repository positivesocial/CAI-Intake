-- CAI Intake - Initial Database Schema
-- Creates all tables for the cutlist management system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'org_admin',
  'manager',
  'operator',
  'viewer'
);

CREATE TYPE cutlist_status AS ENUM (
  'draft',
  'pending',
  'processing',
  'completed',
  'archived'
);

CREATE TYPE parse_job_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

CREATE TYPE parse_source_type AS ENUM (
  'text',
  'file',
  'voice',
  'api'
);

CREATE TYPE template_type AS ENUM (
  'intake_form',
  'export',
  'label'
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  role user_role DEFAULT 'operator',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- MATERIALS
-- ============================================================

CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  material_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  thickness_mm DECIMAL(6,2) NOT NULL,
  core_type VARCHAR(50),
  grain VARCHAR(20),
  finish VARCHAR(100),
  color_code VARCHAR(20),
  default_sheet_l DECIMAL(8,2),
  default_sheet_w DECIMAL(8,2),
  cost_per_sqm DECIMAL(10,2),
  supplier VARCHAR(255),
  sku VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, material_id)
);

CREATE INDEX idx_materials_organization ON materials(organization_id);
CREATE INDEX idx_materials_material_id ON materials(material_id);

-- ============================================================
-- EDGEBANDS
-- ============================================================

CREATE TABLE edgebands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  edgeband_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  thickness_mm DECIMAL(4,2) NOT NULL,
  width_mm DECIMAL(6,2) NOT NULL,
  material VARCHAR(100),
  color_code VARCHAR(20),
  cost_per_meter DECIMAL(8,2),
  supplier VARCHAR(255),
  sku VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, edgeband_id)
);

CREATE INDEX idx_edgebands_organization ON edgebands(organization_id);

-- ============================================================
-- CUTLISTS
-- ============================================================

CREATE TABLE cutlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  job_ref VARCHAR(100),
  client_ref VARCHAR(100),
  status cutlist_status DEFAULT 'draft',
  capabilities JSONB DEFAULT '{
    "core_parts": true,
    "edging": true,
    "grooves": false,
    "cnc_holes": false,
    "cnc_routing": false,
    "custom_cnc": false,
    "advanced_grouping": false,
    "part_notes": true
  }',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, doc_id)
);

CREATE INDEX idx_cutlists_organization ON cutlists(organization_id);
CREATE INDEX idx_cutlists_user ON cutlists(user_id);
CREATE INDEX idx_cutlists_status ON cutlists(status);
CREATE INDEX idx_cutlists_created ON cutlists(created_at DESC);

-- ============================================================
-- PARTS
-- ============================================================

CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cutlist_id UUID NOT NULL REFERENCES cutlists(id) ON DELETE CASCADE,
  part_id VARCHAR(50) NOT NULL,
  label VARCHAR(255),
  qty INTEGER NOT NULL CHECK (qty > 0),
  length_mm DECIMAL(8,2) NOT NULL CHECK (length_mm > 0),
  width_mm DECIMAL(8,2) NOT NULL CHECK (width_mm > 0),
  thickness_mm DECIMAL(6,2) NOT NULL CHECK (thickness_mm > 0),
  material_id VARCHAR(50) NOT NULL,
  grain VARCHAR(20) DEFAULT 'none',
  allow_rotation BOOLEAN DEFAULT true,
  group_id VARCHAR(50),
  priority INTEGER,
  ops JSONB,
  notes JSONB,
  audit JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cutlist_id, part_id)
);

CREATE INDEX idx_parts_cutlist ON parts(cutlist_id);
CREATE INDEX idx_parts_material ON parts(material_id);
CREATE INDEX idx_parts_group ON parts(group_id);

-- ============================================================
-- PARSE JOBS
-- ============================================================

CREATE TABLE parse_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cutlist_id UUID REFERENCES cutlists(id) ON DELETE SET NULL,
  source_type parse_source_type NOT NULL,
  source_data JSONB NOT NULL,
  status parse_job_status DEFAULT 'pending',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parse_jobs_organization ON parse_jobs(organization_id);
CREATE INDEX idx_parse_jobs_user ON parse_jobs(user_id);
CREATE INDEX idx_parse_jobs_status ON parse_jobs(status);

-- ============================================================
-- FILES
-- ============================================================

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_organization ON files(organization_id);
CREATE INDEX idx_files_user ON files(user_id);

-- ============================================================
-- TEMPLATES
-- ============================================================

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type template_type NOT NULL,
  config JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_organization ON templates(organization_id);
CREATE INDEX idx_templates_type ON templates(type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE edgebands ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parse_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can see their own organization
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Users: Users can view themselves and others in their org
CREATE POLICY "Users can view users in their organization" ON users
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    OR id = auth.uid()
  );

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Materials: Organization members can view/manage
CREATE POLICY "Organization members can view materials" ON materials
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Managers can manage materials" ON materials
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin', 'manager')
    )
  );

-- Edgebands: Similar to materials
CREATE POLICY "Organization members can view edgebands" ON edgebands
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Managers can manage edgebands" ON edgebands
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin', 'manager')
    )
  );

-- Cutlists: Organization members can view, operators+ can manage their own
CREATE POLICY "Organization members can view cutlists" ON cutlists
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can manage their own cutlists" ON cutlists
  FOR ALL USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin', 'manager')
    )
  );

-- Parts: Based on cutlist access
CREATE POLICY "Users can view parts in accessible cutlists" ON parts
  FOR SELECT USING (
    cutlist_id IN (
      SELECT id FROM cutlists WHERE 
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can manage parts in their cutlists" ON parts
  FOR ALL USING (
    cutlist_id IN (
      SELECT id FROM cutlists WHERE 
        user_id = auth.uid() OR
        organization_id IN (
          SELECT organization_id FROM users 
          WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin', 'manager')
        )
    )
  );

-- Parse jobs: Users can see their own, managers can see all in org
CREATE POLICY "Users can view their parse jobs" ON parse_jobs
  FOR SELECT USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin', 'manager')
    )
  );

CREATE POLICY "Users can create parse jobs" ON parse_jobs
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- Files: Similar to parse jobs
CREATE POLICY "Users can view their files" ON files
  FOR SELECT USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin', 'manager')
    )
  );

CREATE POLICY "Users can manage their files" ON files
  FOR ALL USING (user_id = auth.uid());

-- Templates: Organization members can view, admins can manage
CREATE POLICY "Organization members can view templates" ON templates
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage templates" ON templates
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'org_admin')
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_edgebands_updated_at
  BEFORE UPDATE ON edgebands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cutlists_updated_at
  BEFORE UPDATE ON cutlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_parse_jobs_updated_at
  BEFORE UPDATE ON parse_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- HELPER FUNCTION: Create user profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();





