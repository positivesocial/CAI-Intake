-- Add indexes to optimize dashboard queries
-- These indexes speed up the most common dashboard queries

-- Cutlists: user_id + created_at for user's recent cutlists
CREATE INDEX IF NOT EXISTS idx_cutlists_user_created 
ON cutlists (user_id, created_at DESC);

-- Cutlists: organization_id + created_at for org's recent cutlists  
CREATE INDEX IF NOT EXISTS idx_cutlists_org_created
ON cutlists (organization_id, created_at DESC);

-- Cutlists: status for filtering by status
CREATE INDEX IF NOT EXISTS idx_cutlists_status
ON cutlists (status);

-- Cut parts: cutlist_id for counting parts per cutlist
CREATE INDEX IF NOT EXISTS idx_cut_parts_cutlist
ON cut_parts (cutlist_id);

-- Uploaded files: organization_id + created_at for file stats
CREATE INDEX IF NOT EXISTS idx_uploaded_files_org_created
ON uploaded_files (organization_id, created_at DESC);

-- Parse jobs: organization_id + created_at for activity
CREATE INDEX IF NOT EXISTS idx_parse_jobs_org_created
ON parse_jobs (organization_id, created_at DESC);

-- Parse jobs: user_id + created_at for user activity
CREATE INDEX IF NOT EXISTS idx_parse_jobs_user_created
ON parse_jobs (user_id, created_at DESC);

-- Optimize jobs: status for filtering active jobs
CREATE INDEX IF NOT EXISTS idx_optimize_jobs_status
ON optimize_jobs (status);

-- Users: organization_id for team member queries
CREATE INDEX IF NOT EXISTS idx_users_org
ON users (organization_id);

-- Users: last_login_at for sorting active users
CREATE INDEX IF NOT EXISTS idx_users_last_login
ON users (last_login_at DESC NULLS LAST);

-- Invitations: organization_id + status for pending invites
CREATE INDEX IF NOT EXISTS idx_invitations_org_pending
ON invitations (organization_id, accepted_at, expires_at);

-- Exports: cutlist_id + created_at for export activity
CREATE INDEX IF NOT EXISTS idx_exports_cutlist_created
ON exports (cutlist_id, created_at DESC);
