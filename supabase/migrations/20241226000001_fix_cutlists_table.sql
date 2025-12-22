-- ============================================================
-- Fix Cutlists Table Migration
-- Adds missing columns that are expected by the API and Prisma schema
-- ============================================================

-- Add missing columns to cutlists table
ALTER TABLE public.cutlists
ADD COLUMN IF NOT EXISTS source_method TEXT DEFAULT 'web',
ADD COLUMN IF NOT EXISTS source_client TEXT,
ADD COLUMN IF NOT EXISTS source_file_ref TEXT,
ADD COLUMN IF NOT EXISTS source_template TEXT,
ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT 'cai-cutlist/v1',
ADD COLUMN IF NOT EXISTS job_id TEXT,
ADD COLUMN IF NOT EXISTS meta JSONB,
ADD COLUMN IF NOT EXISTS cnc_library JSONB;

-- Make existing cutlists have a source_method if null
UPDATE public.cutlists 
SET source_method = 'web' 
WHERE source_method IS NULL;

-- Add comments
COMMENT ON COLUMN public.cutlists.source_method IS 'How the cutlist was created: manual, paste_parser, excel_table, file_upload, ocr, voice, api, web';
COMMENT ON COLUMN public.cutlists.source_client IS 'Which client created the cutlist: web, api, mobile';
COMMENT ON COLUMN public.cutlists.source_file_ref IS 'Reference to source file if created from file upload';
COMMENT ON COLUMN public.cutlists.source_template IS 'Template used if any';
COMMENT ON COLUMN public.cutlists.schema_version IS 'Cutlist schema version for migration purposes';
COMMENT ON COLUMN public.cutlists.job_id IS 'Reference to CAI 2D optimization job';
COMMENT ON COLUMN public.cutlists.meta IS 'Additional metadata as JSON';
COMMENT ON COLUMN public.cutlists.cnc_library IS 'CNC library configuration as JSON';

-- Also ensure job_ref and client_ref columns exist (they should, but just in case)
ALTER TABLE public.cutlists
ADD COLUMN IF NOT EXISTS job_ref VARCHAR(100),
ADD COLUMN IF NOT EXISTS client_ref VARCHAR(100);

-- Fix description column type if it's not TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cutlists' 
    AND column_name = 'description' 
    AND data_type != 'text'
  ) THEN
    ALTER TABLE public.cutlists ALTER COLUMN description TYPE TEXT;
  END IF;
END $$;

-- Create index on source_method for analytics
CREATE INDEX IF NOT EXISTS idx_cutlists_source_method ON public.cutlists(source_method);

