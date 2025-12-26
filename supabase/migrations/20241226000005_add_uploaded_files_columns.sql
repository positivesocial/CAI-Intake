-- Add missing columns to uploaded_files table
-- These are required for linking files to cutlists and users

-- Add cutlist_id column (nullable - files may not be linked initially)
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS cutlist_id TEXT;

-- Add user_id column for tracking who uploaded the file
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add index for faster queries by cutlist
CREATE INDEX IF NOT EXISTS idx_uploaded_files_cutlist_id ON uploaded_files(cutlist_id);

-- Add index for faster queries by organization
CREATE INDEX IF NOT EXISTS idx_uploaded_files_organization_id ON uploaded_files(organization_id);

-- Add index for user lookups
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);

-- Add comments for documentation
COMMENT ON COLUMN uploaded_files.cutlist_id IS 'Reference to the cutlist this file belongs to (null if not yet linked)';
COMMENT ON COLUMN uploaded_files.user_id IS 'Reference to the user who uploaded this file';


