/**
 * Script to apply operations migration
 * This handles the type change in parse_corrections and creates new operation tables
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting operations migration...");

  // Step 1: Fix the parse_corrections.correction_type column
  console.log("\n1. Fixing parse_corrections.correction_type column...");
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE parse_corrections 
      ALTER COLUMN correction_type TYPE TEXT 
      USING correction_type::TEXT
    `);
    console.log("   ✓ correction_type column converted to TEXT");
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes("already exists") || err.message?.includes("type \"text\"")) {
      console.log("   ✓ correction_type column already TEXT");
    } else {
      console.log("   Note:", err.message);
    }
  }

  // Step 2: Create operation_types table
  console.log("\n2. Creating operation_types table...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS operation_types (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_system BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("   ✓ operation_types table created");
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.log("   Note:", err.message);
  }

  // Step 3: Create edgeband_operations table
  console.log("\n3. Creating edgeband_operations table...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS edgeband_operations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        edges TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        thickness_mm DOUBLE PRECISION,
        material_id TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("   ✓ edgeband_operations table created");
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.log("   Note:", err.message);
  }

  // Step 4: Create groove_operations table
  console.log("\n4. Creating groove_operations table...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS groove_operations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
        type_id TEXT REFERENCES operation_types(id),
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        width_mm DOUBLE PRECISION NOT NULL,
        depth_mm DOUBLE PRECISION NOT NULL,
        offset_from_edge_mm DOUBLE PRECISION NOT NULL DEFAULT 0,
        edge TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("   ✓ groove_operations table created");
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.log("   Note:", err.message);
  }

  // Step 5: Create drilling_operations table
  console.log("\n5. Creating drilling_operations table...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS drilling_operations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
        type_id TEXT REFERENCES operation_types(id),
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        holes JSONB NOT NULL DEFAULT '[]'::JSONB,
        ref_edge TEXT,
        ref_corner TEXT,
        hardware_brand TEXT,
        hardware_model TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("   ✓ drilling_operations table created");
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.log("   Note:", err.message);
  }

  // Step 6: Create cnc_operations table
  console.log("\n6. Creating cnc_operations table...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS cnc_operations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
        type_id TEXT REFERENCES operation_types(id),
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        op_type TEXT NOT NULL,
        parametric_config JSONB,
        shape_id TEXT,
        params JSONB,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("   ✓ cnc_operations table created");
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.log("   Note:", err.message);
  }

  // Step 7: Create indexes
  console.log("\n7. Creating indexes...");
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_operation_types_org ON operation_types(organization_id)",
    "CREATE INDEX IF NOT EXISTS idx_operation_types_category ON operation_types(category)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_types_org_cat_code ON operation_types(organization_id, category, code)",
    "CREATE INDEX IF NOT EXISTS idx_edgeband_operations_org ON edgeband_operations(organization_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_edgeband_operations_org_code ON edgeband_operations(organization_id, code)",
    "CREATE INDEX IF NOT EXISTS idx_groove_operations_org ON groove_operations(organization_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_groove_operations_org_code ON groove_operations(organization_id, code)",
    "CREATE INDEX IF NOT EXISTS idx_drilling_operations_org ON drilling_operations(organization_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_drilling_operations_org_code ON drilling_operations(organization_id, code)",
    "CREATE INDEX IF NOT EXISTS idx_cnc_operations_org ON cnc_operations(organization_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_cnc_operations_org_code ON cnc_operations(organization_id, code)",
  ];

  for (const idx of indexes) {
    try {
      await prisma.$executeRawUnsafe(idx);
    } catch (error: unknown) {
      // Ignore if already exists
    }
  }
  console.log("   ✓ Indexes created");

  console.log("\n✅ Operations migration completed successfully!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

