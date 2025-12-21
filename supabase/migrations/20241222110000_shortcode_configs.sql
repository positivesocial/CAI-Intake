-- CAI Intake - Shortcode Configurations Table
-- Stores organization-specific shortcode customizations

-- Create the shortcode_configs table
CREATE TABLE IF NOT EXISTS shortcode_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  shortcode TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  default_specs JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique shortcode per org and service type
  UNIQUE(org_id, service_type, shortcode)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shortcode_configs_org_id ON shortcode_configs(org_id);
CREATE INDEX IF NOT EXISTS idx_shortcode_configs_service_type ON shortcode_configs(service_type);
CREATE INDEX IF NOT EXISTS idx_shortcode_configs_active ON shortcode_configs(is_active) WHERE is_active = true;

-- Add check constraint for service_type
ALTER TABLE shortcode_configs
ADD CONSTRAINT chk_service_type 
CHECK (service_type IN ('edgeband', 'groove', 'hole', 'cnc', 'material', 'custom'));

-- Enable RLS
ALTER TABLE shortcode_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view shortcode configs for their organization
CREATE POLICY "Users can view own org shortcode configs"
ON shortcode_configs FOR SELECT
USING (
  org_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Admins can insert shortcode configs for their organization
CREATE POLICY "Admins can create shortcode configs"
ON shortcode_configs FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT organization_id FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Admins can update shortcode configs for their organization
CREATE POLICY "Admins can update shortcode configs"
ON shortcode_configs FOR UPDATE
USING (
  org_id IN (
    SELECT organization_id FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Admins can delete shortcode configs for their organization
CREATE POLICY "Admins can delete shortcode configs"
ON shortcode_configs FOR DELETE
USING (
  org_id IN (
    SELECT organization_id FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_shortcode_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shortcode_configs_updated_at
BEFORE UPDATE ON shortcode_configs
FOR EACH ROW
EXECUTE FUNCTION update_shortcode_configs_updated_at();

-- Add comment
COMMENT ON TABLE shortcode_configs IS 'Organization-specific shortcode configurations with system defaults fallback';

