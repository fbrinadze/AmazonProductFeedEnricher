# AWS RDS Quick Start

Quick reference for using AWS RDS PostgreSQL with this application.

## Setup (One-time)

```bash
# 1. Download SSL certificate
npm run rds:download-cert

# 2. Configure .env
# Edit backend/.env and set:
USE_AWS_RDS=true
AWS_SECRET_ARN=arn:aws:secretsmanager:...
RDS_HOST=your-rds-endpoint.rds.amazonaws.com

# 3. Test connection
npm run rds:test

# 4. Run migrations
npm run rds:migrate

# 5. Seed database
npm run prisma:seed
```

## Daily Commands

```bash
# Test RDS connection
npm run rds:test

# Run new migrations
npm run rds:migrate

# View database in browser
npm run prisma:studio

# Start development server (uses RDS)
npm run dev
```

## Switching Databases

```bash
# Use AWS RDS
# In .env: USE_AWS_RDS=true

# Use local PostgreSQL
# In .env: USE_AWS_RDS=false
```

## Troubleshooting

```bash
# Check AWS credentials
aws sts get-caller-identity

# Test secret access
aws secretsmanager get-secret-value --secret-id "arn:aws:..."

# Check certificate
ls -la certs/global-bundle.pem

# Re-download certificate
npm run rds:download-cert
```

## Environment Variables

Required in `.env`:
- `USE_AWS_RDS=true` - Enable RDS mode
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `AWS_SECRET_ARN` - Secrets Manager ARN
- `RDS_HOST` - RDS endpoint
- `RDS_PORT` - Port (usually 5432)
- `RDS_DATABASE` - Database name
- `RDS_USER` - Database user
- `RDS_SSL_CERT_PATH` - Path to SSL cert

## Security Notes

- Never commit `.env` file
- Use IAM roles in production
- Rotate secrets regularly
- Restrict RDS security groups
- Enable RDS encryption

## Need Help?

See [AWS_RDS_SETUP.md](./AWS_RDS_SETUP.md) for detailed documentation.
