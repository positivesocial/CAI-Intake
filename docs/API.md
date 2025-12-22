# CAI Intake API Documentation

## Overview

The CAI Intake API provides programmatic access to cutlist management, parsing, and export functionality. This RESTful API uses JSON for request and response bodies.

## Base URL

```
Production: https://api.caiintake.com/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All API requests require authentication using a Bearer token.

```bash
curl -X GET https://api.caiintake.com/v1/cutlists \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Obtaining an API Key

1. Log in to your CAI Intake account
2. Navigate to Settings > API Keys
3. Click "Generate New Key"
4. Copy and securely store your key

> **Note:** API access is available on Professional and Enterprise plans only.

---

## Endpoints

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
| `status` | string | Filter by status: draft, active, archived |
| `search` | string | Search by name or reference |
| `sort` | string | Sort field: name, created_at, updated_at |
| `order` | string | Sort order: asc, desc |

**Response:**

```json
{
  "cutlists": [
    {
      "id": "cl_abc123",
      "name": "Kitchen Cabinet Project",
      "status": "active",
      "parts_count": 24,
      "created_at": "2024-12-20T10:30:00Z",
      "updated_at": "2024-12-20T15:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
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
    "name": "Kitchen Cabinet Project",
    "description": "Main kitchen cabinets",
    "status": "active",
    "job_ref": "JOB-2024-001",
    "client_ref": "CLIENT-123",
    "parts": [
      {
        "part_id": "pt_xyz789",
        "label": "Side Panel",
        "size": { "L": 720, "W": 560 },
        "thickness_mm": 18,
        "qty": 2,
        "material_id": "mat_white_melamine",
        "grain": "along_L",
        "ops": {
          "edging": {
            "L1": "eb_abs_white",
            "L2": "eb_abs_white"
          }
        }
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
  "job_ref": "JOB-2024-002",
  "client_ref": "CLIENT-456",
  "parts": [
    {
      "label": "Top Panel",
      "size": { "L": 800, "W": 600 },
      "thickness_mm": 18,
      "qty": 1,
      "material_id": "mat_white_melamine"
    }
  ]
}
```

**Response:** `201 Created`

```json
{
  "cutlist": {
    "id": "cl_new789",
    "name": "New Cabinet Project",
    "status": "draft",
    "parts_count": 1,
    "created_at": "2024-12-21T09:00:00Z"
  }
}
```

#### Update Cutlist

```http
PUT /cutlists/{id}
```

**Request Body:** Same as create, with optional fields.

#### Delete Cutlist

```http
DELETE /cutlists/{id}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Cutlist and associated files deleted"
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
      "label": "Shelf",
      "size": { "L": 500, "W": 300 },
      "thickness_mm": 18,
      "qty": 4,
      "material_id": "mat_white_melamine"
    }
  ]
}
```

#### Update Part

```http
PUT /cutlists/{cutlist_id}/parts/{part_id}
```

#### Delete Parts

```http
DELETE /cutlists/{cutlist_id}/parts
```

**Request Body:**

```json
{
  "part_ids": ["pt_abc", "pt_def"]
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
  "text": "Side panel 720x560 qty 2 white board",
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
      "confidence": 0.95
    }
  ],
  "parse_method": "ai_extraction",
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

**Response:**

```json
{
  "job": {
    "id": "pj_abc123",
    "status": "completed",
    "parts": [...],
    "summary": {
      "total_parts": 24,
      "confidence_avg": 0.92,
      "warnings": []
    },
    "created_at": "2024-12-21T10:00:00Z",
    "completed_at": "2024-12-21T10:00:05Z"
  }
}
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
    "include_metadata": true
  }
}
```

**Supported Formats:**
- `json` - Native CAI format
- `csv` - Universal CSV
- `maxcut` - MaxCut .mcp
- `cutlistplus` - CutList Plus CSV
- `cutrite` - CutRite XML
- `optimik` - Optimik CSV

**Response:**

Binary file download with appropriate Content-Type header.

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
| `cutlist_id` | string | Optional: Link to cutlist |

**Response:**

```json
{
  "file": {
    "id": "file_xyz",
    "name": "cutlist.pdf",
    "size_bytes": 245678,
    "mime_type": "application/pdf",
    "url": "https://storage.caiintake.com/..."
  }
}
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

### Materials

#### List Materials

```http
GET /materials
```

**Response:**

```json
{
  "materials": [
    {
      "id": "mat_white_melamine",
      "name": "White Melamine 18mm",
      "thickness_mm": 18,
      "type": "board",
      "is_system": false
    }
  ]
}
```

#### Create Material

```http
POST /materials
```

**Request Body:**

```json
{
  "name": "Oak Veneer 18mm",
  "thickness_mm": 18,
  "type": "board",
  "sku": "OAK-18-VNR",
  "cost_per_sqm": 45.00
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
  "name": "ABS White 2mm",
  "thickness_mm": 2,
  "width_mm": 22,
  "sku": "ABS-WHT-2",
  "shortcode": "A"
}
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
    "plan_id": "professional",
    "status": "active",
    "billing_interval": "monthly",
    "current_period_end": "2025-01-20T00:00:00Z"
  },
  "usage": {
    "cutlists_this_month": 45,
    "parts_processed": 1250,
    "storage_used_mb": 156
  },
  "limits": {
    "max_cutlists_per_month": 500,
    "max_team_members": 10,
    "max_storage_mb": 10240
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
  "details": {}
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `422` | Validation Error |
| `429` | Rate Limited |
| `500` | Server Error |

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request body is malformed |
| `VALIDATION_FAILED` | Field validation errors |
| `NOT_FOUND` | Resource doesn't exist |
| `PERMISSION_DENIED` | Insufficient permissions |
| `RATE_LIMITED` | Too many requests |
| `QUOTA_EXCEEDED` | Plan limit reached |

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

---

## Webhooks

Configure webhooks to receive real-time notifications.

### Supported Events

| Event | Description |
|-------|-------------|
| `cutlist.created` | New cutlist created |
| `cutlist.updated` | Cutlist modified |
| `cutlist.deleted` | Cutlist deleted |
| `parse_job.completed` | Parse job finished |
| `parse_job.failed` | Parse job failed |
| `export.completed` | Export ready |

### Webhook Payload

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

### Webhook Security

Verify webhook signatures using the `X-CAI-Signature` header:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === `sha256=${expected}`;
}
```

---

## SDKs

### JavaScript/TypeScript

```bash
npm install @caiintake/sdk
```

```typescript
import { CAIIntake } from '@caiintake/sdk';

const client = new CAIIntake({
  apiKey: 'YOUR_API_KEY'
});

const cutlists = await client.cutlists.list();
```

### Python

```bash
pip install cai-intake
```

```python
from cai_intake import CAIIntake

client = CAIIntake(api_key='YOUR_API_KEY')
cutlists = client.cutlists.list()
```

---

## Support

- **API Status**: [status.caiintake.com](https://status.caiintake.com)
- **Developer Support**: api-support@caiintake.com
- **Documentation**: [docs.caiintake.com/api](https://docs.caiintake.com/api)

---

*API Version: v1 | Last updated: December 2024*

