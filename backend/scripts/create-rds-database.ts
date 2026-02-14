import { Client } from 'pg';
import { getPgClientConfig } from '../src/config/database';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createDatabase() {
  console.log('🗄️  AWS RDS Database Creation Tool\n');

  try {
    // Get database configuration
    const config = await getPgClientConfig();
    
    const dbName = await question(`Enter database name to create (default: amazon_enrichment): `);
    const targetDb = dbName.trim() || 'amazon_enrichment';

    console.log('\n📋 Connection details:');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Admin Database: ${config.database}`);
    console.log(`   User: ${config.user}`);
    console.log(`   Target Database: ${targetDb}`);
    console.log('');

    const confirm = await question('Proceed with database creation? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      rl.close();
      return;
    }

    // Connect to postgres database (not the target database)
    const client = new Client(config);

    console.log('\n🔌 Connecting to RDS...');
    await client.connect();
    console.log('✅ Connected\n');

    // Check if database already exists
    console.log(`🔍 Checking if database '${targetDb}' exists...`);
    const checkResult = await client.query(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [targetDb]
    );

    if (checkResult.rows.length > 0) {
      console.log(`⚠️  Database '${targetDb}' already exists!`);
      const overwrite = await question('Do you want to drop and recreate it? (y/n): ');
      
      if (overwrite.toLowerCase() === 'y') {
        console.log(`\n🗑️  Dropping database '${targetDb}'...`);
        
        // Terminate existing connections
        await client.query(`
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = $1
            AND pid <> pg_backend_pid()
        `, [targetDb]);
        
        // Drop database
        await client.query(`DROP DATABASE IF EXISTS "${targetDb}"`);
        console.log('✅ Database dropped');
      } else {
        console.log('Keeping existing database.');
        await client.end();
        rl.close();
        return;
      }
    }

    // Create database
    console.log(`\n📦 Creating database '${targetDb}'...`);
    await client.query(`CREATE DATABASE "${targetDb}"`);
    console.log('✅ Database created successfully!\n');

    // Grant privileges
    console.log('🔐 Granting privileges...');
    await client.query(`GRANT ALL PRIVILEGES ON DATABASE "${targetDb}" TO ${config.user}`);
    console.log('✅ Privileges granted\n');

    await client.end();

    console.log('✅ Database setup complete!\n');
    console.log('📝 Next steps:');
    console.log(`   1. Update RDS_DATABASE="${targetDb}" in your .env file`);
    console.log('   2. Run migrations: npm run rds:migrate');
    console.log('   3. Seed database: npm run prisma:seed\n');

  } catch (error) {
    console.error('\n❌ Database creation failed:');
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createDatabase();
