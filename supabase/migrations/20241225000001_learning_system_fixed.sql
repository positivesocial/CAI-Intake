-- CAI Intake - Learning System Schema (Fixed for TEXT organization_id)
-- Tables for adaptive parsing that learns from user corrections

-- ============================================================
-- PARSER PATTERNS
-- Learned patterns from user corrections (e.g., dimension formats, edge notations)
-- ============================================================

CREATE TABLE IF NOT EXISTS parser_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT,  -- References organizations(id)
  pattern_type VARCHAR(50) NOT NULL,  -- 'dimension_format', 'edge_notation', 'column_order', 'quantity_format'
  input_pattern TEXT NOT NULL,         -- Regex or example pattern
  output_mapping JSONB NOT NULL,       -- How to interpret the pattern
  description TEXT,                    -- Human-readable description
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parser_patterns_org ON parser_patterns(organization_id);
CREATE INDEX IF NOT EXISTS idx_parser_patterns_type ON parser_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_parser_patterns_confidence ON parser_patterns(confidence DESC);

-- ============================================================
-- MATERIAL MAPPINGS
-- Learn material name aliases from user corrections
-- ============================================================

CREATE TABLE IF NOT EXISTS material_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT,  -- References organizations(id)
  raw_name TEXT NOT NULL,              -- What user typed: "PB BLACK CHERRY", "18mm white mel"
  normalized_name TEXT,                -- Cleaned version for matching
  material_id VARCHAR(50) NOT NULL,    -- Canonical material ID
  thickness_mm DECIMAL(6,2),           -- Associated thickness if specified
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_material_mappings_org ON material_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_material_mappings_normalized ON material_mappings(normalized_name);
CREATE INDEX IF NOT EXISTS idx_material_mappings_material ON material_mappings(material_id);

-- ============================================================
-- CLIENT TEMPLATES
-- Learned format patterns for specific clients
-- ============================================================

CREATE TABLE IF NOT EXISTS client_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT,  -- References organizations(id)
  client_name TEXT NOT NULL,
  client_aliases TEXT[] DEFAULT '{}',  -- Alternative names/spellings
  column_order TEXT[] NOT NULL,        -- ['label', 'length', 'width', 'qty', 'edge_L', 'edge_W']
  edge_notation JSONB,                 -- { "X": ["L1"], "XX": ["W1","W2"], "x": "groove" }
  groove_notation JSONB,               -- { "x": "W2", "G": "L1" }
  default_material_id VARCHAR(50),
  default_thickness_mm DECIMAL(6,2),
  header_patterns TEXT[],              -- Patterns to recognize this client's format
  sample_rows JSONB,                   -- Example rows for reference
  notes TEXT,                          -- Admin notes about this client's format
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0.5,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_templates_org ON client_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_templates_name ON client_templates(client_name);
CREATE INDEX IF NOT EXISTS idx_client_templates_confidence ON client_templates(confidence DESC);

-- ============================================================
-- PARSE CORRECTIONS
-- History of user corrections for learning
-- ============================================================

DO $$ BEGIN
  CREATE TYPE correction_type AS ENUM (
    'dimension',      -- L/W/thickness changed
    'quantity',       -- Qty changed
    'material',       -- Material ID changed
    'label',          -- Part label changed
    'edge_banding',   -- Edge selections changed
    'groove',         -- Groove operations changed
    'cnc',            -- CNC operations changed
    'rotation',       -- Rotation allowed changed
    'grain',          -- Grain direction changed
    'complete_reject' -- Part completely rejected
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS parse_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT,  -- References organizations(id)
  user_id UUID,          -- References users(id)
  parse_job_id TEXT,     -- References parse_jobs(id)
  cutlist_id TEXT,       -- References cutlists(id)
  
  -- What changed
  correction_type correction_type NOT NULL,
  field_path TEXT,                     -- JSON path to the field that changed
  
  -- Before/after values
  original_value JSONB,                -- What AI parsed
  corrected_value JSONB,               -- What user corrected to
  original_part JSONB,                 -- Full original part (for context)
  corrected_part JSONB,                -- Full corrected part
  
  -- Source context
  source_text TEXT,                    -- Original input text that was parsed
  source_line_number INTEGER,          -- Line number in source
  source_file_name TEXT,               -- Original filename if from file
  
  -- Learning metadata
  pattern_extracted BOOLEAN DEFAULT FALSE,  -- Whether we extracted a pattern from this
  pattern_id UUID,  -- References parser_patterns(id)
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parse_corrections_org ON parse_corrections(organization_id);
CREATE INDEX IF NOT EXISTS idx_parse_corrections_user ON parse_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_parse_corrections_type ON parse_corrections(correction_type);
CREATE INDEX IF NOT EXISTS idx_parse_corrections_created ON parse_corrections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parse_corrections_pattern ON parse_corrections(pattern_extracted) WHERE NOT pattern_extracted;

-- ============================================================
-- OCR JOBS
-- Track OCR processing for files
-- ============================================================

DO $$ BEGIN
  CREATE TYPE ocr_provider AS ENUM ('openai', 'anthropic');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ocr_status AS ENUM ('queued', 'uploading', 'processing', 'parsing', 'complete', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS ocr_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT,  -- References organizations(id)
  user_id UUID,          -- References users(id)
  file_id UUID,          -- References files table if it exists
  cutlist_id TEXT,       -- References cutlists(id)
  
  -- File info
  filename TEXT NOT NULL,
  file_type VARCHAR(20),               -- 'pdf', 'image'
  file_size_bytes BIGINT,
  storage_path TEXT,
  
  -- Processing info
  provider ocr_provider NOT NULL DEFAULT 'openai',
  status ocr_status NOT NULL DEFAULT 'queued',
  
  -- Multi-page support
  total_pages INTEGER DEFAULT 1,
  current_page INTEGER DEFAULT 0,
  pages_processed INTEGER DEFAULT 0,
  
  -- Progress tracking
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  stage VARCHAR(50),                   -- Current processing stage
  
  -- Results
  extracted_text TEXT,                 -- Raw OCR text
  detected_format VARCHAR(50),         -- 'tabular', 'handwritten', 'mixed'
  parts_count INTEGER DEFAULT 0,
  confidence DECIMAL(3,2),
  
  -- Learning
  client_template_id UUID,  -- References client_templates(id)
  learning_applied BOOLEAN DEFAULT FALSE,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_org ON ocr_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_user ON ocr_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_created ON ocr_jobs(created_at DESC);

-- ============================================================
-- OCR PAGE RESULTS
-- Individual page results for multi-page documents
-- ============================================================

CREATE TABLE IF NOT EXISTS ocr_page_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ocr_job_id UUID NOT NULL,  -- References ocr_jobs(id)
  page_number INTEGER NOT NULL,
  
  -- OCR results
  extracted_text TEXT,
  confidence DECIMAL(3,2),
  
  -- Parsed parts from this page
  parts_count INTEGER DEFAULT 0,
  parts_data JSONB,                    -- Array of parsed parts
  
  -- Processing info
  processing_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(ocr_job_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_ocr_page_results_job ON ocr_page_results(ocr_job_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Update confidence based on success rate
CREATE OR REPLACE FUNCTION update_pattern_confidence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.usage_count > 0 THEN
    NEW.confidence := LEAST(0.99, NEW.success_count::DECIMAL / NEW.usage_count);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pattern_confidence ON parser_patterns;
CREATE TRIGGER trigger_update_pattern_confidence
  BEFORE UPDATE ON parser_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_pattern_confidence();

-- Update client template success rate
CREATE OR REPLACE FUNCTION update_template_success_rate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_template_success_rate ON client_templates;
CREATE TRIGGER trigger_update_template_success_rate
  BEFORE UPDATE ON client_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_template_success_rate();

-- ============================================================
-- ROW LEVEL SECURITY (Disabled for now - using service role access)
-- ============================================================

-- Note: RLS is disabled for these tables as they are accessed via service role
-- from the API. Add RLS policies later if direct client access is needed.

-- ============================================================
-- SEED DATA: Common patterns (only if table is empty)
-- ============================================================

INSERT INTO parser_patterns (organization_id, pattern_type, input_pattern, output_mapping, description, confidence)
SELECT NULL, 'edge_notation', 'X', '{"edges": ["L1"]}', 'Single X = edge on L1 (long side)', 0.9
WHERE NOT EXISTS (SELECT 1 FROM parser_patterns WHERE input_pattern = 'X' AND pattern_type = 'edge_notation');

INSERT INTO parser_patterns (organization_id, pattern_type, input_pattern, output_mapping, description, confidence)
SELECT NULL, 'edge_notation', 'XX', '{"edges": ["W1", "W2"]}', 'Double X = edges on both W sides', 0.9
WHERE NOT EXISTS (SELECT 1 FROM parser_patterns WHERE input_pattern = 'XX' AND pattern_type = 'edge_notation');

INSERT INTO parser_patterns (organization_id, pattern_type, input_pattern, output_mapping, description, confidence)
SELECT NULL, 'edge_notation', 'x', '{"groove": "W2"}', 'Lowercase x = groove (back panel)', 0.85
WHERE NOT EXISTS (SELECT 1 FROM parser_patterns WHERE input_pattern = 'x' AND pattern_type = 'edge_notation');

INSERT INTO parser_patterns (organization_id, pattern_type, input_pattern, output_mapping, description, confidence)
SELECT NULL, 'edge_notation', '4L', '{"edges": ["L1", "L2", "W1", "W2"]}', '4L = all four edges', 0.95
WHERE NOT EXISTS (SELECT 1 FROM parser_patterns WHERE input_pattern = '4L' AND pattern_type = 'edge_notation');

INSERT INTO parser_patterns (organization_id, pattern_type, input_pattern, output_mapping, description, confidence)
SELECT NULL, 'edge_notation', '2L', '{"edges": ["L1", "L2"]}', '2L = both long edges', 0.9
WHERE NOT EXISTS (SELECT 1 FROM parser_patterns WHERE input_pattern = '2L' AND pattern_type = 'edge_notation');

INSERT INTO parser_patterns (organization_id, pattern_type, input_pattern, output_mapping, description, confidence)
SELECT NULL, 'edge_notation', '2W', '{"edges": ["W1", "W2"]}', '2W = both short edges', 0.9
WHERE NOT EXISTS (SELECT 1 FROM parser_patterns WHERE input_pattern = '2W' AND pattern_type = 'edge_notation');

INSERT INTO parser_patterns (organization_id, pattern_type, input_pattern, output_mapping, description, confidence)
SELECT NULL, 'dimension_format', '(\d+)\s*[xX×]\s*(\d+)', '{"order": "LxW", "separator": "x"}', 'Standard LxW format', 0.95
WHERE NOT EXISTS (SELECT 1 FROM parser_patterns WHERE pattern_type = 'dimension_format' AND output_mapping->>'order' = 'LxW');

INSERT INTO parser_patterns (organization_id, pattern_type, input_pattern, output_mapping, description, confidence)
SELECT NULL, 'quantity_format', '[xX](\d+)', '{"prefix": "x"}', 'Quantity as x5, X10', 0.9
WHERE NOT EXISTS (SELECT 1 FROM parser_patterns WHERE pattern_type = 'quantity_format' AND output_mapping->>'prefix' = 'x');

