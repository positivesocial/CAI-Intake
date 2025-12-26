-- ============================================================
-- Organization Branding Settings Migration
-- 
-- Adds branding configuration to organizations for custom
-- templates, logos, colors, and template settings.
-- ============================================================

-- Add branding JSONB column to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN organizations.branding IS 'Organization branding configuration including logo, colors, and template settings';

-- Create storage bucket for organization logos (if not exists)
-- Note: This needs to be done via Supabase dashboard or CLI, not SQL

-- Sample branding structure (for reference):
-- {
--   "logo_url": "https://...",
--   "logo_dark_url": "https://...",  -- Optional dark mode logo
--   "primary_color": "#0EA5E9",
--   "secondary_color": "#38BDF8",
--   "accent_color": "#06B6D4",
--   "company_name": "Acme Cabinets",
--   "company_tagline": "Quality Craftsmanship",
--   "contact_info": {
--     "phone": "+1-555-123-4567",
--     "email": "orders@acme.com",
--     "address": "123 Workshop Lane",
--     "website": "https://acme.com"
--   },
--   "template_settings": {
--     "header_text": "Custom header for templates",
--     "footer_text": "All dimensions in mm. Verify before cutting.",
--     "include_logo": true,
--     "include_qr_code": true,
--     "qr_style": "standard",  -- "standard" | "rounded" | "dots"
--     "page_size": "A4",  -- "A4" | "Letter" | "A3"
--     "orientation": "portrait"  -- "portrait" | "landscape"
--   },
--   "pdf_theme": {
--     "font_family": "Helvetica",
--     "heading_size": 14,
--     "body_size": 10,
--     "table_style": "bordered"  -- "bordered" | "striped" | "minimal"
--   }
-- }

-- Index for faster queries on branding data
CREATE INDEX IF NOT EXISTS idx_organizations_branding 
ON organizations USING gin (branding);

-- Add updated_at trigger for branding changes
CREATE OR REPLACE FUNCTION update_branding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.branding IS DISTINCT FROM NEW.branding THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_branding_timestamp ON organizations;
CREATE TRIGGER trigger_update_branding_timestamp
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_branding_timestamp();



