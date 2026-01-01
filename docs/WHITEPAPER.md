# CAI Intake: The Universal Cutlist Engine

<p align="center">
  <img src="../public/branding/logo-full.svg" alt="CAI Intake" width="320">
</p>

<p align="center">
  <strong>Transforming Chaos into Precision</strong><br>
  <em>The Definitive Cutlist Data Ingestion Platform for Cabinet & Woodworking Manufacturing</em>
</p>

<p align="center">
  <strong>White Paper v1.0 | January 2025</strong>
</p>

---

## Executive Summary

CAI Intake is an enterprise-grade SaaS platform that solves one of the most persistent problems in cabinet and woodworking manufacturing: **the chaos of cutlist data ingestion**. 

Every workshop receives cutlists in countless formats—handwritten notes, Excel spreadsheets, PDFs from design software, photos of paper lists, and verbal instructions. This inconsistency leads to errors, wasted materials, production delays, and frustrated operators.

CAI Intake provides **six intelligent input modes** that all converge into a single, validated canonical format ready for optimization and manufacturing. Powered by advanced AI (Claude and GPT-4), computer vision, and a self-improving learning system, CAI Intake achieves **85-99%+ accuracy** across all input types.

### Key Value Propositions

| Stakeholder | Value |
|-------------|-------|
| **Workshop Owners** | Reduce material waste by 15-25% through accurate cutlist processing |
| **Operators** | Save 2-4 hours daily on manual data entry and error correction |
| **Designers** | Seamless data flow from design software to production |
| **Integrators** | Universal API for connecting any design tool to any optimizer |

### Market Opportunity

- **$2.1B** global woodworking software market (2024)
- **12.4% CAGR** projected through 2030
- **500,000+** cabinet shops globally
- **90%** still use manual or semi-automated cutlist processes

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Our Solution](#our-solution)
3. [Technology Architecture](#technology-architecture)
4. [The Learning System](#the-learning-system)
5. [Use Cases](#use-cases)
6. [Competitive Landscape](#competitive-landscape)
7. [Business Model](#business-model)
8. [Security & Compliance](#security--compliance)
9. [Roadmap](#roadmap)
10. [The Team](#the-team)
11. [Investment Opportunity](#investment-opportunity)

---

## The Problem

### The Cutlist Data Nightmare

Every cabinet and woodworking shop faces the same challenge: **cutlist data comes from everywhere in every format imaginable**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    REAL-WORLD DATA SOURCES                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📝 Handwritten notes from craftsmen ("fundis")                     │
│  📊 Excel files with inconsistent column ordering                   │
│  📄 PDFs from design software (SketchCut, MaxCut, CutList Plus)     │
│  📸 Photos of paper cutlists taken on mobile phones                 │
│  🗣️ Verbal instructions during rushed production meetings           │
│  💬 WhatsApp messages with dimensions scattered across chats        │
│  📑 Scanned documents with varying image quality                    │
│  🖥️ Software exports in proprietary formats                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### The Cost of Chaos

| Problem | Impact |
|---------|--------|
| **Transcription Errors** | A single digit mistake (720mm → 270mm) ruins an entire panel |
| **Format Confusion** | Edge banding "2L2W" vs "ALL" vs "4-sided" means the same thing |
| **Missing Information** | Cutlists arrive without thickness, material, or operation data |
| **Time Waste** | Operators spend 30-50% of their day on data entry, not production |
| **Material Waste** | 10-20% of materials wasted due to rework from data errors |
| **Production Delays** | Average 2-4 hour delay per project due to cutlist clarification |

### Why Existing Solutions Fail

1. **Design Software Silos**: Each software (SketchList3D, Cabinet Vision, KCD) exports in its own format
2. **Optimizers Expect Clean Data**: CutList Plus, MaxCut, Optimik require perfectly formatted inputs
3. **No Universal Translator**: No tool exists to bridge the gap between messy reality and clean requirements
4. **Static Parsers**: Traditional parsers can't handle the variety of real-world formats
5. **No Learning**: Each error must be manually corrected; the system never improves

---

## Our Solution

### The Universal Cutlist Engine

CAI Intake is the **"universal translator"** for cutlist data. It accepts any input format and produces a single, validated canonical output ready for optimization and manufacturing.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAI INTAKE ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│   │Manual│ │Excel │ │Voice │ │OCR/AI│ │ QR   │ │Paste │           │
│   │Entry │ │Import│ │Dict. │ │Upload│ │Templ.│ │Parse │           │
│   └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘           │
│      │        │        │        │        │        │                │
│      └────────┴────────┴───┬────┴────────┴────────┘                │
│                            │                                       │
│                            ▼                                       │
│              ┌─────────────────────────┐                           │
│              │   🧠 LEARNING ENGINE    │                           │
│              │   Few-shot + Patterns   │                           │
│              │   + Material Mapping    │                           │
│              └───────────┬─────────────┘                           │
│                          │                                         │
│                          ▼                                         │
│              ┌─────────────────────────┐                           │
│              │  📋 CANONICAL SCHEMA    │                           │
│              │    cai-cutlist/v1       │                           │
│              │  (Single Source of      │                           │
│              │   Truth)                │                           │
│              └───────────┬─────────────┘                           │
│                          │                                         │
│          ┌───────────────┼───────────────┐                         │
│          ▼               ▼               ▼                         │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                 │
│   │   MaxCut    │ │ CutList+    │ │  CAI 2D     │                 │
│   │   Export    │ │   Export    │ │ Optimizer   │                 │
│   └─────────────┘ └─────────────┘ └─────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Six Intelligent Input Modes

| Mode | Description | Accuracy | Best For |
|------|-------------|----------|----------|
| **Manual Entry** | Natural language parsing with fast entry field | 100% | Quick additions, single parts |
| **Excel/CSV** | Upload or paste with intelligent column mapping | 95%+ | Spreadsheet imports |
| **Voice Dictation** | Speak parts using Web Speech or Whisper | 90%+ | Hands-free entry |
| **Smart Upload** | PDFs and images with multi-stage AI OCR | 85%+ | Design exports, scans |
| **QR Templates** | Organization-branded forms with guaranteed structure | 99%+ | Standardized workflows |
| **Copy/Paste** | Smart parsing from any text source | 85%+ | Quick transfers |

### The Canonical Schema

Every cutlist converges into a single, versioned schema (`cai-cutlist/v1`):

```typescript
interface CutPart {
  part_id: string;                    // Unique identifier
  label?: string;                     // Human-readable name
  qty: number;                        // Quantity needed
  size: { L: number; W: number };     // Length × Width (mm)
  thickness_mm: number;               // Material thickness
  material_id: string;                // Reference to material
  allow_rotation: boolean;            // Grain direction control
  group_id?: string;                  // Assembly grouping
  
  ops?: {
    edging?: {                        // Edge banding
      edges?: Record<Edge, {
        apply: boolean;
        edgeband_id?: string;
      }>;
    };
    grooves?: GrooveOp[];             // Dados and grooves
    holes?: HoleOp[];                 // Drilling patterns
    routing?: RoutingOp[];            // CNC routing
    custom_cnc_ops?: CustomOp[];      // Custom operations
  };
  
  notes?: {
    operator?: string;
    design?: string;
    cnc?: string;
  };
  
  audit?: {
    confidence: number;               // 0-1 parsing confidence
    source: string;                   // Origin file/input
    warnings?: string[];              // Flags for review
  };
}
```

### Template Detection & Awareness

CAI Intake automatically detects and adapts to common cutlist formats:

| Template | Detection Method | Special Handling |
|----------|------------------|------------------|
| **SketchCut PRO** | Underline patterns, "gl/GL" | Solid underline = edge, dashed = groove |
| **MaxCut** | L-L-W-W format | Binary edge coding, actual vs cutting size |
| **CutList Plus** | Column headers | Standard column mapping |
| **CAI Template** | QR code | Deterministic column positions |
| **Handwritten** | Visual analysis | Enhanced OCR with confidence flagging |

---

## Technology Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16, React 19 | Server components, streaming |
| **Styling** | Tailwind CSS, shadcn/ui | Modern, accessible UI |
| **Database** | PostgreSQL + Supabase | Scalable, row-level security |
| **ORM** | Prisma | Type-safe queries |
| **Validation** | Zod | Runtime schema validation |
| **State** | Zustand | Persisted client state |
| **AI Primary** | Anthropic Claude 3.5/4 | Vision OCR, PDF parsing |
| **AI Fallback** | OpenAI GPT-4o | Redundant provider |
| **OCR** | Python Tesseract | Text extraction |

### Multi-Stage OCR Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MULTI-STAGE OCR PIPELINE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐                                                    │
│  │ Input File  │                                                    │
│  └──────┬──────┘                                                    │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────┐      ┌─────────────────┐                      │
│  │ Format Detect   │──────│ Template Detect │                      │
│  │ PDF/Image/Text  │      │ QR + Text Scan  │                      │
│  └────────┬────────┘      └────────┬────────┘                      │
│           │                        │                                │
│           ▼                        ▼                                │
│  ┌────────────────────────────────────────────┐                    │
│  │          STAGE 1: Python OCR               │ ← Fast, cheap      │
│  │          (Tesseract text extraction)       │                    │
│  └─────────────────────┬──────────────────────┘                    │
│                        │                                            │
│              ┌─────────┴─────────┐                                  │
│              │  Quality Check    │                                  │
│              │  ≥70% confidence? │                                  │
│              └─────────┬─────────┘                                  │
│                   YES  │  NO                                        │
│                   ▼    │                                            │
│  ┌────────────────┐    │                                            │
│  │ Return Result  │    │                                            │
│  └────────────────┘    │                                            │
│                        ▼                                            │
│  ┌────────────────────────────────────────────┐                    │
│  │          STAGE 2: Claude Native PDF        │ ← Direct analysis  │
│  │          (For text-based PDFs)             │                    │
│  └─────────────────────┬──────────────────────┘                    │
│                        │                                            │
│              ┌─────────┴─────────┐                                  │
│              │  Success?         │                                  │
│              └─────────┬─────────┘                                  │
│                   YES  │  NO                                        │
│                   ▼    │                                            │
│  ┌────────────────┐    │                                            │
│  │ Return Result  │    │                                            │
│  └────────────────┘    │                                            │
│                        ▼                                            │
│  ┌────────────────────────────────────────────┐                    │
│  │          STAGE 3: Vision Fallback          │ ← Most capable     │
│  │          (Claude Vision → GPT-4o Vision)   │                    │
│  └─────────────────────┬──────────────────────┘                    │
│                        │                                            │
│                        ▼                                            │
│  ┌────────────────────────────────────────────┐                    │
│  │          VALIDATION & EXPANSION            │                    │
│  │   • Compact format detection               │                    │
│  │   • Dimension validation (L,W > 0)         │                    │
│  │   • Quantity sanitization                  │                    │
│  │   • Skip invalid parts → Modal             │                    │
│  └────────────────────────────────────────────┘                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Performance Benchmarks

| Metric | Value | Notes |
|--------|-------|-------|
| **Parse Time (Text)** | <500ms | Pattern-based parsing |
| **Parse Time (Image)** | 8-20s | Depending on complexity |
| **Parse Time (PDF)** | 10-45s | Multi-page documents |
| **API Latency** | <100ms | Non-AI endpoints |
| **Uptime SLA** | 99.9% | Enterprise tier |
| **Cache Hit Rate** | 40-60% | For repeated documents |

---

## The Learning System

### Self-Improving Accuracy

CAI Intake gets smarter with every use. Our learning system combines:

1. **Few-Shot Learning**: Relevant examples are injected into AI prompts
2. **Pattern Recognition**: Common formats are learned and applied
3. **Material Mapping**: Organization-specific materials are auto-matched
4. **Silent Auto-Training**: User corrections automatically create training examples

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LEARNING FEEDBACK LOOP                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐                                               │
│  │   User Upload    │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────────────────────────────┐                      │
│  │         FEW-SHOT SELECTOR                │                      │
│  │  • Template matching (+40 points)        │                      │
│  │  • Structure similarity (+20 points)     │                      │
│  │  • Feature matching (+20 points)         │                      │
│  │  • Success rate history (+30 points)     │                      │
│  │  • Client matching (+15 points)          │                      │
│  └────────────────────┬─────────────────────┘                      │
│                       │                                             │
│                       ▼                                             │
│  ┌──────────────────────────────────────────┐                      │
│  │         AI PARSING + EXAMPLES            │                      │
│  │  System prompt + top 3 examples          │                      │
│  └────────────────────┬─────────────────────┘                      │
│                       │                                             │
│                       ▼                                             │
│  ┌──────────────────────────────────────────┐                      │
│  │         USER REVIEW & CORRECTION         │                      │
│  │  Verify parts, fix errors                │                      │
│  └────────────────────┬─────────────────────┘                      │
│                       │                                             │
│                       ▼                                             │
│  ┌──────────────────────────────────────────┐                      │
│  │         SILENT AUTO-TRAINING             │                      │
│  │  • Detect significant corrections        │                      │
│  │  • Auto-create training example          │                      │
│  │  • Update pattern confidence             │                      │
│  │  • Log accuracy metrics                  │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                     │
│  ════════════════════════════════════════════                      │
│  Result: Every correction improves future parsing                   │
│  ════════════════════════════════════════════                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Accuracy Metrics

| Input Type | Initial Accuracy | After Learning |
|------------|------------------|----------------|
| Printed cutlists | 85% | 95%+ |
| SketchCut PRO PDFs | 90% | 98%+ |
| MaxCut exports | 88% | 97%+ |
| Handwritten notes | 70% | 85%+ |
| CAI Templates | 95% | 99%+ |

---

## Use Cases

### Case Study 1: High-Volume Cabinet Shop

**Client**: Kitchen Pro Manufacturers (50 employees, 200 cabinets/month)

**Before CAI Intake**:
- 2 full-time data entry staff
- 3-hour average per project for cutlist processing
- 15% rework rate due to data errors
- $45,000/year in wasted materials

**After CAI Intake**:
- Data entry reduced to 30 minutes/project
- 3% rework rate
- $12,000/year material savings
- ROI: **8 months**

### Case Study 2: Furniture Design Studio

**Client**: ModernForm Designs (8 employees)

**Challenge**: Receive customer designs in every format imaginable

**Solution**: CAI Intake standardizes all inputs

**Results**:
- Quote turnaround: 2 days → 4 hours
- Customer satisfaction: +40%
- Production errors: -60%

### Case Study 3: CNC Integration

**Client**: TechWood Manufacturing (CNC-heavy production)

**Challenge**: CNC operations (holes, routing) lost in translation

**Solution**: Full CNC operation capture in canonical schema

**Results**:
- CNC program generation time: -50%
- Manual CNC programming eliminated
- Full traceability from design to machine

---

## Competitive Landscape

### Market Positioning

```
                    HIGH AUTOMATION
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         │   CAI Intake   │                │
         │   ★            │                │
         │                │                │
  GENERAL │                │                │ SPECIALIZED
  PURPOSE ├────────────────┼────────────────┤ (Single SW)
         │                │                │
         │                │   CutList Plus │
         │                │   MaxCut       │
         │   Excel        │                │
         │                │                │
         └────────────────┼────────────────┘
                          │
                    LOW AUTOMATION
```

### Competitive Comparison

| Feature | CAI Intake | CutList Plus | MaxCut | Excel |
|---------|-----------|--------------|--------|-------|
| Multi-format input | ✅ 6 modes | ❌ Single | ❌ Single | ❌ Manual |
| AI-powered OCR | ✅ Multi-stage | ❌ | ❌ | ❌ |
| Self-learning | ✅ | ❌ | ❌ | ❌ |
| Voice input | ✅ | ❌ | ❌ | ❌ |
| API access | ✅ REST | ❌ | ❌ | ❌ |
| Multi-tenant SaaS | ✅ | ❌ Desktop | ❌ Desktop | N/A |
| CNC operations | ✅ Full | ⚠️ Limited | ⚠️ Limited | ❌ |
| Export formats | ✅ 7+ | ⚠️ 3 | ⚠️ 2 | ⚠️ CSV |

### Competitive Advantages

1. **Universal Input**: Only solution that handles all input formats
2. **AI + Learning**: Only solution that improves automatically
3. **API-First**: Easy integration with existing tools
4. **Modern SaaS**: No software installation, always updated
5. **Full CNC Support**: Captures all operations, not just dimensions

---

## Business Model

### Pricing Tiers

| Plan | Price | Team Size | Cutlists/mo | Features |
|------|-------|-----------|-------------|----------|
| **Free** | $0 | 1 user | 5 | Basic entry, CSV export |
| **Starter** | $29/mo | 3 users | 50 | Excel, Voice, Edgebanding |
| **Professional** | $79/mo | 10 users | 500 | Full OCR, CNC ops, API |
| **Enterprise** | Custom | Unlimited | Unlimited | SLA, Priority support |

### Revenue Streams

1. **Subscription Revenue** (Primary): Monthly/annual SaaS fees
2. **API Usage**: Pay-per-parse for high-volume integrators
3. **Enterprise Licensing**: On-premise deployments
4. **Professional Services**: Custom integrations, training

### Unit Economics

| Metric | Value |
|--------|-------|
| **CAC** | $150 (blended) |
| **LTV** | $2,400 (Professional) |
| **LTV:CAC** | 16:1 |
| **Churn** | <5% monthly |
| **Payback Period** | 2.5 months |

---

## Security & Compliance

### Data Security

- **TLS 1.3**: All data encrypted in transit
- **AES-256**: All data encrypted at rest
- **Row-Level Security**: Supabase RLS policies
- **SOC 2 Type II**: Compliance in progress
- **GDPR Ready**: Data residency and deletion controls

### AI Security

- **No Data Sharing**: Customer data never used to train public models
- **Org Isolation**: Each organization's learning is isolated
- **Audit Logging**: Complete audit trail of all AI operations
- **Rate Limiting**: Protection against abuse

---

## Roadmap

### Completed (Q1-Q4 2024)

- [x] Core canonical schema
- [x] 6 input modes
- [x] Multi-stage OCR pipeline
- [x] Learning system with auto-training
- [x] Export to MaxCut, CutList Plus, CutRite, Optimik
- [x] Subscription & billing
- [x] Super admin platform
- [x] Template detection (SketchCut, MaxCut)

### Q1 2025

- [ ] **CAI 2D Optimizer Integration**: Native panel optimization
- [ ] **Mobile App**: iOS/Android for photo capture
- [ ] **Offline Mode**: Work without internet, sync later

### Q2 2025

- [ ] **Design Software Plugins**: SketchUp, Cabinet Vision integrations
- [ ] **Batch Processing**: High-volume parallel parsing
- [ ] **Advanced Analytics**: Material waste tracking, productivity metrics

### Q3-Q4 2025

- [ ] **Machine Integration**: Direct CNC machine communication
- [ ] **AR Labeling**: Augmented reality part labeling
- [ ] **Marketplace**: Third-party material and operation libraries

---

## The Team

### Leadership

**PositiveSocial Ltd** is a technology company focused on bringing AI-powered solutions to traditional industries.

- **Headquarters**: London, United Kingdom
- **Development**: Distributed team across UK, EU, Africa
- **Founded**: 2023

### Advisory Board

- Industry veterans from cabinet manufacturing
- AI/ML experts from leading tech companies
- SaaS scaling specialists

---

## Investment Opportunity

### Funding Stage

**Seed Round**: Raising $1.5M to accelerate growth

### Use of Funds

| Category | Allocation | Purpose |
|----------|------------|---------|
| Engineering | 50% | Product development, mobile apps |
| Sales & Marketing | 30% | Customer acquisition, brand building |
| Operations | 15% | Infrastructure, compliance |
| Reserve | 5% | Contingency |

### Key Metrics (Projections)

| Metric | 2025 | 2026 | 2027 |
|--------|------|------|------|
| ARR | $500K | $2M | $8M |
| Customers | 500 | 2,000 | 8,000 |
| Team Size | 10 | 25 | 50 |

### Why Now?

1. **AI Maturity**: Claude and GPT-4 vision capabilities make accurate OCR possible
2. **Industry Digitization**: Post-COVID push for digital transformation
3. **Labor Shortage**: Manufacturing struggling to find skilled workers
4. **First Mover**: No established AI-first solution in this space

---

## Contact

**For Investors:**
- Email: invest@positivesocial.com
- Website: https://positivesocial.com

**For Partners:**
- Email: partners@cai-intake.io
- Website: https://cai-intake.io/partners

**For Customers:**
- Email: sales@cai-intake.io
- Website: https://cai-intake.io
- Demo: https://app.cai-intake.io/demo

---

<p align="center">
  <strong>CAI Intake</strong><br>
  <em>Transforming Chaos into Precision</em><br>
  <br>
  Part of the <strong>CabinetAI</strong> Ecosystem<br>
  © 2024-2025 PositiveSocial Ltd. All Rights Reserved.
</p>

