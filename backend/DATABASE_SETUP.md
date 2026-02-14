# Database Setup Instructions

## Prerequisites

You need PostgreSQL 16 installed and running on your system.

### Installing PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-16
sudo systemctl start postgresql
```

**Windows:**
Download and install from https://www.postgresql.org/download/windows/

## Database Setup

1. **Create the database:**
```bash
# Connect to PostgreSQL
psql postgres

# Create database and user
CREATE DATABASE amazon_enrichment;
CREATE USER user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE amazon_enrichment TO user;

# Exit psql
\q
```

2. **Update the .env file** (if needed):
```
DATABASE_URL="postgresql://user:password@localhost:5432/amazon_enrichment?schema=public"
```

3. **Run Prisma migrations:**
```bash
npm run prisma:migrate
```

This will:
- Create all database tables
- Run the seed script to create:
  - Initial admin user (email: admin@bcibrands.com, password: admin123)
  - Sample validation rules
  - Sample brand configurations (CECE, Vince Camuto, 1.STATE)
  - Sample lookup table entries for colors, sizes, departments, and item types

4. **Verify the setup:**
```bash
npm run prisma:studio
```

This will open Prisma Studio in your browser where you can view and manage the database.

## Default Admin Credentials

After seeding, you can login with:
- **Email:** admin@bcibrands.com
- **Password:** admin123

**Important:** Change this password in production!

## Troubleshooting

### Connection refused
- Make sure PostgreSQL is running: `brew services list` (macOS) or `sudo systemctl status postgresql` (Linux)
- Check if PostgreSQL is listening on port 5432: `lsof -i :5432`

### Permission denied
- Make sure the user has proper permissions on the database
- Try connecting manually: `psql -U user -d amazon_enrichment`

### Migration fails
- Drop and recreate the database if needed:
  ```bash
  psql postgres
  DROP DATABASE amazon_enrichment;
  CREATE DATABASE amazon_enrichment;
  \q
  ```
- Then run migrations again: `npm run prisma:migrate`
