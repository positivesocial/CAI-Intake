#!/usr/bin/env node

/**
 * Execute SQL migration directly against the database
 */

import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

// Load environment variables manually from .env
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
        // Remove quotes if present
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
  
  if (!databaseUrl) {
    console.error('❌ Missing DATABASE_URL or DIRECT_URL in .env');
    process.exit(1);
  }

  console.log('📝 CAI Intake - Database Migration Runner\n');
  console.log('🔗 Connecting to database...\n');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20241226000003_comprehensive_fix.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Running comprehensive fix migration...\n');
    console.log('   This will:');
    console.log('   - Fix cutlists and cut_parts ID defaults');
    console.log('   - Drop and recreate operations tables with correct types');
    console.log('   - Set up RLS policies');
    console.log('   - Seed default data');
    console.log('');

    // Execute the entire migration as a single transaction
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!\n');

    // Verify tables exist
    console.log('📋 Verifying tables...\n');
    
    const tables = [
      'hole_patterns',
      'groove_profiles', 
      'routing_profiles',
      'groove_types',
      'hole_types',
      'cnc_operation_types',
      'shortcode_configs'
    ];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM public.${table}`);
        console.log(`   ✅ ${table}: ${result.rows[0].count} rows`);
      } catch (err) {
        console.log(`   ❌ ${table}: Error - ${err.message}`);
      }
    }

    console.log('\n🎉 All done! Restart your dev server to see the changes.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('   Detail:', error.detail);
    if (error.hint) console.error('   Hint:', error.hint);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

