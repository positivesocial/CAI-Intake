# Changelog

All notable changes to CAI Intake will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2025-01-01

### Added

#### AI & OCR Enhancements
- **Claude Native PDF Support**: Direct PDF analysis without conversion
- **Multi-Stage OCR Pipeline**: Python OCR → Claude PDF → Vision fallback
- **Template Detection**: Auto-detect SketchCut PRO, MaxCut, CutList Plus, CAI templates
- **Text-Based Template Detection**: AI fallback when QR code detection fails
- **Confidence-Based Flagging**: Low-confidence parts highlighted for review
- **Invalid Parts Modal**: Correction interface for parts with invalid dimensions

#### Learning System
- **Silent Auto-Training**: Corrections automatically create training examples
- **Template-Aware Few-Shot**: Select examples matching detected template type
- **Accuracy Tracking**: Log and track parsing accuracy across categories
- **Organization Prefix Matching**: QR codes with shortened org IDs now resolved

#### User Experience
- **Mobile-First Design**: Fully responsive UI for all device sizes
- **Haptic Feedback**: Touch feedback on interactive elements
- **Page Transitions**: Smooth animations between views
- **Gallery View**: Visual comparison of source files with parsed parts
- **Drag-and-Drop Parts**: Reorder parts in manual entry

#### Platform
- **Super Admin Dashboard**: Platform-wide analytics and management
- **AI Usage Tracking**: Track costs by provider and organization
- **OCR Audit Logs**: Complete audit trail of all parsing operations
- **Training Dashboard**: View accuracy metrics and training examples

#### API
- **Doubled Timeouts**: Increased parse timeouts for complex documents
- **Caching**: Response caching for repeated document types
- **Rate Limiting**: Per-organization rate limits
- **Bulk Operations**: Batch update cutlist statuses

### Changed

- **Cutlist Status Logic**: Clearer draft → completed → exported flow
- **Operations Selection**: More intuitive UI in parts inbox
- **Sidebar Design**: Cleaner collapse/expand behavior
- **Dashboard Queries**: Optimized for faster loading

### Fixed

- **Excel Parser**: Fixed "row[ref]?.trim is not a function" error
- **Edgeband Table**: Added missing columns (material, width_mm)
- **Materials Table**: Added grain column migration
- **Part Dimensions**: Fixed auto-swap logic for L/W
- **Quantity Validation**: Parts with invalid quantities routed to modal
- **Organization Lookup**: Prefix matching for QR code org IDs

### Security

- **Row-Level Security**: Enhanced RLS policies
- **API Key Scopes**: Granular permission controls
- **Audit Logging**: Comprehensive action logging

---

## [1.2.0] - 2024-12-15

### Added

- **Voice Dictation Mode**: Web Speech API + Whisper support
- **Export Formats**: MaxCut, CutList Plus, CutRite, Optimik
- **Subscription System**: Stripe integration for billing
- **Notification System**: In-app and email notifications
- **Webhook Support**: Real-time event notifications

### Changed

- **Parser Detection**: Improved auto-detection accuracy
- **Excel Import**: Better column mapping wizard
- **UI Components**: Updated to shadcn/ui v2

### Fixed

- **PDF Parsing**: Better handling of scanned documents
- **Material Mapping**: Improved fuzzy matching

---

## [1.1.0] - 2024-11-01

### Added

- **QR Template System**: Organization-branded input forms
- **Pattern Learning**: Auto-learn from user corrections
- **Material Mapping**: Fuzzy matching for material names
- **Part Grouping**: Organize parts by cabinet/assembly

### Changed

- **Canonical Schema**: Added CNC operations (holes, routing)
- **API Versioning**: Moved to /v1 prefix

### Fixed

- **Copy/Paste**: Better whitespace handling
- **Validation**: Stricter dimension validation

---

## [1.0.0] - 2024-09-15

### Added

- **Initial Release**
- **Manual Entry**: Natural language parsing
- **Excel Import**: CSV/XLSX with column mapping
- **Smart Upload**: Basic OCR for images
- **Canonical Schema**: cai-cutlist/v1 format
- **Multi-Tenant**: Organization support
- **Role-Based Access**: Owner, Admin, Manager, Operator, Viewer
- **CSV Export**: Basic export functionality

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 2.0.0 | 2025-01-01 | AI learning, mobile UI, template detection |
| 1.2.0 | 2024-12-15 | Voice input, exports, billing |
| 1.1.0 | 2024-11-01 | QR templates, pattern learning |
| 1.0.0 | 2024-09-15 | Initial release |

---

## Upgrade Guide

### From 1.x to 2.0

1. **Database Migration**
   ```bash
   npm run db:migrate
   ```

2. **Environment Variables**
   - No new required variables
   - `PYTHON_OCR_URL` now optional (uses built-in fallback)

3. **Breaking Changes**
   - None - fully backward compatible

4. **Recommended Actions**
   - Review new permission settings
   - Configure notification preferences
   - Set up training examples for better accuracy

---

<p align="center">
  <em>For questions, contact support@cai-intake.io</em>
</p>

