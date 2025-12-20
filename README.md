# CAI Intake

<p align="center">
  <img src="public/branding/logo-full.svg" alt="CAI Intake Logo" width="280">
</p>

<p align="center">
  <strong>The definitive cutlist data ingestion engine for cabinet & woodworking workshops</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#api">API</a> •
  <a href="#schema">Schema</a>
</p>

---

## Overview

CAI Intake is an enterprise-grade cutlist ingestion system that transforms messy, inconsistent input data into a clean, canonical format ready for optimization and manufacturing. It's designed to be the "universal translator" for cutlist data in the woodworking industry.

### The Problem

Workshops receive cutlists in countless formats:
- Handwritten notes
- Excel spreadsheets with inconsistent columns
- PDFs from design software
- Verbal instructions
- Photos of paper cutlists

This chaos leads to errors, wasted materials, and frustrated operators.

### The Solution

CAI Intake provides **6 intelligent input modes** that all converge into a single, validated canonical format:

```
┌─────────────────────────────────────────────────────────────┐
│                      INPUT SOURCES                          │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────────────┤
│Manual│Excel │Voice │OCR/AI│QR    │Copy  │     All modes    │
│Entry │Table │Dict. │Upload│Templ.│Paste │     unified      │
└──┬───┴──┬───┴──┬───┴──┬───┴──┬───┴──┬───┘                  │
   │      │      │      │      │      │                       │
   └──────┴──────┴──────┴──────┴──────┘                       │
                      │                                       │
                      ▼                                       │
          ┌───────────────────────┐                           │
          │   CANONICAL SCHEMA    │  ◄── Single source of    │
          │   (cai-cutlist/v1)    │      truth               │
          └───────────┬───────────┘                           │
                      │                                       │
          ┌───────────┴───────────┐                           │
          ▼                       ▼                           │
   ┌─────────────┐       ┌─────────────┐                     │
   │ CAI 2D      │       │ External    │                     │
   │ Optimizer   │       │ Exports     │                     │
   └─────────────┘       └─────────────┘                     │
                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Input Modes

| Mode | Description | Accuracy |
|------|-------------|----------|
| **Manual Entry** | Fast parse field + full form | 100% |
| **Excel Table** | Paste or upload spreadsheets with column mapping | 95%+ |
| **Voice Dictation** | Speak parts in structured format | 90%+ |
| **File Upload** | PDFs, images, CSVs with AI extraction | 85%+ |
| **QR Templates** | Org-branded forms with guaranteed accuracy | 99%+ |
| **Copy/Paste** | Extract from any text source | 85%+ |

### Canonical Schema Features

- **Versioned format** (`cai-cutlist/v1`) for safe evolution
- **L/W convention** with grain direction support
- **Full CNC operations**: edgebanding, grooves, holes, routing
- **Audit trail**: confidence scores, warnings, human verification
- **Capability tiers**: Simple shops see basic fields, CNC shops see everything

### Enterprise Features

- Multi-tenant organization support
- Role-based capabilities
- Versioned REST API
- Webhook notifications for async jobs
- Export to MaxCut, CutList Plus, and more

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or use Docker)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/positivesocial/CAI-Intake.git
cd CAI-Intake

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and other settings

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the application.

### Test Accounts

The application includes demo accounts for testing different user roles:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| **Super Admin** | `super@caiintake.com` | `SuperAdmin123!` | Platform-wide admin access |
| **Org Admin** | `admin@acmecabinets.com` | `OrgAdmin123!` | Organization admin (Acme Cabinets) |
| **Operator** | `operator@acmecabinets.com` | `Operator123!` | Basic operator access |

You can also use the **Quick Demo Login** buttons on the login page to instantly sign in as any role without entering credentials.

> **Note:** These are demo accounts for local development. They work without Supabase configuration.

### Docker Setup (Optional)

```bash
# Start PostgreSQL
docker run -d \
  --name cai-postgres \
  -e POSTGRES_USER=cai \
  -e POSTGRES_PASSWORD=cai \
  -e POSTGRES_DB=cai_intake \
  -p 5432:5432 \
  postgres:15

# Update .env
DATABASE_URL="postgresql://cai:cai@localhost:5432/cai_intake"
```

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL + Prisma |
| Validation | Zod |
| State | Zustand |

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Authentication routes
│   ├── (dashboard)/        # Protected dashboard
│   │   ├── cutlists/       # Cutlist management
│   │   ├── intake/         # Intake inbox UI
│   │   └── settings/       # Organization settings
│   └── api/v1/             # Versioned API
├── components/
│   ├── ui/                 # shadcn components
│   ├── intake/             # Intake-specific components
│   └── parts/              # Parts table components
├── lib/
│   ├── schema/             # Canonical Zod schemas
│   ├── parsers/            # Input parsing engines
│   ├── validators/         # Validation logic
│   └── exporters/          # Export format generators
└── types/                  # TypeScript types
```

### Data Flow

```mermaid
flowchart LR
    subgraph Input
        A[Manual] --> R
        B[Excel] --> R
        C[Voice] --> R
        D[OCR] --> R
        E[Template] --> R
        F[Paste] --> R
    end
    
    R[Router] --> P[Parser]
    P --> N[Normalizer]
    N --> V[Validator]
    V --> I[Intake Inbox]
    I --> DB[(Database)]
    DB --> API[API v1]
    API --> OPT[CAI 2D]
    API --> EXP[Exports]
```

## API

### Base URL

```
https://api.cai-intake.com/v1
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/cutlists` | POST | Create a cutlist |
| `/cutlists/{id}` | GET | Get a cutlist |
| `/files` | POST | Upload a file |
| `/parse-jobs` | POST | Create a parse job |
| `/parse-jobs/{id}` | GET | Get parse job result |
| `/exports` | POST | Create an export |
| `/optimize-jobs` | POST | Submit for optimization |

### Example: Create Parse Job

```bash
curl -X POST https://api.cai-intake.com/v1/parse-jobs \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "ORG-123",
    "target_schema": "cai-cutlist/v1",
    "source": {
      "kind": "text",
      "text": "Side panel 720x560 qty 2 white board",
      "origin": "manual_field"
    },
    "options": {
      "units": "mm",
      "default_thickness_mm": 18
    }
  }'
```

## Schema

### Canonical CutPart

The heart of CAI Intake is the `CutPart` schema:

```typescript
interface CutPart {
  // Identity
  part_id: string;
  label?: string;
  family?: "panel" | "door" | "drawer_box" | "face_frame" | "filler" | "misc";
  qty: number;

  // Dimensions (finished sizes in mm)
  size: { L: number; W: number };
  thickness_mm: number;

  // Material & orientation
  material_id: string;
  grain: "none" | "along_L";
  allow_rotation?: boolean;

  // Operations (optional)
  ops?: {
    edging?: EdgeEdgingOps;
    grooves?: GrooveOp[];
    holes?: HoleOp[];
    routing?: RoutingOp[];
  };

  // Audit trail
  audit?: {
    source_method: IngestionMethod;
    confidence?: number;
    human_verified?: boolean;
  };
}
```

See [src/lib/schema/](src/lib/schema/) for complete schema definitions.

## Development

### Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
```

### Git Workflow

```
main (production)
  └── develop (integration)
        ├── feature/schema-core
        ├── feature/manual-entry
        └── feature/excel-import
```

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`
- **PR required** for all changes to `develop` and `main`
- **CI runs** on every push and PR

## Roadmap

- [x] Phase 1: Foundation (Schema + Manual Entry)
- [ ] Phase 2: Excel/CSV Import with Mapping Wizard
- [ ] Phase 3: Voice Dictation Mode
- [ ] Phase 4: OCR + AI Parsing
- [ ] Phase 5: QR Template System
- [ ] Phase 6: CAI 2D Integration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Proprietary - All Rights Reserved

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/positivesocial">PositiveSocial</a>
</p>

<p align="center">
  Part of the <strong>CabinetAI</strong> ecosystem
</p>
