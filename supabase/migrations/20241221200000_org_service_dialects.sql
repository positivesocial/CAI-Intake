-- ============================================================
-- Organization Service Dialects
-- 
-- Stores per-organization configuration for translating external
-- service notations (edgebanding, grooves, drilling, CNC) to
-- canonical CabinetAI shortcodes.
-- ============================================================

-- Create the main dialects table
CREATE TABLE IF NOT EXISTS org_service_dialects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Metadata
  name TEXT NOT NULL DEFAULT 'Default',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Dialect configurations (JSON)
  -- Each section contains aliases, yes/no values, patterns, etc.
  edgeband_config JSONB NOT NULL DEFAULT '{
    "aliases": {},
    "yesValues": ["X", "XX", "1", "Y", "YES", "TRUE"],
    "noValues": ["", "-", "0", "N", "NO", "FALSE", "NONE"],
    "defaultIfBlank": null,
    "columnMappings": {}
  }'::jsonb,
  
  groove_config JSONB NOT NULL DEFAULT '{
    "aliases": {},
    "defaultWidthMm": 4,
    "defaultDepthMm": 10,
    "defaultOffsetMm": 10,
    "yesValues": ["X", "1", "Y", "YES", "G"],
    "noValues": ["", "-", "0", "N", "NO"],
    "columnMappings": {}
  }'::jsonb,
  
  drilling_config JSONB NOT NULL DEFAULT '{
    "hingePatterns": {},
    "shelfPatterns": {},
    "handlePatterns": {},
    "knobPatterns": {},
    "aliases": {}
  }'::jsonb,
  
  cnc_config JSONB NOT NULL DEFAULT '{
    "macros": {},
    "aliases": {}
  }'::jsonb,
  
  -- Settings
  use_ai_fallback BOOLEAN NOT NULL DEFAULT true,
  auto_learn BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Version for optimistic locking
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Unique constraint: one active dialect per org
  CONSTRAINT unique_active_dialect_per_org 
    UNIQUE NULLS NOT DISTINCT (organization_id, is_active) 
    WHERE (is_active = true)
);

-- Index for fast lookup by organization
CREATE INDEX IF NOT EXISTS idx_org_service_dialects_org 
  ON org_service_dialects(organization_id) 
  WHERE is_active = true;

-- ============================================================
-- Dialect Aliases Table
-- 
-- Stores individual alias mappings that are learned or manually
-- added. These get merged into the dialect config.
-- ============================================================

CREATE TABLE IF NOT EXISTS dialect_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  dialect_id UUID REFERENCES org_service_dialects(id) ON DELETE CASCADE,
  
  -- Alias type
  service_type TEXT NOT NULL CHECK (service_type IN ('edgeband', 'groove', 'drilling', 'cnc')),
  
  -- The external/customer notation
  external_code TEXT NOT NULL,
  
  -- The canonical CabinetAI code
  canonical_code TEXT NOT NULL,
  
  -- How this alias was created
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'learned', 'imported')),
  
  -- Learning metadata
  confidence REAL DEFAULT 1.0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Example that generated this alias (for reference)
  example_text TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one alias per external code per type per org
  CONSTRAINT unique_alias_per_org 
    UNIQUE (organization_id, service_type, external_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dialect_aliases_org 
  ON dialect_aliases(organization_id);
CREATE INDEX IF NOT EXISTS idx_dialect_aliases_lookup 
  ON dialect_aliases(organization_id, service_type, external_code);

-- ============================================================
-- Custom Patterns Table
-- 
-- Stores regex patterns for complex external formats that can't
-- be handled by simple alias mapping.
-- ============================================================

CREATE TABLE IF NOT EXISTS dialect_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  dialect_id UUID REFERENCES org_service_dialects(id) ON DELETE CASCADE,
  
  -- Pattern metadata
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN ('edgeband', 'groove', 'drilling', 'cnc')),
  
  -- The regex pattern (stored as string)
  pattern_regex TEXT NOT NULL,
  
  -- Handler code (simple mapping expression or function)
  -- e.g., '{ edges: ["L1", "L2"] }' or 'match => ({ edges: [match[1]] })'
  handler_code TEXT NOT NULL,
  
  -- Priority (higher = checked first)
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Is this pattern enabled?
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Example input that matches this pattern
  example_input TEXT,
  expected_output JSONB,
  
  -- Usage tracking
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dialect_patterns_org 
  ON dialect_patterns(organization_id);
CREATE INDEX IF NOT EXISTS idx_dialect_patterns_active 
  ON dialect_patterns(organization_id, service_type, is_enabled, priority DESC);

-- ============================================================
-- Triggers for updated_at
-- ============================================================

-- Function for updating timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for org_service_dialects
DROP TRIGGER IF EXISTS update_org_service_dialects_updated_at ON org_service_dialects;
CREATE TRIGGER update_org_service_dialects_updated_at
  BEFORE UPDATE ON org_service_dialects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for dialect_aliases
DROP TRIGGER IF EXISTS update_dialect_aliases_updated_at ON dialect_aliases;
CREATE TRIGGER update_dialect_aliases_updated_at
  BEFORE UPDATE ON dialect_aliases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for dialect_patterns
DROP TRIGGER IF EXISTS update_dialect_patterns_updated_at ON dialect_patterns;
CREATE TRIGGER update_dialect_patterns_updated_at
  BEFORE UPDATE ON dialect_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS Policies
-- ============================================================

-- Enable RLS
ALTER TABLE org_service_dialects ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialect_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialect_patterns ENABLE ROW LEVEL SECURITY;

-- Dialects: Org members can read, admins can write
CREATE POLICY dialect_select ON org_service_dialects
  FOR SELECT
  USING (
    organization_id IS NULL  -- Global defaults readable by all
    OR organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY dialect_insert ON org_service_dialects
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'org_admin')
    )
  );

CREATE POLICY dialect_update ON org_service_dialects
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'org_admin')
    )
  );

CREATE POLICY dialect_delete ON org_service_dialects
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'org_admin')
    )
  );

-- Aliases: Same policies
CREATE POLICY aliases_select ON dialect_aliases
  FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY aliases_insert ON dialect_aliases
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY aliases_update ON dialect_aliases
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY aliases_delete ON dialect_aliases
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'org_admin')
    )
  );

-- Patterns: Same policies
CREATE POLICY patterns_select ON dialect_patterns
  FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY patterns_insert ON dialect_patterns
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'org_admin')
    )
  );

CREATE POLICY patterns_update ON dialect_patterns
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'org_admin')
    )
  );

CREATE POLICY patterns_delete ON dialect_patterns
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'org_admin')
    )
  );

-- ============================================================
-- Helper Functions
-- ============================================================

-- Function to get effective dialect for an organization
-- Merges org-specific with global defaults
CREATE OR REPLACE FUNCTION get_org_dialect(p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_dialect RECORD;
  v_default RECORD;
  v_result JSONB;
BEGIN
  -- Get organization's dialect
  SELECT * INTO v_dialect 
  FROM org_service_dialects 
  WHERE organization_id = p_organization_id AND is_active = true
  LIMIT 1;
  
  -- Get global default
  SELECT * INTO v_default 
  FROM org_service_dialects 
  WHERE organization_id IS NULL AND is_active = true
  LIMIT 1;
  
  -- If org has a dialect, use it (merged with default)
  IF v_dialect IS NOT NULL THEN
    v_result := jsonb_build_object(
      'id', v_dialect.id,
      'organizationId', v_dialect.organization_id,
      'name', v_dialect.name,
      'edgeband', COALESCE(v_dialect.edgeband_config, v_default.edgeband_config, '{}'::jsonb),
      'groove', COALESCE(v_dialect.groove_config, v_default.groove_config, '{}'::jsonb),
      'drilling', COALESCE(v_dialect.drilling_config, v_default.drilling_config, '{}'::jsonb),
      'cnc', COALESCE(v_dialect.cnc_config, v_default.cnc_config, '{}'::jsonb),
      'useAiFallback', v_dialect.use_ai_fallback,
      'autoLearn', v_dialect.auto_learn
    );
  -- Otherwise return default
  ELSIF v_default IS NOT NULL THEN
    v_result := jsonb_build_object(
      'id', v_default.id,
      'organizationId', NULL,
      'name', 'Default',
      'edgeband', v_default.edgeband_config,
      'groove', v_default.groove_config,
      'drilling', v_default.drilling_config,
      'cnc', v_default.cnc_config,
      'useAiFallback', v_default.use_ai_fallback,
      'autoLearn', v_default.auto_learn
    );
  -- No dialect found
  ELSE
    v_result := NULL;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a learned alias
CREATE OR REPLACE FUNCTION learn_dialect_alias(
  p_organization_id UUID,
  p_service_type TEXT,
  p_external_code TEXT,
  p_canonical_code TEXT,
  p_example_text TEXT DEFAULT NULL,
  p_confidence REAL DEFAULT 0.8
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO dialect_aliases (
    organization_id,
    service_type,
    external_code,
    canonical_code,
    source,
    confidence,
    usage_count,
    example_text
  )
  VALUES (
    p_organization_id,
    p_service_type,
    p_external_code,
    p_canonical_code,
    'learned',
    p_confidence,
    1,
    p_example_text
  )
  ON CONFLICT (organization_id, service_type, external_code)
  DO UPDATE SET
    canonical_code = EXCLUDED.canonical_code,
    confidence = GREATEST(dialect_aliases.confidence, EXCLUDED.confidence),
    usage_count = dialect_aliases.usage_count + 1,
    last_used_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment alias usage
CREATE OR REPLACE FUNCTION increment_alias_usage(
  p_organization_id UUID,
  p_service_type TEXT,
  p_external_code TEXT,
  p_success BOOLEAN DEFAULT true
)
RETURNS VOID AS $$
BEGIN
  UPDATE dialect_aliases
  SET 
    usage_count = usage_count + 1,
    success_count = success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    last_used_at = now()
  WHERE 
    organization_id = p_organization_id
    AND service_type = p_service_type
    AND external_code = p_external_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Insert global default dialect
-- ============================================================

INSERT INTO org_service_dialects (
  organization_id,
  name,
  description,
  edgeband_config,
  groove_config,
  drilling_config,
  cnc_config,
  use_ai_fallback,
  auto_learn
)
VALUES (
  NULL,
  'CabinetAI Default',
  'Standard dialect supporting common industry formats',
  '{
    "aliases": {
      "ALL": "2L2W",
      "4": "2L2W",
      "4S": "2L2W",
      "4SIDES": "2L2W",
      "FULL": "2L2W",
      "LONG": "2L",
      "SHORT": "2W",
      "WIDTH": "2W"
    },
    "yesValues": ["X", "XX", "1", "Y", "YES", "TRUE", "✓"],
    "noValues": ["", "-", "0", "N", "NO", "FALSE", "NONE"],
    "defaultIfBlank": null,
    "columnMappings": {
      "L1": ["L1", "LONG1", "EDGE L1"],
      "L2": ["L2", "LONG2", "EDGE L2"],
      "W1": ["W1", "WIDTH1", "SHORT1", "EDGE W1"],
      "W2": ["W2", "WIDTH2", "SHORT2", "EDGE W2"],
      "long": ["L", "LONG", "LONG EDGES"],
      "width": ["W", "WIDTH", "SHORT EDGES"],
      "all": ["ALL", "ALL EDGES", "EDGING", "EB"]
    }
  }'::jsonb,
  '{
    "aliases": {
      "BACK": "GW2-4-10",
      "BACKPANEL": "GW2-4-10",
      "BP": "GW2-4-10",
      "BOTTOM": "GW1-4-12",
      "BTM": "GW1-4-12",
      "DRAWER": "GW1-4-12"
    },
    "defaultWidthMm": 4,
    "defaultDepthMm": 10,
    "defaultOffsetMm": 10,
    "yesValues": ["X", "1", "Y", "YES", "G"],
    "noValues": ["", "-", "0", "N", "NO"],
    "columnMappings": {
      "long": ["GROOVE L", "GRV L"],
      "width": ["GROOVE W", "GRV W"],
      "back": ["GROOVE BACK", "BACK GROOVE", "BP GROOVE"],
      "bottom": ["GROOVE BTM", "BTM GROOVE", "DRAWER GROOVE"]
    }
  }'::jsonb,
  '{
    "hingePatterns": {
      "STD": {"refEdge": "L1", "offsetsMm": [100], "distanceFromEdgeMm": 22, "count": 2},
      "110": {"refEdge": "L1", "offsetsMm": [110], "distanceFromEdgeMm": 22, "count": 2},
      "3H-100": {"refEdge": "L1", "offsetsMm": [100], "distanceFromEdgeMm": 22, "count": 3}
    },
    "shelfPatterns": {
      "32MM": {"refEdge": "L1", "offsetsMm": [37, 69, 101], "distanceFromEdgeMm": 37},
      "32": {"refEdge": "L1", "offsetsMm": [37, 69, 101], "distanceFromEdgeMm": 37},
      "SYSTEM32": {"refEdge": "L1", "offsetsMm": [37, 69, 101], "distanceFromEdgeMm": 37}
    },
    "handlePatterns": {
      "96": {"refEdge": "L1", "offsetsMm": [0, 96], "distanceFromEdgeMm": 30},
      "CC96": {"refEdge": "L1", "offsetsMm": [0, 96], "distanceFromEdgeMm": 30},
      "128": {"refEdge": "L1", "offsetsMm": [0, 128], "distanceFromEdgeMm": 30},
      "CC128": {"refEdge": "L1", "offsetsMm": [0, 128], "distanceFromEdgeMm": 30}
    },
    "knobPatterns": {
      "CENTER": {"refEdge": "L1", "offsetsMm": [], "distanceFromEdgeMm": 0},
      "CTR": {"refEdge": "L1", "offsetsMm": [], "distanceFromEdgeMm": 0}
    },
    "aliases": {
      "HINGE": "H2-100",
      "HINGES": "H2-100",
      "SHELF": "SP-32",
      "PINS": "SP-32",
      "HANDLE": "HD-CC96",
      "KNOB": "KN-CTR"
    }
  }'::jsonb,
  '{
    "macros": {
      "SINK-600x500": {"type": "cutout", "shapeId": "sink_rect", "params": {"width": 600, "height": 500}},
      "HOB-580x510": {"type": "cutout", "shapeId": "hob_rect", "params": {"width": 580, "height": 510}},
      "R3": {"type": "radius", "shapeId": "corner_radius", "params": {"radius": 3, "corners": "all"}},
      "R6": {"type": "radius", "shapeId": "corner_radius", "params": {"radius": 6, "corners": "all"}}
    },
    "aliases": {
      "SINK": "SINK-600x500",
      "HOB": "HOB-580x510",
      "COOKTOP": "HOB-580x510",
      "RADIUS": "R3",
      "ROUNDED": "R3"
    }
  }'::jsonb,
  true,
  true
)
ON CONFLICT DO NOTHING;

