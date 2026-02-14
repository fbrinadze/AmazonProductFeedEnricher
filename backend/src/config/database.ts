import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

// Configure AWS SDK
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });

interface RDSSecret {
  password: string;
  username?: string;
  engine?: string;
  host?: string;
  port?: number;
  dbname?: string;
}

/**
 * Fetches database password from AWS Secrets Manager
 */
export async function getDatabasePassword(): Promise<string> {
  const secretArn = process.env.AWS_SECRET_ARN;
  
  if (!secretArn) {
    throw new Error('AWS_SECRET_ARN environment variable is not set');
  }

  const sm = new AWS.SecretsManager();
  
  try {
    const response = await sm.getSecretValue({ SecretId: secretArn }).promise();
    
    if (!response.SecretString) {
      throw new Error('Secret does not contain a string value');
    }

    const secret: RDSSecret = JSON.parse(response.SecretString);
    return secret.password;
  } catch (error) {
    console.error('Error fetching database password from Secrets Manager:', error);
    throw error;
  }
}

/**
 * Constructs the DATABASE_URL for Prisma based on environment variables
 */
export async function getDatabaseUrl(): Promise<string> {
  const useRDS = process.env.USE_AWS_RDS === 'true';
  
  if (!useRDS) {
    // Use local PostgreSQL connection from .env
    return process.env.DATABASE_URL || '';
  }

  // Fetch password from AWS Secrets Manager
  const password = await getDatabasePassword();
  
  const host = process.env.RDS_HOST;
  const port = process.env.RDS_PORT || '5432';
  const database = process.env.RDS_DATABASE || 'postgres';
  const user = process.env.RDS_USER || 'postgres';
  const sslMode = process.env.RDS_SSL_MODE || 'require';

  if (!host) {
    throw new Error('RDS_HOST environment variable is not set');
  }

  // Construct connection string with SSL parameters
  let connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?schema=public`;
  
  if (sslMode !== 'disable') {
    connectionString += `&sslmode=${sslMode}`;
    
    // Add SSL certificate if provided
    const certPath = process.env.RDS_SSL_CERT_PATH;
    if (certPath && fs.existsSync(certPath)) {
      connectionString += `&sslrootcert=${certPath}`;
    }
  }

  return connectionString;
}

/**
 * Gets pg client configuration for direct connections (non-Prisma)
 */
export async function getPgClientConfig() {
  const useRDS = process.env.USE_AWS_RDS === 'true';
  
  if (!useRDS) {
    // Parse local DATABASE_URL
    const dbUrl = process.env.DATABASE_URL || '';
    const url = new URL(dbUrl);
    
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.slice(1).split('?')[0],
      user: url.username,
      password: url.password,
    };
  }

  // Fetch password from AWS Secrets Manager
  const password = await getDatabasePassword();
  
  const host = process.env.RDS_HOST;
  const port = parseInt(process.env.RDS_PORT || '5432');
  const database = process.env.RDS_DATABASE || 'postgres';
  const user = process.env.RDS_USER || 'postgres';
  const certPath = process.env.RDS_SSL_CERT_PATH;

  if (!host) {
    throw new Error('RDS_HOST environment variable is not set');
  }

  const config: any = {
    host,
    port,
    database,
    user,
    password,
  };

  // Add SSL configuration if using RDS
  if (certPath && fs.existsSync(certPath)) {
    config.ssl = {
      rejectUnauthorized: false,
      ca: fs.readFileSync(certPath).toString(),
    };
  } else {
    config.ssl = {
      rejectUnauthorized: false,
    };
  }

  return config;
}
