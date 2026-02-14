import { Client } from 'pg';
import { getPgClientConfig } from '../src/config/database';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('🔍 Testing AWS RDS PostgreSQL connection...\n');

  try {
    // Get database configuration
    const config = await getPgClientConfig();
    
    console.log('📋 Connection details:');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   User: ${config.user}`);
    console.log(`   SSL: ${config.ssl ? 'Enabled' : 'Disabled'}`);
    console.log('');

    // Create client
    const client = new Client(config);

    // Connect
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Test query
    console.log('🔍 Running test query...');
    const result = await client.query('SELECT version()');
    console.log('✅ Query successful!\n');
    console.log('📊 PostgreSQL Version:');
    console.log(`   ${result.rows[0].version}\n`);

    // Check if database exists
    const dbCheck = await client.query(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [config.database]
    );
    
    if (dbCheck.rows.length > 0) {
      console.log(`✅ Database '${config.database}' exists`);
    } else {
      console.log(`⚠️  Database '${config.database}' does not exist`);
      console.log('   You may need to create it first');
    }

    // Close connection
    await client.end();
    console.log('\n✅ Connection test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error(error);
    process.exit(1);
  }
}

testConnection();
