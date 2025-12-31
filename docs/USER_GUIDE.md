# CAI Intake User Guide

Welcome to CAI Intake! This comprehensive guide will help you get started with the platform and make the most of its powerful features for cutlist management.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Creating Cutlists](#creating-cutlists)
4. [Input Methods](#input-methods)
5. [Managing Parts](#managing-parts)
6. [Part Rotation & Grain](#part-rotation--grain)
7. [Part Grouping](#part-grouping)
8. [Operations (Edgebanding, Grooves, Holes, CNC)](#operations)
9. [Exporting Cutlists](#exporting-cutlists)
10. [Team Management](#team-management)
11. [Billing & Subscription](#billing--subscription)
12. [Settings & Preferences](#settings--preferences)
13. [Notifications](#notifications)
14. [Keyboard Shortcuts](#keyboard-shortcuts)
15. [Learning System](#learning-system)
16. [FAQ](#faq)
17. [Support](#support)

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
2. **Set your preferences**: Choose your default units (mm/inches) and theme (light/dark)
3. **Explore the dashboard**: Familiarize yourself with the main navigation
4. **Review cutlist capabilities**: Enable/disable features like edgebanding, grooves, CNC operations

---

## Dashboard Overview

The dashboard provides a quick overview of your activity:

- **Recent Cutlists**: Your most recent projects with quick access
- **Parts Inbox**: Newly parsed parts awaiting review
- **Quick Stats**: Total cutlists, parts, and processing metrics
- **Recent Activity**: Latest actions across your organization
- **Notifications**: Bell icon shows unread notifications

### Navigation

| Menu Item | Description |
|-----------|-------------|
| **Home** | Dashboard overview |
| **Intake** | Create new cutlists (main workflow) |
| **Cutlists** | View and manage saved cutlists |
| **Library** | Materials, edgebands, and operation presets |
| **Reports** | Usage statistics and analytics |
| **Settings** | Account, organization, and billing settings |
| **Help** | Help center, documentation, and support |

---

## Creating Cutlists

### Quick Start Workflow

1. Click **"New Cutlist"** or navigate to **Intake**
2. **Setup Step**: Configure cutlist properties and capabilities
   - Enter a name for your cutlist
   - Set project/customer references (optional)
   - Enable/disable capabilities (edgebanding, grooves, holes, CNC)
3. **Feed Parts**: Add parts using any input method
4. **Review & Edit**: Verify parsed parts, make corrections
5. **Save**: Finalize and save your cutlist

### Cutlist Properties

| Field | Description |
|-------|-------------|
| **Name** | Unique identifier for the cutlist |
| **Project Name** | Optional project reference |
| **Customer Name** | Optional client identifier |
| **Description** | Notes or additional details |
| **Status** | Draft, Active, or Archived |

### Cutlist Capabilities

Enable only the features you need:

| Capability | Description |
|------------|-------------|
| **Edgebanding** | Edge banding operations (L1, L2, W1, W2) |
| **Grooves** | Dados and grooves for panel backs |
| **CNC Holes** | Hole patterns for hardware |
| **CNC Routing** | Custom routing operations |
| **Part Grouping** | Group parts by cabinet/assembly |
| **Part Notes** | Add notes to individual parts |

---

## Input Methods

CAI Intake supports 6 intelligent input methods:

### 1. Manual Entry (Fast Parse)

The fastest way to add individual parts using natural language:

```
Side panel 720x560 qty 2 white board
```

**Supported formats:**
- `[name] [length]x[width] qty [quantity] [material]`
- `[length] x [width] x [qty] - [name]`
- `[quantity] @ [length] x [width] [material]`
- Numbered lists: `1. 720x560 qty 2`

**Tips:**
- Dimensions can be in any order
- Material names are auto-matched
- Operations can be included: `edge 2L2W`

### 2. Excel/CSV Import

Upload or paste spreadsheet data:

1. Click **"Excel/CSV"** tab
2. Upload file or paste data directly
3. Map columns to CAI fields using the wizard
4. Preview and confirm mapping
5. Import parts

**Supported formats:** CSV, XLSX, XLS, TSV

**Tips:**
- Headers are auto-detected
- Save column mappings as templates for reuse
- Unmapped columns are preserved in notes

### 3. Smart File Upload (OCR/AI)

Process PDFs, images, and scanned documents:

1. Click **"Smart Upload"** tab
2. Drag and drop files (or click to browse)
3. Wait for AI processing
4. Review extracted parts in inbox

**Supported formats:** PDF, PNG, JPG, JPEG, WEBP, HEIC

**How it works:**
- Text-based PDFs: Python OCR text extraction (fastest)
- Digital PDFs: Claude Native PDF support (direct analysis)
- Scanned PDFs: Multi-stage fallback (Python OCR → Claude → GPT)
- Images: AI Vision analysis with template detection
- Automatic format and template detection

**Template Detection:**
The system automatically recognizes:
- **SketchCut PRO**: Underlines for edge banding, "gl/GL" for grooves
- **MaxCut**: L-L-W-W binary edge format, actual vs cutting size
- **CutList Plus**: Standard column layouts
- **CAI Templates**: QR codes and predefined structures

**Tips:**
- Higher quality images = better accuracy
- Clear, typed text works best
- Handwritten notes may need more review
- Use Gallery View to compare source with parsed parts

### 4. Voice Dictation

Speak your cutlist:

1. Click **"Voice"** tab
2. Click the microphone button
3. Dictate in a structured format:
   - "Side panel, 720 by 560, quantity 2, white board"
   - "Part one, 600 by 400, 3 pieces, oak"
4. Review transcription and parsed parts

**Requirements:**
- Chrome or Edge browser (for Web Speech API)
- Or upload an audio file for Whisper transcription

### 5. Copy/Paste (Smart Parse)

Paste text from any source:

1. Click **"Paste & Parse"** tab
2. Paste your text (emails, notes, spreadsheets)
3. AI automatically detects format and parses

**Auto-Detection:**
- Structured data (tables, CSV) → Pattern-based parsing
- Free-form text (notes, emails) → AI parsing
- Mixed formats → Hybrid approach

**Supported text types:**
- Copy-pasted spreadsheets
- Email excerpts
- Handwritten notes transcripts
- Job sheets and order forms
- Numbered lists

### 6. QR Templates

Use org-branded templates for guaranteed accuracy:

1. Print QR template (Settings → Templates)
2. Fill in the template (physical or digital)
3. Scan the QR code or upload image
4. Parts are parsed according to template structure

**Benefits:**
- 99%+ accuracy with predefined structure
- Consistent data entry
- Works with field staff and customers

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
| **Rot** | Rotation allowed (✓) or locked (⊘) |
| **Group** | Part grouping (cabinet/assembly) |
| **Ops** | Operations summary (edge, groove, holes) |

### Actions

- **Edit**: Click any cell to edit inline
- **Delete**: Select parts and click Delete
- **Duplicate**: Create copies of selected parts
- **Reorder**: Drag rows to reorder (manual order)
- **Group**: Organize parts into groups

### Bulk Operations

1. Select multiple parts using checkboxes
2. Use the bulk action toolbar:
   - **Material**: Change material for all selected
   - **Rotation**: Allow or lock rotation
   - **Group**: Assign to a group
   - **Delete**: Remove selected parts

---

## Part Rotation & Grain

### Understanding Rotation

The **Rotation** (Rot) setting controls whether parts can be rotated during cutting optimization:

| Setting | Icon | Meaning |
|---------|------|---------|
| **Allowed** | ✓ | Part can be rotated 90° for better yield |
| **Locked** | ⊘ | Part must maintain orientation (grain direction) |

### When to Lock Rotation

Lock rotation when:
- Material has visible grain direction
- Part orientation matters aesthetically
- CNC operations require specific orientation
- Hardware placement is directional

### Setting Rotation

**Individual Part:**
- Click the rotation icon in the parts table
- Toggle in the part edit dialog

**Bulk Update:**
1. Select multiple parts
2. Use Bulk Actions → Rotation
3. Choose "Allow rotation" or "Lock rotation"

**Default Behavior:**
- New parts default to **rotation locked** (⊘)
- This prevents accidental rotation of grained materials
- Change in Settings → Cutlist Defaults

---

## Part Grouping

### What is Part Grouping?

Part grouping lets you organize parts by cabinet, assembly, or custom categories. This helps with:
- Manufacturing organization
- Assembly tracking
- Visual clarity in large cutlists

### Enabling Grouping

1. Go to Intake → Setup Step
2. Enable "Part Grouping" under Organization
3. A "Group" column appears in the parts table

### Assigning Groups

**Individual Part:**
- Enter group name in the Group field
- Common formats: "Cabinet 1", "Drawer A", "Island"

**Bulk Assign:**
1. Select multiple parts
2. Use Bulk Actions → Group
3. Enter group name

### Tips

- Use consistent naming (e.g., "Cab-1", "Cab-2")
- Groups can be any text (no validation)
- Leave blank for ungrouped parts

---

## Operations

### Edgebanding

Apply edge banding to panel edges:

| Edge | Position |
|------|----------|
| **L1** | First long edge |
| **L2** | Second long edge |
| **W1** | First short edge |
| **W2** | Second short edge |

**Shortcode format:** `2L2W` (both long, both short edges)

**Setting edgebanding:**
1. Select a part
2. Click the edgebanding icon or edit the Ops field
3. Choose edges and material
4. Common patterns:
   - `0` = No edging
   - `1L` = Front edge only
   - `2L2W` = All edges
   - `2L1W` = Both long + one short

### Grooves

Add grooves/dadoes for panel backs:

**Configuration:**
- Position (edge offset or field)
- Width and depth
- Face (top or bottom)

**Common use:**
- Panel back grooves (6mm or 3mm)
- Assembly dadoes

### Holes

Add hole patterns for hardware:

**Pattern types:**
- System 32 (shelf pins)
- Hinge holes
- Custom patterns

**Configuration:**
- Hole diameter
- Depth
- Position array

### CNC Routing

Custom routing operations:

- Profile routing
- Pocket cuts
- Custom macros
- Hardware prep

---

## Exporting Cutlists

### Available Formats

| Format | Extension | Best For |
|--------|-----------|----------|
| **CSV** | `.csv` | Universal spreadsheet import |
| **JSON** | `.json` | API integration, backup |
| **PDF** | `.pdf` | Printing and sharing |
| **MaxCut** | `.mcp` | MaxCut optimization software |
| **CutList Plus** | `.csv` | CutList Plus Pro |
| **CutRite** | `.xml` | Holzma, Homag systems |
| **Optimik** | `.csv` | Optimik software |

### How to Export

1. Open a cutlist
2. Click **"Export"** button
3. Choose format from dropdown
4. Configure options (units, headers, etc.)
5. Download file

### Export Options

| Option | Description |
|--------|-------------|
| **Units** | mm, cm, or inches |
| **Include headers** | Add column headers |
| **Include operations** | Add edging, groove details |
| **Rotation column** | Include rotation status |
| **Group column** | Include part grouping |

---

## Team Management

### Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, billing, can delete org |
| **Admin** | Manage users, settings, full cutlist access |
| **Manager** | Create/edit cutlists, limited settings |
| **Operator** | View and process cutlists only |
| **Viewer** | Read-only access |

### Inviting Users

1. Go to **Settings → Team**
2. Click **"Invite User"**
3. Enter email and select role
4. Send invitation
5. User receives email with signup link

### Managing Permissions

- Admins can change user roles
- Owners can transfer ownership
- Remove users from Settings → Team

---

## Billing & Subscription

### Plans

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0/mo | 5 cutlists, 1 user, basic |
| **Starter** | $29/mo | 50 cutlists, 3 users, Excel, Voice |
| **Professional** | $79/mo | 500 cutlists, 10 users, OCR, API |
| **Enterprise** | Custom | Unlimited, priority support |

### Managing Your Subscription

1. Go to **Settings → Billing**
2. View current plan and usage
3. Upgrade or downgrade as needed
4. Update payment method

### Usage Limits

Monitor usage in the billing dashboard:
- Cutlists created this period
- Parts processed
- AI/OCR calls used
- Storage used

---

## Settings & Preferences

### User Settings (Settings → Account)

- Profile information (name, email)
- Password change
- Theme preference (light/dark/system)
- Default units

### Organization Settings (Settings → Organization)

- Organization name and logo
- Regional settings (timezone, date format)
- Default cutlist settings
- Capability presets
- Webhook configuration

### Shortcodes (Settings → Shortcodes)

Configure operation shortcodes:
- Edgeband notation (e.g., "A" = "White ABS")
- Groove codes
- Material abbreviations

---

## Notifications

### Notification Center

Click the bell icon in the header to view notifications:

- **File processed**: When uploads complete
- **Cutlist created**: When cutlists are saved
- **Errors**: Processing failures
- **System**: Updates and announcements

### Managing Notifications

- Click to mark as read
- "Mark all as read" button
- "Clear all" to remove old notifications
- Notifications persist across sessions

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New cutlist |
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + E` | Export |
| `Ctrl/Cmd + K` | Command palette |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Delete` | Delete selected parts |
| `Enter` | Confirm edit / Add part |
| `Tab` | Next field |
| `Shift + Tab` | Previous field |
| `Escape` | Cancel / Close modal |
| `?` | Show keyboard shortcuts |

---

## Learning System

CAI Intake continuously improves parsing accuracy through intelligent learning:

### How It Learns

1. **Few-Shot Examples**: AI uses successful parsing examples to improve accuracy
2. **Pattern Recognition**: System learns your organization's notation (edge codes, material names)
3. **Material Mapping**: Auto-maps your material names to your database
4. **Silent Auto-Training**: Corrections are automatically saved as training examples in the background
5. **Template Detection**: Recognizes SketchCut PRO, MaxCut, CutList Plus, and CAI templates

### Confidence Flagging

Parts with low parsing confidence are automatically flagged:
- **High Confidence** (green): Dimensions, material, and operations all clear
- **Medium Confidence** (yellow): Some fields may need verification
- **Low Confidence** (red): Review recommended before saving

### Training (Super Admin)

Super admins can access the Training Dashboard:
- View accuracy metrics over time
- Add new training examples (upload or paste)
- Review weak areas and low-confidence patterns
- Manage material mappings
- Test parser against training data

### For Best Results

- Review and correct parsed parts before saving (corrections improve AI)
- Use consistent notation across your organization
- Parts with confidence flags should be verified
- Report parsing errors for continuous improvement

---

## FAQ

### General

**Q: How accurate is the AI/OCR parsing?**

A: Accuracy varies by input quality:
- Clean spreadsheets: 95%+
- Typed PDFs: 90%+
- Scanned documents: 85%+
- Handwritten notes: 70%+ (needs review)

**Q: Can I import from my existing software?**

A: Yes! We support CSV import with flexible column mapping. Most cutting software can export CSV.

**Q: Is my data secure?**

A: Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We use enterprise-grade security with Supabase.

### Technical

**Q: What file types can I upload?**

A: PDF, PNG, JPG, WEBP, HEIC, CSV, XLSX, XLS, TXT, audio files (for voice transcription)

**Q: What's the maximum file size?**

A: 10MB per file for standard plans, 50MB for Professional and Enterprise.

**Q: Can I use the API?**

A: API access is available on Professional and Enterprise plans.

### Billing

**Q: Can I cancel anytime?**

A: Yes, subscriptions can be canceled at any time. You'll retain access until the end of your billing period.

**Q: Do you offer refunds?**

A: We offer a 14-day money-back guarantee for new subscriptions.

---

## Support

Need help? We're here for you:

- **Help Center**: [app.cai-intake.io/help](https://app.cai-intake.io/help)
- **Documentation**: [app.cai-intake.io/docs](https://app.cai-intake.io/docs)
- **Email**: support@cai-intake.io
- **Live Chat**: Available in-app (Professional+)
- **Phone**: Enterprise plans only

**Response Times:**
- Free/Starter: 48-72 hours
- Professional: 24 hours
- Enterprise: 4 hours (business hours)

---

*Last updated: December 2025 | Version 1.2.0*
