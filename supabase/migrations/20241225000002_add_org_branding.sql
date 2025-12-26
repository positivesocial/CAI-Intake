-- Add branding column to organizations table
-- This stores organization branding settings for PDF exports and templates

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

-- Add comment explaining the structure
COMMENT ON COLUMN organizations.branding IS 'Organization branding settings including:
- company_name: Display name for documents
- company_tagline: Optional tagline
- primary_color: Hex color for headers/accents (e.g., #008080)
- secondary_color: Hex color for backgrounds
- accent_color: Hex color for highlights
- logo_url: URL to light mode logo
- logo_dark_url: URL to dark mode logo
- contact_info: { phone, email, address, website }
- template_settings: { header_text, footer_text, include_logo, page_size, orientation }
- pdf_theme: { font_family, heading_size, body_size, table_style }';

-- Set default branding for organizations that don't have it
UPDATE organizations 
SET branding = jsonb_build_object(
  'company_name', name,
  'primary_color', '#008080',
  'secondary_color', '#F0F0F0',
  'template_settings', jsonb_build_object(
    'page_size', 'A4',
    'orientation', 'landscape',
    'footer_text', 'All dimensions in mm. Verify before cutting.'
  )
)
WHERE branding IS NULL OR branding = '{}';


