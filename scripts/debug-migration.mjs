#!/usr/bin/env node

import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

function loadEnv() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = join(__dirname, '..', '.env');
  
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected\n');

    // Just create the hole_patterns table first
    console.log('Creating hole_patterns table...');
    await client.query(`
      DROP TABLE IF EXISTS public.hole_patterns CASCADE;
      
      CREATE TABLE public.hole_patterns (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id TEXT NOT NULL,
        pattern_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        kind VARCHAR(50) NOT NULL,
        holes JSONB NOT NULL DEFAULT '[]'::jsonb,
        ref_edge VARCHAR(10),
        ref_corner VARCHAR(20),
        parametric_config JSONB,
        hardware_id VARCHAR(100),
        hardware_brand VARCHAR(100),
        hardware_model VARCHAR(100),
        is_system BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        usage_count INT DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT hole_patterns_org_pattern_unique UNIQUE(organization_id, pattern_id)
      );
    `);
    console.log('✅ hole_patterns created\n');

    console.log('Creating groove_profiles table...');
    await client.query(`
      DROP TABLE IF EXISTS public.groove_profiles CASCADE;
      
      CREATE TABLE public.groove_profiles (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id TEXT NOT NULL,
        profile_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        width_mm DECIMAL(6,2) NOT NULL,
        depth_mm DECIMAL(6,2) NOT NULL,
        purpose VARCHAR(50),
        default_offset_mm DECIMAL(6,2) DEFAULT 10,
        default_face VARCHAR(10) DEFAULT 'back',
        allow_stopped BOOLEAN DEFAULT TRUE,
        default_start_offset_mm DECIMAL(6,2) DEFAULT 0,
        default_end_offset_mm DECIMAL(6,2) DEFAULT 0,
        tool_dia_mm DECIMAL(6,2),
        tool_id VARCHAR(100),
        feed_rate INT,
        is_system BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        usage_count INT DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT groove_profiles_org_profile_unique UNIQUE(organization_id, profile_id)
      );
    `);
    console.log('✅ groove_profiles created\n');

    console.log('Creating routing_profiles table...');
    await client.query(`
      DROP TABLE IF EXISTS public.routing_profiles CASCADE;
      
      CREATE TABLE public.routing_profiles (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id TEXT NOT NULL,
        profile_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        profile_type VARCHAR(50) NOT NULL,
        specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
        tool_dia_mm DECIMAL(6,2),
        tool_id VARCHAR(100),
        tool_type VARCHAR(50),
        feed_rate INT,
        plunge_rate INT,
        spindle_speed INT,
        step_down_mm DECIMAL(6,2),
        dxf_layer VARCHAR(100),
        gcode_template TEXT,
        is_system BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        usage_count INT DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT routing_profiles_org_profile_unique UNIQUE(organization_id, profile_id)
      );
    `);
    console.log('✅ routing_profiles created\n');

    // Enable RLS
    console.log('Enabling RLS...');
    await client.query(`
      ALTER TABLE public.hole_patterns ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.groove_profiles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.routing_profiles ENABLE ROW LEVEL SECURITY;
    `);
    console.log('✅ RLS enabled\n');

    // Create simpler RLS policies
    console.log('Creating RLS policies...');
    
    await client.query(`
      DROP POLICY IF EXISTS "Users can view hole patterns" ON public.hole_patterns;
      DROP POLICY IF EXISTS "Admins can manage hole patterns" ON public.hole_patterns;
      
      CREATE POLICY "Users can view hole patterns" ON public.hole_patterns
        FOR SELECT USING (true);
      
      CREATE POLICY "Admins can manage hole patterns" ON public.hole_patterns
        FOR ALL USING (true);
    `);
    
    await client.query(`
      DROP POLICY IF EXISTS "Users can view groove profiles" ON public.groove_profiles;
      DROP POLICY IF EXISTS "Admins can manage groove profiles" ON public.groove_profiles;
      
      CREATE POLICY "Users can view groove profiles" ON public.groove_profiles
        FOR SELECT USING (true);
      
      CREATE POLICY "Admins can manage groove profiles" ON public.groove_profiles
        FOR ALL USING (true);
    `);
    
    await client.query(`
      DROP POLICY IF EXISTS "Users can view routing profiles" ON public.routing_profiles;
      DROP POLICY IF EXISTS "Admins can manage routing profiles" ON public.routing_profiles;
      
      CREATE POLICY "Users can view routing profiles" ON public.routing_profiles
        FOR SELECT USING (true);
      
      CREATE POLICY "Admins can manage routing profiles" ON public.routing_profiles
        FOR ALL USING (true);
    `);
    
    console.log('✅ RLS policies created\n');

    // Seed data
    console.log('Seeding default data...');
    await client.query(`
      INSERT INTO public.hole_patterns (organization_id, pattern_id, name, kind, holes, is_system, description)
      SELECT 
        o.id,
        patterns.pattern_id,
        patterns.name,
        patterns.kind,
        patterns.holes::jsonb,
        true,
        patterns.description
      FROM public.organizations o
      CROSS JOIN (
        VALUES 
          ('HINGE_35', 'Hinge 35mm Cup', 'hinge', '[{"x":0,"y":0,"dia_mm":35,"depth_mm":13}]', 'Standard 35mm European hinge cup'),
          ('HINGE_26', 'Hinge 26mm Cup', 'hinge', '[{"x":0,"y":0,"dia_mm":26,"depth_mm":13}]', 'Compact 26mm hinge cup'),
          ('SYS32_5H', 'System 32 - 5 Holes', 'shelf_pins', '[{"x":37,"y":0,"dia_mm":5,"depth_mm":13}]', 'System 32 shelf pin holes'),
          ('HANDLE_CC96', 'Handle CC96', 'handle', '[{"x":0,"y":0,"dia_mm":5,"depth_mm":25},{"x":96,"y":0,"dia_mm":5,"depth_mm":25}]', 'Handle holes at 96mm centers')
      ) AS patterns(pattern_id, name, kind, holes, description)
      ON CONFLICT (organization_id, pattern_id) DO NOTHING;
    `);
    
    await client.query(`
      INSERT INTO public.groove_profiles (organization_id, profile_id, name, width_mm, depth_mm, purpose, is_system, description)
      SELECT 
        o.id,
        profiles.profile_id,
        profiles.name,
        profiles.width_mm,
        profiles.depth_mm,
        profiles.purpose,
        true,
        profiles.description
      FROM public.organizations o
      CROSS JOIN (
        VALUES 
          ('BP_4x10', 'Back Panel 4x10', 4.0, 10.0, 'back_panel', 'Standard groove for 4mm back panels'),
          ('DB_6x10', 'Drawer Bottom 6x10', 6.0, 10.0, 'drawer_bottom', 'Standard groove for drawer bottoms')
      ) AS profiles(profile_id, name, width_mm, depth_mm, purpose, description)
      ON CONFLICT (organization_id, profile_id) DO NOTHING;
    `);
    
    await client.query(`
      INSERT INTO public.routing_profiles (organization_id, profile_id, name, profile_type, specifications, is_system, description)
      SELECT 
        o.id,
        profiles.profile_id,
        profiles.name,
        profiles.profile_type,
        profiles.specifications::jsonb,
        true,
        profiles.description
      FROM public.organizations o
      CROSS JOIN (
        VALUES 
          ('EDGE_ROUND_3', 'Edge Round 3mm', 'edge_profile', '{"shape":"round","radius_mm":3}', '3mm radius edge profile'),
          ('SINK_CUTOUT', 'Sink Cutout', 'cutout', '{"shape":"rect","purpose":"sink"}', 'Rectangular sink cutout')
      ) AS profiles(profile_id, name, profile_type, specifications, description)
      ON CONFLICT (organization_id, profile_id) DO NOTHING;
    `);
    
    console.log('✅ Data seeded\n');

    // Notify schema cache refresh
    console.log('Refreshing schema cache...');
    await client.query(`NOTIFY pgrst, 'reload schema'`);
    console.log('✅ Schema cache notified\n');

    // Verify
    console.log('Verifying tables...');
    const tables = ['hole_patterns', 'groove_profiles', 'routing_profiles'];
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM public.${table}`);
      console.log(`  ✅ ${table}: ${result.rows[0].count} rows`);
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('   Detail:', error.detail);
    if (error.position) console.error('   Position:', error.position);
  } finally {
    await client.end();
  }
}

runMigration();

