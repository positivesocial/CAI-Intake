# CAI Intake API Documentation

## Overview

The CAI Intake API provides programmatic access to cutlist management, parsing, and export functionality. This RESTful API uses JSON for request and response bodies.

**OpenAPI Specification**: See [openapi.yaml](./openapi.yaml) for the complete machine-readable specification.

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
| `X-API-Version` | Current API version (1.0.0) |
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
  "version": "1.0.0",
  "timestamp": "2024-12-29T10:00:00Z",
  "uptime_seconds": 86400,
  "services": {
    "api": { "status": "healthy" },
    "database": { "status": "healthy", "latency_ms": 5 },
    "storage": { "status": "healthy", "latency_ms": 12 },
    "ai": { "status": "healthy", "message": "Anthropic" }
  }
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
| `status` | string | Filter by status: draft, pending, processing, completed, archived |
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
      "status": "active",
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
    "status": "active",
    "project_name": "Kitchen Renovation",
    "customer_name": "John Smith",
    "capabilities": {
      "edging": true,
      "grooves": true,
      "cnc_holes": false
    },
    "parts": [
      {
        "id": "pt_xyz789",
        "part_id": "SIDE-001",
        "label": "Side Panel",
        "size": { "L": 720, "W": 560 },
        "thickness_mm": 18,
        "qty": 2,
        "material_id": "mat_white_melamine",
        "allow_rotation": false,
        "group_id": "cabinet-1",
        "ops": {
          "edging": { "L1": "eb_white", "L2": "eb_white" }
        },
        "notes": { "production": "Handle with care" }
      }
    ],
    "parts_count": 24,
    "source_files": [
      {
        "id": "file_abc",
        "original_name": "cutlist.pdf",
        "url": "https://..."
      }
    ],
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
  "capabilities": {
    "edging": true,
    "grooves": false,
    "cnc_holes": false,
    "advanced_grouping": true
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
  ]
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

**Response:** `201 Created`

```json
{
  "cutlist": {
    "id": "cl_new789",
    "doc_id": "DOC-new789",
    "name": "Kitchen Cabinet Project (Copy)",
    "status": "draft",
    "parts_count": 24
  },
  "original_id": "cl_abc123",
  "message": "Cutlist duplicated successfully"
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
    "materials": [
      {
        "material_id": "mat_white",
        "thickness_mm": 18,
        "unique_parts": 20,
        "total_pieces": 40,
        "total_area_sqm": 10.2
      }
    ],
    "edge_banding": [
      { "position": "L1", "total_length_m": 42.5, "piece_count": 30 }
    ],
    "operations": [
      { "type": "drilling", "count": 48 }
    ],
    "parts_locked_rotation": 12,
    "parts_with_notes": 5,
    "groups": [
      { "group_id": "cabinet-1", "count": 8 },
      { "group_id": null, "count": 16 }
    ]
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

**Request Body:**

```json
{
  "parts": [
    {
      "part_id": "SHELF-001",
      "label": "Shelf",
      "size": { "L": 500, "W": 300 },
      "thickness_mm": 18,
      "qty": 4,
      "material_id": "mat_white_melamine",
      "allow_rotation": true,
      "group_id": "cabinet-1"
    }
  ]
}
```

#### Bulk Update Parts

```http
PATCH /cutlists/{cutlist_id}/parts
```

**Request Body:**

```json
{
  "updates": [
    {
      "part_id": "SHELF-001",
      "material_id": "mat_oak",
      "allow_rotation": false
    },
    {
      "part_id": "SHELF-002",
      "qty": 6
    }
  ]
}
```

#### Delete Parts

```http
DELETE /cutlists/{cutlist_id}/parts
```

**Request Body:**

```json
{
  "part_ids": ["SHELF-001", "SHELF-002"]
}
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

**Response:**

```json
{
  "query": "white melamine",
  "results": [
    {
      "id": "mat_white",
      "type": "material",
      "title": "White Melamine 18mm",
      "subtitle": "MAT-WHITE-18 - 18mm",
      "metadata": { "thickness_mm": 18 }
    },
    {
      "id": "cl_abc123",
      "type": "cutlist",
      "title": "Kitchen Cabinets",
      "subtitle": "JOB-2024-001"
    }
  ],
  "total": 2,
  "types": ["cutlists", "materials"]
}
```

---

### Bulk Operations

```http
POST /bulk
```

Execute multiple operations in a single request.

**Request Body:**

```json
{
  "operations": [
    {
      "operation": "cutlists.archive",
      "ids": ["cl_abc123", "cl_def456"]
    },
    {
      "operation": "parts.update_material",
      "ids": ["pt_001", "pt_002"],
      "data": { "material_id": "mat_oak" }
    }
  ]
}
```

**Supported Operations:**

| Operation | Description |
|-----------|-------------|
| `cutlists.archive` | Archive cutlists |
| `cutlists.delete` | Delete cutlists |
| `cutlists.update_status` | Update status |
| `parts.delete` | Delete parts |
| `parts.update_material` | Update material |
| `parts.update_rotation` | Update rotation setting |
| `materials.delete` | Delete materials |
| `edgebands.delete` | Delete edgebands |

**Response:**

```json
{
  "success": true,
  "results": [
    { "operation": "cutlists.archive", "success": true, "affected": 2 },
    { "operation": "parts.update_material", "success": true, "affected": 2 }
  ],
  "summary": {
    "total_operations": 2,
    "successful": 2,
    "failed": 0,
    "total_affected": 4
  }
}
```

---

### Parsing

#### Parse Text

```http
POST /parse-text
```

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

**Response:**

```json
{
  "parts": [
    {
      "label": "Side panel",
      "size": { "L": 720, "W": 560 },
      "thickness_mm": 18,
      "qty": 2,
      "material_id": "mat_white_melamine",
      "allow_rotation": false,
      "ops": {
        "edging": { "L1": true, "W1": true, "W2": true }
      },
      "confidence": 0.95
    }
  ],
  "parse_method": "ai",
  "processing_time_ms": 450
}
```

#### Parse File

```http
POST /parse-file
```

**Request Body:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | PDF, image, or spreadsheet |
| `options` | JSON | Parse options (optional) |

**Response:**

```json
{
  "job_id": "pj_abc123",
  "status": "processing",
  "estimated_time_ms": 5000
}
```

#### Get Parse Job

```http
GET /parse-jobs/{id}
```

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
| `maxcut` | .csv | MaxCut CSV |
| `cutlistplus` | .csv | CutList Plus CSV |
| `cutrite` | .xml | CutRite XML |
| `optimik` | .csv | Optimik CSV |
| `cai2d` | .json | CAI 2D format |

#### List Export Formats

```http
GET /exports
```

Returns available export formats and their metadata.

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
  "color_code": "#FFFFFF",
  "waste_factor_pct": 1,
  "overhang_mm": 0
}
```

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

#### Delete File

```http
DELETE /files/{id}
```

---

### Team Management

#### List Team Members

```http
GET /team
```

**Response:**

```json
{
  "members": [
    {
      "id": "user_abc",
      "name": "John Smith",
      "email": "john@example.com",
      "role": "manager",
      "status": "active",
      "lastActive": "5m ago",
      "cutlistsThisWeek": 12
    }
  ],
  "invitations": [
    {
      "id": "inv_xyz",
      "email": "jane@example.com",
      "role": "operator",
      "status": "pending",
      "expiresAt": "2024-12-28T00:00:00Z"
    }
  ],
  "stats": {
    "total": 5,
    "active": 4,
    "pendingInvites": 1
  }
}
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

#### Get Team Member

```http
GET /team/{id}
```

#### Update Team Member

```http
PUT /team/{id}
```

**Request Body:**

```json
{
  "role": "manager",
  "is_active": true
}
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

No authentication required. Returns invitation details for the sign-up page.

#### Accept Invitation

```http
POST /invitations/{token}
```

Requires authentication. Adds the current user to the organization.

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

**Response:** `201 Created`

```json
{
  "webhook": {
    "id": "wh_abc123",
    "url": "https://your-server.com/webhook",
    "events": ["cutlist.created", "cutlist.updated"],
    "secret": "whsec_xxxxx..."
  },
  "message": "Webhook created. Store the secret securely."
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

Sends a test event to the webhook endpoint.

#### Update Webhook

```http
PUT /webhooks/{id}
```

#### Delete Webhook

```http
DELETE /webhooks/{id}
```

#### Webhook Payload

```json
{
  "event": "cutlist.created",
  "timestamp": "2024-12-21T10:00:00Z",
  "data": {
    "cutlist_id": "cl_abc123",
    "name": "New Project"
  }
}
```

#### Webhook Security

Verify webhook signatures using the `X-CAI-Signature` header:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const [timestamp, v1] = signature.split(',').map(s => s.split('=')[1]);
  const signaturePayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');
  return v1 === expected;
}
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

**Request Body:**

```json
{
  "name": "Production Integration",
  "description": "For MaxCut sync",
  "scopes": ["cutlists:read", "cutlists:write", "exports:read"],
  "expires_at": "2025-12-31T23:59:59Z"
}
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

**Response:** `201 Created`

```json
{
  "api_key": {
    "id": "key_abc123",
    "name": "Production Integration",
    "key": "cai_live_xxxxx...",
    "prefix": "xxxxx",
    "scopes": ["cutlists:read", "cutlists:write"]
  },
  "message": "Store the key securely. It's only shown once."
}
```

#### Revoke API Key

```http
DELETE /api-keys/{id}
```

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
    "currentPeriodEnd": "2025-01-20T00:00:00Z",
    "trialDaysRemaining": 0,
    "cancelAtPeriodEnd": false
  },
  "usage": {
    "cutlistsCreated": 45,
    "partsProcessed": 1250,
    "aiParsesUsed": 120,
    "ocrPagesUsed": 85,
    "storageUsedMb": 156
  },
  "limits": {
    "maxCutlistsPerMonth": 500,
    "maxPartsPerCutlist": 1000,
    "maxTeamMembers": 10,
    "maxStorageMb": 10240
  },
  "plan": {
    "features": ["AI Parsing", "OCR", "All Export Formats"]
  }
}
```

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
| `CONFLICT` | Conflicting operation |
| `RATE_LIMITED` | Too many requests |
| `QUOTA_EXCEEDED` | Plan limit reached |
| `AI_NOT_CONFIGURED` | AI provider not set up |
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

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 115
X-RateLimit-Reset: 1703150400
```

When rate limited, the response includes a `Retry-After` header.

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
const { cutlists } = await client.cutlists.list({ status: 'active' });

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
cutlists = client.cutlists.list(status='active')

# Parse text
parts = client.parse.text('Side panel 720x560 qty 2')

# Create export
file = client.exports.create(
    cutlist_id='cl_abc123',
    format='maxcut'
)
```

---

## Changelog

### v1.0.0 (December 2024)

- Initial stable API release
- Added health check endpoint
- Added webhook management endpoints
- Added API key management
- Added global search
- Added bulk operations
- Added cutlist duplicate and stats endpoints
- Added team member management
- Added invitation acceptance
- OpenAPI 3.1 specification

---

## Support

- **API Status**: [status.cai-intake.io](https://status.cai-intake.io)
- **Developer Support**: api-support@cai-intake.io
- **Documentation**: [docs.cai-intake.io/api](https://docs.cai-intake.io/api)
- **OpenAPI Spec**: [/docs/openapi.yaml](./openapi.yaml)

---

*API Version: v1.0.0 | Last updated: December 2024*
