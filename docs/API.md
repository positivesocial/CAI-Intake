# CAI Intake API Documentation

<p align="center">
  <strong>REST API Reference v2.1</strong><br>
  <em>Last Updated: January 2026</em>
</p>

---

## Overview

The CAI Intake API provides programmatic access to cutlist management, parsing, and export functionality. This RESTful API uses JSON for request and response bodies.

| Document | Link |
|----------|------|
| **OpenAPI Specification** | [openapi.yaml](./openapi.yaml) |
| **Postman Collection** | Coming soon |
| **SDK (Node.js)** | Coming soon |

> **API Access**: Available on Professional ($79/mo) and Enterprise plans only.

## Base URL

```
Production: https://api.cai-intake.io/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All API requests require authentication using either:

1. **Bearer Token** (for user sessions)
2. **API Key** (for external integrations)

```bash
# Using Bearer token
curl -X GET https://api.cai-intake.io/v1/cutlists \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Using API Key
curl -X GET https://api.cai-intake.io/v1/cutlists \
  -H "X-API-Key: cai_live_xxxxx"
```

### Obtaining an API Key

1. Log in to your CAI Intake account
2. Navigate to Settings > API Keys
3. Click "Generate New Key"
4. Select the required scopes
5. Copy and securely store your key (it's only shown once)

> **Note:** API access is available on Professional and Enterprise plans only.

---

## Response Headers

All responses include standard headers:

| Header | Description |
|--------|-------------|
| `X-API-Version` | Current API version (2.1.0) |
| `X-RateLimit-Limit` | Maximum requests per minute |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Unix timestamp for limit reset |

---

## Endpoints

### Health Check

#### Get System Health

```http
GET /health
```

Returns system health status including database and external service connectivity.

**Response:**

```json
{
  "status": "healthy",
  "version": "2.1.0",
  "timestamp": "2026-01-01T10:00:00Z",
  "uptime_seconds": 86400,
  "services": {
    "api": { "status": "healthy" },
    "database": { "status": "healthy", "latency_ms": 5 },
    "storage": { "status": "healthy", "latency_ms": 12 },
    "ai": { "status": "healthy", "message": "Anthropic Claude 4.5 Sonnet" }
  }
}
```

---

### Dashboard

#### Get Dashboard Data

```http
GET /dashboard
```

Returns comprehensive dashboard statistics including cutlists, activity, and usage metrics.

**Response:**

```json
{
  "success": true,
  "stats": {
    "totalCutlists": 156,
    "activeCutlists": 24,
    "partsProcessed": 4580,
    "cutlistsThisWeek": 12
  },
  "recentCutlists": [...],
  "recentActivity": [...]
}
```

#### Get Quick Dashboard Stats

```http
GET /dashboard/quick
```

Returns lightweight dashboard stats for fast loading.

**Response:**

```json
{
  "cutlists": { "total": 156, "thisWeek": 12 },
  "parts": { "total": 4580 },
  "materials": { "total": 28 }
}
```

---

### Cutlists

#### List Cutlists

```http
GET /cutlists
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20, max: 100) |
| `status` | string | Filter by status: draft, completed, exported, archived |
| `search` | string | Search by name or reference |
| `sort` | string | Sort field: name, createdAt, updatedAt, status |
| `order` | string | Sort order: asc, desc |

**Response:**

```json
{
  "cutlists": [
    {
      "id": "cl_abc123",
      "name": "Kitchen Cabinet Project",
      "status": "completed",
      "partsCount": 24,
      "totalPieces": 48,
      "materialsCount": 3,
      "createdAt": "2024-12-20T10:30:00Z",
      "updatedAt": "2024-12-20T15:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasMore": true
  }
}
```

#### Get Cutlist

```http
GET /cutlists/{id}
```

**Response:**

```json
{
  "cutlist": {
    "id": "cl_abc123",
    "doc_id": "DOC-abc123",
    "name": "Kitchen Cabinet Project",
    "description": "Main kitchen cabinets",
    "status": "completed",
    "project_name": "Kitchen Renovation",
    "customer_name": "John Smith",
    "capabilities": {
      "edging": true,
      "grooves": true,
      "cnc_holes": false
    },
    "parts": [...],
    "materials": [...],
    "edgebands": [...],
    "parts_count": 24,
    "source_files": [...],
    "created_at": "2024-12-20T10:30:00Z",
    "updated_at": "2024-12-20T15:45:00Z"
  }
}
```

#### Create Cutlist

```http
POST /cutlists
```

**Request Body:**

```json
{
  "name": "New Cabinet Project",
  "description": "Optional description",
  "project_name": "Kitchen Renovation",
  "customer_name": "Jane Doe",
  "status": "draft",
  "capabilities": {
    "edging": true,
    "grooves": false,
    "cnc_holes": false
  },
  "parts": [
    {
      "part_id": "TOP-001",
      "label": "Top Panel",
      "size": { "L": 800, "W": 600 },
      "thickness_mm": 18,
      "qty": 1,
      "material_id": "mat_white_melamine",
      "allow_rotation": true
    }
  ],
  "materials": [...],
  "edgebands": [...]
}
```

**Response:** `201 Created`

#### Update Cutlist

```http
PUT /cutlists/{id}
```

#### Delete Cutlist

```http
DELETE /cutlists/{id}
```

#### Duplicate Cutlist

```http
POST /cutlists/{id}/duplicate
```

Creates a copy of an existing cutlist with all its parts.

**Request Body:**

```json
{
  "name": "Kitchen Cabinet Project (Copy)",
  "include_parts": true,
  "include_files": false
}
```

#### Get Cutlist Statistics

```http
GET /cutlists/{id}/stats
```

Returns detailed statistics for a cutlist.

**Response:**

```json
{
  "stats": {
    "cutlist_id": "cl_abc123",
    "unique_parts": 24,
    "total_pieces": 48,
    "total_area_sqm": 12.5,
    "total_perimeter_m": 156.8,
    "materials": [...],
    "edge_banding": [...],
    "operations": [...],
    "parts_locked_rotation": 12,
    "parts_with_notes": 5
  }
}
```

---

### Parts

#### List Parts

```http
GET /cutlists/{cutlist_id}/parts
```

#### Add Parts

```http
POST /cutlists/{cutlist_id}/parts
```

#### Bulk Update Parts

```http
PATCH /cutlists/{cutlist_id}/parts
```

#### Delete Parts

```http
DELETE /cutlists/{cutlist_id}/parts
```

---

### Global Search

```http
GET /search
```

Search across cutlists, materials, edgebands, and parts.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (required) |
| `types` | string | Comma-separated types: cutlists,materials,edgebands,parts |
| `limit` | integer | Maximum results (default: 20, max: 50) |

---

### Bulk Operations

```http
POST /bulk
```

Execute multiple operations in a single request.

**Supported Operations:**

| Operation | Description |
|-----------|-------------|
| `cutlists.archive` | Archive cutlists |
| `cutlists.delete` | Delete cutlists |
| `cutlists.update_status` | Update status (draft, completed, exported) |
| `parts.delete` | Delete parts |
| `parts.update_material` | Update material |
| `parts.update_rotation` | Update rotation setting |
| `materials.delete` | Delete materials |
| `edgebands.delete` | Delete edgebands |

---

### Parsing

#### Parse Text

```http
POST /parse-text
```

Parse cutlist data from plain text using AI.

**Request Body:**

```json
{
  "text": "Side panel 720x560 qty 2 white board 1L2W edge",
  "options": {
    "units": "mm",
    "default_thickness_mm": 18,
    "default_material_id": "mat_white_melamine"
  }
}
```

#### Parse File

```http
POST /parse-file
```

Parse cutlist data from uploaded files (PDF, images, spreadsheets).

**Request Body:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | PDF, image (JPG/PNG), Excel, or CSV |
| `options` | JSON | Parse options (optional) |
| `skipCache` | boolean | Skip OCR cache for fresh parse |

**Supported File Types:**
- PDF documents (including scanned)
- Images (JPG, PNG, WebP)
- Excel (.xlsx, .xls)
- CSV files

#### Main Parse Endpoint

```http
POST /parse
```

Unified parsing endpoint that handles both text and file parsing.

#### Get Parse Progress

```http
GET /parse/progress
```

Get progress updates for long-running parse operations.

#### Get Parse Job

```http
GET /parse-jobs/{id}
```

#### List Parse Jobs

```http
GET /parse-jobs
```

---

### CSV Wizard

Smart CSV parsing with automatic format detection.

#### Detect CSV Format

```http
POST /csv-wizard/detect
```

Automatically detect column mappings and data types in a CSV file.

**Request Body:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | CSV file to analyze |

**Response:**

```json
{
  "success": true,
  "detectedFormat": {
    "delimiter": ",",
    "hasHeaders": true,
    "columns": [
      { "index": 0, "name": "Label", "suggestedMapping": "label" },
      { "index": 1, "name": "Length", "suggestedMapping": "length" },
      { "index": 2, "name": "Width", "suggestedMapping": "width" }
    ]
  },
  "preview": [...]
}
```

#### Preview CSV Import

```http
POST /csv-wizard/preview
```

Preview how CSV data will be imported with custom column mappings.

---

### Exports

#### Create Export

```http
POST /exports
```

**Request Body:**

```json
{
  "cutlist_id": "cl_abc123",
  "format": "maxcut",
  "options": {
    "units": "mm",
    "include_metadata": true,
    "include_edging": true
  }
}
```

**Supported Formats:**

| Format | Extension | Description |
|--------|-----------|-------------|
| `json` | .json | Native CAI format |
| `csv` | .csv | Universal CSV |
| `maxcut` | .csv | MaxCut panel optimizer |
| `cutlistplus` | .csv | CutList Plus FX |
| `cutrite` | .xml | CutRite/Weinig XML |
| `optimik` | .csv | Optimik panel optimizer |
| `cai2d` | .json | CAI 2D Optimizer |

---

### Materials

#### List Materials

```http
GET /materials
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name or ID |
| `thickness` | number | Filter by thickness |

#### Create Material

```http
POST /materials
```

**Request Body:**

```json
{
  "material_id": "MAT-OAK-18",
  "name": "Oak Veneer 18mm",
  "thickness_mm": 18,
  "core_type": "MDF",
  "grain": "length",
  "finish": "matte",
  "default_sheet": { "L": 2440, "W": 1220 },
  "sku": "OAK-18-VNR",
  "supplier": "ABC Panels"
}
```

#### Get Material

```http
GET /materials/{id}
```

#### Update Material

```http
PUT /materials/{id}
```

#### Delete Material

```http
DELETE /materials/{id}
```

#### Import Materials

```http
POST /materials/import
```

Bulk import materials from CSV/Excel.

**Request Body:** `multipart/form-data`

---

### Edgebands

#### List Edgebands

```http
GET /edgebands
```

#### Create Edgeband

```http
POST /edgebands
```

**Request Body:**

```json
{
  "edgeband_id": "EB-WHITE-2",
  "name": "ABS White 2mm",
  "thickness_mm": 2,
  "width_mm": 22,
  "material": "ABS",
  "color_code": "#FFFFFF"
}
```

#### Get Edgeband

```http
GET /edgebands/{id}
```

#### Update Edgeband

```http
PUT /edgebands/{id}
```

#### Delete Edgeband

```http
DELETE /edgebands/{id}
```

---

### Operations Management

#### Edgeband Operations

```http
GET /operations/edgeband
POST /operations/edgeband
GET /operations/edgeband/{id}
PUT /operations/edgeband/{id}
DELETE /operations/edgeband/{id}
```

#### Groove Operations

```http
GET /operations/groove
POST /operations/groove
GET /operations/groove/{id}
PUT /operations/groove/{id}
DELETE /operations/groove/{id}
```

**Create Groove Profile:**

```json
{
  "name": "Standard Groove",
  "width_mm": 4,
  "depth_mm": 8,
  "position": "center",
  "shortcode": "G4X8"
}
```

#### Drilling/Hole Operations

```http
GET /operations/drilling
POST /operations/drilling
GET /operations/drilling/{id}
PUT /operations/drilling/{id}
DELETE /operations/drilling/{id}
```

**Create Hole Pattern:**

```json
{
  "name": "32mm System",
  "pattern_type": "line",
  "hole_diameter_mm": 5,
  "hole_depth_mm": 12,
  "spacing_mm": 32,
  "shortcode": "H32"
}
```

#### CNC Operations

```http
GET /operations/cnc
POST /operations/cnc
GET /operations/cnc/{id}
PUT /operations/cnc/{id}
DELETE /operations/cnc/{id}
```

**Create CNC Program:**

```json
{
  "name": "Hinge Bore",
  "program_id": "HINGE35",
  "description": "35mm hinge boring",
  "machine_type": "cnc_router",
  "shortcode": "CNC-HNG"
}
```

#### Operation Types

```http
GET /operations/types
POST /operations/types
GET /operations/types/{id}
PUT /operations/types/{id}
DELETE /operations/types/{id}
```

#### Seed Default Operations

```http
POST /operations/seed
```

Seeds organization with default operation templates.

---

### Shortcodes

Organization-specific shortcodes for quick data entry.

#### List Shortcodes

```http
GET /shortcodes
```

**Response:**

```json
{
  "shortcodes": [
    {
      "id": "sc_abc",
      "code": "EB1",
      "type": "edgeband",
      "target_id": "eb_white_2mm",
      "description": "White ABS 2mm"
    }
  ]
}
```

#### Create Shortcode

```http
POST /shortcodes
```

**Request Body:**

```json
{
  "code": "EB1",
  "type": "edgeband",
  "target_id": "eb_white_2mm",
  "description": "White ABS 2mm"
}
```

#### Update Shortcode

```http
PUT /shortcodes/{id}
```

#### Delete Shortcode

```http
DELETE /shortcodes/{id}
```

#### Template Shortcodes

```http
GET /template-shortcodes
```

Get shortcodes for use in CAI templates.

---

### Files

#### Upload File

```http
POST /files
```

**Request Body:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | The file to upload |
| `kind` | string | File type: cutlist_source, template_scan |

#### List Files

```http
GET /files
```

#### Get File

```http
GET /files/{id}
```

#### Get File Proxy (for PDFs)

```http
GET /files/proxy/{id}
```

Proxy endpoint for serving PDF files with proper headers.

#### Delete File

```http
DELETE /files/{id}
```

---

### PDF Preview

```http
POST /pdf-preview
```

Generate preview images from PDF files.

**Request Body:**

```json
{
  "file_id": "file_abc123",
  "page": 1,
  "width": 800
}
```

---

### Panel Optimization

#### Run Optimization

```http
POST /optimize
```

Submit a cutlist for panel cutting optimization.

**Request Body:**

```json
{
  "cutlist_id": "cl_abc123",
  "settings": {
    "blade_thickness_mm": 4,
    "edge_trim_mm": 10,
    "algorithm": "guillotine"
  }
}
```

#### List Optimization Jobs

```http
GET /optimize-jobs
```

#### Get Optimization Job

```http
GET /optimize-jobs/{id}
```

#### Export Optimization Results

```http
POST /optimize/export/pdf
POST /optimize/export/labels
```

Export cutting patterns as PDF or part labels.

---

### Organization Settings

#### Get Organization Settings

```http
GET /organizations/settings
```

#### Update Organization Settings

```http
PUT /organizations/settings
```

**Request Body:**

```json
{
  "default_units": "mm",
  "default_thickness_mm": 18,
  "enable_auto_training": true,
  "ocr_provider": "anthropic"
}
```

#### Get Branding Settings

```http
GET /organizations/branding
```

#### Update Branding

```http
PUT /organizations/branding
```

**Request Body:**

```json
{
  "company_name": "ABC Cabinets",
  "logo_url": "https://...",
  "primary_color": "#0066CC",
  "secondary_color": "#004499"
}
```

#### Upload Branding Assets

```http
POST /organizations/branding/upload
```

Upload logo and other branding assets.

---

### Team Management

#### List Team Members

```http
GET /team
```

#### Invite Team Member

```http
POST /team
```

**Request Body:**

```json
{
  "email": "newmember@example.com",
  "role": "operator"
}
```

**Available Roles:**
- `owner` - Full access, can delete organization
- `admin` - Full access except billing
- `manager` - Can manage cutlists and team
- `operator` - Can create and edit cutlists
- `viewer` - Read-only access

#### Get Team Member

```http
GET /team/{id}
```

#### Update Team Member

```http
PUT /team/{id}
```

#### Remove Team Member

```http
DELETE /team/{id}
```

---

### Invitations

#### Get Invitation Details

```http
GET /invitations/{token}
```

No authentication required.

#### Accept Invitation

```http
POST /invitations/{token}
```

Requires authentication.

---

### Authentication & Profile

#### Get User Profile

```http
GET /auth/profile
```

**Response:**

```json
{
  "id": "user_abc",
  "email": "user@example.com",
  "name": "John Smith",
  "avatar_url": "https://...",
  "organization": {
    "id": "org_xyz",
    "name": "ABC Cabinets",
    "role": "admin"
  }
}
```

#### Update Profile

```http
PUT /auth/profile
```

**Request Body:**

```json
{
  "name": "John Smith",
  "preferences": {
    "theme": "dark",
    "notifications": true
  }
}
```

#### Upload Avatar

```http
POST /auth/avatar
```

**Request Body:** `multipart/form-data`

---

### Billing

#### Create Checkout Session

```http
POST /billing/checkout
```

Create a Stripe checkout session for subscription upgrade.

**Request Body:**

```json
{
  "plan_id": "professional",
  "billing_interval": "monthly"
}
```

#### Get Billing Portal

```http
GET /billing/portal
```

Get a link to the Stripe billing portal.

#### Get Billing History

```http
GET /billing/history
```

Returns list of past invoices and payments.

---

### Subscription

#### Get Subscription

```http
GET /subscription
```

**Response:**

```json
{
  "subscription": {
    "planId": "professional",
    "planName": "Professional",
    "status": "active",
    "billingInterval": "monthly",
    "currentPeriodEnd": "2026-02-01T00:00:00Z",
    "trialDaysRemaining": 0,
    "cancelAtPeriodEnd": false
  },
  "usage": {
    "cutlistsCreated": 45,
    "partsProcessed": 1250,
    "aiParsesUsed": 120,
    "storageUsedMb": 156
  },
  "limits": {
    "maxCutlistsPerMonth": 500,
    "maxPartsPerCutlist": 1000,
    "maxTeamMembers": 10,
    "maxStorageMb": 10240
  }
}
```

---

### Webhooks

#### List Webhooks

```http
GET /webhooks
```

#### Create Webhook

```http
POST /webhooks
```

**Request Body:**

```json
{
  "url": "https://your-server.com/webhook",
  "events": ["cutlist.created", "cutlist.updated", "parse_job.completed"],
  "description": "Production notifications",
  "is_active": true
}
```

#### Supported Events

| Event | Description |
|-------|-------------|
| `cutlist.created` | New cutlist created |
| `cutlist.updated` | Cutlist modified |
| `cutlist.deleted` | Cutlist deleted |
| `cutlist.archived` | Cutlist archived |
| `parse_job.started` | Parse job started |
| `parse_job.completed` | Parse job finished |
| `parse_job.failed` | Parse job failed |
| `export.completed` | Export ready |
| `optimization.completed` | Optimization finished |
| `optimization.failed` | Optimization failed |
| `team.member_added` | New team member |
| `team.member_removed` | Team member removed |
| `subscription.updated` | Subscription changed |

#### Test Webhook

```http
POST /webhooks/{id}
```

#### Update Webhook

```http
PUT /webhooks/{id}
```

#### Delete Webhook

```http
DELETE /webhooks/{id}
```

---

### API Keys

#### List API Keys

```http
GET /api-keys
```

#### Create API Key

```http
POST /api-keys
```

**Available Scopes:**

| Scope | Description |
|-------|-------------|
| `cutlists:read` | Read cutlists |
| `cutlists:write` | Create/update cutlists |
| `parts:read` | Read parts |
| `parts:write` | Create/update parts |
| `materials:read` | Read materials |
| `materials:write` | Create/update materials |
| `files:read` | Read files |
| `files:write` | Upload files |
| `exports:read` | Generate exports |
| `parse:execute` | Run parse operations |
| `webhooks:manage` | Manage webhooks |

#### Revoke API Key

```http
DELETE /api-keys/{id}
```

---

### Reports

```http
GET /reports
```

Generate usage and analytics reports.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Report type: usage, activity, exports |
| `start_date` | date | Start of date range |
| `end_date` | date | End of date range |
| `format` | string | Output format: json, csv |

---

### OCR Metrics

```http
GET /ocr/metrics
```

Get OCR performance metrics and accuracy statistics.

**Response:**

```json
{
  "success": true,
  "metrics": {
    "totalParses": 1250,
    "successRate": 96.5,
    "avgProcessingTime": 3200,
    "providerStats": {
      "anthropic": { "count": 1100, "successRate": 97.2 },
      "openai": { "count": 150, "successRate": 92.0 }
    }
  }
}
```

---

### AI Training (Super Admin)

#### Get Training Accuracy

```http
GET /training/accuracy
```

Get AI parsing accuracy metrics.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `view` | string | View type: summary, breakdown |
| `range` | string | Time range: 7d, 14d, 30d, 90d |

#### List Training Examples

```http
GET /training/examples
```

#### Create Training Example

```http
POST /training/examples
```

**Request Body:**

```json
{
  "sourceType": "image",
  "sourceText": "...",
  "correctParts": [...],
  "category": "sketchcut",
  "difficulty": "medium"
}
```

#### Get Training Example

```http
GET /training/examples/{id}
```

#### Update Training Example

```http
PUT /training/examples/{id}
```

#### Delete Training Example

```http
DELETE /training/examples/{id}
```

#### Bulk Upload Training Examples

```http
POST /training/bulk-upload
```

#### Test Parse

```http
POST /training/test-parse
```

Test parsing against training examples.

#### Log Accuracy

```http
POST /training/log-accuracy
```

Log parsing accuracy for training improvement.

---

### Platform Admin APIs (Super Admin Only)

These endpoints require super admin privileges.

#### Platform Statistics

```http
GET /platform/stats
```

Get platform-wide statistics.

#### Platform Analytics

```http
GET /platform/analytics
```

Detailed platform analytics including AI costs by provider.

#### List Organizations

```http
GET /platform/organizations
POST /platform/organizations
```

#### List Platform Users

```http
GET /platform/users
```

#### Platform Plans

```http
GET /platform/plans
POST /platform/plans
```

#### Platform Revenue

```http
GET /platform/revenue
```

Revenue analytics and financial metrics.

#### OCR Audit Log

```http
GET /platform/ocr-audit
```

Detailed OCR/AI parsing audit trail.

---

### Admin APIs (Super Admin Only)

#### Clear OCR Cache

```http
POST /admin/clear-cache
```

Clear the OCR result cache.

#### Manage Plans

```http
GET /admin/plans
POST /admin/plans
PUT /admin/plans/{id}
DELETE /admin/plans/{id}
```

---

### Miscellaneous

#### Contact Form

```http
POST /contact
```

Submit contact form message.

#### Transcribe Audio

```http
POST /transcribe-audio
```

Transcribe audio notes to text.

#### Template Merge

```http
POST /template-merge
```

Merge data with CAI template.

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {},
  "requestId": "req_abc123"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `204` | No Content |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `409` | Conflict |
| `422` | Validation Error |
| `429` | Rate Limited |
| `500` | Server Error |
| `503` | Service Unavailable |

### Common Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication |
| `FORBIDDEN` | Insufficient permissions |
| `INVALID_REQUEST` | Request body is malformed |
| `VALIDATION_FAILED` | Field validation errors |
| `NOT_FOUND` | Resource doesn't exist |
| `ALREADY_EXISTS` | Resource already exists |
| `RATE_LIMITED` | Too many requests |
| `QUOTA_EXCEEDED` | Plan limit reached |
| `AI_PARSE_FAILED` | AI parsing failed |

---

## Rate Limiting

API requests are rate-limited based on your plan:

| Plan | Requests/Minute | Requests/Day |
|------|-----------------|--------------|
| Free | 30 | 500 |
| Starter | 60 | 2,000 |
| Professional | 120 | 10,000 |
| Enterprise | Custom | Custom |

---

## SDKs

### JavaScript/TypeScript

```bash
npm install @caiintake/sdk
```

```typescript
import { CAIIntake } from '@caiintake/sdk';

const client = new CAIIntake({
  apiKey: 'cai_live_xxxxx'
});

// List cutlists
const { cutlists } = await client.cutlists.list({ status: 'completed' });

// Parse text
const { parts } = await client.parse.text('Side panel 720x560 qty 2');

// Create export
const file = await client.exports.create({
  cutlistId: 'cl_abc123',
  format: 'maxcut'
});
```

### Python

```bash
pip install cai-intake
```

```python
from cai_intake import CAIIntake

client = CAIIntake(api_key='cai_live_xxxxx')

# List cutlists
cutlists = client.cutlists.list(status='completed')

# Parse text
parts = client.parse.text('Side panel 720x560 qty 2')
```

---

## Changelog

### v2.1.0 (January 2026)

- Added Dashboard APIs (`/dashboard`, `/dashboard/quick`)
- Added Operations Management APIs (CNC, Drilling, Groove, Edgeband)
- Added CSV Wizard for smart CSV parsing
- Added Shortcodes API for quick data entry
- Added Organization Settings and Branding APIs
- Added Panel Optimization APIs
- Added AI Training System APIs
- Added Platform Admin APIs
- Added Billing and Profile APIs
- Added OCR Metrics endpoint
- Email-based user lookup for consistent authentication
- Super admin redirect to platform training page

### v2.0.0 (December 2025)

- Claude 4.5 Sonnet native PDF support
- Silent auto-training from user corrections
- Template-aware few-shot selection
- Confidence-based flagging
- Dashboard optimization
- MaxCut/CutList Plus CSV export improvements

### v1.0.0 (December 2024)

- Initial stable API release
- Cutlist CRUD operations
- Parse text and file endpoints
- Export formats (JSON, CSV, MaxCut, CutList Plus, CutRite, Optimik)
- Materials and Edgebands management
- Team management and invitations
- Webhook system
- API key management

---

## Support

- **API Status**: [status.cai-intake.io](https://status.cai-intake.io)
- **Developer Support**: api-support@cai-intake.io
- **Documentation**: [docs.cai-intake.io/api](https://docs.cai-intake.io/api)
- **OpenAPI Spec**: [/docs/openapi.yaml](./openapi.yaml)

---

*API Version: v2.1.0 | Last updated: January 2026*
