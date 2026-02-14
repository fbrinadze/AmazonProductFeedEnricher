# Prisma Schema Reference

This document provides an overview of the database schema for the Amazon Product Data Enrichment Tool.

## Database Tables

### Users (`users`)
Stores user accounts with authentication and authorization information.

**Fields:**
- `id` (UUID): Primary key
- `email` (String): Unique email address
- `passwordHash` (String): Bcrypt hashed password
- `fullName` (String): User's full name
- `role` (String): User role ('user' or 'admin')
- `isActive` (Boolean): Account active status
- `failedLogins` (Int): Failed login attempt counter
- `lockedUntil` (DateTime?): Account lock expiration
- `lastLoginAt` (DateTime?): Last successful login timestamp
- `createdAt` (DateTime): Account creation timestamp
- `updatedAt` (DateTime): Last update timestamp

**Relations:**
- One-to-many with `Upload`
- One-to-many with `MappingTemplate`
- One-to-many with `AuditLog`

### Uploads (`uploads`)
Stores information about uploaded files and their processing status.

**Fields:**
- `id` (UUID): Primary key
- `userId` (UUID): Foreign key to User
- `filename` (String): Original filename
- `originalSize` (BigInt?): File size in bytes
- `rowCount` (Int?): Number of data rows
- `errorCount` (Int): Count of rows with errors
- `warningCount` (Int): Count of rows with warnings
- `passCount` (Int): Count of rows passing validation
- `status` (String): Processing status ('pending', 'processing', 'completed', 'failed')
- `filePath` (String?): Path to uploaded file
- `exportPath` (String?): Path to exported file
- `mappingTemplateId` (UUID?): Applied mapping template
- `createdAt` (DateTime): Upload timestamp

**Relations:**
- Many-to-one with `User`
- One-to-many with `UploadRow`

### Upload Rows (`upload_rows`)
Stores individual rows from uploaded files with validation results.

**Fields:**
- `id` (UUID): Primary key
- `uploadId` (UUID): Foreign key to Upload
- `rowNumber` (Int): Row number in original file
- `originalData` (JSON): Raw imported values
- `enrichedData` (JSON?): Values after enrichment
- `validationResults` (JSON?): Array of validation issues
- `status` (String): Row status ('pending', 'pass', 'warning', 'error')
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last update timestamp

**Relations:**
- Many-to-one with `Upload` (cascade delete)

### Mapping Templates (`mapping_templates`)
Stores saved column mapping configurations.

**Fields:**
- `id` (UUID): Primary key
- `userId` (UUID): Foreign key to User
- `name` (String): Template name
- `isDefault` (Boolean): Whether this is the default template
- `mappings` (JSON): Column mapping configuration
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last update timestamp

**Relations:**
- Many-to-one with `User`

### Validation Rules (`validation_rules`)
Stores configurable validation rules.

**Fields:**
- `id` (UUID): Primary key
- `fieldName` (String): Field to validate
- `ruleType` (String): Type of validation ('required', 'max_length', 'regex', 'range', 'lookup', 'custom')
- `ruleConfig` (JSON): Rule-specific configuration
- `severity` (String): Issue severity ('error', 'warning', 'info')
- `message` (String): Validation message
- `isActive` (Boolean): Whether rule is enabled
- `sortOrder` (Int): Execution order
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last update timestamp

### Lookup Tables (`lookup_tables`)
Stores mapping tables for data enrichment.

**Fields:**
- `id` (UUID): Primary key
- `tableType` (String): Type of lookup ('color_map', 'size_map', 'department', 'item_type')
- `sourceValue` (String): ERP/source value
- `targetValue` (String): Amazon/target value
- `brand` (String?): Optional brand-specific mapping
- `isActive` (Boolean): Whether entry is active
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last update timestamp

**Unique Constraint:** `(tableType, sourceValue, brand)`

### Brand Config (`brand_config`)
Stores brand-specific configuration.

**Fields:**
- `id` (UUID): Primary key
- `brandName` (String): Unique brand name
- `amazonBrand` (String): Amazon brand name
- `defaultManufacturer` (String?): Default manufacturer
- `defaultFulfillment` (String): Default fulfillment channel
- `isActive` (Boolean): Whether brand is active
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last update timestamp

### Audit Log (`audit_log`)
Stores audit trail of system actions.

**Fields:**
- `id` (UUID): Primary key
- `userId` (UUID?): Foreign key to User (nullable for system actions)
- `action` (String): Action type
- `entityType` (String?): Type of entity affected
- `entityId` (UUID?): ID of entity affected
- `details` (JSON?): Action-specific details
- `ipAddress` (String?): User's IP address
- `createdAt` (DateTime): Action timestamp

**Relations:**
- Many-to-one with `User` (optional)

## Validation Rule Types

### Required
Checks if field is non-empty.
```json
{ "ruleConfig": {} }
```

### Max Length
Checks if string length does not exceed limit.
```json
{ "ruleConfig": { "max": 200 } }
```

### Regex
Validates field against regular expression.
```json
{ "ruleConfig": { "pattern": "^[A-Z0-9-]+$" } }
```

### Range
Validates numeric value within bounds.
```json
{ "ruleConfig": { "min": 0, "max": 10000 } }
```

### Lookup
Validates value exists in lookup table.
```json
{ "ruleConfig": { "table_type": "color_map" } }
```

### Custom
JavaScript function for complex validation.
```json
{ "ruleConfig": { "function": "validateUPCCheckDigit" } }
```

## Lookup Table Types

- `color_map`: Maps ERP color names to Amazon color values
- `size_map`: Maps ERP size codes to Amazon size values
- `department`: Maps ERP department names to Amazon departments
- `item_type`: Maps product types to Amazon item type keywords

## Seeded Data

After running migrations, the database is seeded with:

1. **Admin User**
   - Email: admin@bcibrands.com
   - Password: admin123 (change in production!)
   - Role: admin

2. **Validation Rules** (21 rules)
   - Required field checks
   - Length validations
   - Format validations
   - Quality warnings

3. **Brand Configurations** (3 brands)
   - CECE
   - Vince Camuto
   - 1.STATE

4. **Lookup Table Entries** (18 entries)
   - 5 color mappings
   - 5 size mappings
   - 4 department mappings
   - 4 item type mappings

## Common Queries

### Get user with uploads
```typescript
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' },
  include: { uploads: true }
});
```

### Get upload with rows and validation results
```typescript
const upload = await prisma.upload.findUnique({
  where: { id: uploadId },
  include: { 
    uploadRows: true,
    user: true
  }
});
```

### Get active validation rules
```typescript
const rules = await prisma.validationRule.findMany({
  where: { isActive: true },
  orderBy: { sortOrder: 'asc' }
});
```

### Get lookup table entries by type
```typescript
const colorMappings = await prisma.lookupTable.findMany({
  where: { 
    tableType: 'color_map',
    isActive: true
  }
});
```

### Create audit log entry
```typescript
await prisma.auditLog.create({
  data: {
    userId: user.id,
    action: 'upload',
    entityType: 'upload',
    entityId: upload.id,
    details: { filename: upload.filename },
    ipAddress: req.ip
  }
});
```
