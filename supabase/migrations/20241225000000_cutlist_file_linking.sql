-- CAI Intake - Cutlist File Linking Migration
-- Links uploaded files directly to cutlists for better organization and cascade delete

-- Add cutlist_id column to uploaded_files table
ALTER TABLE public.uploaded_files
ADD COLUMN IF NOT EXISTS cutlist_id TEXT REFERENCES public.cutlists(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_uploaded_files_cutlist_id ON public.uploaded_files(cutlist_id);

-- Update RLS policy to allow users to view files linked to their cutlists
DROP POLICY IF EXISTS "Users can view their org files" ON public.uploaded_files;
CREATE POLICY "Users can view their org files" ON public.uploaded_files
  FOR SELECT
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

-- Update RLS policy for managing files
DROP POLICY IF EXISTS "Users can manage their org files" ON public.uploaded_files;
CREATE POLICY "Users can manage their org files" ON public.uploaded_files
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

-- Add comment
COMMENT ON COLUMN public.uploaded_files.cutlist_id IS 'Links the uploaded file to a specific cutlist for organization and cascade operations';

