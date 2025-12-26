# Operations Libraries & Enhanced PDF Metrics

## Overview

Two major enhancements:
1. **PDF Export** - Detailed metrics for edgebanding, grooves, holes, CNC
2. **Operations Libraries** - Per-org database tables for reusable patterns/profiles

---

## Part 1: Enhanced PDF Export Metrics

### Edgebanding Metrics

Calculate total edgeband length per material:

```
Edgebanding Summary:
┌─────────────────────────────────────────────────────────┐
│ Material              │ Thickness │ Length   │ Parts   │
├───────────────────────┼───────────┼──────────┼─────────┤
│ White PVC             │ 1mm       │ 45.20 m  │ 24      │
│ Black ABS             │ 2mm       │ 18.50 m  │ 12      │
│ Oak Veneer            │ 0.5mm     │ 8.30 m   │ 6       │
├───────────────────────┼───────────┼──────────┼─────────┤
│ TOTAL                 │           │ 72.00 m  │ 42      │
└─────────────────────────────────────────────────────────┘
```

**Calculation Logic:**
```typescript
// For each part with edging
for (const part of parts) {
  const edges = part.ops?.edging?.edges;
  if (!edges) continue;
  
  for (const [edgeId, config] of Object.entries(edges)) {
    if (!config.apply) continue;
    
    // Calculate edge length
    const length = edgeId.startsWith('L') ? part.size.L : part.size.W;
    const totalLength = length * part.qty;
    
    // Group by edgeband material
    const ebandId = config.edgeband_id || 'default';
    accumulate(ebandId, totalLength);
  }
}
```

### Groove Metrics

Group by groove profile/type with dimensions:

```
Groove Summary:
┌──────────────────────────────────────────────────────────────┐
│ Profile              │ Width │ Depth │ Length   │ Parts     │
├──────────────────────┼───────┼───────┼──────────┼───────────┤
│ Back Panel           │ 4mm   │ 10mm  │ 23.50 m  │ 15        │
│ Drawer Bottom        │ 4mm   │ 8mm   │ 12.20 m  │ 8         │
│ Light Profile        │ 18mm  │ 12mm  │ 8.30 m   │ 4         │
│ Custom               │ 3mm   │ 6mm   │ 2.10 m   │ 2         │
├──────────────────────┼───────┼───────┼──────────┼───────────┤
│ TOTAL                │       │       │ 46.10 m  │ 29        │
└──────────────────────────────────────────────────────────────┘
```

**Calculation Logic:**
```typescript
for (const part of parts) {
  const grooves = part.ops?.grooves;
  if (!grooves) continue;
  
  for (const groove of grooves) {
    // Calculate groove length based on side
    const isLongEdge = groove.side.startsWith('L');
    const length = isLongEdge ? part.size.L : part.size.W;
    
    // Account for stopped grooves
    const effectiveLength = groove.stopped 
      ? length - (groove.start_offset_mm || 0) - (groove.end_offset_mm || 0)
      : length;
    
    const totalLength = effectiveLength * part.qty;
    
    // Group by profile (width x depth)
    const profileKey = `${groove.width_mm}x${groove.depth_mm}`;
    accumulate(profileKey, totalLength);
  }
}
```

### Hole Metrics

Count holes by pattern/type:

```
Drilling Summary:
┌────────────────────────────────────────────────────────────┐
│ Pattern              │ Diameter │ Count    │ Parts        │
├──────────────────────┼──────────┼──────────┼──────────────┤
│ Hinge Cups (35mm)    │ 35mm     │ 48       │ 24 parts     │
│ Shelf Pins           │ 5mm      │ 384      │ 12 parts     │
│ Handle Holes         │ 5mm      │ 32       │ 16 parts     │
│ Cam Locks            │ 15mm     │ 24       │ 8 parts      │
├──────────────────────┼──────────┼──────────┼──────────────┤
│ TOTAL                │          │ 488      │ 60 parts     │
└────────────────────────────────────────────────────────────┘
```

### CNC Operations Metrics

```
CNC Operations Summary:
┌─────────────────────────────────────────────────────────────┐
│ Operation            │ Count    │ Area/Length │ Parts      │
├──────────────────────┼──────────┼─────────────┼────────────┤
│ Cutouts              │ 4        │ 1.2 m²      │ 4 parts    │
│ Pockets              │ 8        │ 0.3 m²      │ 6 parts    │
│ Corner Radius        │ 12       │ -           │ 3 parts    │
│ Edge Profiles        │ 6        │ 4.2 m       │ 6 parts    │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 2: Operations Libraries (Per-Org Database)

### Database Schema

#### Hole Patterns Table

```sql
CREATE TABLE hole_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pattern_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Pattern definition
  kind VARCHAR(50) NOT NULL, -- hinge, shelf_pins, handle, knob, drawer_slide, cam_lock, dowel, system32, custom
  
  -- Hole specifications (JSONB array)
  holes JSONB NOT NULL, -- [{ x: number, y: number, dia_mm: number, depth_mm?: number }]
  
  -- Reference positioning
  ref_edge VARCHAR(10), -- L1, L2, W1, W2
  ref_corner VARCHAR(20), -- top_left, top_right, bottom_left, bottom_right
  
  -- Hardware reference
  hardware_id VARCHAR(100),
  hardware_brand VARCHAR(100),
  
  -- Metadata
  is_system BOOLEAN DEFAULT FALSE, -- CAI-provided vs org-created
  usage_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, pattern_id)
);
```

#### Groove Profiles Table

```sql
CREATE TABLE groove_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Groove specifications
  width_mm DECIMAL(6,2) NOT NULL,
  depth_mm DECIMAL(6,2) NOT NULL,
  
  -- Purpose/type
  purpose VARCHAR(50), -- back_panel, drawer_bottom, light_profile, glass_panel, custom
  
  -- Tooling
  tool_dia_mm DECIMAL(6,2),
  tool_id VARCHAR(100),
  
  -- Defaults
  default_offset_mm DECIMAL(6,2) DEFAULT 10,
  default_face VARCHAR(10) DEFAULT 'back', -- front, back
  
  -- Metadata
  is_system BOOLEAN DEFAULT FALSE,
  usage_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, profile_id)
);
```

#### Routing Profiles Table

```sql
CREATE TABLE routing_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Profile type
  profile_type VARCHAR(50) NOT NULL, -- edge_profile, pocket, cutout, rebate, chamfer, radius
  
  -- Profile specifications (JSONB for flexibility)
  specifications JSONB NOT NULL,
  -- For edge profiles: { shape: 'ogee'|'bevel'|'round'|'custom', radius?: number, angle?: number }
  -- For pockets: { default_depth: number, through_allowed: boolean }
  -- For cutouts: { shape: 'rect'|'circle'|'custom', purpose: 'sink'|'hob'|'vent'|... }
  -- For radius: { radius_mm: number, corners: 'all'|'front'|'back'|... }
  
  -- Tooling
  tool_dia_mm DECIMAL(6,2),
  tool_id VARCHAR(100),
  feed_rate INT,
  spindle_speed INT,
  
  -- Metadata
  is_system BOOLEAN DEFAULT FALSE,
  usage_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, profile_id)
);
```

### Prisma Models

```prisma
model HolePattern {
  id             String   @id @default(cuid())
  patternId      String   @map("pattern_id")
  name           String
  description    String?
  kind           String   // hinge, shelf_pins, handle, etc.
  holes          Json     // Array of hole definitions
  refEdge        String?  @map("ref_edge")
  refCorner      String?  @map("ref_corner")
  hardwareId     String?  @map("hardware_id")
  hardwareBrand  String?  @map("hardware_brand")
  isSystem       Boolean  @default(false) @map("is_system")
  usageCount     Int      @default(0) @map("usage_count")
  metadata       Json?
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, patternId])
  @@map("hole_patterns")
}

model GrooveProfile {
  id              String   @id @default(cuid())
  profileId       String   @map("profile_id")
  name            String
  description     String?
  widthMm         Float    @map("width_mm")
  depthMm         Float    @map("depth_mm")
  purpose         String?
  toolDiaMm       Float?   @map("tool_dia_mm")
  toolId          String?  @map("tool_id")
  defaultOffsetMm Float?   @map("default_offset_mm")
  defaultFace     String?  @map("default_face")
  isSystem        Boolean  @default(false) @map("is_system")
  usageCount      Int      @default(0) @map("usage_count")
  metadata        Json?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  organizationId  String       @map("organization_id")
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, profileId])
  @@map("groove_profiles")
}

model RoutingProfile {
  id             String   @id @default(cuid())
  profileId      String   @map("profile_id")
  name           String
  description    String?
  profileType    String   @map("profile_type")
  specifications Json
  toolDiaMm      Float?   @map("tool_dia_mm")
  toolId         String?  @map("tool_id")
  feedRate       Int?     @map("feed_rate")
  spindleSpeed   Int?     @map("spindle_speed")
  isSystem       Boolean  @default(false) @map("is_system")
  usageCount     Int      @default(0) @map("usage_count")
  metadata       Json?
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, profileId])
  @@map("routing_profiles")
}
```

### API Routes

```
GET    /api/v1/hole-patterns      - List org's hole patterns
POST   /api/v1/hole-patterns      - Create new pattern
GET    /api/v1/hole-patterns/:id  - Get pattern details
PUT    /api/v1/hole-patterns/:id  - Update pattern
DELETE /api/v1/hole-patterns/:id  - Delete pattern

GET    /api/v1/groove-profiles    - List org's groove profiles
POST   /api/v1/groove-profiles    - Create new profile
...

GET    /api/v1/routing-profiles   - List org's routing profiles
POST   /api/v1/routing-profiles   - Create new profile
...
```

### System Default Patterns

Seed common patterns for new orgs:

```typescript
const SYSTEM_HOLE_PATTERNS = [
  {
    pattern_id: 'H2-110',
    name: '2 Hinges @ 110mm',
    kind: 'hinge',
    holes: [
      { x: 21.5, y: 110, dia_mm: 35, depth_mm: 13 },
      { x: 21.5, y: -110, dia_mm: 35, depth_mm: 13 }, // -110 = from opposite edge
    ],
    hardware_brand: 'Blum',
    is_system: true,
  },
  {
    pattern_id: 'SP-32',
    name: 'System 32 Shelf Pins',
    kind: 'system32',
    holes: [], // Dynamically generated based on part height
    ref_edge: 'L1',
    is_system: true,
  },
  // ... more patterns
];

const SYSTEM_GROOVE_PROFILES = [
  {
    profile_id: 'BACK-4x10',
    name: 'Back Panel Groove',
    width_mm: 4,
    depth_mm: 10,
    purpose: 'back_panel',
    default_offset_mm: 10,
    is_system: true,
  },
  {
    profile_id: 'DRAWER-4x8',
    name: 'Drawer Bottom Groove',
    width_mm: 4,
    depth_mm: 8,
    purpose: 'drawer_bottom',
    default_offset_mm: 12,
    is_system: true,
  },
  // ... more profiles
];
```

---

## Implementation Order

### Phase 1: PDF Export Metrics (No DB changes)
1. Create metric calculation functions
2. Update PDF export to include detailed tables
3. Add edgeband length breakdown
4. Add groove length breakdown
5. Add hole count breakdown
6. Add CNC operations breakdown

### Phase 2: Database Schema
1. Create Supabase migration for new tables
2. Update Prisma schema
3. Create TypeScript types
4. Add RLS policies

### Phase 3: API Routes
1. Hole patterns CRUD
2. Groove profiles CRUD
3. Routing profiles CRUD
4. System pattern seeding

### Phase 4: UI Components
1. Hole patterns management page
2. Groove profiles management page
3. Routing profiles management page
4. Pattern picker components for intake forms

### Phase 5: Integration
1. Link parsers to org libraries
2. Update part operations to reference library items
3. Usage tracking
4. Learning system integration

---

## Files to Create/Modify

### Phase 1 (PDF Export)
- `src/lib/exports/pdf-export.ts` - Add metric calculations and tables

### Phase 2 (Database)
- `supabase/migrations/20241222000000_operations_libraries.sql`
- `prisma/schema.prisma` - Add new models
- `src/lib/supabase/types.ts` - Update database types

### Phase 3 (API)
- `src/app/api/v1/hole-patterns/route.ts`
- `src/app/api/v1/hole-patterns/[id]/route.ts`
- `src/app/api/v1/groove-profiles/route.ts`
- `src/app/api/v1/groove-profiles/[id]/route.ts`
- `src/app/api/v1/routing-profiles/route.ts`
- `src/app/api/v1/routing-profiles/[id]/route.ts`

### Phase 4 (UI)
- `src/app/(dashboard)/settings/operations/page.tsx`
- `src/components/settings/HolePatternsManager.tsx`
- `src/components/settings/GrooveProfilesManager.tsx`
- `src/components/settings/RoutingProfilesManager.tsx`





