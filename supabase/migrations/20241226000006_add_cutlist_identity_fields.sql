-- Add project and customer identity fields to cutlists table
-- These complement the existing job_ref and client_ref fields

-- Add project_name column
ALTER TABLE public.cutlists ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);

-- Add customer_name column
ALTER TABLE public.cutlists ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Create index for searching by project
CREATE INDEX IF NOT EXISTS idx_cutlists_project_name ON public.cutlists(project_name);

-- Create index for searching by customer
CREATE INDEX IF NOT EXISTS idx_cutlists_customer_name ON public.cutlists(customer_name);

-- Add comments for documentation
COMMENT ON COLUMN public.cutlists.project_name IS 'Name of the project this cutlist belongs to';
COMMENT ON COLUMN public.cutlists.customer_name IS 'Name of the customer/client for this cutlist';

-- Also add source_method if it doesn't exist (required field)
ALTER TABLE public.cutlists ADD COLUMN IF NOT EXISTS source_method VARCHAR(50) DEFAULT 'web';


