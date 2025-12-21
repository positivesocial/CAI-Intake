-- CAI Intake - File Cache Table
-- Stores parsed file results by hash for faster reprocessing

-- Create the file_cache table
CREATE TABLE IF NOT EXISTS file_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  parts JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  cached_at BIGINT NOT NULL,
  ttl_ms BIGINT NOT NULL DEFAULT 86400000, -- 24 hours default
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint on hash + org for efficient lookups
  UNIQUE(file_hash, org_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_file_cache_file_hash ON file_cache(file_hash);
CREATE INDEX IF NOT EXISTS idx_file_cache_org_id ON file_cache(org_id);
CREATE INDEX IF NOT EXISTS idx_file_cache_cached_at ON file_cache(cached_at);

-- Enable RLS
ALTER TABLE file_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view cache entries for their organization
CREATE POLICY "Users can view own org file cache"
ON file_cache FOR SELECT
USING (
  org_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Users can insert cache entries for their organization
CREATE POLICY "Users can create file cache entries"
ON file_cache FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Users can update cache entries for their organization
CREATE POLICY "Users can update file cache entries"
ON file_cache FOR UPDATE
USING (
  org_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Users can delete cache entries for their organization
CREATE POLICY "Users can delete file cache entries"
ON file_cache FOR DELETE
USING (
  org_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_file_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM file_cache
  WHERE (cached_at + ttl_ms) < (EXTRACT(EPOCH FROM NOW()) * 1000);
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON TABLE file_cache IS 'Cache for parsed file results by content hash';

