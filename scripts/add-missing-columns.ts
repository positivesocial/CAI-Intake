/**
 * Script to add missing columns to operation tables
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding missing columns to operation tables...\n");

  // Add columns to operation_types
  const opTypeCols = [
    "ALTER TABLE operation_types ADD COLUMN IF NOT EXISTS icon TEXT",
    "ALTER TABLE operation_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true",
    "ALTER TABLE operation_types ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0",
  ];

  // Add columns to edgeband_operations
  const edgeCols = [
    "ALTER TABLE edgeband_operations ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0",
  ];

  // Add columns to groove_operations
  const grooveCols = [
    "ALTER TABLE groove_operations ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0",
  ];

  // Add columns to drilling_operations
  const drillCols = [
    "ALTER TABLE drilling_operations ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0",
  ];

  // Add columns to cnc_operations
  const cncCols = [
    "ALTER TABLE cnc_operations ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0",
  ];

  const allCols = [
    ...opTypeCols,
    ...edgeCols,
    ...grooveCols,
    ...drillCols,
    ...cncCols,
  ];

  for (const sql of allCols) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`✓ ${sql}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (err.message?.includes("already exists")) {
        console.log(`✓ Column already exists: ${sql}`);
      } else {
        console.log(`Note: ${err.message}`);
      }
    }
  }

  console.log("\n✅ Done!");
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

