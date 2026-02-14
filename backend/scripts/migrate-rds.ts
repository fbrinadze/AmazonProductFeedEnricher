import { execSync } from 'child_process';
import { getDatabaseUrl } from '../src/config/database';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function migrateRDS() {
  console.log('🚀 Running Prisma migrations on AWS RDS...\n');

  try {
    // Check if USE_AWS_RDS is enabled
    if (process.env.USE_AWS_RDS !== 'true') {
      console.error('❌ USE_AWS_RDS is not set to "true" in .env file');
      console.log('   Please set USE_AWS_RDS=true to use AWS RDS');
      process.exit(1);
    }

    // Get database URL with password from Secrets Manager
    console.log('🔐 Fetching database credentials from AWS Secrets Manager...');
    const databaseUrl = await getDatabaseUrl();
    console.log('✅ Credentials retrieved\n');

    // Set DATABASE_URL for Prisma
    process.env.DATABASE_URL = databaseUrl;

    // Run Prisma migrate
    console.log('📦 Running Prisma migrations...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });

    console.log('\n✅ Migrations completed successfully!');
    console.log('\n💡 To seed the database, run: npm run prisma:seed');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  }
}

migrateRDS();
