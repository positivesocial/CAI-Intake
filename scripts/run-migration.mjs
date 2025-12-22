#!/usr/bin/env node

/**
 * Script to run SQL migrations directly against the database
 * Usage: node scripts/run-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Running operations tables migration...\n');
  
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20241226000000_fix_operations_tables.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  
  // Split by semicolons but be careful with function bodies
  // We'll run statements individually to better track errors
  const statements = [];
  let currentStatement = '';
  let inFunction = false;
  
  for (const line of sql.split('\n')) {
    currentStatement += line + '\n';
    
    if (line.includes('$$ LANGUAGE')) {
      inFunction = false;
    } else if (line.includes('AS $$')) {
      inFunction = true;
    }
    
    if (!inFunction && line.trim().endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }
  
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  console.log(`📄 Found ${statements.length} SQL statements\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.startsWith('--') || stmt.length < 5) continue;
    
    // Get first line for description
    const firstLine = stmt.split('\n')[0].slice(0, 80);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });
      
      if (error) {
        // Try using raw SQL function if available
        const { error: error2 } = await supabase.from('_exec').select('*').limit(0);
        
        if (error2) {
          // Just continue - many statements may fail on "already exists" which is OK
          if (error.message?.includes('already exists') || 
              error.message?.includes('duplicate') ||
              error.message?.includes('does not exist')) {
            console.log(`⏭️  [${i + 1}/${statements.length}] Skipped (already exists): ${firstLine}...`);
          } else {
            console.log(`⚠️  [${i + 1}/${statements.length}] Warning: ${error.message?.slice(0, 100) || 'Unknown error'}`);
            errorCount++;
          }
        }
      } else {
        console.log(`✅ [${i + 1}/${statements.length}] ${firstLine}...`);
        successCount++;
      }
    } catch (err) {
      console.log(`⚠️  [${i + 1}/${statements.length}] Error: ${err.message?.slice(0, 100) || 'Unknown error'}`);
    }
  }
  
  console.log(`\n📊 Migration complete: ${successCount} succeeded, ${errorCount} warnings\n`);
}

// Alternative: Use REST API to execute SQL directly
async function runMigrationViaRest() {
  console.log('🚀 Running operations tables migration via REST API...\n');
  
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20241226000000_fix_operations_tables.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  
  try {
    // Try to execute via the Supabase Management API
    // This requires the service role key
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql_query: sql })
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.log('REST API response:', text);
    } else {
      console.log('✅ Migration executed successfully');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main
console.log('📝 CAI Intake - Operations Tables Migration\n');
console.log(`🔗 Supabase URL: ${supabaseUrl}\n`);

// Since we can't execute raw SQL via supabase-js client directly,
// we'll output the SQL for manual execution
console.log('⚠️  To run this migration, please:');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Copy and run the migration SQL from:');
console.log(`   ${join(__dirname, '..', 'supabase', 'migrations', '20241226000000_fix_operations_tables.sql')}`);
console.log('');
console.log('Or run via Supabase CLI:');
console.log('   npx supabase db push');
console.log('');

// Try to check if tables exist
async function checkTables() {
  console.log('📋 Checking existing tables...\n');
  
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
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ ${table}: Not found or error - ${error.message}`);
    } else {
      console.log(`✅ ${table}: Exists`);
    }
  }
}

checkTables().catch(console.error);

