# CAI Intake User Guide

Welcome to CAI Intake! This guide will help you get started with the platform and make the most of its features.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Creating Cutlists](#creating-cutlists)
4. [Input Methods](#input-methods)
5. [Managing Parts](#managing-parts)
6. [Operations (Edgebanding, Grooves, Holes, CNC)](#operations)
7. [Exporting Cutlists](#exporting-cutlists)
8. [Team Management](#team-management)
9. [Billing & Subscription](#billing--subscription)
10. [Keyboard Shortcuts](#keyboard-shortcuts)
11. [FAQ](#faq)

---

## Getting Started

### Logging In

1. Navigate to [https://app.cai-intake.io](https://app.cai-intake.io)
2. Enter your email and password
3. Click "Sign In"

If you don't have an account, contact your organization administrator or start a free trial.

### First-Time Setup

After logging in for the first time:

1. **Complete your profile**: Add your name and contact information
2. **Set your preferences**: Choose your default units (mm/inches) and theme
3. **Explore the dashboard**: Familiarize yourself with the main navigation

---

## Dashboard Overview

The dashboard provides a quick overview of your activity:

- **Recent Cutlists**: Your most recent projects
- **Parts Inbox**: Newly parsed parts awaiting review
- **Quick Stats**: Total cutlists, parts, and processing metrics
- **Recent Activity**: Latest actions across your organization

### Navigation

- **Home**: Dashboard overview
- **Intake**: Create new cutlists
- **Cutlists**: View and manage saved cutlists
- **Library**: Materials, edgebands, and operation presets
- **Reports**: Usage statistics and analytics
- **Settings**: Account and organization settings

---

## Creating Cutlists

### Quick Start

1. Click **"New Cutlist"** or navigate to **Intake**
2. Enter a name for your cutlist
3. Add parts using any input method
4. Review and save

### Cutlist Properties

| Field | Description |
|-------|-------------|
| **Name** | Unique identifier for the cutlist |
| **Job Reference** | Optional external reference number |
| **Client Reference** | Optional client identifier |
| **Description** | Notes or additional details |
| **Status** | Draft, Active, or Archived |

---

## Input Methods

CAI Intake supports multiple ways to add parts:

### 1. Manual Entry

The fastest way to add individual parts:

```
Side panel 720x560 qty 2 white board
```

**Supported formats:**
- `[name] [length]x[width] qty [quantity] [material]`
- `[length] x [width] x [qty] - [name]`
- `[quantity] @ [length] x [width] [material]`

### 2. Excel/CSV Import

Upload spreadsheets with automatic column mapping:

1. Click **"Excel/CSV"** tab
2. Upload your file or paste data
3. Map columns to CAI fields
4. Preview and confirm

**Tips:**
- Headers are auto-detected
- Use the column wizard for complex mappings
- Save mappings as templates for reuse

### 3. Smart File Upload (OCR)

Process PDFs, images, and scanned documents:

1. Click **"Smart Upload"** tab
2. Drag and drop files
3. Wait for AI processing
4. Review extracted parts

**Supported formats:** PDF, PNG, JPG, WEBP, HEIC

### 4. Voice Dictation

Speak your cutlist:

1. Click **"Voice"** tab
2. Click the microphone button
3. Dictate in the format: "Part name, length, width, quantity, material"
4. Review transcription

### 5. Copy/Paste

Paste text from any source:

1. Click **"Paste"** tab
2. Paste your text
3. AI extracts part information

---

## Managing Parts

### Parts Table

The parts table displays all parts in your cutlist:

| Column | Description |
|--------|-------------|
| **#** | Part number |
| **Label** | Part name/description |
| **L** | Length (mm) |
| **W** | Width (mm) |
| **Th.** | Thickness (mm) |
| **Qty** | Quantity |
| **Material** | Board material |
| **Grain** | Grain direction |
| **Ops** | Operations summary |

### Actions

- **Edit**: Click any cell to edit inline
- **Delete**: Select parts and click Delete
- **Duplicate**: Create copies of selected parts
- **Reorder**: Drag rows to reorder
- **Group**: Organize parts into groups

### Bulk Operations

1. Select multiple parts using checkboxes
2. Use the bulk action menu:
   - Delete selected
   - Change material
   - Update thickness
   - Apply edgebanding

---

## Operations

### Edgebanding

Apply edge banding to panel edges:

1. Select a part
2. Click the edgebanding icon
3. Choose edges: L1, L2, W1, W2
4. Select edgeband material

**Shortcode format:** `L1-L2-W1-W2` (e.g., `A-A-B-0`)

### Grooves

Add grooves/dadoes:

1. Select a part
2. Click the groove icon
3. Configure:
   - Position (edge or field)
   - Width and depth
   - Offset from edge

### Holes

Add hole patterns:

1. Select a part
2. Click the holes icon
3. Choose pattern or add custom
4. Set positions and diameters

### CNC Operations

Add routing profiles:

1. Select a part
2. Click the CNC icon
3. Select routing profile
4. Configure parameters

---

## Exporting Cutlists

### Available Formats

| Format | Best For |
|--------|----------|
| **CSV** | Universal spreadsheet import |
| **JSON** | API integration, backup |
| **MaxCut** | MaxCut optimization software |
| **CutList Plus** | CutList Plus Pro |
| **CutRite** | Holzma, Homag systems |
| **Optimik** | Optimik software |

### How to Export

1. Open a cutlist
2. Click **"Export"**
3. Choose format
4. Configure options (units, headers, etc.)
5. Download file

### Export Options

- **Units**: mm, cm, or inches
- **Include headers**: Add column headers
- **Grain direction**: Include grain column
- **Operations**: Include operation details

---

## Team Management

### Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, billing |
| **Admin** | Manage users, settings |
| **Manager** | Create/edit cutlists |
| **Operator** | View and process cutlists |
| **Viewer** | Read-only access |

### Inviting Users

1. Go to **Settings > Team**
2. Click **"Invite User"**
3. Enter email and select role
4. Send invitation

### Managing Permissions

- Admins can change user roles
- Owners can transfer ownership
- Remove users from Settings > Team

---

## Billing & Subscription

### Plans

| Plan | Price | Features |
|------|-------|----------|
| Free | $0/mo | 5 cutlists, 1 user |
| Starter | $29/mo | 50 cutlists, 3 users |
| Professional | $79/mo | 500 cutlists, 10 users |
| Enterprise | Custom | Unlimited |

### Managing Your Subscription

1. Go to **Settings > Billing**
2. View current plan and usage
3. Upgrade or downgrade as needed
4. Update payment method

### Invoices

- Download invoices from the billing page
- Invoices are sent to the billing email
- Receipts available after payment

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New cutlist |
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + E` | Export |
| `Ctrl/Cmd + /` | Toggle shortcuts help |
| `Escape` | Cancel current action |
| `Delete` | Delete selected |
| `Enter` | Confirm edit |
| `Tab` | Next field |
| `Shift + Tab` | Previous field |

---

## FAQ

### General

**Q: How accurate is the OCR parsing?**

A: OCR accuracy depends on document quality. Well-formatted PDFs achieve 95%+ accuracy. Handwritten documents may require more manual review.

**Q: Can I import from my existing software?**

A: Yes! We support CSV import with flexible column mapping. Most cutting software can export CSV.

**Q: Is my data secure?**

A: Yes. All data is encrypted in transit and at rest. We use enterprise-grade security with Supabase.

### Technical

**Q: What file types can I upload?**

A: PDF, PNG, JPG, WEBP, HEIC, CSV, XLSX, XLS, TXT

**Q: What's the maximum file size?**

A: 10MB per file for standard plans, 50MB for Professional and Enterprise.

**Q: Can I use the API?**

A: API access is available on Professional and Enterprise plans.

### Billing

**Q: Can I cancel anytime?**

A: Yes, subscriptions can be canceled at any time. You'll retain access until the end of your billing period.

**Q: Do you offer refunds?**

A: We offer a 14-day money-back guarantee for new subscriptions.

**Q: Do you accept PayPal?**

A: Yes, we accept both credit cards and PayPal.

---

## Support

Need help? We're here for you:

- **Documentation**: [docs.cai-intake.io](https://docs.cai-intake.io)
- **Email**: support@cai-intake.io
- **Live Chat**: Available in-app (Professional+)
- **Phone**: Enterprise plans only

---

*Last updated: December 2024*

