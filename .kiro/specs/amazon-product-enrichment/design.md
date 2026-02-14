# Design Document

## Overview

The Amazon Product Data Enrichment Tool is a full-stack web application built with React (frontend) and Node.js/Express (backend), backed by PostgreSQL. The system follows a three-tier architecture with clear separation between presentation, business logic, and data layers. Users authenticate via JWT, upload CSV/Excel files containing product data from the Exenta ERP, and the system parses, validates, and enriches the data against Amazon's Clothing flat file requirements. The validation engine applies configurable rules stored in the database, providing real-time feedback through a spreadsheet-style interface. Admins can configure validation rules, manage lookup tables for data enrichment, and monitor system activity through audit logs.

## Architecture

The system follows a client-server architecture with RESTful API communication:

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (React)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Login   │ │  Upload  │ │  Review  │ │ Admin  │ │
│  │  Screen  │ │  Module  │ │  Grid    │ │ Panel  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└────────────────────┬────────────────────────────────┘
                     │ REST API (HTTPS)
┌────────────────────┴────────────────────────────────┐
│               Backend (Node.js / Express)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Auth    │ │  File    │ │ Validate │ │ Export │ │
│  │  Service │ │  Parser  │ │ Engine   │ │ Engine │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────┐
│              Database (PostgreSQL)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Users   │ │ Uploads  │ │ Mappings │ │ Audit  │ │
│  │  Table   │ │ Table    │ │ Tables   │ │ Log    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└─────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript | Component-based UI, strong typing, large ecosystem |
| UI Framework | Tailwind CSS + shadcn/ui | Rapid, consistent styling with accessible components |
| Data Grid | AG Grid (Community) | High-performance spreadsheet-style grid with inline editing |
| Backend | Node.js + Express + TypeScript | Unified language stack, strong async file processing |
| Authentication | JWT + bcrypt | Stateless auth, industry-standard password hashing |
| Database | PostgreSQL 16 | Relational data for users, mappings, audit; JSONB for flexible rule storage |
| ORM | Prisma | Type-safe database access, migrations, schema management |
| File Parsing | Papa Parse (CSV), SheetJS (Excel) | Battle-tested libraries for tabular data parsing |
| Validation Engine | Custom rule engine | Configurable rules stored in DB, executed server-side |
| File Storage | Local filesystem (dev) / S3 (prod) | Uploaded files and generated exports |
| Testing | Vitest (unit), Playwright (e2e) | Fast unit tests, reliable browser automation |

## Components and Interfaces

### Frontend Components

#### Authentication Module
- **LoginForm**: Email/password input with validation, displays error messages
- **ForgotPasswordForm**: Email input for password reset request
- **ResetPasswordForm**: New password input with token validation
- **AuthContext**: React context providing authentication state and methods
- **ProtectedRoute**: HOC that redirects unauthenticated users to login

#### Upload Module
- **FileUploadZone**: Drag-and-drop area with file type and size validation
- **SheetSelector**: Dropdown for selecting target sheet from multi-sheet Excel files
- **ColumnMapper**: Drag-and-drop interface for mapping source columns to Amazon fields
- **MappingTemplateSelector**: Dropdown to load saved mapping templates
- **UploadPreview**: Table showing first 10 rows of parsed data

#### Review Module
- **ValidationDashboard**: Summary cards showing health score, error/warning/pass counts
- **ValidationFilters**: Dropdowns for filtering by severity, field, and rule
- **DataGrid**: AG Grid component with custom cell renderers for color-coding
- **CellDetailPopover**: Modal showing validation messages and suggestions for a cell
- **BulkEditModal**: Form for applying changes to multiple selected rows
- **AutoFixButton**: Triggers automatic correction of deterministic issues

#### Export Module
- **ExportOptions**: Radio buttons for Amazon flat file vs validation report
- **ExportPreview**: Summary of rows to be included/excluded
- **DownloadButton**: Triggers file generation and download

#### Admin Module
- **UserManagement**: Table with create/edit/deactivate actions
- **ValidationRuleManager**: CRUD interface for validation rules
- **LookupTableManager**: CRUD interface with CSV import/export
- **BrandConfigManager**: Form for brand-specific settings
- **AuditLogViewer**: Filterable table of system actions

### Backend Services

#### AuthService
```typescript
interface AuthService {
  login(email: string, password: string): Promise<{ token: string; user: User }>;
  logout(token: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  verifyToken(token: string): Promise<User>;
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, hash: string): Promise<boolean>;
}
```

#### FileParserService
```typescript
interface FileParserService {
  parseCSV(filePath: string): Promise<ParsedData>;
  parseExcel(filePath: string, sheetName?: string): Promise<ParsedData>;
  detectEncoding(filePath: string): Promise<string>;
  detectDelimiter(content: string): string;
  getSheetNames(filePath: string): Promise<string[]>;
}

interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
}
```

#### ValidationEngine
```typescript
interface ValidationEngine {
  validate(uploadId: string): Promise<ValidationResult>;
  loadRules(): Promise<ValidationRule[]>;
  applyRule(rule: ValidationRule, row: UploadRow): ValidationIssue[];
  enrichRow(row: UploadRow, lookupTables: LookupTable[]): EnrichedRow;
  generateTitleSuggestion(row: UploadRow): string;
}

interface ValidationRule {
  id: string;
  fieldName: string;
  ruleType: 'required' | 'max_length' | 'regex' | 'range' | 'lookup' | 'custom';
  ruleConfig: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
  message: string;
  isActive: boolean;
}

interface ValidationIssue {
  field: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  uploadId: string;
  totalRows: number;
  passCount: number;
  errorCount: number;
  warningCount: number;
  healthScore: number;
}
```

#### ExportEngine
```typescript
interface ExportEngine {
  exportAmazonFlatFile(uploadId: string): Promise<string>;
  exportValidationReport(uploadId: string): Promise<string>;
  generateAmazonHeader(): string[];
  filterPassingRows(rows: UploadRow[]): UploadRow[];
  formatTabDelimited(rows: UploadRow[]): string;
}
```

### API Endpoints

#### Authentication
- `POST /api/auth/login` - Login with email/password → JWT
- `POST /api/auth/logout` - Invalidate session
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token

#### Users (Admin only except GET /me)
- `GET /api/users/me` - Get current user profile
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user (role, status)
- `POST /api/users/:id/reset-password` - Admin reset user's password

#### Uploads
- `POST /api/uploads` - Upload CSV/Excel file
- `GET /api/uploads` - List user's upload history (admin: all)
- `GET /api/uploads/:id` - Get upload details + summary stats
- `GET /api/uploads/:id/rows` - Get paginated row data with validation
- `PUT /api/uploads/:id/rows/:rowId` - Update a row's enriched data
- `POST /api/uploads/:id/bulk-edit` - Bulk update rows
- `POST /api/uploads/:id/auto-fix` - Apply auto-fix to all fixable issues
- `DELETE /api/uploads/:id` - Delete upload and associated data

#### Column Mapping
- `GET /api/mappings` - List saved mapping templates
- `POST /api/mappings` - Save new mapping template
- `PUT /api/mappings/:id` - Update mapping template
- `DELETE /api/mappings/:id` - Delete mapping template
- `POST /api/uploads/:id/apply-mapping` - Apply mapping template to upload

#### Validation
- `POST /api/uploads/:id/validate` - Run validation on upload
- `GET /api/uploads/:id/report` - Get validation report

#### Export
- `POST /api/uploads/:id/export/amazon` - Export Amazon flat file (.txt)
- `POST /api/uploads/:id/export/report` - Export validation report (.xlsx)

#### Admin: Validation Rules
- `GET /api/admin/rules` - List all validation rules
- `POST /api/admin/rules` - Create validation rule
- `PUT /api/admin/rules/:id` - Update validation rule
- `DELETE /api/admin/rules/:id` - Delete validation rule

#### Admin: Lookup Tables
- `GET /api/admin/lookups/:type` - Get lookup table by type
- `POST /api/admin/lookups` - Add lookup entry
- `PUT /api/admin/lookups/:id` - Update lookup entry
- `DELETE /api/admin/lookups/:id` - Delete lookup entry
- `POST /api/admin/lookups/import` - Import lookup table from CSV
- `GET /api/admin/lookups/export/:type` - Export lookup table as CSV

#### Admin: Brand Config
- `GET /api/admin/brands` - List brand configurations
- `POST /api/admin/brands` - Create brand config
- `PUT /api/admin/brands/:id` - Update brand config

#### Admin: Audit Log
- `GET /api/admin/audit` - Query audit log (filterable)

## Data Models

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
    is_active       BOOLEAN DEFAULT true,
    failed_logins   INTEGER DEFAULT 0,
    locked_until    TIMESTAMP,
    last_login_at   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

#### Uploads Table
```sql
CREATE TABLE uploads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    filename        VARCHAR(500) NOT NULL,
    original_size   BIGINT,
    row_count       INTEGER,
    error_count     INTEGER DEFAULT 0,
    warning_count   INTEGER DEFAULT 0,
    pass_count      INTEGER DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending | processing | completed | failed
    file_path       VARCHAR(1000),
    export_path     VARCHAR(1000),
    mapping_template_id UUID,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

#### Upload Rows Table
```sql
CREATE TABLE upload_rows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id       UUID REFERENCES uploads(id) ON DELETE CASCADE,
    row_number      INTEGER NOT NULL,
    original_data   JSONB NOT NULL,          -- raw imported values
    enriched_data   JSONB,                   -- values after enrichment
    validation_results JSONB,               -- array of {field, rule, severity, message}
    status          VARCHAR(20) DEFAULT 'pending',  -- pending | pass | warning | error
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

#### Mapping Templates Table
```sql
CREATE TABLE mapping_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    name            VARCHAR(255) NOT NULL,
    is_default      BOOLEAN DEFAULT false,
    mappings        JSONB NOT NULL,          -- {source_column: amazon_field, ...}
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

#### Validation Rules Table
```sql
CREATE TABLE validation_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name      VARCHAR(100) NOT NULL,
    rule_type       VARCHAR(50) NOT NULL,     -- required | max_length | regex | range | lookup | custom
    rule_config     JSONB NOT NULL,           -- {max: 200, pattern: "...", values: [...], etc.}
    severity        VARCHAR(20) NOT NULL,     -- error | warning | info
    message         VARCHAR(500) NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

#### Lookup Tables Table
```sql
CREATE TABLE lookup_tables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_type      VARCHAR(50) NOT NULL,     -- color_map | size_map | department | item_type
    source_value    VARCHAR(255) NOT NULL,     -- ERP value
    target_value    VARCHAR(255) NOT NULL,     -- Amazon value
    brand           VARCHAR(100),             -- optional brand-specific mapping
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(table_type, source_value, brand)
);
```

#### Brand Config Table
```sql
CREATE TABLE brand_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_name      VARCHAR(100) UNIQUE NOT NULL,
    amazon_brand    VARCHAR(100) NOT NULL,     -- exact Amazon brand name
    default_manufacturer VARCHAR(255),
    default_fulfillment VARCHAR(20) DEFAULT 'DEFAULT',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

#### Audit Log Table
```sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,     -- login | upload | export | edit | admin_*
    entity_type     VARCHAR(50),              -- upload | user | rule | mapping
    entity_id       UUID,
    details         JSONB,                    -- action-specific metadata
    ip_address      VARCHAR(45),
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### Validation Engine Design

The validation engine processes rows through a pipeline of rule evaluators:

```
Input Row → Field Mapping → Rule Pipeline → Result Aggregation → Output

Rule Pipeline:
  1. Required Field Check     → Error if missing required fields
  2. Format Validation        → Error if wrong format (UPC, URL, etc.)
  3. Length Validation        → Error/Warning if exceeding limits
  4. Value Validation         → Error if invalid enum values
  5. Cross-Field Validation   → Error if parent/child inconsistency
  6. Lookup Enrichment        → Auto-map using lookup tables
  7. Quality Scoring          → Warning/Info for optimization opportunities
  8. Title Generation         → Info with suggested title format
```

Rules are stored in the database and loaded at validation time, allowing admins to modify behavior without code changes.

#### Validation Rule Types

1. **Required**: Checks if field is non-empty
   - Config: `{}`
   - Example: `item_sku` must be present

2. **Max Length**: Checks if string length does not exceed limit
   - Config: `{ max: 200 }`
   - Example: `item_name` ≤ 200 characters

3. **Regex**: Validates field against regular expression
   - Config: `{ pattern: "^[A-Z0-9-]+$" }`
   - Example: `item_sku` format validation

4. **Range**: Validates numeric value within bounds
   - Config: `{ min: 0, max: 10000 }`
   - Example: `standard_price` > 0

5. **Lookup**: Validates value exists in lookup table
   - Config: `{ table_type: "color_map" }`
   - Example: `color_map` must be valid Amazon color

6. **Custom**: JavaScript function for complex validation
   - Config: `{ function: "validateUPCCheckDigit" }`
   - Example: UPC check digit validation

#### UPC/EAN Check Digit Validation

UPC-A (12 digits) and EAN-13 (13 digits) use the following algorithm:

1. Starting from the right (excluding check digit), alternate multiplying digits by 3 and 1
2. Sum all products
3. Check digit = (10 - (sum % 10)) % 10

Example UPC-A: `012345678905`
- Calculation: `(0×3 + 1×1 + 2×3 + 3×1 + 4×3 + 5×1 + 6×3 + 7×1 + 8×3 + 9×1 + 0×3) = 60`
- Check digit: `(10 - (60 % 10)) % 10 = 0` (but actual is 5, so this would fail)

#### Parent-Child Validation

For variation products:
1. Verify `parent_sku` exists in the file when `parent_child` = 'Child'
2. Verify all children of a parent have the same `variation_theme`
3. Verify `variation_theme` matches the attributes that differ (e.g., 'SizeColor' when size and color vary)
4. Verify parent has `parent_child` = 'Parent'

#### Title Generation Pattern

```
[Brand] [Department] [Product Type] [Key Feature] [Color] [Size]
```

Example: `Vince Camuto Women's Blouse Floral Print Navy Medium`

Algorithm:
1. Extract brand from `brand_name`
2. Extract department from `department_name` (map to readable form)
3. Extract product type from `clothing_type` or `item_type`
4. Extract key feature from first bullet point or description
5. Extract color from `color_name`
6. Extract size from `size_name`
7. Concatenate with spaces, capitalize appropriately


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, several redundancies were identified:
- Criteria 3.12 and 3.23 both test parent-child referential integrity (consolidated into one property)
- Criteria 3.24 and 4.2 both test color mapping suggestions (consolidated)
- Criteria 3.25 and 4.3 both test size mapping suggestions (consolidated)
- Criteria 1.10 and 8.1 both test bcrypt password hashing (consolidated)
- Several UI-specific criteria (2.3, 2.7, 5.4, 5.5, 5.6, 8.4) are not testable as properties
- Time-based criteria (6.9) requires manual testing

### Authentication Properties

Property 1: Valid credentials produce JWT tokens
*For any* valid user credentials (email and password), authenticating should return a JWT token containing user ID, role, and expiration timestamp
**Validates: Requirements 1.1, 8.2**

Property 2: Invalid credentials are rejected
*For any* invalid credentials, authentication should fail and increment the failed login counter
**Validates: Requirements 1.2**

Property 3: Unauthenticated requests are rejected
*For any* protected endpoint, requests without valid JWT tokens should return authentication errors
**Validates: Requirements 1.5**

Property 4: Authorization is enforced by role
*For any* admin-only endpoint, requests from standard users should return authorization errors
**Validates: Requirements 1.6**

Property 5: Password reset tokens are time-limited
*For any* password reset request, the system should generate a time-limited reset token
**Validates: Requirements 1.4**

Property 6: Deactivated users cannot login
*For any* deactivated user account, login attempts should be rejected while the user's data remains in the system
**Validates: Requirements 1.8**

Property 7: Passwords are hashed with bcrypt
*For any* user account, the stored password should be a bcrypt hash with work factor ≥ 10, never plaintext
**Validates: Requirements 1.10, 8.1**

Property 8: User creation requires all fields
*For any* user creation request missing email, full name, or role, the system should reject the request
**Validates: Requirements 1.7**

Property 9: Admin password reset generates new credentials
*For any* admin-initiated password reset, the system should generate a new secure password that allows login
**Validates: Requirements 1.9**

Property 10: JWT expiration requires re-authentication
*For any* expired JWT token, requests should be rejected and require re-authentication
**Validates: Requirements 8.3**

### File Upload and Parsing Properties

Property 11: File format and size validation
*For any* uploaded file, the system should accept CSV/XLSX/XLS formats up to 50 MB and reject others
**Validates: Requirements 2.1**

Property 12: CSV delimiter auto-detection
*For any* CSV file with comma, tab, or pipe delimiters, the system should correctly detect and parse the file
**Validates: Requirements 2.2**

Property 13: Encoding detection and handling
*For any* file with UTF-8, Latin-1, or Windows-1252 encoding, the system should correctly detect and parse the content
**Validates: Requirements 2.4**

Property 14: File preview generation
*For any* successfully parsed file, the system should return headers and the first 10 data rows as preview
**Validates: Requirements 2.5**

Property 15: Column auto-mapping
*For any* uploaded file with column names similar to Amazon fields, the system should auto-map matching columns
**Validates: Requirements 2.6**

Property 16: Mapping template persistence
*For any* saved column mapping, the system should store it and allow retrieval for future uploads
**Validates: Requirements 2.8**

Property 17: Default mapping template application
*For any* admin-set default mapping template, the system should automatically apply it to all users' uploads
**Validates: Requirements 2.9**

Property 18: Upload error messages
*For any* failed file upload, the system should return a descriptive error message indicating the cause
**Validates: Requirements 2.10**

### Validation Properties

Property 19: SKU uniqueness and presence
*For any* product row, the item_sku should be non-empty and unique within the file
**Validates: Requirements 3.1**

Property 20: Title validation
*For any* product row, the item_name should be non-empty, not exceed 200 characters, and contain no prohibited characters
**Validates: Requirements 3.2**

Property 21: UPC/EAN check digit validation
*For any* product with external_product_id, if it's a 12-digit UPC or 13-digit EAN, the check digit should be mathematically valid
**Validates: Requirements 3.3**

Property 22: Barcode type validation
*For any* product row, the external_product_id_type should be either 'UPC' or 'EAN'
**Validates: Requirements 3.4**

Property 23: Brand validation
*For any* product row, the brand_name should match a configured BCI brand
**Validates: Requirements 3.5**

Property 24: Department validation
*For any* product row, the department_name should match a valid Amazon department value
**Validates: Requirements 3.6**

Property 25: Description validation
*For any* product row, the product_description should be non-empty, not exceed 2000 characters, and contain no HTML tags
**Validates: Requirements 3.7**

Property 26: Bullet point validation
*For any* product row, at least bullet_point1 should be present and each bullet should not exceed 500 characters
**Validates: Requirements 3.8**

Property 27: Color map validation
*For any* product row, the color_map should match an Amazon-accepted color map value
**Validates: Requirements 3.9**

Property 28: Size map validation
*For any* product row, the size_map should match an Amazon-accepted size map value
**Validates: Requirements 3.10**

Property 29: Image URL validation
*For any* product row, the main_image_url should be a well-formed URL
**Validates: Requirements 3.11**

Property 30: Parent-child referential integrity
*For any* product row with parent_child = 'Child', the parent_sku should reference an existing parent within the file
**Validates: Requirements 3.12, 3.23**

Property 31: Variation theme consistency
*For any* parent-child product set, all children should have the same variation_theme as their parent
**Validates: Requirements 3.13**

Property 32: Price validation
*For any* product row, the standard_price should be a positive numeric value
**Validates: Requirements 3.14**

Property 33: Quantity validation
*For any* product row, the quantity should be a non-negative integer
**Validates: Requirements 3.15**

Property 34: Title quality warnings
*For any* product title missing brand name, color, size, or material, or containing all uppercase or excessive punctuation, the system should flag it as a warning
**Validates: Requirements 3.16, 3.17**

Property 35: Bullet point quality warnings
*For any* bullet point shorter than 15 characters, the system should flag it as a warning
**Validates: Requirements 3.18**

Property 36: Bullet point HTML rejection
*For any* bullet point containing HTML tags, the system should flag it as an error
**Validates: Requirements 3.19**

Property 37: Description quality warnings
*For any* product description shorter than 100 characters, the system should flag it as a warning
**Validates: Requirements 3.20**

Property 38: Price reasonableness warnings
*For any* product with price of zero or exceeding configured thresholds, the system should flag it as a warning
**Validates: Requirements 3.21**

Property 39: Barcode uniqueness
*For any* file, if a UPC or EAN appears multiple times, the system should flag it as an error
**Validates: Requirements 3.22**

### Enrichment Properties

Property 40: Title generation pattern
*For any* product with incomplete title, the system should generate a suggestion following the pattern: [Brand] [Department] [Product Type] [Key Feature] [Color] [Size]
**Validates: Requirements 4.1**

Property 41: Color mapping suggestions
*For any* product with color_name, the system should suggest the corresponding color_map value from the lookup table
**Validates: Requirements 3.24, 4.2**

Property 42: Size mapping suggestions
*For any* product with size_name, the system should suggest the corresponding size_map value from the lookup table
**Validates: Requirements 3.25, 4.3**

Property 43: Department inference
*For any* product with attributes indicating a specific department, the system should suggest the appropriate department_name
**Validates: Requirements 4.4**

Property 44: Item type inference
*For any* product with clothing_type and attributes, the system should suggest appropriate item_type keywords
**Validates: Requirements 4.5**

Property 45: Optional field suggestions
*For any* product missing recommended optional fields, the system should flag them as info-level suggestions
**Validates: Requirements 4.6**

Property 46: Auto-fix availability
*For any* product with whitespace or formatting issues, the system should provide a one-click fix option
**Validates: Requirements 4.7**

Property 47: Enrichment tracking
*For any* applied enrichment suggestion, the system should update the field value and track the before/after change
**Validates: Requirements 4.8**

### Review Interface Properties

Property 48: Health score calculation
*For any* completed validation, the health score should equal (pass_count / total_rows) × 100
**Validates: Requirements 5.1**

Property 49: Validation summary accuracy
*For any* completed validation, the summary counts (total, errors, warnings, passing) should match the actual row statuses
**Validates: Requirements 5.2**

Property 50: Issue categorization
*For any* validation issue, it should be categorized as Error, Warning, or Info based on severity
**Validates: Requirements 5.3**

Property 51: Inline edit re-validation
*For any* inline cell edit, the system should update the value and re-validate the affected row
**Validates: Requirements 5.7**

Property 52: Bulk edit application
*For any* bulk edit operation on selected rows, the system should update the specified field across all selected rows
**Validates: Requirements 5.8**

Property 53: Auto-fix correction
*For any* auto-fix operation, the system should automatically correct all deterministic issues (whitespace, check digits, standard mappings)
**Validates: Requirements 5.9**

Property 54: Warning dismissal audit
*For any* dismissed warning, the system should record the dismissal in the audit trail
**Validates: Requirements 5.10**

Property 55: Change tracking
*For any* user-made change, the system should track before and after values for audit purposes
**Validates: Requirements 5.11**

### Export Properties

Property 56: Amazon flat file format
*For any* Amazon flat file export, the output should be a tab-delimited .txt file with required header rows
**Validates: Requirements 6.1, 6.2**

Property 57: Export row filtering
*For any* Amazon flat file export, only rows passing all error-level validations should be included
**Validates: Requirements 6.3**

Property 58: Export exclusion warnings
*For any* export with rows excluded due to errors, the system should warn the user and provide a summary
**Validates: Requirements 6.4**

Property 59: Validation report structure
*For any* validation report export, the Excel file should contain separate sheets for Summary, Errors, Warnings, and Info
**Validates: Requirements 6.5**

Property 60: Validation report content
*For any* validation report export, it should include original values, flagged issues, and applied fixes
**Validates: Requirements 6.6**

Property 61: Upload history accuracy
*For any* upload in history, the display should show correct timestamp, filename, user, row count, and pass/fail counts
**Validates: Requirements 6.7**

Property 62: Export file retrieval
*For any* previous upload, the system should allow re-downloading of the exported files with matching content
**Validates: Requirements 6.8**

### Admin Configuration Properties

Property 63: Validation rule display
*For any* validation rule, the admin interface should display its field, type, severity, and active status
**Validates: Requirements 7.1**

Property 64: Rule toggle effect
*For any* disabled validation rule, it should be excluded from subsequent validation runs
**Validates: Requirements 7.2**

Property 65: Threshold update application
*For any* adjusted validation threshold, the new threshold should be applied to subsequent validations
**Validates: Requirements 7.3**

Property 66: Custom rule creation
*For any* custom validation rule creation, the system should allow specifying field, operator, value, and severity
**Validates: Requirements 7.4**

Property 67: Lookup table CRUD
*For any* lookup table entry, admins should be able to add, edit, and delete entries for color, size, department, and item type mappings
**Validates: Requirements 7.5**

Property 68: Lookup table import validation
*For any* CSV lookup table import, the system should validate entries before saving
**Validates: Requirements 7.6**

Property 69: Lookup table export round-trip
*For any* lookup table, exporting to CSV then importing should preserve all entries
**Validates: Requirements 7.7**

Property 70: Brand configuration persistence
*For any* brand configuration, the system should store Amazon brand name, default manufacturer, and default fulfillment channel
**Validates: Requirements 7.8**

Property 71: Audit log completeness
*For any* user action (authentication, upload, export, edit, admin action), it should appear in the audit log with timestamp, user, action type, and details
**Validates: Requirements 7.9, 8.10**

Property 72: Audit log filtering
*For any* audit log query with filters (user, action type, date range), the results should match the filter criteria
**Validates: Requirements 7.10**

### System Integrity Properties

Property 73: Concurrent upload independence
*For any* set of concurrent file uploads by different users, each should be processed independently without conflicts
**Validates: Requirements 8.5**

Property 74: Unique file storage
*For any* uploaded files with identical names, the system should use unique identifiers to prevent collisions
**Validates: Requirements 8.6**

Property 75: Cascade deletion
*For any* deleted upload, all associated rows and validation results should be removed from the database
**Validates: Requirements 8.7**

Property 76: Transaction rollback
*For any* failed database transaction, all changes should be rolled back and an error returned
**Validates: Requirements 8.8**

Property 77: Validation immutability
*For any* validation rule update, previously completed validations should remain unchanged
**Validates: Requirements 8.9**


## Error Handling

### Error Categories

1. **Authentication Errors (401)**
   - Invalid credentials
   - Expired JWT token
   - Missing authentication token
   - Account locked due to failed attempts

2. **Authorization Errors (403)**
   - Insufficient permissions for resource
   - Standard user accessing admin endpoint
   - Deactivated account attempting access

3. **Validation Errors (400)**
   - Invalid file format or size
   - Missing required fields in request
   - Invalid data types or formats
   - Constraint violations (duplicate email, etc.)

4. **Not Found Errors (404)**
   - Upload ID not found
   - User ID not found
   - Mapping template not found
   - Validation rule not found

5. **Server Errors (500)**
   - Database connection failures
   - File system errors
   - Unexpected exceptions
   - Transaction rollback failures

### Error Response Format

All API errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "File size exceeds maximum allowed size of 50 MB",
    "details": {
      "field": "file",
      "maxSize": 52428800,
      "actualSize": 67108864
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Handling Strategies

1. **File Upload Errors**
   - Validate file size before processing
   - Catch parsing errors and return descriptive messages
   - Handle encoding detection failures gracefully
   - Clean up temporary files on error

2. **Validation Errors**
   - Catch rule execution errors and log them
   - Continue validation even if individual rules fail
   - Provide partial results when possible
   - Flag problematic rules for admin review

3. **Database Errors**
   - Use transactions for multi-step operations
   - Implement retry logic for transient failures
   - Log all database errors with context
   - Return user-friendly messages without exposing internals

4. **External Service Errors**
   - Handle email service failures gracefully
   - Queue password reset emails for retry
   - Provide fallback mechanisms where possible

5. **Concurrent Access Errors**
   - Use optimistic locking for row updates
   - Handle version conflicts gracefully
   - Provide clear conflict resolution messages

## Testing Strategy

### Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Unit Testing

Unit tests focus on:
- Specific examples that demonstrate correct behavior
- Integration points between components
- Edge cases and error conditions
- Mock external dependencies (email service, file system)

Example unit test cases:
- Login with specific valid credentials returns expected JWT
- Account locks after exactly 5 failed attempts
- CSV with comma delimiter parses correctly
- UPC check digit validation for known valid/invalid codes
- Parent-child validation with specific test data
- Export generates correct Amazon header rows

### Property-Based Testing

Property tests focus on:
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Invariants that should never be violated

Configuration:
- Minimum 100 iterations per property test (due to randomization)
- Each property test references its design document property
- Tag format: **Feature: amazon-product-enrichment, Property {number}: {property_text}**

Example property test cases:
- For any valid credentials, login returns a JWT with correct structure
- For any CSV file with valid delimiter, parsing succeeds
- For any product row, validation categorizes issues by severity
- For any UPC/EAN, check digit validation is mathematically correct
- For any parent-child set, referential integrity is maintained
- For any export, only passing rows are included

### Testing Libraries

- **Backend Unit Tests**: Vitest with supertest for API testing
- **Backend Property Tests**: fast-check for property-based testing
- **Frontend Unit Tests**: Vitest with React Testing Library
- **Frontend Property Tests**: fast-check for component property testing
- **E2E Tests**: Playwright for critical user flows
- **Database Tests**: In-memory PostgreSQL or test containers

### Test Coverage Goals

- Unit test coverage: ≥ 80% for business logic
- Property test coverage: All 77 correctness properties implemented
- E2E test coverage: All critical user flows (login → upload → validate → export)
- Integration test coverage: All API endpoints

### Critical User Flows for E2E Testing

1. **Standard User Flow**
   - Login → Upload CSV → Map columns → Validate → Review results → Apply fixes → Export Amazon file

2. **Admin User Flow**
   - Login → Create user → Configure validation rule → Manage lookup table → View audit log

3. **Error Recovery Flow**
   - Login → Upload invalid file → See error → Upload valid file → Continue workflow

### Continuous Integration

- Run all unit tests on every commit
- Run property tests on every pull request
- Run E2E tests before deployment
- Generate coverage reports and enforce thresholds
- Fail builds on test failures or coverage drops
