/**
 * CAI Intake - Database Seed Script
 * 
 * Seeds initial data for the application:
 * - System roles
 * - Demo organization
 * - Demo users
 * - Default materials
 * - Default edgebands
 * 
 * Run with: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

// =============================================================================
// SEED DATA
// =============================================================================

const ROLES = [
  {
    name: "super_admin",
    displayName: "Super Admin",
    description: "Platform-wide administrator with full access",
    isSystem: true,
    permissions: {
      // Platform management
      "platform:manage": true,
      "platform:settings": true,
      "platform:users": true,
      "platform:organizations": true,
      // All organization permissions
      "org:manage": true,
      "org:settings": true,
      "org:billing": true,
      "org:delete": true,
      // All team permissions
      "team:manage": true,
      "team:invite": true,
      "team:remove": true,
      "team:roles": true,
      // All cutlist permissions
      "cutlist:create": true,
      "cutlist:read": true,
      "cutlist:update": true,
      "cutlist:delete": true,
      "cutlist:export": true,
      "cutlist:optimize": true,
      // All material permissions
      "materials:manage": true,
      "materials:create": true,
      "materials:read": true,
      "materials:update": true,
      "materials:delete": true,
      // All template permissions
      "templates:manage": true,
      "templates:create": true,
      "templates:read": true,
      "templates:update": true,
      "templates:delete": true,
      // Reports
      "reports:view": true,
      "reports:export": true,
    },
  },
  {
    name: "org_admin",
    displayName: "Organization Admin",
    description: "Full access to organization settings and team management",
    isSystem: true,
    permissions: {
      "org:manage": true,
      "org:settings": true,
      "org:billing": true,
      "team:manage": true,
      "team:invite": true,
      "team:remove": true,
      "team:roles": true,
      "cutlist:create": true,
      "cutlist:read": true,
      "cutlist:update": true,
      "cutlist:delete": true,
      "cutlist:export": true,
      "cutlist:optimize": true,
      "materials:manage": true,
      "materials:create": true,
      "materials:read": true,
      "materials:update": true,
      "materials:delete": true,
      "templates:manage": true,
      "templates:create": true,
      "templates:read": true,
      "templates:update": true,
      "templates:delete": true,
      "reports:view": true,
      "reports:export": true,
    },
  },
  {
    name: "manager",
    displayName: "Manager",
    description: "Can manage cutlists and view team performance",
    isSystem: true,
    permissions: {
      "team:invite": true,
      "cutlist:create": true,
      "cutlist:read": true,
      "cutlist:update": true,
      "cutlist:delete": true,
      "cutlist:export": true,
      "cutlist:optimize": true,
      "materials:create": true,
      "materials:read": true,
      "materials:update": true,
      "templates:create": true,
      "templates:read": true,
      "templates:update": true,
      "reports:view": true,
    },
  },
  {
    name: "operator",
    displayName: "Operator",
    description: "Can create and manage own cutlists",
    isSystem: true,
    permissions: {
      "cutlist:create": true,
      "cutlist:read": true,
      "cutlist:update": true,
      "cutlist:export": true,
      "cutlist:optimize": true,
      "materials:read": true,
      "templates:read": true,
    },
  },
  {
    name: "viewer",
    displayName: "Viewer",
    description: "Read-only access to cutlists and reports",
    isSystem: true,
    permissions: {
      "cutlist:read": true,
      "materials:read": true,
      "templates:read": true,
      "reports:view": true,
    },
  },
];

const DEMO_ORGANIZATION = {
  name: "Acme Cabinets & Millwork",
  slug: "acme-cabinets",
  plan: "professional",
  settings: {
    defaultUnits: "mm",
    defaultThickness: 18,
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
  },
  capabilities: {
    core_parts: true,
    edging: true,
    grooves: true,
    cnc_holes: true,
    cnc_routing: true,
    custom_cnc: true,
    advanced_grouping: true,
    part_notes: true,
  },
};

// Demo users - passwords are hashed versions
// In production, use proper auth (Supabase handles this)
const DEMO_USERS = [
  {
    email: "super@caiintake.com",
    name: "Platform Super Admin",
    jobTitle: "Platform Administrator",
    phone: "+1 (555) 000-0001",
    isSuperAdmin: true,
    roleName: "super_admin",
    organizationSlug: null, // Super admin has no org
    preferences: {
      theme: "dark",
      language: "en",
      timezone: "UTC",
      dateFormat: "YYYY-MM-DD",
      defaultUnits: "mm",
      advancedMode: true,
    },
    notifications: {
      email: true,
      push: true,
      cutlistComplete: true,
      parseJobComplete: true,
      weeklyDigest: true,
    },
  },
  {
    email: "admin@acmecabinets.com",
    name: "John Smith",
    jobTitle: "Workshop Manager",
    phone: "+1 (555) 123-4567",
    isSuperAdmin: false,
    roleName: "org_admin",
    organizationSlug: "acme-cabinets",
    preferences: {
      theme: "light",
      language: "en",
      timezone: "America/New_York",
      dateFormat: "MM/DD/YYYY",
      defaultUnits: "mm",
      advancedMode: true,
    },
    notifications: {
      email: true,
      push: true,
      cutlistComplete: true,
      parseJobComplete: true,
      weeklyDigest: true,
    },
  },
  {
    email: "operator@acmecabinets.com",
    name: "Mike Johnson",
    jobTitle: "CNC Operator",
    phone: "+1 (555) 987-6543",
    isSuperAdmin: false,
    roleName: "operator",
    organizationSlug: "acme-cabinets",
    preferences: {
      theme: "system",
      language: "en",
      timezone: "America/New_York",
      dateFormat: "MM/DD/YYYY",
      defaultUnits: "mm",
      advancedMode: false,
    },
    notifications: {
      email: true,
      push: false,
      cutlistComplete: true,
      parseJobComplete: true,
      weeklyDigest: false,
    },
  },
];

const DEFAULT_MATERIALS = [
  {
    materialId: "MAT-WHITE-18",
    name: "18mm White Melamine PB",
    sku: "WM-18-001",
    thicknessMm: 18,
    coreType: "PB",
    finish: "White Melamine",
    colorCode: "#FFFFFF",
    defaultSheet: {
      size: { L: 2440, W: 1220 },
      grained: false,
    },
  },
  {
    materialId: "MAT-WHITE-16",
    name: "16mm White Melamine PB",
    sku: "WM-16-001",
    thicknessMm: 16,
    coreType: "PB",
    finish: "White Melamine",
    colorCode: "#FFFFFF",
    defaultSheet: {
      size: { L: 2440, W: 1220 },
      grained: false,
    },
  },
  {
    materialId: "MAT-OAK-18",
    name: "18mm Oak Veneer MDF",
    sku: "OV-18-001",
    thicknessMm: 18,
    coreType: "MDF",
    finish: "Oak Veneer",
    colorCode: "#C4A77D",
    defaultSheet: {
      size: { L: 2440, W: 1220 },
      grained: true,
    },
  },
  {
    materialId: "MAT-WALNUT-18",
    name: "18mm Walnut Veneer MDF",
    sku: "WV-18-001",
    thicknessMm: 18,
    coreType: "MDF",
    finish: "Walnut Veneer",
    colorCode: "#5D4037",
    defaultSheet: {
      size: { L: 2440, W: 1220 },
      grained: true,
    },
  },
  {
    materialId: "MAT-GRAY-18",
    name: "18mm Anthracite Gray PB",
    sku: "AG-18-001",
    thicknessMm: 18,
    coreType: "PB",
    finish: "Anthracite Gray",
    colorCode: "#424242",
    defaultSheet: {
      size: { L: 2440, W: 1220 },
      grained: false,
    },
  },
  {
    materialId: "MAT-PLY-18",
    name: "18mm Birch Plywood",
    sku: "BP-18-001",
    thicknessMm: 18,
    coreType: "PLY",
    finish: "Natural Birch",
    colorCode: "#E8D4B8",
    defaultSheet: {
      size: { L: 2440, W: 1220 },
      grained: true,
    },
  },
  {
    materialId: "MAT-HDF-3",
    name: "3mm HDF Backing",
    sku: "HDF-3-001",
    thicknessMm: 3,
    coreType: "HDF",
    finish: "Raw HDF",
    colorCode: "#A1887F",
    defaultSheet: {
      size: { L: 2440, W: 1220 },
      grained: false,
    },
  },
];

const DEFAULT_EDGEBANDS = [
  {
    edgebandId: "EB-WHITE-0.4",
    name: "0.4mm White ABS",
    thicknessMm: 0.4,
    colorMatchMaterialId: "MAT-WHITE-18",
    finish: "Matte",
  },
  {
    edgebandId: "EB-WHITE-0.8",
    name: "0.8mm White ABS",
    thicknessMm: 0.8,
    colorMatchMaterialId: "MAT-WHITE-18",
    finish: "Matte",
  },
  {
    edgebandId: "EB-WHITE-2",
    name: "2mm White ABS",
    thicknessMm: 2,
    colorMatchMaterialId: "MAT-WHITE-18",
    finish: "Matte",
  },
  {
    edgebandId: "EB-OAK-0.8",
    name: "0.8mm Oak Veneer",
    thicknessMm: 0.8,
    colorMatchMaterialId: "MAT-OAK-18",
    finish: "Natural",
  },
  {
    edgebandId: "EB-OAK-2",
    name: "2mm Oak Solid Wood",
    thicknessMm: 2,
    colorMatchMaterialId: "MAT-OAK-18",
    finish: "Natural",
  },
  {
    edgebandId: "EB-WALNUT-0.8",
    name: "0.8mm Walnut Veneer",
    thicknessMm: 0.8,
    colorMatchMaterialId: "MAT-WALNUT-18",
    finish: "Natural",
  },
  {
    edgebandId: "EB-GRAY-0.8",
    name: "0.8mm Anthracite Gray ABS",
    thicknessMm: 0.8,
    colorMatchMaterialId: "MAT-GRAY-18",
    finish: "Matte",
  },
];

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

async function seedRoles() {
  console.log("🔐 Seeding roles...");
  
  for (const roleData of ROLES) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: {
        displayName: roleData.displayName,
        description: roleData.description,
        permissions: roleData.permissions,
      },
      create: {
        name: roleData.name,
        displayName: roleData.displayName,
        description: roleData.description,
        isSystem: roleData.isSystem,
        permissions: roleData.permissions,
      },
    });
  }
  
  console.log(`  ✓ Created ${ROLES.length} roles`);
}

async function seedOrganization() {
  console.log("🏢 Seeding demo organization...");
  
  const org = await prisma.organization.upsert({
    where: { slug: DEMO_ORGANIZATION.slug },
    update: {
      name: DEMO_ORGANIZATION.name,
      plan: DEMO_ORGANIZATION.plan,
      settings: DEMO_ORGANIZATION.settings,
      capabilities: DEMO_ORGANIZATION.capabilities,
    },
    create: {
      name: DEMO_ORGANIZATION.name,
      slug: DEMO_ORGANIZATION.slug,
      plan: DEMO_ORGANIZATION.plan,
      settings: DEMO_ORGANIZATION.settings,
      capabilities: DEMO_ORGANIZATION.capabilities,
    },
  });
  
  console.log(`  ✓ Created organization: ${org.name}`);
  return org;
}

async function seedUsers(organizationId: string) {
  console.log("👥 Seeding demo users...");
  
  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.name, r.id]));
  
  for (const userData of DEMO_USERS) {
    const roleId = roleMap.get(userData.roleName);
    
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        jobTitle: userData.jobTitle,
        phone: userData.phone,
        isSuperAdmin: userData.isSuperAdmin,
        roleId,
        organizationId: userData.organizationSlug ? organizationId : null,
        preferences: userData.preferences,
        notifications: userData.notifications,
        isActive: true,
        emailVerified: new Date(),
      },
      create: {
        email: userData.email,
        name: userData.name,
        jobTitle: userData.jobTitle,
        phone: userData.phone,
        isSuperAdmin: userData.isSuperAdmin,
        roleId,
        organizationId: userData.organizationSlug ? organizationId : null,
        preferences: userData.preferences,
        notifications: userData.notifications,
        isActive: true,
        emailVerified: new Date(),
      },
    });
  }
  
  console.log(`  ✓ Created ${DEMO_USERS.length} users`);
}

async function seedMaterials(organizationId: string) {
  console.log("🪵 Seeding default materials...");
  
  for (const matData of DEFAULT_MATERIALS) {
    await prisma.material.upsert({
      where: {
        organizationId_materialId: {
          organizationId,
          materialId: matData.materialId,
        },
      },
      update: {
        name: matData.name,
        sku: matData.sku,
        thicknessMm: matData.thicknessMm,
        coreType: matData.coreType,
        finish: matData.finish,
        colorCode: matData.colorCode,
        defaultSheet: matData.defaultSheet,
      },
      create: {
        organizationId,
        materialId: matData.materialId,
        name: matData.name,
        sku: matData.sku,
        thicknessMm: matData.thicknessMm,
        coreType: matData.coreType,
        finish: matData.finish,
        colorCode: matData.colorCode,
        defaultSheet: matData.defaultSheet,
      },
    });
  }
  
  console.log(`  ✓ Created ${DEFAULT_MATERIALS.length} materials`);
}

async function seedEdgebands(organizationId: string) {
  console.log("📏 Seeding default edgebands...");
  
  for (const ebData of DEFAULT_EDGEBANDS) {
    await prisma.edgeband.upsert({
      where: {
        organizationId_edgebandId: {
          organizationId,
          edgebandId: ebData.edgebandId,
        },
      },
      update: {
        name: ebData.name,
        thicknessMm: ebData.thicknessMm,
        colorMatchMaterialId: ebData.colorMatchMaterialId,
        finish: ebData.finish,
      },
      create: {
        organizationId,
        edgebandId: ebData.edgebandId,
        name: ebData.name,
        thicknessMm: ebData.thicknessMm,
        colorMatchMaterialId: ebData.colorMatchMaterialId,
        finish: ebData.finish,
      },
    });
  }
  
  console.log(`  ✓ Created ${DEFAULT_EDGEBANDS.length} edgebands`);
}

async function seedPlatformSettings() {
  console.log("⚙️ Seeding platform settings...");
  
  await prisma.platformSettings.upsert({
    where: { id: "platform" },
    update: {},
    create: {
      id: "platform",
      settings: {
        maintenanceMode: false,
        allowRegistration: true,
        defaultPlan: "free",
        maxOrganizations: 1000,
        maxUsersPerOrg: 50,
        maxCutlistsPerOrg: 500,
        features: {
          ai_parsing: true,
          voice_dictation: true,
          ocr_scanning: true,
          qr_templates: true,
          optimizer_integration: true,
        },
        smtp: {
          configured: false,
        },
      },
    },
  });
  
  console.log("  ✓ Platform settings initialized");
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("\n🌱 CAI Intake - Database Seed\n");
  console.log("================================\n");
  
  try {
    // Seed in order (roles first, then org, then users with role references)
    await seedRoles();
    const org = await seedOrganization();
    await seedUsers(org.id);
    await seedMaterials(org.id);
    await seedEdgebands(org.id);
    await seedPlatformSettings();
    
    console.log("\n================================");
    console.log("✅ Seed completed successfully!\n");
    console.log("Demo Credentials:");
    console.log("  Super Admin:  super@caiintake.com / SuperAdmin123!");
    console.log("  Org Admin:    admin@acmecabinets.com / OrgAdmin123!");
    console.log("  Operator:     operator@acmecabinets.com / Operator123!\n");
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




