# Product Spec: BCI Brands Amazon Product Data Enrichment Tool

## Overview

A web-based application that enables BCI Brands users to upload product data exports (CSV/Excel) from the Exenta ERP system, validate and enrich the data against Amazon Seller Central's listing requirements, and export Amazon-ready flat files for import. The application sits behind authentication with role-based access (standard user and admin).

---

## Problem Statement

BCI Brands (operating CECE and Vince Camuto apparel lines) needs to list products on Amazon Seller Central. Product data exported from the Exenta ERP is structured for internal wholesale operations and does not map cleanly to Amazon's Clothing flat file template. Manual data enrichment is error-prone, time-consuming, and results in rejected imports. This tool automates validation, mapping, and enrichment to produce submission-ready files.

---

## User Personas

### Standard User
- **Role**: Merchandising, e-commerce, or operations team member
- **Goal**: Upload ERP exports, review validation results, fix flagged issues, and download Amazon-ready files
- **Access**: Upload, validate, view history, export

### Admin User
- **Role**: IT administrator or e-commerce manager
- **Goal**: Manage users, configure validation rules, manage field mappings, view audit logs
- **Access**: All standard user capabilities + user management, rule configuration, system settings

---

## Requirements

### REQ-1: Authentication & Authorization

#### REQ-1.1: Login System
- Users must authenticate with email and password before accessing any application features
- Support secure password hashing (bcrypt)
- Implement JWT-based session management with configurable token expiration
- Provide "Forgot Password" flow with email-based reset link
- Lock accounts after 5 consecutive failed login attempts (configurable by admin)

#### REQ-1.2: Role-Based Access Control
- Two roles: `user` and `admin`
- Standard users can: upload files, run validations, view their own upload history, export results
- Admin users can: all standard user actions + manage users (create, edit, deactivate), configure validation rules, manage field mappings, view all users' upload history, access audit logs

#### REQ-1.3: User Management (Admin Only)
- Admin can create new user accounts with name, email, role assignment
- Admin can deactivate (soft delete) user accounts
- Admin can reset another user's password
- Admin can promote/demote users between `user` and `admin` roles
- Display user list with status, role, last login, and upload count

---

### REQ-2: File Upload & Parsing

#### REQ-2.1: Supported File Formats
- Accept `.csv`, `.xlsx`, and `.xls` file uploads
- Maximum file size: 50 MB
- Drag-and-drop upload zone with click-to-browse fallback

#### REQ-2.2: File Parsing
- Auto-detect delimiter for CSV files (comma, tab, pipe)
- Handle multi-sheet Excel files — prompt user to select the target sheet
- Parse header row and display column preview (first 10 rows) before processing
- Detect and handle common encoding issues (UTF-8, Latin-1, Windows-1252)

#### REQ-2.3: Column Mapping
- Present detected columns from the uploaded file alongside expected Amazon Clothing flat file fields
- Auto-map columns where names match or are similar (fuzzy matching)
- Allow manual drag-and-drop or dropdown column mapping for unmatched fields
- Save column mapping templates per user for reuse on future uploads
- Admin can set default mapping templates for the organization

---

### REQ-3: Amazon Clothing Flat File Validation

#### REQ-3.1: Required Field Validation
Validate that the following Amazon-required fields are present and populated for every row:

| Amazon Field | Description | Validation |
|---|---|---|
| `item_sku` | Unique product identifier | Non-empty, unique within file |
| `item_name` | Product title | Non-empty, ≤ 200 characters, no prohibited characters |
| `external_product_id` | UPC/EAN barcode | Valid UPC (12 digits) or EAN (13 digits) with check digit validation |
| `external_product_id_type` | Barcode type | Must be `UPC` or `EAN` |
| `brand_name` | Brand | Must match BCI brand names (CECE, Vince Camuto, etc.) |
| `manufacturer` | Manufacturer name | Non-empty |
| `department_name` | Target department | Must be valid Amazon department value |
| `product_description` | Product description | Non-empty, ≤ 2000 characters, no HTML tags |
| `bullet_point1` through `bullet_point5` | Key product features | At least `bullet_point1` required, each ≤ 500 characters |
| `item_type` | Amazon item type keyword | Must match Amazon's valid item type keywords for Clothing |
| `clothing_type` | Clothing category | Must be valid Amazon clothing type |
| `color_name` | Product color | Non-empty |
| `color_map` | Amazon color map value | Must match Amazon's predefined color map values |
| `size_name` | Product size | Non-empty |
| `size_map` | Amazon size map value | Must match Amazon's predefined size map values |
| `material_type` | Fabric/material composition | Non-empty |
| `main_image_url` | Primary product image URL | Valid URL, must be accessible, recommended ≥ 1000px on longest side |
| `parent_child` | Relationship type | Must be `Parent`, `Child`, or empty |
| `parent_sku` | Parent SKU for child items | Required when `parent_child` = `Child` |
| `relationship_type` | Variation type | Required for parent/child, typically `Variation` |
| `variation_theme` | Variation axis | Required for variations (e.g., `SizeColor`, `Size`, `Color`) |
| `standard_price` | Selling price | Numeric, > 0 |
| `quantity` | Available inventory | Non-negative integer |
| `fulfillment_channel` | FBA or MFN | Must be valid Amazon fulfillment value |

#### REQ-3.2: Data Quality Validations
- **Title Optimization**: Flag titles missing brand name, color, size, or material; flag titles with ALL CAPS or excessive punctuation
- **Bullet Point Quality**: Flag bullet points that are too short (< 15 characters), contain HTML, or repeat content from other bullets
- **Description Quality**: Flag descriptions shorter than 100 characters; flag HTML or special character issues
- **Image URL Validation**: Verify URLs are well-formed; optionally check HTTP response status for accessibility
- **Price Reasonableness**: Flag prices of $0, prices above a configurable threshold, and prices below a configurable floor
- **Barcode Validation**: Validate UPC/EAN check digits mathematically; flag duplicates within file
- **Parent-Child Consistency**: Validate that child SKUs reference existing parent SKUs within the file; validate variation themes match across parent/children
- **Size/Color Mapping**: Flag unmapped or non-standard size/color values against Amazon's accepted value lists

#### REQ-3.3: Enrichment Suggestions
- Auto-generate title suggestions using pattern: `[Brand] [Department] [Product Type] [Key Feature] [Color] [Size]`
- Suggest `color_map` values based on `color_name` using a lookup table (admin-configurable)
- Suggest `size_map` values based on `size_name` using a lookup table (admin-configurable)
- Suggest `department_name` based on detected product attributes
- Suggest `item_type` keywords based on `clothing_type` and product attributes
- Flag missing recommended (non-required) fields like `style_name`, `lifestyle`, `target_audience_keywords`

---

### REQ-4: Validation Results & Review Interface

#### REQ-4.1: Validation Dashboard
- Display overall file health score (percentage of rows passing all validations)
- Show summary counts: total rows, rows with errors, rows with warnings, rows passing
- Categorize issues by severity: **Error** (will cause Amazon rejection), **Warning** (may impact listing quality), **Info** (optimization suggestion)
- Allow filtering results by: severity level, specific field, specific validation rule

#### REQ-4.2: Row-Level Review
- Spreadsheet-style grid view of all product data
- Color-coded cells: red for errors, yellow for warnings, green for passing
- Click on a flagged cell to view the specific validation message and suggested fix
- Inline editing: allow users to fix values directly in the grid
- Bulk edit: select multiple rows and apply a value change to a specific field

#### REQ-4.3: Enrichment Actions
- "Auto-Fix" button for issues with deterministic solutions (e.g., trim whitespace, fix check digit, map standard color values)
- "Apply Suggestion" for AI-generated enrichment recommendations
- "Ignore" to dismiss a warning for a specific row (with audit trail)
- Track all changes with before/after values

---

### REQ-5: Export

#### REQ-5.1: Amazon Flat File Export
- Export validated and enriched data as Amazon Clothing flat file format (tab-delimited `.txt`)
- Include Amazon's required header rows (template type, version)
- Only include rows that pass all error-level validations (warn on excluded rows)
- Option to export all rows with an error summary sheet attached

#### REQ-5.2: Validation Report Export
- Export validation report as `.xlsx` with separate sheets for: Summary, Errors, Warnings, Info
- Include original values, flagged issues, and applied fixes

#### REQ-5.3: Upload History
- Store all uploads with: timestamp, filename, user, row count, pass/fail counts
- Allow re-downloading of any previous export
- Retain upload history for 90 days (configurable by admin)

---

### REQ-6: Admin Configuration

#### REQ-6.1: Validation Rule Management
- Admin can enable/disable individual validation rules
- Admin can adjust thresholds (e.g., minimum description length, price floor/ceiling)
- Admin can add custom validation rules via a rule builder (field, operator, value, severity)

#### REQ-6.2: Lookup Table Management
- Admin can manage color mapping tables (ERP color → Amazon `color_map` value)
- Admin can manage size mapping tables (ERP size → Amazon `size_map` value)
- Admin can manage department mapping tables
- Admin can manage item type keyword mappings
- Import/export lookup tables as CSV

#### REQ-6.3: Brand Configuration
- Admin can configure allowed brand names and their Amazon-specific formatting
- Admin can set default values per brand (e.g., default manufacturer, default fulfillment channel)

#### REQ-6.4: Audit Log
- Log all user actions: login, upload, export, edit, admin changes
- Display filterable audit log (by user, action type, date range)
- Admin-only access

---

## Design Document

### Architecture

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

### Tech Stack

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

### Database Schema

```sql
-- Users
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

-- Uploads
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

-- Upload Rows (stores parsed + enriched product data per row)
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

-- Column Mapping Templates
CREATE TABLE mapping_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    name            VARCHAR(255) NOT NULL,
    is_default      BOOLEAN DEFAULT false,
    mappings        JSONB NOT NULL,          -- {source_column: amazon_field, ...}
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Validation Rules (admin-configurable)
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

-- Lookup Tables (color maps, size maps, department maps, etc.)
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

-- Brand Configuration
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

-- Audit Log
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

### API Endpoints

```
Authentication
  POST   /api/auth/login              - Login with email/password → JWT
  POST   /api/auth/logout             - Invalidate session
  POST   /api/auth/forgot-password    - Request password reset email
  POST   /api/auth/reset-password     - Reset password with token

Users (Admin only except GET /me)
  GET    /api/users/me                - Get current user profile
  GET    /api/users                   - List all users
  POST   /api/users                   - Create new user
  PUT    /api/users/:id               - Update user (role, status)
  POST   /api/users/:id/reset-password - Admin reset user's password

Uploads
  POST   /api/uploads                 - Upload CSV/Excel file
  GET    /api/uploads                 - List user's upload history (admin: all)
  GET    /api/uploads/:id             - Get upload details + summary stats
  GET    /api/uploads/:id/rows        - Get paginated row data with validation
  PUT    /api/uploads/:id/rows/:rowId - Update a row's enriched data
  POST   /api/uploads/:id/bulk-edit   - Bulk update rows
  POST   /api/uploads/:id/auto-fix    - Apply auto-fix to all fixable issues
  DELETE /api/uploads/:id             - Delete upload and associated data

Column Mapping
  GET    /api/mappings                - List saved mapping templates
  POST   /api/mappings                - Save new mapping template
  PUT    /api/mappings/:id            - Update mapping template
  DELETE /api/mappings/:id            - Delete mapping template
  POST   /api/uploads/:id/apply-mapping - Apply mapping template to upload

Validation
  POST   /api/uploads/:id/validate    - Run validation on upload
  GET    /api/uploads/:id/report      - Get validation report

Export
  POST   /api/uploads/:id/export/amazon   - Export Amazon flat file (.txt)
  POST   /api/uploads/:id/export/report   - Export validation report (.xlsx)

Admin: Validation Rules
  GET    /api/admin/rules             - List all validation rules
  POST   /api/admin/rules             - Create validation rule
  PUT    /api/admin/rules/:id         - Update validation rule
  DELETE /api/admin/rules/:id         - Delete validation rule

Admin: Lookup Tables
  GET    /api/admin/lookups/:type     - Get lookup table by type
  POST   /api/admin/lookups           - Add lookup entry
  PUT    /api/admin/lookups/:id       - Update lookup entry
  DELETE /api/admin/lookups/:id       - Delete lookup entry
  POST   /api/admin/lookups/import    - Import lookup table from CSV
  GET    /api/admin/lookups/export/:type - Export lookup table as CSV

Admin: Brand Config
  GET    /api/admin/brands            - List brand configurations
  POST   /api/admin/brands            - Create brand config
  PUT    /api/admin/brands/:id        - Update brand config

Admin: Audit Log
  GET    /api/admin/audit             - Query audit log (filterable)
```

### Frontend Route Structure

```
/login                    - Login page
/forgot-password          - Password reset request
/reset-password/:token    - Password reset form

/dashboard                - Upload history + quick actions (protected)
/upload                   - File upload + column mapping (protected)
/upload/:id/review        - Validation results grid view (protected)
/upload/:id/export        - Export options (protected)

/admin                    - Admin dashboard (admin only)
/admin/users              - User management (admin only)
/admin/rules              - Validation rule config (admin only)
/admin/lookups            - Lookup table management (admin only)
/admin/brands             - Brand configuration (admin only)
/admin/audit              - Audit log viewer (admin only)
```

### Validation Engine Design

The validation engine processes rows through a pipeline of rule evaluators:

```
Input Row → Field Mapping → Rule Pipeline → Result Aggregation → Output

Rule Pipeline:
  1. Required Field Check     → Error if missing required fields
  2. Format Validation        → Error if wrong format (UPC, URL, etc.)
  3. Length Validation         → Error/Warning if exceeding limits
  4. Value Validation         → Error if invalid enum values
  5. Cross-Field Validation   → Error if parent/child inconsistency
  6. Lookup Enrichment        → Auto-map using lookup tables
  7. Quality Scoring          → Warning/Info for optimization opportunities
  8. Title Generation         → Info with suggested title format
```

Rules are stored in the database and loaded at validation time, allowing admins to modify behavior without code changes.

---

## Tasks

### Phase 1: Foundation (Sprint 1-2)

- [ ] **TASK-1.1**: Project scaffolding — Initialize monorepo with React frontend (Vite + TypeScript) and Express backend (TypeScript), configure ESLint, Prettier, and Tailwind CSS
- [ ] **TASK-1.2**: Database setup — Create PostgreSQL schema with Prisma, write seed scripts for default validation rules, lookup tables, and initial admin user
- [ ] **TASK-1.3**: Authentication system — Implement JWT auth with login, logout, password reset, account lockout, and middleware for route protection
- [ ] **TASK-1.4**: User management API — Build CRUD endpoints for admin user management with role assignment
- [ ] **TASK-1.5**: Frontend auth flow — Build login page, protected route wrapper, auth context, and user session management

### Phase 2: Core Upload & Parsing (Sprint 3-4)

- [ ] **TASK-2.1**: File upload endpoint — Handle multipart upload for CSV/XLSX/XLS with size validation and storage
- [ ] **TASK-2.2**: File parsing service — Implement CSV parsing (Papa Parse) and Excel parsing (SheetJS) with encoding detection and multi-sheet handling
- [ ] **TASK-2.3**: Column mapping engine — Build fuzzy matching auto-mapper and mapping template CRUD
- [ ] **TASK-2.4**: Upload UI — Build drag-and-drop upload component, file preview, sheet selector, and column mapping interface
- [ ] **TASK-2.5**: Upload history — Build upload list view with status, stats, and re-download capability

### Phase 3: Validation Engine (Sprint 5-7)

- [ ] **TASK-3.1**: Validation rule engine — Build configurable rule pipeline that loads rules from DB and processes rows
- [ ] **TASK-3.2**: Required field validators — Implement all required field presence and format checks per REQ-3.1
- [ ] **TASK-3.3**: UPC/EAN validator — Implement check digit validation for UPC-A (12 digit) and EAN-13
- [ ] **TASK-3.4**: Parent-child validator — Validate variation relationships, theme consistency, and parent SKU references
- [ ] **TASK-3.5**: Quality scoring validators — Implement title, bullet point, and description quality analysis per REQ-3.2
- [ ] **TASK-3.6**: Lookup-based enrichment — Auto-map color, size, department, and item type using lookup tables
- [ ] **TASK-3.7**: Title suggestion generator — Build title template engine: `[Brand] [Department] [Type] [Feature] [Color] [Size]`

### Phase 4: Review Interface (Sprint 8-9)

- [ ] **TASK-4.1**: Validation dashboard — Build summary view with health score, severity counts, and filter controls
- [ ] **TASK-4.2**: Data grid component — Implement AG Grid with color-coded cells, cell click detail popover, and pagination
- [ ] **TASK-4.3**: Inline editing — Enable direct cell editing in grid with change tracking (before/after)
- [ ] **TASK-4.4**: Bulk edit — Build multi-row selection with bulk field update capability
- [ ] **TASK-4.5**: Auto-fix & suggestions — Implement one-click auto-fix for deterministic issues and "Apply Suggestion" for enrichment recommendations

### Phase 5: Export (Sprint 10)

- [ ] **TASK-5.1**: Amazon flat file export — Generate tab-delimited `.txt` with correct Amazon header rows, filtered to passing rows only
- [ ] **TASK-5.2**: Validation report export — Generate `.xlsx` report with Summary, Errors, Warnings, and Info sheets
- [ ] **TASK-5.3**: Export UI — Build export page with format selection, row filtering options, and download

### Phase 6: Admin Panel (Sprint 11-12)

- [ ] **TASK-6.1**: Admin dashboard — Build admin landing page with system stats and quick links
- [ ] **TASK-6.2**: User management UI — Build user list, create/edit forms, role toggle, and account actions
- [ ] **TASK-6.3**: Validation rule manager — Build rule list, create/edit forms with field/operator/value builder
- [ ] **TASK-6.4**: Lookup table manager — Build CRUD interface for color, size, department, and item type mappings with CSV import/export
- [ ] **TASK-6.5**: Brand configuration UI — Build brand list with default value management
- [ ] **TASK-6.6**: Audit log viewer — Build filterable, paginated audit log display

### Phase 7: Polish & Deployment (Sprint 13)

- [ ] **TASK-7.1**: Error handling & loading states — Implement consistent error boundaries, toast notifications, and skeleton loaders
- [ ] **TASK-7.2**: Responsive design pass — Ensure usability on tablet and desktop viewports
- [ ] **TASK-7.3**: End-to-end tests — Write Playwright tests for critical flows: login → upload → validate → export
- [ ] **TASK-7.4**: Deployment configuration — Docker Compose setup for production (frontend, backend, PostgreSQL, Nginx reverse proxy)
- [ ] **TASK-7.5**: Documentation — API docs (Swagger/OpenAPI), user guide, admin guide

---

## Amazon Clothing Flat File Reference

### Template Details
- **Template Type**: `Clothing`
- **Version**: `2014.0703` (verify current version on Seller Central)
- **File Format**: Tab-delimited text (`.txt`)
- **Encoding**: UTF-8
- **Header Rows**: Row 1 = `TemplateType=Clothing`, Row 2 = `Version=...`, Row 3 = field names

### Key Amazon Value Lists (Seed Data)

**Color Map Values** (partial — full list in Amazon documentation):
`Beige, Black, Blue, Brown, Gold, Green, Grey, Ivory, Metallic, Multi-Colored, Off-White, Orange, Pink, Purple, Red, Silver, Tan, White, Yellow`

**Size Map Values** (Women's apparel, partial):
`XX-Small, X-Small, Small, Medium, Large, X-Large, XX-Large, 3X-Large, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, One Size`

**Department Values**:
`womens, mens, girls, boys, baby-girls, baby-boys, unisex-adult, unisex-baby`

**Variation Themes**:
`Size, Color, SizeColor, ColorName-SizeName`

---

## Out of Scope (v1)

- Direct Amazon Seller Central API integration (SP-API) for automated listing push
- AI-generated product descriptions or bullet points (future enhancement)
- Image analysis or validation of actual image content
- Multi-marketplace support (Amazon.ca, Amazon.uk, etc.)
- Real-time inventory sync with Exenta ERP
- Multi-language listing support
- A/B testing for listing optimization

---

## Future Enhancements (v2+)

- **Amazon SP-API Integration**: Direct product listing push to Seller Central
- **AI Content Generation**: Use LLM to generate optimized titles, bullet points, and descriptions from ERP data
- **Image Compliance Checker**: Validate image dimensions, background color, and content against Amazon image requirements
- **Listing Performance Dashboard**: Pull Amazon sales/traffic data to correlate with listing quality scores
- **Multi-Marketplace**: Support Amazon international marketplaces with locale-specific requirements
