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

async function testFetch() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('📋 Testing cutlists query...\n');

    // Get a user and their org
    const userResult = await client.query(`
      SELECT id, organization_id FROM public.users LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No users found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`User ID: ${user.id}`);
    console.log(`Org ID: ${user.organization_id}\n`);

    // Try the exact query from the API
    console.log('Testing cutlists query with parts count...');
    try {
      const cutlistsResult = await client.query(`
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM public.cut_parts WHERE cutlist_id = c.id) as parts_count
        FROM public.cutlists c
        WHERE c.organization_id = $1
        ORDER BY c.created_at DESC
        LIMIT 20
      `, [user.organization_id]);
      
      console.log(`✅ Query successful: ${cutlistsResult.rows.length} cutlists found`);
      
      if (cutlistsResult.rows.length > 0) {
        console.log('\nFirst cutlist:');
        const first = cutlistsResult.rows[0];
        console.log(`  ID: ${first.id}`);
        console.log(`  Name: ${first.name}`);
        console.log(`  Status: ${first.status}`);
        console.log(`  Parts: ${first.parts_count}`);
      }
    } catch (queryError) {
      console.log('❌ Query failed:', queryError.message);
      if (queryError.hint) console.log('   Hint:', queryError.hint);
    }

    // Check cut_parts table structure
    console.log('\nChecking cut_parts table...');
    const partsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'cut_parts'
      ORDER BY ordinal_position
    `);
    console.log('Columns:');
    partsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

testFetch();

