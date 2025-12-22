-- ============================================================
-- Usage Tracking Migration
-- 
-- Creates tables and functions for tracking API usage,
-- costs, and analytics across organizations and users.
-- ============================================================

-- ============================================================
-- USAGE RECORDS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization/User tracking
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Action details
  action_type TEXT NOT NULL,  -- 'parse_file', 'parse_text', 'ocr', 'ai_chat', 'template_generate', etc.
  provider TEXT,              -- 'openai', 'anthropic', 'python_ocr', 'internal'
  model TEXT,                 -- 'gpt-4o', 'claude-3-5-sonnet', etc.
  
  -- Usage metrics
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  tokens_total INT GENERATED ALWAYS AS (tokens_input + tokens_output) STORED,
  
  -- Cost tracking (in USD, with 6 decimal precision)
  cost_usd DECIMAL(12,6) DEFAULT 0,
  
  -- Request/Response metadata
  request_metadata JSONB DEFAULT '{}'::jsonb,
  response_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Status tracking
  status TEXT DEFAULT 'success',  -- 'success', 'error', 'timeout', 'rate_limited'
  error_message TEXT,
  
  -- Timing
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_usage_org_id ON usage_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_action_type ON usage_records(action_type);
CREATE INDEX IF NOT EXISTS idx_usage_provider ON usage_records(provider);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_records(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_status ON usage_records(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_usage_org_created ON usage_records(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_action_created ON usage_records(action_type, created_at DESC);

-- ============================================================
-- DAILY USAGE AGGREGATES (MATERIALIZED VIEW)
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS usage_daily_stats AS
SELECT
  date_trunc('day', created_at) AS day,
  organization_id,
  action_type,
  provider,
  COUNT(*) AS request_count,
  SUM(tokens_input) AS total_tokens_input,
  SUM(tokens_output) AS total_tokens_output,
  SUM(tokens_total) AS total_tokens,
  SUM(cost_usd) AS total_cost_usd,
  AVG(duration_ms)::INT AS avg_duration_ms,
  COUNT(*) FILTER (WHERE status = 'success') AS success_count,
  COUNT(*) FILTER (WHERE status = 'error') AS error_count,
  COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limited_count
FROM usage_records
GROUP BY date_trunc('day', created_at), organization_id, action_type, provider;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_daily_unique 
ON usage_daily_stats(day, organization_id, action_type, provider);

-- ============================================================
-- MONTHLY BILLING AGGREGATES
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS usage_monthly_billing AS
SELECT
  date_trunc('month', created_at) AS month,
  organization_id,
  provider,
  SUM(cost_usd) AS total_cost_usd,
  SUM(tokens_total) AS total_tokens,
  COUNT(*) AS total_requests,
  COUNT(DISTINCT user_id) AS active_users,
  COUNT(DISTINCT action_type) AS action_types_used
FROM usage_records
WHERE organization_id IS NOT NULL
GROUP BY date_trunc('month', created_at), organization_id, provider;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_monthly_unique 
ON usage_monthly_billing(month, organization_id, provider);

-- ============================================================
-- API RATE LIMITS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope (org or user level)
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Limit configuration
  endpoint TEXT NOT NULL,  -- '*' for all, or specific endpoint pattern
  requests_per_minute INT DEFAULT 60,
  requests_per_hour INT DEFAULT 1000,
  requests_per_day INT DEFAULT 10000,
  
  -- Token limits (for AI endpoints)
  tokens_per_minute INT,
  tokens_per_day INT,
  
  -- Burst configuration
  burst_limit INT DEFAULT 10,  -- Max requests in burst
  burst_window_seconds INT DEFAULT 1,  -- Burst window
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure either org or user is set
  CONSTRAINT rate_limits_scope_check CHECK (
    (organization_id IS NOT NULL AND user_id IS NULL) OR
    (organization_id IS NULL AND user_id IS NOT NULL) OR
    (organization_id IS NULL AND user_id IS NULL)  -- Global limits
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_org ON rate_limits(organization_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);

-- ============================================================
-- RATE LIMIT TRACKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  endpoint TEXT NOT NULL,
  
  -- Window tracking
  window_start TIMESTAMPTZ NOT NULL,
  window_type TEXT NOT NULL,  -- 'minute', 'hour', 'day'
  request_count INT DEFAULT 1,
  token_count INT DEFAULT 0,
  
  -- Composite key for upsert
  UNIQUE(organization_id, user_id, ip_address, endpoint, window_start, window_type)
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_window 
ON rate_limit_tracking(window_start);

-- ============================================================
-- ERROR LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Error details
  error_type TEXT NOT NULL,  -- 'api_error', 'parse_error', 'validation_error', 'system_error'
  error_code TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  
  -- Request context
  endpoint TEXT,
  method TEXT,
  request_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Severity
  severity TEXT DEFAULT 'error',  -- 'debug', 'info', 'warning', 'error', 'critical'
  
  -- Resolution status
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_org ON error_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON error_logs(is_resolved) WHERE is_resolved = false;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Record a usage event
CREATE OR REPLACE FUNCTION record_usage(
  p_org_id UUID,
  p_user_id UUID,
  p_action_type TEXT,
  p_provider TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_tokens_input INT DEFAULT 0,
  p_tokens_output INT DEFAULT 0,
  p_cost_usd DECIMAL DEFAULT 0,
  p_duration_ms INT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL,
  p_request_metadata JSONB DEFAULT '{}'::jsonb,
  p_response_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO usage_records (
    organization_id, user_id, action_type, provider, model,
    tokens_input, tokens_output, cost_usd, duration_ms,
    status, error_message, request_metadata, response_metadata
  ) VALUES (
    p_org_id, p_user_id, p_action_type, p_provider, p_model,
    p_tokens_input, p_tokens_output, p_cost_usd, p_duration_ms,
    p_status, p_error_message, p_request_metadata, p_response_metadata
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log an error
CREATE OR REPLACE FUNCTION log_error(
  p_org_id UUID,
  p_user_id UUID,
  p_error_type TEXT,
  p_error_message TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_error_stack TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_method TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'error',
  p_request_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO error_logs (
    organization_id, user_id, error_type, error_message,
    error_code, error_stack, endpoint, method, severity, request_metadata
  ) VALUES (
    p_org_id, p_user_id, p_error_type, p_error_message,
    p_error_code, p_error_stack, p_endpoint, p_method, p_severity, p_request_metadata
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get usage summary for an organization
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_org_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
  action_type TEXT,
  provider TEXT,
  request_count BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL,
  avg_duration INT,
  success_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ur.action_type,
    ur.provider,
    COUNT(*)::BIGINT AS request_count,
    SUM(ur.tokens_total)::BIGINT AS total_tokens,
    SUM(ur.cost_usd) AS total_cost,
    AVG(ur.duration_ms)::INT AS avg_duration,
    (COUNT(*) FILTER (WHERE ur.status = 'success')::DECIMAL / NULLIF(COUNT(*), 0) * 100) AS success_rate
  FROM usage_records ur
  WHERE ur.organization_id = p_org_id
    AND ur.created_at >= p_start_date
    AND ur.created_at <= p_end_date
  GROUP BY ur.action_type, ur.provider
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Usage records: Org admins can view their org's usage
CREATE POLICY usage_records_org_read ON usage_records
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Rate limits: Org admins can manage their org's limits
CREATE POLICY rate_limits_org_manage ON rate_limits
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'org_admin')
    )
  );

-- Error logs: Org admins can view their org's errors
CREATE POLICY error_logs_org_read ON error_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Super admins can access all
CREATE POLICY usage_records_super_admin ON usage_records
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY rate_limits_super_admin ON rate_limits
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY error_logs_super_admin ON error_logs
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================
-- CLEANUP FUNCTIONS
-- ============================================================

-- Clean up old rate limit tracking records
CREATE OR REPLACE FUNCTION cleanup_rate_limit_tracking()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_tracking
  WHERE window_start < NOW() - INTERVAL '2 days';
END;
$$ LANGUAGE plpgsql;

-- Refresh materialized views (should be called periodically)
CREATE OR REPLACE FUNCTION refresh_usage_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY usage_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY usage_monthly_billing;
END;
$$ LANGUAGE plpgsql;


