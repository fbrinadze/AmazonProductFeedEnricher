# AWS RDS Implementation Summary

This document summarizes the AWS RDS PostgreSQL integration added to the Amazon Product Data Enrichment Tool.

## Overview

The application now supports both local PostgreSQL and AWS RDS PostgreSQL databases. You can switch between them using the `USE_AWS_RDS` environment variable.

## What Was Implemented

### 1. Database Configuration Module
**File:** `src/config/database.ts`

Provides utilities for:
- Fetching database passwords from AWS Secrets Manager
- Constructing Prisma-compatible DATABASE_URL with SSL
- Getting pg client configuration for direct connections
- Supporting both local and RDS modes

### 2. Connection Testing Script
**File:** `scripts/test-rds-connection.ts`

Features:
- Tests RDS connectivity
- Displays connection details
- Runs test queries
- Verifies database existence
- Shows PostgreSQL version

**Usage:** `npm run rds:test`

### 3. Migration Script
**File:** `scripts/migrate-rds.ts`

Features:
- Fetches credentials from Secrets Manager
- Runs Prisma migrations on RDS
- Handles SSL configuration automatically

**Usage:** `npm run rds:migrate`

### 4. Database Creation Script
**File:** `scripts/create-rds-database.ts`

Features:
- Interactive database creation
- Checks for existing databases
- Handles database dropping/recreation
- Grants proper privileges

**Usage:** `npm run rds:create-db`

### 5. SSL Certificate Download Script
**File:** `scripts/download-rds-cert.sh`

Features:
- Downloads AWS RDS global certificate bundle
- Verifies certificate details
- Handles re-downloads

**Usage:** `npm run rds:download-cert`

### 6. Documentation

Created comprehensive documentation:
- **AWS_RDS_SETUP.md** - Complete setup guide with troubleshooting
- **RDS_QUICK_START.md** - Quick reference for daily use
- **AWS_RDS_IMPLEMENTATION.md** - This file

### 7. Environment Configuration

Updated `.env` and `.env.example` with:
- `USE_AWS_RDS` - Toggle between local/RDS
- `AWS_REGION` - AWS region
- `AWS_SECRET_ARN` - Secrets Manager ARN
- `RDS_HOST` - RDS endpoint
- `RDS_PORT` - Database port
- `RDS_DATABASE` - Database name
- `RDS_USER` - Database user
- `RDS_SSL_MODE` - SSL mode (require/disable)
- `RDS_SSL_CERT_PATH` - Path to SSL certificate

### 8. Package Updates

Added dependencies:
- `aws-sdk` - AWS SDK for Secrets Manager
- `pg` - PostgreSQL client for direct connections

Added npm scripts:
- `rds:download-cert` - Download SSL certificate
- `rds:test` - Test RDS connection
- `rds:migrate` - Run migrations on RDS
- `rds:create-db` - Create database on RDS

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application                          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  src/config/database.ts                          │  │
│  │  - getDatabasePassword()                         │  │
│  │  - getDatabaseUrl()                              │  │
│  │  - getPgClientConfig()                           │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│         ┌───────────────┴───────────────┐              │
│         │                               │              │
│         ▼                               ▼              │
│  ┌─────────────┐                ┌─────────────┐       │
│  │   Prisma    │                │  pg Client  │       │
│  │   Client    │                │  (Direct)   │       │
│  └─────────────┘                └─────────────┘       │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐          ┌─────────────────────┐
│  AWS Secrets    │          │    AWS RDS          │
│   Manager       │          │   PostgreSQL        │
│                 │          │                     │
│  - Password     │          │  - Database         │
│    Storage      │          │  - SSL Required     │
└─────────────────┘          └─────────────────────┘
```

## Security Features

1. **Secrets Management**
   - Passwords stored in AWS Secrets Manager
   - Never stored in code or environment files
   - Fetched at runtime using AWS SDK

2. **SSL/TLS Encryption**
   - All connections use SSL
   - Certificate verification enabled
   - AWS global certificate bundle

3. **IAM Integration**
   - Supports IAM roles for AWS services
   - No hardcoded credentials needed in production

4. **Environment Separation**
   - Easy switching between local and RDS
   - Different configurations for dev/prod

## Usage Examples

### Development with RDS

```bash
# One-time setup
npm run rds:download-cert
npm run rds:test
npm run rds:create-db
npm run rds:migrate
npm run prisma:seed

# Daily development
npm run dev  # Uses RDS when USE_AWS_RDS=true
```

### Production Deployment

```bash
# Set environment variables
export USE_AWS_RDS=true
export AWS_REGION=us-east-1
export AWS_SECRET_ARN=arn:aws:secretsmanager:...
export RDS_HOST=your-rds-endpoint.rds.amazonaws.com
# ... other variables

# Run migrations
npm run rds:migrate

# Start application
npm start
```

### Switching Databases

```bash
# Use local PostgreSQL
echo "USE_AWS_RDS=false" >> .env

# Use AWS RDS
echo "USE_AWS_RDS=true" >> .env
```

## Configuration Reference

### Required Environment Variables (RDS Mode)

| Variable | Description | Example |
|----------|-------------|---------|
| `USE_AWS_RDS` | Enable RDS mode | `true` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_SECRET_ARN` | Secrets Manager ARN | `arn:aws:secretsmanager:...` |
| `RDS_HOST` | RDS endpoint | `database-1.cluster-xxx.rds.amazonaws.com` |
| `RDS_PORT` | Database port | `5432` |
| `RDS_DATABASE` | Database name | `amazon_enrichment` |
| `RDS_USER` | Database user | `postgres` |
| `RDS_SSL_MODE` | SSL mode | `require` |
| `RDS_SSL_CERT_PATH` | Certificate path | `./certs/global-bundle.pem` |

### AWS IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:SECRET_NAME"
    }
  ]
}
```

## Testing

### Test Connection
```bash
npm run rds:test
```

Expected output:
- Connection successful
- PostgreSQL version displayed
- Database existence confirmed

### Test Migrations
```bash
npm run rds:migrate
```

Expected output:
- Credentials fetched from Secrets Manager
- All migrations applied successfully
- No errors

### Test Application
```bash
npm run dev
```

Expected behavior:
- Application starts without errors
- Database queries work correctly
- Prisma Client connects successfully

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check RDS security group
   - Verify network connectivity
   - Ensure RDS is publicly accessible (if needed)

2. **Authentication Failed**
   - Verify AWS credentials
   - Check Secrets Manager permissions
   - Confirm secret ARN is correct

3. **SSL Error**
   - Download certificate: `npm run rds:download-cert`
   - Verify certificate path in `.env`
   - Check certificate file exists

4. **Database Not Found**
   - Create database: `npm run rds:create-db`
   - Update `RDS_DATABASE` in `.env`

## Performance Considerations

1. **Connection Pooling**
   - Prisma handles connection pooling automatically
   - Configure pool size in Prisma schema if needed

2. **Secrets Caching**
   - Password is fetched once per application start
   - Consider implementing caching for serverless

3. **SSL Overhead**
   - SSL adds minimal latency
   - Required for security compliance

## Future Enhancements

Potential improvements:
1. RDS Proxy integration for better connection management
2. IAM database authentication (no passwords)
3. Read replica support for scaling
4. Automatic failover handling
5. Connection retry logic with exponential backoff

## Support

For issues or questions:
1. Check [AWS_RDS_SETUP.md](./AWS_RDS_SETUP.md) for detailed setup
2. Review [RDS_QUICK_START.md](./RDS_QUICK_START.md) for quick reference
3. Check AWS RDS and Secrets Manager documentation
4. Review application logs for error details
