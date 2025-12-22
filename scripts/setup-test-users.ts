/**
 * CAI Intake - Setup Test Users in Supabase Auth
 * 
 * This script creates test users in Supabase Auth and syncs them
 * with the Prisma database.
 * 
 * Run with: npx ts-node scripts/setup-test-users.ts
 * 
 * Prerequisites:
 * - SUPABASE_SERVICE_ROLE_KEY must be set in .env
 * - Database must be migrated and seeded first
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Test users to create
const TEST_USERS = [
  {
    email: "super@caiintake.com",
    password: "SuperAdmin123!",
    name: "Platform Super Admin",
    isSuperAdmin: true,
  },
  {
    email: "admin@acmecabinets.com",
    password: "OrgAdmin123!",
    name: "John Smith",
    isSuperAdmin: false,
  },
  {
    email: "operator@acmecabinets.com",
    password: "Operator123!",
    name: "Mike Johnson",
    isSuperAdmin: false,
  },
];

async function main() {
  console.log("\n🔐 CAI Intake - Setup Test Users\n");
  console.log("================================\n");

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing required environment variables:");
    console.error("   - NEXT_PUBLIC_SUPABASE_URL");
    console.error("   - SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("📡 Connected to Supabase:", supabaseUrl);
  console.log("");

  for (const user of TEST_USERS) {
    console.log(`👤 Processing user: ${user.email}`);

    try {
      // Check if user exists in Supabase Auth
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error(`   ⚠️ Error listing users:`, listError.message);
        continue;
      }

      const existingUser = existingUsers?.users?.find(u => u.email === user.email);

      let authUserId: string;

      if (existingUser) {
        console.log(`   ℹ️ User already exists in Supabase Auth`);
        authUserId = existingUser.id;

        // Update password if needed
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          authUserId,
          { password: user.password }
        );

        if (updateError) {
          console.error(`   ⚠️ Failed to update password:`, updateError.message);
        } else {
          console.log(`   ✓ Password updated`);
        }
      } else {
        // Create new user in Supabase Auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            name: user.name,
          },
        });

        if (createError) {
          console.error(`   ❌ Failed to create user:`, createError.message);
          continue;
        }

        authUserId = newUser.user.id;
        console.log(`   ✓ Created user in Supabase Auth (ID: ${authUserId})`);
      }

      // Sync with Prisma database
      const existingDbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (existingDbUser) {
        // Update the Prisma user ID to match Supabase Auth ID
        if (existingDbUser.id !== authUserId) {
          // We need to be careful here - can't just update the ID
          // Instead, update all relevant fields
          await prisma.user.update({
            where: { email: user.email },
            data: {
              name: user.name,
              isActive: true,
              emailVerified: new Date(),
            },
          });
          console.log(`   ✓ Updated user in database`);
          console.log(`   ⚠️ Note: Database ID (${existingDbUser.id}) differs from Supabase Auth ID (${authUserId})`);
        }
      } else {
        // Get role for the user
        const roleName = user.isSuperAdmin ? "super_admin" : 
          user.email.includes("admin") ? "org_admin" : "operator";
        const role = await prisma.role.findUnique({ where: { name: roleName } });
        
        // Get organization for non-super-admin users
        const organization = !user.isSuperAdmin 
          ? await prisma.organization.findUnique({ where: { slug: "acme-cabinets" } })
          : null;

        // Create user in database with Supabase Auth ID
        await prisma.user.create({
          data: {
            id: authUserId, // Use the Supabase Auth ID!
            email: user.email,
            name: user.name,
            isSuperAdmin: user.isSuperAdmin,
            roleId: role?.id,
            organizationId: organization?.id,
            isActive: true,
            emailVerified: new Date(),
            preferences: {
              theme: "system",
              language: "en",
              defaultUnits: "mm",
            },
            notifications: {
              email: true,
              push: true,
            },
          },
        });
        console.log(`   ✓ Created user in database`);
      }

      console.log("");
    } catch (error) {
      console.error(`   ❌ Error processing user:`, error);
    }
  }

  console.log("================================");
  console.log("✅ Test users setup complete!\n");
  console.log("Login Credentials:");
  console.log("  Super Admin:  super@caiintake.com / SuperAdmin123!");
  console.log("  Org Admin:    admin@acmecabinets.com / OrgAdmin123!");
  console.log("  Operator:     operator@acmecabinets.com / Operator123!\n");
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




