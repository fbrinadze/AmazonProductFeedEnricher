# AWS RDS PostgreSQL Setup Guide

This guide explains how to configure the application to use AWS RDS PostgreSQL instead of a local database.

## Prerequisites

- AWS account with access to RDS and Secrets Manager
- AWS CLI configured with appropriate credentials
- Node.js 20+ installed

## Configuration Steps

### 1. Configure Environment Variables

Update your `backend/.env` file with your AWS RDS details:

```bash
# Enable AWS RDS mode
USE_AWS_RDS="true"

# AWS Configuration
AWS_REGION="us-east-1"
AWS_SECRET_ARN="arn:aws:secretsmanager:us-east-1:816039038872:secret:rds!cluster-b7ce4e2e-7c4f-4216-9e33-f67d8d786082-zCSN6Y"

# RDS Connection Details
RDS_HOST="database-1.cluster-cqv24ec4ipd4.us-east-1.rds.amazonaws.com"
RDS_PORT="5432"
RDS_DATABASE="postgres"
RDS_USER="postgres"
RDS_SSL_MODE="require"
RDS_SSL_CERT_PATH="./certs/global-bundle.pem"
```

### 2. Download RDS SSL Certificate

AWS RDS requires SSL connections. Download the certificate bundle:

```bash
cd backend
npm run rds:download-cert
```

This will download the AWS RDS global certificate bundle to `backend/certs/global-bundle.pem`.

### 3. Configure AWS Credentials

The application uses AWS SDK to fetch the database password from Secrets Manager. Ensure your AWS credentials are configured:

**Option 1: AWS CLI Configuration**
```bash
aws configure
```

**Option 2: Environment Variables**
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

**Option 3: IAM Role (for EC2/ECS)**
If running on AWS infrastructure, attach an IAM role with the following permissions:
- `secretsmanager:GetSecretValue` for the RDS secret
- `rds:DescribeDBClusters` (optional, for additional features)

### 4. Test the Connection

Before running migrations, test the RDS connection:

```bash
npm run rds:test
```

This will:
- Fetch the password from AWS Secrets Manager
- Connect to the RDS instance
- Run a test query
- Display PostgreSQL version and connection details

Expected output:
```
🔍 Testing AWS RDS PostgreSQL connection...

📋 Connection details:
   Host: database-1.cluster-cqv24ec4ipd4.us-east-1.rds.amazonaws.com
   Port: 5432
   Database: postgres
   User: postgres
   SSL: Enabled

🔌 Connecting to database...
✅ Connected successfully!

🔍 Running test query...
✅ Query successful!

📊 PostgreSQL Version:
   PostgreSQL 16.x on x86_64-pc-linux-gnu...

✅ Connection test completed successfully!
```

### 5. Create Database (if needed)

If the database doesn't exist, create it:

```bash
# Connect to RDS using psql
psql -h database-1.cluster-cqv24ec4ipd4.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d postgres

# Create the database
CREATE DATABASE amazon_enrichment;

# Exit
\q
```

Update `RDS_DATABASE` in `.env` to `amazon_enrichment`.

### 6. Run Migrations

Run Prisma migrations on the RDS database:

```bash
npm run rds:migrate
```

This will:
- Fetch credentials from AWS Secrets Manager
- Apply all Prisma migrations to the RDS database
- Create all tables with proper schema

### 7. Seed the Database

After migrations complete, seed the database with initial data:

```bash
npm run prisma:seed
```

This creates:
- Initial admin user (admin@bcibrands.com / admin123)
- Sample validation rules
- Sample brand configurations
- Sample lookup table entries

### 8. Verify Setup

Open Prisma Studio to verify the database:

```bash
npm run prisma:studio
```

Or run the test connection again:

```bash
npm run rds:test
```

## Development Workflow

### Local Development with RDS

Set `USE_AWS_RDS=true` in your `.env` file and start the development server:

```bash
npm run dev
```

The application will automatically:
- Fetch the database password from AWS Secrets Manager on startup
- Connect to RDS using SSL
- Use the RDS database for all operations

### Switching Between Local and RDS

To switch back to local PostgreSQL:

```bash
# In backend/.env
USE_AWS_RDS="false"
```

To switch to AWS RDS:

```bash
# In backend/.env
USE_AWS_RDS="true"
```

## Production Deployment

### Environment Variables

For production, set these environment variables in your deployment platform (ECS, Lambda, EC2, etc.):

```bash
USE_AWS_RDS=true
AWS_REGION=us-east-1
AWS_SECRET_ARN=arn:aws:secretsmanager:...
RDS_HOST=your-rds-endpoint.rds.amazonaws.com
RDS_PORT=5432
RDS_DATABASE=amazon_enrichment
RDS_USER=postgres
RDS_SSL_MODE=require
RDS_SSL_CERT_PATH=/app/certs/global-bundle.pem
```

### IAM Permissions

Ensure your production environment has an IAM role with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:816039038872:secret:rds!cluster-*"
    }
  ]
}
```

### SSL Certificate in Production

Include the RDS certificate in your Docker image or deployment package:

```dockerfile
# In your Dockerfile
COPY backend/certs/global-bundle.pem /app/certs/global-bundle.pem
```

## Troubleshooting

### Connection Timeout

**Problem:** Connection times out when trying to connect to RDS.

**Solutions:**
1. Check RDS security group allows inbound traffic on port 5432 from your IP
2. Verify RDS is publicly accessible (if connecting from outside AWS)
3. Check VPC and subnet configuration

### Authentication Failed

**Problem:** Password authentication fails.

**Solutions:**
1. Verify AWS credentials are configured correctly
2. Check IAM permissions for Secrets Manager access
3. Verify the secret ARN is correct
4. Test fetching the secret manually:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id "arn:aws:secretsmanager:..."
   ```

### SSL Certificate Error

**Problem:** SSL certificate verification fails.

**Solutions:**
1. Download the latest certificate: `npm run rds:download-cert`
2. Verify certificate path in `.env` is correct
3. Check certificate file exists: `ls -la backend/certs/global-bundle.pem`

### Database Does Not Exist

**Problem:** Error: database "amazon_enrichment" does not exist.

**Solutions:**
1. Connect to RDS and create the database manually
2. Update `RDS_DATABASE` in `.env` to match existing database
3. Verify you have permissions to create databases

### Prisma Migration Fails

**Problem:** Migration fails with permission errors.

**Solutions:**
1. Ensure RDS user has sufficient privileges:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE amazon_enrichment TO postgres;
   GRANT ALL ON SCHEMA public TO postgres;
   ```
2. Check if migrations table exists and is accessible
3. Try running migrations with `--skip-seed` flag

## Security Best Practices

1. **Never commit credentials**: Keep `.env` in `.gitignore`
2. **Use IAM roles**: Prefer IAM roles over access keys when possible
3. **Rotate secrets**: Regularly rotate RDS passwords in Secrets Manager
4. **Restrict access**: Use security groups to limit RDS access
5. **Enable encryption**: Use RDS encryption at rest and in transit
6. **Monitor access**: Enable CloudWatch logs for RDS and Secrets Manager

## Cost Optimization

1. **Use RDS Proxy**: For serverless deployments, use RDS Proxy to manage connections
2. **Right-size instances**: Choose appropriate RDS instance size for your workload
3. **Use Aurora Serverless**: Consider Aurora Serverless v2 for variable workloads
4. **Enable backups**: Configure automated backups with appropriate retention

## Additional Resources

- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Prisma with AWS RDS](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-aws-lambda)
- [RDS SSL/TLS Certificates](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
