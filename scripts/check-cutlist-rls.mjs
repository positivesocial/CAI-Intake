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

async function checkRLS() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('📋 Checking cutlists table RLS policies...\n');

    // Check if RLS is enabled
    const rlsResult = await client.query(`
      SELECT relrowsecurity, relforcerowsecurity 
      FROM pg_class 
      WHERE relname = 'cutlists'
    `);
    console.log('RLS enabled:', rlsResult.rows[0]);

    // Check policies
    const policiesResult = await client.query(`
      SELECT polname, polcmd, polroles::text[], polqual::text, polwithcheck::text
      FROM pg_policy 
      WHERE polrelid = 'public.cutlists'::regclass
    `);
    console.log('\nCutlists policies:');
    policiesResult.rows.forEach(row => {
      console.log(`  - ${row.polname} (${row.polcmd})`);
      console.log(`    Roles: ${row.polroles}`);
      if (row.polqual) console.log(`    Using: ${row.polqual.slice(0, 100)}...`);
      if (row.polwithcheck) console.log(`    With check: ${row.polwithcheck.slice(0, 100)}...`);
    });

    // Try a test insert (will be rolled back)
    console.log('\nTesting insert...');
    await client.query('BEGIN');
    
    try {
      // Get a test user and org
      const userResult = await client.query(`
        SELECT id, organization_id FROM public.users LIMIT 1
      `);
      
      if (userResult.rows.length === 0) {
        console.log('❌ No users found in database');
        await client.query('ROLLBACK');
        return;
      }
      
      const testUser = userResult.rows[0];
      console.log(`  Using user: ${testUser.id}`);
      console.log(`  Using org: ${testUser.organization_id}`);
      
      // Try insert as superuser (bypasses RLS)
      const testId = 'test-' + Date.now();
      const insertResult = await client.query(`
        INSERT INTO public.cutlists (id, organization_id, user_id, doc_id, name, source_method)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [testId, testUser.organization_id, testUser.id, 'DOC-TEST', 'Test Cutlist', 'web']);
      
      console.log('✅ Insert successful:', insertResult.rows[0]);
      
    } catch (insertError) {
      console.log('❌ Insert failed:', insertError.message);
      if (insertError.detail) console.log('   Detail:', insertError.detail);
      if (insertError.hint) console.log('   Hint:', insertError.hint);
      if (insertError.constraint) console.log('   Constraint:', insertError.constraint);
    }
    
    await client.query('ROLLBACK');
    console.log('\n(Test rolled back)');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkRLS();

