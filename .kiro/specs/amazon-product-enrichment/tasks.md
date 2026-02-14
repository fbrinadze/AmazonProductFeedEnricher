# Implementation Plan: Amazon Product Data Enrichment Tool

## Overview

This implementation plan breaks down the Amazon Product Data Enrichment Tool into discrete coding tasks following a phased approach. The system uses Node.js/Express/TypeScript for the backend, React/TypeScript for the frontend, PostgreSQL for the database, and includes comprehensive property-based testing using fast-check. Each phase builds incrementally, with testing tasks integrated throughout to catch errors early.

## Technology Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL 16 with Prisma ORM
- **Authentication**: JWT + bcrypt
- **File Parsing**: Papa Parse (CSV), SheetJS (Excel)
- **Data Grid**: AG Grid Community
- **Testing**: Vitest (unit), fast-check (property), Playwright (e2e)

## Tasks

### Phase 1: Project Setup and Database Foundation

- [x] 1. Initialize project structure and dependencies
  - Create monorepo structure with backend and frontend directories
  - Initialize Node.js/TypeScript projects for both backend and frontend
  - Install core dependencies: Express, Prisma, React, Tailwind CSS, shadcn/ui
  - Set up ESLint, Prettier, and TypeScript configurations
  - Create .env.example files for environment variables
  - _Requirements: All (foundation)_

- [ ] 2. Set up PostgreSQL database and Prisma schema
  - [ ] 2.1 Define Prisma schema for all database tables
    - Create schema for users, uploads, upload_rows, mapping_templates, validation_rules, lookup_tables, brand_config, audit_log
    - Define relationships and constraints
    - _Requirements: 1.1-1.10, 2.1-2.10, 6.7-6.9, 7.1-7.10, 8.1-8.10_

  - [ ] 2.2 Create initial database migration
    - Generate and run Prisma migration
    - Seed database with initial admin user and sample validation rules
    - _Requirements: 1.7, 7.1-7.4_

  - [ ]* 2.3 Write property test for database schema
    - **Property 75: Cascade deletion**
    - **Validates: Requirements 8.7**

### Phase 2: Authentication and Authorization

- [ ] 3. Implement authentication service
  - [ ] 3.1 Create AuthService with bcrypt password hashing
    - Implement hashPassword and comparePassword functions
    - Use bcrypt with work factor ≥ 10
    - _Requirements: 1.10, 8.1_

  - [ ]* 3.2 Write property test for password hashing
    - **Property 7: Passwords are hashed with bcrypt**
    - **Validates: Requirements 1.10, 8.1**

  - [ ] 3.3 Implement JWT token generation and verification
    - Create functions to sign and verify JWT tokens
    - Include user ID, role, and expiration in token payload
    - _Requirements: 1.1, 8.2_

  - [ ]* 3.4 Write property test for JWT token structure
    - **Property 1: Valid credentials produce JWT tokens**
    - **Validates: Requirements 1.1, 8.2**

  - [ ]* 3.5 Write property test for JWT expiration
    - **Property 10: JWT expiration requires re-authentication**
    - **Validates: Requirements 8.3**

- [ ] 4. Implement authentication API endpoints
  - [ ] 4.1 Create POST /api/auth/login endpoint
    - Validate credentials, check account status, handle failed login attempts
    - Return JWT token on success
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 4.2 Write property test for invalid credentials rejection
    - **Property 2: Invalid credentials are rejected**
    - **Validates: Requirements 1.2**

  - [ ] 4.3 Create POST /api/auth/logout endpoint
    - Invalidate session (if using token blacklist)
    - _Requirements: 1.1_

  - [ ] 4.4 Create POST /api/auth/forgot-password endpoint
    - Generate time-limited reset token
    - Send reset email (mock email service for now)
    - _Requirements: 1.4_

  - [ ]* 4.5 Write property test for password reset tokens
    - **Property 5: Password reset tokens are time-limited**
    - **Validates: Requirements 1.4**

  - [ ] 4.6 Create POST /api/auth/reset-password endpoint
    - Verify reset token and update password
    - _Requirements: 1.4_

- [ ] 5. Implement authorization middleware
  - [ ] 5.1 Create JWT verification middleware
    - Extract and verify JWT from Authorization header
    - Attach user to request object
    - _Requirements: 1.5_

  - [ ]* 5.2 Write property test for unauthenticated request rejection
    - **Property 3: Unauthenticated requests are rejected**
    - **Validates: Requirements 1.5**

  - [ ] 5.3 Create role-based authorization middleware
    - Check user role against required role for endpoint
    - _Requirements: 1.6_

  - [ ]* 5.4 Write property test for role-based authorization
    - **Property 4: Authorization is enforced by role**
    - **Validates: Requirements 1.6**

- [ ] 6. Implement user management API endpoints (admin)
  - [ ] 6.1 Create GET /api/users/me endpoint
    - Return current user profile
    - _Requirements: 1.1_

  - [ ] 6.2 Create GET /api/users and POST /api/users endpoints
    - List all users (admin only)
    - Create new user with email, full name, and role
    - _Requirements: 1.7_

  - [ ]* 6.3 Write property test for user creation validation
    - **Property 8: User creation requires all fields**
    - **Validates: Requirements 1.7**

  - [ ] 6.4 Create PUT /api/users/:id endpoint
    - Update user role and active status
    - _Requirements: 1.8_

  - [ ]* 6.5 Write property test for deactivated user login
    - **Property 6: Deactivated users cannot login**
    - **Validates: Requirements 1.8**

  - [ ] 6.6 Create POST /api/users/:id/reset-password endpoint
    - Admin-initiated password reset
    - Generate secure temporary password
    - _Requirements: 1.9_

  - [ ]* 6.7 Write property test for admin password reset
    - **Property 9: Admin password reset generates new credentials**
    - **Validates: Requirements 1.9**

- [ ] 7. Checkpoint - Authentication and authorization complete
  - Ensure all authentication tests pass, verify JWT flow works end-to-end

### Phase 3: File Upload and Parsing

- [ ] 8. Implement file upload infrastructure
  - [ ] 8.1 Create file upload endpoint with multer
    - Configure multer for file size limits (50 MB)
    - Accept CSV, XLSX, XLS formats
    - Store files with unique identifiers
    - _Requirements: 2.1, 8.6_

  - [ ]* 8.2 Write property test for file format and size validation
    - **Property 11: File format and size validation**
    - **Validates: Requirements 2.1**

  - [ ]* 8.3 Write property test for unique file storage
    - **Property 74: Unique file storage**
    - **Validates: Requirements 8.6**

- [ ] 9. Implement CSV parsing service
  - [ ] 9.1 Create CSV parser using Papa Parse
    - Implement delimiter auto-detection (comma, tab, pipe)
    - Handle UTF-8, Latin-1, Windows-1252 encodings
    - Return headers and rows
    - _Requirements: 2.2, 2.4_

  - [ ]* 9.2 Write property test for CSV delimiter detection
    - **Property 12: CSV delimiter auto-detection**
    - **Validates: Requirements 2.2**

  - [ ]* 9.3 Write property test for encoding detection
    - **Property 13: Encoding detection and handling**
    - **Validates: Requirements 2.4**

  - [ ]* 9.4 Write unit tests for CSV parsing edge cases
    - Test empty files, malformed CSV, special characters
    - _Requirements: 2.2, 2.4_

- [ ] 10. Implement Excel parsing service
  - [ ] 10.1 Create Excel parser using SheetJS
    - Extract sheet names for multi-sheet files
    - Parse selected sheet to headers and rows
    - _Requirements: 2.1, 2.3_

  - [ ]* 10.2 Write unit tests for Excel parsing
    - Test single-sheet and multi-sheet files
    - Test XLSX and XLS formats
    - _Requirements: 2.1, 2.3_

- [ ] 11. Implement file preview and column mapping
  - [ ] 11.1 Create POST /api/uploads endpoint
    - Upload file, parse it, create upload record
    - Return preview (headers + first 10 rows)
    - _Requirements: 2.5_

  - [ ]* 11.2 Write property test for file preview generation
    - **Property 14: File preview generation**
    - **Validates: Requirements 2.5**

  - [ ] 11.3 Implement column auto-mapping logic
    - Match source columns to Amazon fields by name similarity
    - _Requirements: 2.6_

  - [ ]* 11.4 Write property test for column auto-mapping
    - **Property 15: Column auto-mapping**
    - **Validates: Requirements 2.6**

- [ ] 12. Implement mapping template management
  - [ ] 12.1 Create mapping template CRUD endpoints
    - GET /api/mappings - List templates
    - POST /api/mappings - Save new template
    - PUT /api/mappings/:id - Update template
    - DELETE /api/mappings/:id - Delete template
    - _Requirements: 2.8_

  - [ ]* 12.2 Write property test for mapping template persistence
    - **Property 16: Mapping template persistence**
    - **Validates: Requirements 2.8**

  - [ ] 12.3 Create POST /api/uploads/:id/apply-mapping endpoint
    - Apply saved mapping template to upload
    - Support admin default templates
    - _Requirements: 2.9_

  - [ ]* 12.4 Write property test for default mapping application
    - **Property 17: Default mapping template application**
    - **Validates: Requirements 2.9**

  - [ ]* 12.5 Write property test for upload error messages
    - **Property 18: Upload error messages**
    - **Validates: Requirements 2.10**

- [ ] 13. Checkpoint - File upload and parsing complete
  - Ensure all file parsing tests pass, verify CSV and Excel uploads work

### Phase 4: Validation Engine Core

- [ ] 14. Implement validation rule engine
  - [ ] 14.1 Create ValidationEngine class
    - Load validation rules from database
    - Execute rules against upload rows
    - Categorize issues by severity (error, warning, info)
    - _Requirements: 3.1-3.25, 5.3_

  - [ ] 14.2 Implement required field validation
    - Check for non-empty values
    - _Requirements: 3.1, 3.2, 3.7, 3.8_

  - [ ]* 14.3 Write property test for SKU uniqueness
    - **Property 19: SKU uniqueness and presence**
    - **Validates: Requirements 3.1**

  - [ ]* 14.4 Write property test for title validation
    - **Property 20: Title validation**
    - **Validates: Requirements 3.2**

- [ ] 15. Implement barcode validation
  - [ ] 15.1 Create UPC/EAN check digit validator
    - Implement check digit algorithm for 12-digit UPC and 13-digit EAN
    - _Requirements: 3.3_

  - [ ]* 15.2 Write property test for UPC/EAN check digit
    - **Property 21: UPC/EAN check digit validation**
    - **Validates: Requirements 3.3**

  - [ ] 15.3 Implement barcode type validation
    - Verify external_product_id_type is 'UPC' or 'EAN'
    - _Requirements: 3.4_

  - [ ]* 15.4 Write property test for barcode type
    - **Property 22: Barcode type validation**
    - **Validates: Requirements 3.4**

  - [ ]* 15.5 Write property test for barcode uniqueness
    - **Property 39: Barcode uniqueness**
    - **Validates: Requirements 3.22**

- [ ] 16. Implement field-specific validations
  - [ ] 16.1 Create brand, department, and enum validators
    - Validate brand_name against configured brands
    - Validate department_name against Amazon values
    - Validate color_map and size_map against lookup tables
    - _Requirements: 3.5, 3.6, 3.9, 3.10_

  - [ ]* 16.2 Write property test for brand validation
    - **Property 23: Brand validation**
    - **Validates: Requirements 3.5**

  - [ ]* 16.3 Write property test for department validation
    - **Property 24: Department validation**
    - **Validates: Requirements 3.6**

  - [ ]* 16.4 Write property test for color map validation
    - **Property 27: Color map validation**
    - **Validates: Requirements 3.9**

  - [ ]* 16.5 Write property test for size map validation
    - **Property 28: Size map validation**
    - **Validates: Requirements 3.10**

- [ ] 17. Implement content validation
  - [ ] 17.1 Create description and bullet point validators
    - Check length limits (description ≤ 2000, bullets ≤ 500)
    - Check for HTML tags
    - Check minimum quality thresholds
    - _Requirements: 3.7, 3.8, 3.18, 3.19, 3.20_

  - [ ]* 17.2 Write property test for description validation
    - **Property 25: Description validation**
    - **Validates: Requirements 3.7**

  - [ ]* 17.3 Write property test for bullet point validation
    - **Property 26: Bullet point validation**
    - **Validates: Requirements 3.8**

  - [ ]* 17.4 Write property test for bullet point quality
    - **Property 35: Bullet point quality warnings**
    - **Validates: Requirements 3.18**

  - [ ]* 17.5 Write property test for bullet point HTML rejection
    - **Property 36: Bullet point HTML rejection**
    - **Validates: Requirements 3.19**

  - [ ]* 17.6 Write property test for description quality
    - **Property 37: Description quality warnings**
    - **Validates: Requirements 3.20**

- [ ] 18. Implement URL and numeric validations
  - [ ] 18.1 Create URL, price, and quantity validators
    - Validate main_image_url format
    - Validate standard_price is positive
    - Validate quantity is non-negative integer
    - _Requirements: 3.11, 3.14, 3.15, 3.21_

  - [ ]* 18.2 Write property test for image URL validation
    - **Property 29: Image URL validation**
    - **Validates: Requirements 3.11**

  - [ ]* 18.3 Write property test for price validation
    - **Property 32: Price validation**
    - **Validates: Requirements 3.14**

  - [ ]* 18.4 Write property test for quantity validation
    - **Property 33: Quantity validation**
    - **Validates: Requirements 3.15**

  - [ ]* 18.5 Write property test for price reasonableness
    - **Property 38: Price reasonableness warnings**
    - **Validates: Requirements 3.21**

- [ ] 19. Implement parent-child relationship validation
  - [ ] 19.1 Create parent-child validator
    - Verify child SKUs reference existing parent SKUs
    - Verify variation_theme consistency across parent-child sets
    - _Requirements: 3.12, 3.13, 3.23_

  - [ ]* 19.2 Write property test for parent-child referential integrity
    - **Property 30: Parent-child referential integrity**
    - **Validates: Requirements 3.12, 3.23**

  - [ ]* 19.3 Write property test for variation theme consistency
    - **Property 31: Variation theme consistency**
    - **Validates: Requirements 3.13**

- [ ] 20. Implement quality warning validators
  - [ ] 20.1 Create title quality checker
    - Flag titles missing brand, color, size, or material
    - Flag all-uppercase or excessive punctuation
    - _Requirements: 3.16, 3.17_

  - [ ]* 20.2 Write property test for title quality warnings
    - **Property 34: Title quality warnings**
    - **Validates: Requirements 3.16, 3.17**

- [ ] 21. Create validation API endpoint
  - [ ] 21.1 Create POST /api/uploads/:id/validate endpoint
    - Run validation engine on all rows
    - Store validation results in upload_rows table
    - Calculate and store summary statistics
    - _Requirements: 3.1-3.25_

  - [ ]* 21.2 Write property test for issue categorization
    - **Property 50: Issue categorization**
    - **Validates: Requirements 5.3**

- [ ] 22. Checkpoint - Validation engine core complete
  - Ensure all validation property tests pass, verify validation results are accurate

### Phase 5: Data Enrichment

- [ ] 23. Implement enrichment service
  - [ ] 23.1 Create title generation function
    - Generate titles using pattern: [Brand] [Department] [Product Type] [Key Feature] [Color] [Size]
    - _Requirements: 4.1_

  - [ ]* 23.2 Write property test for title generation
    - **Property 40: Title generation pattern**
    - **Validates: Requirements 4.1**

- [ ] 24. Implement lookup-based enrichment
  - [ ] 24.1 Create color and size mapping functions
    - Query lookup tables for color_name → color_map
    - Query lookup tables for size_name → size_map
    - Return suggestions for unmapped values
    - _Requirements: 3.24, 3.25, 4.2, 4.3_

  - [ ]* 24.2 Write property test for color mapping suggestions
    - **Property 41: Color mapping suggestions**
    - **Validates: Requirements 3.24, 4.2**

  - [ ]* 24.3 Write property test for size mapping suggestions
    - **Property 42: Size mapping suggestions**
    - **Validates: Requirements 3.25, 4.3**

- [ ] 25. Implement inference-based enrichment
  - [ ] 25.1 Create department and item type inference
    - Infer department_name from product attributes
    - Suggest item_type keywords from clothing_type
    - _Requirements: 4.4, 4.5_

  - [ ]* 25.2 Write property test for department inference
    - **Property 43: Department inference**
    - **Validates: Requirements 4.4**

  - [ ]* 25.3 Write property test for item type inference
    - **Property 44: Item type inference**
    - **Validates: Requirements 4.5**

- [ ] 26. Implement enrichment suggestions and auto-fix
  - [ ] 26.1 Create optional field suggestion system
    - Flag missing recommended optional fields as info-level
    - _Requirements: 4.6_

  - [ ]* 26.2 Write property test for optional field suggestions
    - **Property 45: Optional field suggestions**
    - **Validates: Requirements 4.6**

  - [ ] 26.3 Create auto-fix function
    - Implement fixes for whitespace, formatting, check digits, standard mappings
    - _Requirements: 4.7_

  - [ ] 26.4 Write property test for auto-fix availability
    - **Property 46: Auto-fix availability**
    - **Validates: Requirements 4.7**

  - [ ] 26.4 Implement enrichment tracking
    - Track before/after values when suggestions are applied
    - _Requirements: 4.8_

  - [ ] 26.5 Write property test for enrichment tracking
    - **Property 47: Enrichment tracking**
    - **Validates: Requirements 4.8**

- [ ] 27. Checkpoint - Data enrichment complete
  - Ensure all enrichment tests pass, verify suggestions are accurate

### Phase 6: Review Interface API

- [ ] 28. Implement validation results API
  - [ ] 28.1 Create GET /api/uploads/:id endpoint
    - Return upload details with summary statistics
    - Calculate health score: (pass_count / total_rows) × 100
    - _Requirements: 5.1, 5.2, 6.7_

  - [ ]* 28.2 Write property test for health score calculation
    - **Property 48: Health score calculation**
    - **Validates: Requirements 5.1**

  - [ ]* 28.3 Write property test for validation summary accuracy
    - **Property 49: Validation summary accuracy**
    - **Validates: Requirements 5.2**

  - [ ]* 28.4 Write property test for upload history accuracy
    - **Property 61: Upload history accuracy**
    - **Validates: Requirements 6.7**

- [ ] 29. Implement row data API with filtering
  - [ ] 29.1 Create GET /api/uploads/:id/rows endpoint
    - Return paginated row data with validation results
    - Support filtering by severity, field, and rule
    - _Requirements: 5.4_

  - [ ]* 29.2 Write unit tests for filtering logic
    - Test severity, field, and rule filters
    - _Requirements: 5.4_

- [ ] 30. Implement row editing API
  - [ ] 30.1 Create PUT /api/uploads/:id/rows/:rowId endpoint
    - Update enriched_data for a row
    - Re-validate the row after update
    - Track changes in audit log
    - _Requirements: 5.7, 5.11_

  - [ ]* 30.2 Write property test for inline edit re-validation
    - **Property 51: Inline edit re-validation**
    - **Validates: Requirements 5.7**

  - [ ]* 30.3 Write property test for change tracking
    - **Property 55: Change tracking**
    - **Validates: Requirements 5.11**

- [ ] 31. Implement bulk operations API
  - [ ] 31.1 Create POST /api/uploads/:id/bulk-edit endpoint
    - Apply field update to multiple selected rows
    - Re-validate affected rows
    - _Requirements: 5.8_

  - [ ]* 31.2 Write property test for bulk edit application
    - **Property 52: Bulk edit application**
    - **Validates: Requirements 5.8**

  - [ ] 31.3 Create POST /api/uploads/:id/auto-fix endpoint
    - Apply auto-fix to all fixable issues
    - Return summary of fixes applied
    - _Requirements: 5.9_

  - [ ]* 31.4 Write property test for auto-fix correction
    - **Property 53: Auto-fix correction**
    - **Validates: Requirements 5.9**

- [ ] 32. Implement warning dismissal
  - [ ] 32.1 Add warning dismissal to row update endpoint
    - Record dismissed warnings in audit log
    - _Requirements: 5.10_

  - [ ]* 32.2 Write property test for warning dismissal audit
    - **Property 54: Warning dismissal audit**
    - **Validates: Requirements 5.10**

- [ ] 33. Checkpoint - Review interface API complete
  - Ensure all review interface tests pass, verify row editing and bulk operations work

### Phase 7: Export Functionality

- [ ] 34. Implement Amazon flat file export
  - [ ] 34.1 Create ExportEngine class
    - Generate Amazon header rows (template type and version)
    - Filter rows to only include those passing error-level validations
    - Format as tab-delimited text
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 34.2 Write property test for Amazon flat file format
    - **Property 56: Amazon flat file format**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 34.3 Write property test for export row filtering
    - **Property 57: Export row filtering**
    - **Validates: Requirements 6.3**

- [ ] 35. Implement validation report export
  - [ ] 35.1 Create validation report generator
    - Generate Excel file with sheets: Summary, Errors, Warnings, Info
    - Include original values, flagged issues, and applied fixes
    - _Requirements: 6.5, 6.6_

  - [ ]* 35.2 Write property test for validation report structure
    - **Property 59: Validation report structure**
    - **Validates: Requirements 6.5**

  - [ ]* 35.3 Write property test for validation report content
    - **Property 60: Validation report content**
    - **Validates: Requirements 6.6**

- [ ] 36. Implement export API endpoints
  - [ ] 36.1 Create POST /api/uploads/:id/export/amazon endpoint
    - Generate Amazon flat file
    - Store export path in uploads table
    - Warn if rows are excluded due to errors
    - _Requirements: 6.1-6.4_

  - [ ]* 36.2 Write property test for export exclusion warnings
    - **Property 58: Export exclusion warnings**
    - **Validates: Requirements 6.4**

  - [ ] 36.3 Create POST /api/uploads/:id/export/report endpoint
    - Generate validation report Excel file
    - Store export path in uploads table
    - _Requirements: 6.5, 6.6_

- [ ] 37. Implement upload history and file retrieval
  - [ ] 37.1 Create GET /api/uploads endpoint
    - List user's upload history (admin sees all)
    - Include timestamp, filename, user, row count, pass/fail counts
    - _Requirements: 6.7_

  - [ ] 37.2 Add file download capability
    - Allow re-downloading of exported files
    - _Requirements: 6.8_

  - [ ]* 37.3 Write property test for export file retrieval
    - **Property 62: Export file retrieval**
    - **Validates: Requirements 6.8**

- [ ] 38. Checkpoint - Export functionality complete
  - Ensure all export tests pass, verify Amazon flat files and reports generate correctly

### Phase 8: Admin Configuration

- [ ] 39. Implement validation rule management
  - [ ] 39.1 Create validation rule CRUD endpoints
    - GET /api/admin/rules - List all rules
    - POST /api/admin/rules - Create rule
    - PUT /api/admin/rules/:id - Update rule
    - DELETE /api/admin/rules/:id - Delete rule
    - _Requirements: 7.1-7.4_

  - [ ]* 39.2 Write property test for validation rule display
    - **Property 63: Validation rule display**
    - **Validates: Requirements 7.1**

  - [ ]* 39.3 Write property test for rule toggle effect
    - **Property 64: Rule toggle effect**
    - **Validates: Requirements 7.2**

  - [ ]* 39.4 Write property test for threshold update
    - **Property 65: Threshold update application**
    - **Validates: Requirements 7.3**

  - [ ]* 39.5 Write property test for custom rule creation
    - **Property 66: Custom rule creation**
    - **Validates: Requirements 7.4**

  - [ ]* 39.6 Write property test for validation immutability
    - **Property 77: Validation immutability**
    - **Validates: Requirements 8.9**

- [ ] 40. Implement lookup table management
  - [ ] 40.1 Create lookup table CRUD endpoints
    - GET /api/admin/lookups/:type - Get lookup table
    - POST /api/admin/lookups - Add entry
    - PUT /api/admin/lookups/:id - Update entry
    - DELETE /api/admin/lookups/:id - Delete entry
    - _Requirements: 7.5_

  - [ ]* 40.2 Write property test for lookup table CRUD
    - **Property 67: Lookup table CRUD**
    - **Validates: Requirements 7.5**

  - [ ] 40.3 Create lookup table import/export endpoints
    - POST /api/admin/lookups/import - Import CSV
    - GET /api/admin/lookups/export/:type - Export CSV
    - _Requirements: 7.6, 7.7_

  - [ ]* 40.4 Write property test for lookup import validation
    - **Property 68: Lookup table import validation**
    - **Validates: Requirements 7.6**

  - [ ]* 40.5 Write property test for lookup export round-trip
    - **Property 69: Lookup table export round-trip**
    - **Validates: Requirements 7.7**

- [ ] 41. Implement brand configuration
  - [ ] 41.1 Create brand config CRUD endpoints
    - GET /api/admin/brands - List brands
    - POST /api/admin/brands - Create brand
    - PUT /api/admin/brands/:id - Update brand
    - _Requirements: 7.8_

  - [ ]* 41.2 Write property test for brand configuration persistence
    - **Property 70: Brand configuration persistence**
    - **Validates: Requirements 7.8**

- [ ] 42. Implement audit log
  - [ ] 42.1 Create audit logging middleware
    - Log all authentication attempts, uploads, exports, edits, admin actions
    - Store user ID, action type, entity type, entity ID, details, IP address
    - _Requirements: 7.9, 8.10_

  - [ ]* 42.2 Write property test for audit log completeness
    - **Property 71: Audit log completeness**
    - **Validates: Requirements 7.9, 8.10**

  - [ ] 42.3 Create GET /api/admin/audit endpoint
    - Query audit log with filters (user, action type, date range)
    - _Requirements: 7.10_

  - [ ]* 42.4 Write property test for audit log filtering
    - **Property 72: Audit log filtering**
    - **Validates: Requirements 7.10**

- [ ] 43. Checkpoint - Admin configuration complete
  - Ensure all admin tests pass, verify rule and lookup management works

### Phase 9: System Integrity and Performance

- [ ] 44. Implement transaction management
  - [ ] 44.1 Add transaction wrappers to critical operations
    - Wrap multi-step operations (upload + parse, validate + store results)
    - Implement rollback on failure
    - _Requirements: 8.8_

  - [ ]* 44.2 Write property test for transaction rollback
    - **Property 76: Transaction rollback**
    - **Validates: Requirements 8.8**

- [ ] 45. Implement concurrent upload handling
  - [ ] 45.1 Add concurrency safeguards
    - Ensure unique file identifiers prevent collisions
    - Test concurrent uploads don't interfere
    - _Requirements: 8.5, 8.6_

  - [ ]* 45.2 Write property test for concurrent upload independence
    - **Property 73: Concurrent upload independence**
    - **Validates: Requirements 8.5**

- [ ] 46. Implement upload deletion
  - [ ] 46.1 Create DELETE /api/uploads/:id endpoint
    - Cascade delete upload_rows and validation results
    - Delete associated files from storage
    - _Requirements: 8.7_

  - [ ]* 46.2 Write property test for cascade deletion (already done in Phase 1)
    - Verify this test covers the full deletion flow
    - _Requirements: 8.7_

- [ ] 47. Checkpoint - System integrity complete
  - Ensure all system integrity tests pass, verify transactions and concurrency work

### Phase 10: Frontend - Authentication UI

- [ ] 48. Set up React frontend project
  - [ ] 48.1 Initialize React app with TypeScript and Tailwind CSS
    - Set up Vite or Create React App
    - Configure Tailwind CSS and shadcn/ui
    - Set up React Router for navigation
    - _Requirements: All (foundation)_

  - [ ] 48.2 Create API client service
    - Implement axios-based API client with JWT token handling
    - Add request/response interceptors
    - _Requirements: 1.1, 1.5_

- [ ] 49. Implement authentication components
  - [ ] 49.1 Create AuthContext and authentication state management
    - Implement login, logout, token refresh logic
    - Store JWT in localStorage or httpOnly cookie
    - _Requirements: 1.1_

  - [ ] 49.2 Create LoginForm component
    - Email and password inputs with validation
    - Display error messages
    - Handle failed login attempts
    - _Requirements: 1.1, 1.2_

  - [ ] 49.3 Create ForgotPasswordForm component
    - Email input for password reset request
    - _Requirements: 1.4_

  - [ ] 49.4 Create ResetPasswordForm component
    - New password input with token validation
    - _Requirements: 1.4_

  - [ ] 49.5 Create ProtectedRoute component
    - Redirect unauthenticated users to login
    - Check user role for admin routes
    - _Requirements: 1.5, 1.6_

  - [ ]* 49.6 Write unit tests for authentication components
    - Test login flow, error handling, protected routes
    - _Requirements: 1.1-1.6_

- [ ] 50. Checkpoint - Frontend authentication complete
  - Ensure authentication UI works end-to-end with backend

### Phase 11: Frontend - Upload and Mapping UI

- [ ] 51. Implement file upload components
  - [ ] 51.1 Create FileUploadZone component
    - Drag-and-drop area with file type and size validation
    - Display upload progress
    - _Requirements: 2.1_

  - [ ] 51.2 Create SheetSelector component
    - Dropdown for multi-sheet Excel files
    - _Requirements: 2.3_

  - [ ] 51.3 Create UploadPreview component
    - Table showing headers and first 10 rows
    - _Requirements: 2.5_

  - [ ]* 51.4 Write unit tests for upload components
    - Test file validation, preview display
    - _Requirements: 2.1, 2.3, 2.5_

- [ ] 52. Implement column mapping components
  - [ ] 52.1 Create ColumnMapper component
    - Drag-and-drop or dropdown interface for mapping columns
    - Show auto-mapped columns
    - Allow manual adjustments
    - _Requirements: 2.6, 2.7_

  - [ ] 52.2 Create MappingTemplateSelector component
    - Dropdown to load saved templates
    - Button to save current mapping as template
    - _Requirements: 2.8_

  - [ ]* 52.3 Write unit tests for mapping components
    - Test auto-mapping, manual mapping, template loading
    - _Requirements: 2.6, 2.7, 2.8_

- [ ] 53. Checkpoint - Frontend upload UI complete
  - Ensure upload and mapping UI works end-to-end with backend

### Phase 12: Frontend - Review Interface

- [ ] 54. Implement validation dashboard
  - [ ] 54.1 Create ValidationDashboard component
    - Display health score, error/warning/pass counts
    - Show summary cards
    - _Requirements: 5.1, 5.2_

  - [ ] 54.2 Create ValidationFilters component
    - Dropdowns for severity, field, and rule filters
    - _Requirements: 5.4_

  - [ ]* 54.3 Write unit tests for dashboard components
    - Test summary calculations, filter application
    - _Requirements: 5.1, 5.2, 5.4_

- [ ] 55. Implement data grid with AG Grid
  - [ ] 55.1 Create DataGrid component
    - Configure AG Grid with custom cell renderers
    - Color-code cells: red (error), yellow (warning), green (pass)
    - Enable inline editing
    - _Requirements: 5.5, 5.7_

  - [ ] 55.2 Create CellDetailPopover component
    - Modal showing validation messages and suggestions
    - _Requirements: 5.6_

  - [ ]* 55.3 Write unit tests for data grid
    - Test cell rendering, inline editing, popover display
    - _Requirements: 5.5, 5.6, 5.7_

- [ ] 56. Implement bulk operations UI
  - [ ] 56.1 Create BulkEditModal component
    - Form for applying changes to selected rows
    - _Requirements: 5.8_

  - [ ] 56.2 Create AutoFixButton component
    - Trigger auto-fix for all fixable issues
    - Display summary of fixes applied
    - _Requirements: 5.9_

  - [ ]* 56.3 Write unit tests for bulk operations
    - Test bulk edit, auto-fix
    - _Requirements: 5.8, 5.9_

- [ ] 57. Checkpoint - Frontend review interface complete
  - Ensure review UI works end-to-end with backend

### Phase 13: Frontend - Export and History

- [ ] 58. Implement export components
  - [ ] 58.1 Create ExportOptions component
    - Radio buttons for Amazon flat file vs validation report
    - _Requirements: 6.1, 6.5_

  - [ ] 58.2 Create ExportPreview component
    - Summary of rows to be included/excluded
    - _Requirements: 6.4_

  - [ ] 58.3 Create DownloadButton component
    - Trigger file generation and download
    - _Requirements: 6.1, 6.5_

  - [ ]* 58.4 Write unit tests for export components
    - Test export options, preview, download
    - _Requirements: 6.1, 6.4, 6.5_

- [ ] 59. Implement upload history
  - [ ] 59.1 Create UploadHistory component
    - Table showing timestamp, filename, user, row count, pass/fail counts
    - Allow re-downloading exported files
    - _Requirements: 6.7, 6.8_

  - [ ]* 59.2 Write unit tests for upload history
    - Test history display, file re-download
    - _Requirements: 6.7, 6.8_

- [ ] 60. Checkpoint - Frontend export and history complete
  - Ensure export and history UI works end-to-end with backend

### Phase 14: Frontend - Admin Panel

- [ ] 61. Implement user management UI
  - [ ] 61.1 Create UserManagement component
    - Table with create/edit/deactivate actions
    - Form for creating new users
    - _Requirements: 1.7, 1.8, 1.9_

  - [ ]* 61.2 Write unit tests for user management
    - Test user creation, editing, deactivation
    - _Requirements: 1.7, 1.8, 1.9_

- [ ] 62. Implement validation rule management UI
  - [ ] 62.1 Create ValidationRuleManager component
    - CRUD interface for validation rules
    - Form for creating/editing rules
    - Toggle for enabling/disabling rules
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 62.2 Write unit tests for rule management
    - Test rule creation, editing, toggling
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 63. Implement lookup table management UI
  - [ ] 63.1 Create LookupTableManager component
    - CRUD interface for lookup entries
    - CSV import/export buttons
    - _Requirements: 7.5, 7.6, 7.7_

  - [ ]* 63.2 Write unit tests for lookup management
    - Test entry creation, editing, import/export
    - _Requirements: 7.5, 7.6, 7.7_

- [ ] 64. Implement brand configuration UI
  - [ ] 64.1 Create BrandConfigManager component
    - Form for brand-specific settings
    - _Requirements: 7.8_

  - [ ]* 64.2 Write unit tests for brand configuration
    - Test brand creation, editing
    - _Requirements: 7.8_

- [ ] 65. Implement audit log viewer
  - [ ] 65.1 Create AuditLogViewer component
    - Filterable table of system actions
    - Filters for user, action type, date range
    - _Requirements: 7.9, 7.10_

  - [ ]* 65.2 Write unit tests for audit log viewer
    - Test log display, filtering
    - _Requirements: 7.9, 7.10_

- [ ] 66. Checkpoint - Frontend admin panel complete
  - Ensure admin UI works end-to-end with backend

### Phase 15: End-to-End Testing and Integration

- [ ] 67. Implement E2E tests with Playwright
  - [ ] 67.1 Set up Playwright test environment
    - Configure test database and test data
    - _Requirements: All_

  - [ ] 67.2 Write E2E test for standard user flow
    - Login → Upload CSV → Map columns → Validate → Review results → Apply fixes → Export Amazon file
    - _Requirements: 1.1, 2.1-2.8, 3.1-3.25, 5.1-5.11, 6.1-6.4_

  - [ ] 67.3 Write E2E test for admin user flow
    - Login → Create user → Configure validation rule → Manage lookup table → View audit log
    - _Requirements: 1.1, 1.7, 7.1-7.10_

  - [ ] 67.4 Write E2E test for error recovery flow
    - Login → Upload invalid file → See error → Upload valid file → Continue workflow
    - _Requirements: 1.1, 2.1, 2.10_

- [ ] 68. Integration testing
  - [ ]* 68.1 Write integration tests for API endpoints
    - Test full request/response cycles for critical endpoints
    - _Requirements: All API endpoints_

  - [ ]* 68.2 Write integration tests for validation pipeline
    - Test end-to-end validation flow from upload to results
    - _Requirements: 3.1-3.25, 4.1-4.8_

- [ ] 69. Final checkpoint - All tests passing
  - Run full test suite (unit, property, integration, E2E)
  - Verify test coverage meets goals (≥80% for business logic)
  - Ensure all 77 correctness properties are implemented and passing

### Phase 16: Deployment Preparation

- [ ] 70. Configure production environment
  - [ ] 70.1 Set up environment variables for production
    - Database connection, JWT secret, file storage (S3), email service
    - _Requirements: All_

  - [ ] 70.2 Configure CORS and security headers
    - Set up CORS for frontend domain
    - Add helmet.js for security headers
    - _Requirements: 1.1, 1.5_

  - [ ] 70.3 Set up file storage for production
    - Configure AWS S3 or similar for uploaded files and exports
    - _Requirements: 2.1, 6.1, 6.5_

  - [ ] 70.4 Set up email service
    - Configure SendGrid, AWS SES, or similar for password reset emails
    - _Requirements: 1.4_

- [ ] 71. Build and optimize for production
  - [ ] 71.1 Build frontend for production
    - Run production build with optimizations
    - Verify bundle size and performance
    - _Requirements: All frontend_

  - [ ] 71.2 Optimize backend for production
    - Enable compression, rate limiting
    - Configure logging and monitoring
    - _Requirements: All backend_

  - [ ] 71.3 Create Docker containers
    - Dockerfile for backend
    - Dockerfile for frontend (or serve from backend)
    - Docker Compose for local development
    - _Requirements: All_

- [ ] 72. Documentation and deployment
  - [ ] 72.1 Write deployment documentation
    - Environment setup instructions
    - Database migration steps
    - Configuration guide
    - _Requirements: All_

  - [ ] 72.2 Create user documentation
    - User guide for standard users
    - Admin guide for configuration
    - _Requirements: All_

  - [ ] 72.3 Final deployment checklist
    - Database migrations applied
    - Environment variables configured
    - SSL certificates installed
    - Monitoring and logging configured
    - Backup strategy in place
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout development
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- All 77 correctness properties from the design document are included as property test tasks
- The implementation follows a phased approach: backend core → validation → enrichment → frontend → integration
- Testing is integrated throughout to catch errors early rather than at the end
