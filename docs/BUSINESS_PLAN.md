# CAI Intake Business Plan

<p align="center">
  <img src="../public/branding/logo-full.svg" alt="CAI Intake" width="280">
</p>

<p align="center">
  <strong>Business Plan 2025-2027</strong><br>
  <em>Confidential | January 2025</em>
</p>

---

## Executive Summary

CAI Intake is a B2B SaaS platform that provides AI-powered cutlist data ingestion for the cabinet and woodworking manufacturing industry. We transform messy, inconsistent cutlist data from any source into clean, validated formats ready for optimization and production.

### Business Highlights

| Metric | Value |
|--------|-------|
| **Total Addressable Market** | $2.1B (woodworking software) |
| **Serviceable Market** | $420M (cutlist/optimization tools) |
| **Target Market (2025)** | $42M (AI-first solutions) |
| **Business Model** | SaaS subscriptions + API usage |
| **Revenue Target (2025)** | $500K ARR |
| **Target Customers** | Cabinet shops, furniture makers, millwork |

---

## Table of Contents

1. [Company Overview](#company-overview)
2. [Problem & Solution](#problem--solution)
3. [Market Analysis](#market-analysis)
4. [Product & Technology](#product--technology)
5. [Business Model](#business-model)
6. [Go-to-Market Strategy](#go-to-market-strategy)
7. [Competitive Analysis](#competitive-analysis)
8. [Operations Plan](#operations-plan)
9. [Financial Projections](#financial-projections)
10. [Risk Analysis](#risk-analysis)
11. [Milestones & Timeline](#milestones--timeline)
12. [Team & Organization](#team--organization)
13. [Funding Requirements](#funding-requirements)

---

## Company Overview

### Mission Statement

*To eliminate data entry waste in manufacturing by making every cutlist instantly usable.*

### Vision

*A world where design intent flows seamlessly to production, with zero data loss or manual transcription.*

### Company Information

| Detail | Information |
|--------|-------------|
| **Legal Name** | PositiveSocial Ltd |
| **Trade Name** | CAI Intake |
| **Incorporated** | United Kingdom, 2023 |
| **Headquarters** | London, UK |
| **Website** | https://cai-intake.io |
| **Industry** | B2B SaaS, Manufacturing Technology |

### Core Values

1. **Accuracy First**: Every digit matters in manufacturing
2. **User Empowerment**: Make complex tools accessible
3. **Continuous Learning**: Systems that improve with use
4. **Integration Focus**: Connect, don't replace

---

## Problem & Solution

### The Problem

Cabinet and woodworking shops receive cutlists in countless formats:
- Handwritten notes
- Excel spreadsheets with inconsistent columns
- PDFs from various design software
- Photos of paper lists
- Verbal instructions

**The Cost**:
- **Time**: 2-4 hours/day on data entry per operator
- **Errors**: 10-20% rework rate from transcription mistakes
- **Materials**: $10,000-50,000/year wasted per mid-size shop
- **Delays**: Average 2-4 hour delay per project

### Our Solution

CAI Intake provides 6 intelligent input modes that all converge into a single canonical format:

1. **Manual Entry**: Natural language parsing
2. **Excel/CSV Import**: Intelligent column mapping
3. **Voice Dictation**: Hands-free data entry
4. **Smart Upload**: AI-powered OCR for PDFs/images
5. **QR Templates**: Standardized forms with guaranteed accuracy
6. **Copy/Paste**: Smart parsing from any text

**Key Differentiators**:
- Multi-modal input (only solution with 6 modes)
- Self-learning system (improves with every correction)
- API-first architecture (easy integration)
- Full CNC operation support (not just dimensions)

---

## Market Analysis

### Market Size

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MARKET SIZING                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TAM: Total Addressable Market                                      │
│  $2.1B - Global woodworking software market                         │
│                                                                     │
│       ┌─────────────────────────────────────────────┐               │
│       │                                             │               │
│       │  SAM: Serviceable Addressable Market        │               │
│       │  $420M - Cutlist & optimization tools       │               │
│       │                                             │               │
│       │       ┌───────────────────────────┐         │               │
│       │       │                           │         │               │
│       │       │  SOM: Serviceable         │         │               │
│       │       │  Obtainable Market        │         │               │
│       │       │  $42M - AI-first          │         │               │
│       │       │  solutions                │         │               │
│       │       │                           │         │               │
│       │       └───────────────────────────┘         │               │
│       │                                             │               │
│       └─────────────────────────────────────────────┘               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Market Trends

| Trend | Impact on CAI Intake |
|-------|---------------------|
| **Industry 4.0 Adoption** | Manufacturing digitization driving demand |
| **Labor Shortage** | Shops need automation to compensate |
| **AI Mainstream** | Customers now expect AI-powered tools |
| **Cloud SaaS Shift** | Move from desktop to cloud solutions |
| **Integration Demand** | Need for tools that connect ecosystems |

### Target Customer Segments

#### Primary: Cabinet & Closet Shops

| Segment | Size | Characteristics | ARPU |
|---------|------|-----------------|------|
| **Small** | 1-5 employees | Owner-operated, price-sensitive | $29/mo |
| **Medium** | 6-20 employees | Growing, need efficiency | $79/mo |
| **Large** | 21-100 employees | Multiple locations, need API | $199+/mo |

#### Secondary: Related Industries

- Furniture manufacturers
- Millwork shops
- Countertop fabricators
- RTA (Ready-to-Assemble) furniture companies

### Geographic Focus

**Phase 1 (2025)**: English-speaking markets
- United States (largest market)
- United Kingdom (home market)
- Canada
- Australia

**Phase 2 (2026)**: European expansion
- Germany (large manufacturing base)
- France, Spain, Italy

**Phase 3 (2027)**: Global
- Asia-Pacific
- Latin America

---

## Product & Technology

### Product Overview

CAI Intake is a web-based SaaS application with:

- **Web App**: Full-featured dashboard (Next.js 16)
- **REST API**: Programmatic access for integrations
- **Mobile** (Planned): iOS/Android for photo capture

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TECHNICAL STACK                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Frontend          │  Backend           │  Infrastructure           │
│  ────────────────  │  ────────────────  │  ────────────────         │
│  Next.js 16        │  Next.js API       │  Vercel (hosting)         │
│  React 19          │  Prisma ORM        │  Supabase (DB)            │
│  Tailwind CSS      │  Zod validation    │  AWS S3 (storage)         │
│  shadcn/ui         │  Rate limiting     │  Cloudflare (CDN)         │
│  Zustand (state)   │  Webhooks          │                           │
│                    │                    │                           │
│  AI Services       │  OCR Pipeline      │  Security                 │
│  ────────────────  │  ────────────────  │  ────────────────         │
│  Anthropic Claude  │  Python Tesseract  │  RLS policies             │
│  OpenAI GPT-4o     │  Claude Vision     │  API key auth             │
│  Whisper (voice)   │  GPT-4o Vision     │  Rate limiting            │
│                    │                    │  Audit logging            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Features by Tier

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|--------------|------------|
| Manual Entry | ✅ | ✅ | ✅ | ✅ |
| Excel Import | ❌ | ✅ | ✅ | ✅ |
| Voice Dictation | ❌ | ✅ | ✅ | ✅ |
| Smart Upload (OCR) | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ |
| CNC Operations | ❌ | ⚠️ Edge only | ✅ Full | ✅ Full |
| Learning System | ❌ | ✅ | ✅ | ✅ Custom |
| Export Formats | CSV | 3 | 7+ | All + Custom |
| Users | 1 | 3 | 10 | Unlimited |
| Support | Community | Email | Priority | Dedicated |

### Product Roadmap

| Quarter | Features |
|---------|----------|
| **Q1 2025** | CAI 2D Optimizer integration, Mobile app MVP |
| **Q2 2025** | Design software plugins (SketchUp), Batch processing |
| **Q3 2025** | Advanced analytics, Machine integration prep |
| **Q4 2025** | AR labeling, Marketplace foundation |

---

## Business Model

### Revenue Streams

#### 1. Subscription Revenue (Primary - 85%)

| Plan | Monthly | Annual (20% off) | Features |
|------|---------|------------------|----------|
| Free | $0 | $0 | Basic, 5 cutlists/mo |
| Starter | $29 | $278/yr | 50 cutlists/mo, 3 users |
| Professional | $79 | $758/yr | 500 cutlists/mo, 10 users, API |
| Enterprise | Custom | Custom | Unlimited, SLA |

#### 2. API Usage Revenue (10%)

| Tier | Included | Overage |
|------|----------|---------|
| Professional | 1,000 API calls/mo | $0.05/call |
| Enterprise | Custom | Volume discounts |

#### 3. Professional Services (5%)

- Custom integrations
- On-site training
- White-label licensing

### Unit Economics

| Metric | Value | Notes |
|--------|-------|-------|
| **CAC** | $150 | Blended (organic + paid) |
| **LTV** | $2,400 | Professional tier, 2.5 year lifespan |
| **LTV:CAC** | 16:1 | Healthy ratio |
| **Gross Margin** | 80% | After AI API costs |
| **Net Revenue Retention** | 110% | Expansion > Churn |
| **Monthly Churn** | <5% | Target |
| **Payback Period** | 2.5 months | |

### Pricing Strategy

- **Freemium**: Free tier for market penetration
- **Value-Based**: Price by value delivered (cutlists processed)
- **Usage Transparency**: Clear overage pricing
- **Annual Incentive**: 20% discount for annual commitment

---

## Go-to-Market Strategy

### Customer Acquisition Channels

#### 1. Content Marketing (30% of budget)

- SEO-optimized blog posts
- YouTube tutorials
- Cutlist template library
- Industry guides

**Target Keywords**:
- "cutlist software"
- "cabinet making software"
- "panel optimization"
- "CNC cutlist"

#### 2. Social Media (20%)

- Facebook Groups (cabinet maker communities)
- YouTube (demo videos)
- Instagram (before/after transformations)
- LinkedIn (B2B targeting)

#### 3. Industry Partnerships (25%)

- Design software integrations (SketchUp, etc.)
- Optimizer partnerships (MaxCut, CutList Plus)
- Industry associations (AWFS, IWF)
- Distributor networks

#### 4. Direct Sales (25%)

- Outbound sales for Enterprise
- Trade show presence
- Webinar series

### Sales Process

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SALES FUNNEL                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AWARENESS          │  Traffic: 10,000/mo                           │
│  (Website, Content) │  Target: 15,000/mo by Q4                      │
│         │           │                                               │
│         ▼           │                                               │
│  TRIAL              │  Conversion: 10%                              │
│  (Free Sign-up)     │  Target: 1,500 trials/mo                      │
│         │           │                                               │
│         ▼           │                                               │
│  ACTIVATION         │  Conversion: 40%                              │
│  (First Cutlist)    │  Target: 600 active/mo                        │
│         │           │                                               │
│         ▼           │                                               │
│  PAID CONVERSION    │  Conversion: 15%                              │
│  (Subscription)     │  Target: 90 new paying/mo                     │
│         │           │                                               │
│         ▼           │                                               │
│  EXPANSION          │  Upgrade rate: 20%                            │
│  (Upsell)           │  Target: Starter → Pro                        │
│                     │                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Marketing Budget Allocation (Year 1)

| Channel | Budget | Expected CAC |
|---------|--------|--------------|
| Content/SEO | $36,000 | $80 |
| Paid Social | $24,000 | $120 |
| Partnerships | $30,000 | $100 |
| Direct Sales | $30,000 | $300 |
| **Total** | **$120,000** | **$150 avg** |

---

## Competitive Analysis

### Competitive Landscape

| Competitor | Type | Strengths | Weaknesses |
|------------|------|-----------|------------|
| **CutList Plus** | Desktop | Established, feature-rich | No cloud, no AI, dated UI |
| **MaxCut** | Desktop | Strong optimization | Single-format input, no AI |
| **Excel** | Spreadsheet | Ubiquitous | No automation, error-prone |
| **Custom Scripts** | DIY | Tailored | Fragile, unmaintained |

### Competitive Advantages

1. **Multi-Modal Input**: Only solution with 6 input methods
2. **AI-Powered OCR**: Unique capability for image/PDF parsing
3. **Self-Learning**: System improves automatically
4. **Modern SaaS**: No installation, always updated
5. **API-First**: Easy integration with existing tools
6. **Full CNC Support**: Beyond just dimensions

### Barriers to Entry

1. **AI Training Data**: Our learning system creates proprietary datasets
2. **Domain Expertise**: Deep understanding of cutlist semantics
3. **Integration Network**: Partnerships with design/optimization tools
4. **Customer Switching Cost**: Learned patterns tied to platform

---

## Operations Plan

### Team Structure (Current)

| Role | Count | Status |
|------|-------|--------|
| CEO/Founder | 1 | Active |
| Lead Developer | 1 | Active |
| Product Designer | 1 | Contract |
| **Total** | 3 | |

### Team Structure (Target EOY 2025)

| Role | Count | Hire Timeline |
|------|-------|---------------|
| CEO | 1 | - |
| CTO | 1 | Q1 2025 |
| Senior Engineers | 2 | Q1-Q2 2025 |
| Product Manager | 1 | Q2 2025 |
| Customer Success | 2 | Q2-Q3 2025 |
| Sales | 2 | Q3 2025 |
| Marketing | 1 | Q3 2025 |
| **Total** | **10** | |

### Key Operational Metrics

| Metric | Current | Target (EOY 2025) |
|--------|---------|-------------------|
| **Uptime** | 99.5% | 99.9% |
| **Support Response** | 24h | 4h (paid tiers) |
| **API Latency** | <200ms | <100ms |
| **Parse Accuracy** | 85% | 92% |
| **NPS** | - | 50+ |

### Technology Operations

- **Hosting**: Vercel (auto-scaling)
- **Database**: Supabase (managed PostgreSQL)
- **Monitoring**: Vercel Analytics + Custom logging
- **CI/CD**: GitHub Actions + Vercel Previews
- **Security**: Quarterly penetration testing

---

## Financial Projections

### Revenue Forecast

| Metric | 2025 | 2026 | 2027 |
|--------|------|------|------|
| **Paying Customers** | 500 | 2,000 | 8,000 |
| **ARPU (Monthly)** | $55 | $60 | $65 |
| **MRR (December)** | $42K | $120K | $520K |
| **ARR** | $500K | $1.5M | $6.2M |
| **Growth Rate** | - | 200% | 313% |

### Customer Mix

| Tier | 2025 | 2026 | 2027 |
|------|------|------|------|
| Starter | 60% | 50% | 40% |
| Professional | 35% | 40% | 45% |
| Enterprise | 5% | 10% | 15% |

### Expense Forecast

| Category | 2025 | 2026 | 2027 |
|----------|------|------|------|
| **Personnel** | $400K | $1.2M | $3M |
| **Infrastructure** | $50K | $150K | $400K |
| **Marketing** | $120K | $350K | $800K |
| **Operations** | $50K | $100K | $200K |
| **Total** | $620K | $1.8M | $4.4M |

### Profitability

| Metric | 2025 | 2026 | 2027 |
|--------|------|------|------|
| **Revenue** | $500K | $1.5M | $6.2M |
| **Expenses** | $620K | $1.8M | $4.4M |
| **Net Income** | ($120K) | ($300K) | $1.8M |
| **Burn Rate** | $10K/mo | $25K/mo | - |
| **Breakeven** | - | - | Q2 2027 |

### Key Financial Assumptions

1. **Churn**: 5% monthly (decreasing to 3% by 2027)
2. **CAC**: $150 (decreasing with brand awareness)
3. **ARPU Growth**: 5% annually (tier upgrades)
4. **Gross Margin**: 80% (AI costs manageable)
5. **Sales Cycle**: 14 days (SMB), 90 days (Enterprise)

---

## Risk Analysis

### Key Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **AI Cost Increases** | Medium | High | Multi-provider strategy, caching |
| **Competition from Incumbents** | Medium | Medium | Speed of innovation, integrations |
| **Customer Concentration** | Low | Medium | Diversified customer base |
| **Technical Debt** | Medium | Medium | Regular refactoring sprints |
| **Talent Acquisition** | High | Medium | Competitive comp, remote-first |
| **Data Security Breach** | Low | High | SOC 2, regular audits |

### Contingency Plans

**Scenario: AI Costs Double**
- Increase usage-based pricing
- Implement aggressive caching
- Develop on-device processing

**Scenario: Major Competitor Enters**
- Accelerate feature development
- Focus on integration moat
- Consider strategic partnership

**Scenario: Economic Downturn**
- Reduce burn rate
- Focus on cash-positive segments
- Emphasize cost-saving value prop

---

## Milestones & Timeline

### 2025 Milestones

| Quarter | Milestone | Key Result |
|---------|-----------|------------|
| **Q1** | Product-Market Fit | 100 paying customers |
| **Q2** | Mobile MVP Launch | 1,000 app downloads |
| **Q3** | Enterprise First | 5 Enterprise customers |
| **Q4** | Growth Acceleration | $42K MRR |

### 2026 Milestones

| Quarter | Milestone | Key Result |
|---------|-----------|------------|
| **Q1** | European Launch | 200 EU customers |
| **Q2** | Partnership Program | 10 integration partners |
| **Q3** | Series A Ready | $100K+ MRR |
| **Q4** | Platform Expansion | CAI 2D optimizer live |

### 2027 Milestones

| Quarter | Milestone | Key Result |
|---------|-----------|------------|
| **Q1** | Market Leadership | #1 AI cutlist tool |
| **Q2** | Profitability | Cash flow positive |
| **Q3** | Global Expansion | 25+ countries |
| **Q4** | Platform Vision | Full CAI ecosystem |

---

## Team & Organization

### Founding Team

**[Founder/CEO]**
- Background in manufacturing technology
- Previous startup experience
- Deep domain expertise in woodworking industry

### Advisory Board (Planned)

| Role | Profile |
|------|---------|
| **Industry Advisor** | 20+ year cabinet manufacturing veteran |
| **Technical Advisor** | AI/ML leader from top tech company |
| **GTM Advisor** | SaaS growth expert, previous exits |
| **Financial Advisor** | CFO experience in B2B SaaS |

### Culture & Values

1. **Customer Obsession**: Every feature serves a real need
2. **Ship Fast**: Rapid iteration over perfect planning
3. **Data-Driven**: Measure everything, decide objectively
4. **Remote-First**: Global talent, async communication
5. **Continuous Learning**: Team mirrors product philosophy

---

## Funding Requirements

### Current Round: Seed

| Detail | Information |
|--------|-------------|
| **Target Raise** | $1.5M |
| **Instrument** | SAFE or Priced Round |
| **Valuation Cap** | $8M |
| **Minimum Check** | $25K |
| **Lead Investor** | Seeking |

### Use of Funds

| Category | Amount | % | Purpose |
|----------|--------|---|---------|
| **Engineering** | $750K | 50% | 3 engineers, infrastructure |
| **Sales & Marketing** | $450K | 30% | 2 sales, marketing spend |
| **Operations** | $225K | 15% | Legal, accounting, compliance |
| **Reserve** | $75K | 5% | Contingency |

### Runway Calculation

- **Monthly Burn**: $50K (post-raise)
- **Runway**: 30 months
- **Path to Series A**: 18-24 months

### Previous Funding

| Round | Amount | Date | Investors |
|-------|--------|------|-----------|
| **Bootstrapped** | $100K | 2023-2024 | Founders |

### Investor Alignment

We're seeking investors who:
- Understand B2B SaaS dynamics
- Have manufacturing/industrial connections
- Take a long-term view (5+ year horizon)
- Can add strategic value beyond capital

---

## Appendix

### A. Financial Model Details

*Available upon request*

### B. Product Screenshots

*See product demo at https://app.cai-intake.io*

### C. Customer Testimonials

*Available upon request*

### D. Technical Documentation

*See docs/WHITEPAPER.md for technical details*

---

<p align="center">
  <strong>CAI Intake</strong><br>
  <em>Transforming Chaos into Precision</em><br>
  <br>
  For inquiries: invest@positivesocial.com<br>
  © 2024-2025 PositiveSocial Ltd. All Rights Reserved.
</p>

