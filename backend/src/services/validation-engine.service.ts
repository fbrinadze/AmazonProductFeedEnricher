import { PrismaClient } from '@prisma/client';
import { EnrichmentService } from './enrichment.service.js';

const prisma = new PrismaClient();
const enrichmentService = new EnrichmentService();

export interface ValidationRule {
  id: string;
  fieldName: string;
  ruleType: 'required' | 'max_length' | 'regex' | 'range' | 'lookup' | 'custom';
  ruleConfig: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
  message: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ValidationIssue {
  field: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  uploadId: string;
  totalRows: number;
  passCount: number;
  errorCount: number;
  warningCount: number;
  healthScore: number;
}

export interface UploadRow {
  id: string;
  uploadId: string;
  rowNumber: number;
  originalData: Record<string, any>;
  enrichedData?: Record<string, any>;
  validationResults?: ValidationIssue[];
  status: 'pending' | 'pass' | 'warning' | 'error';
}

export class ValidationEngine {
  private rules: ValidationRule[] = [];
  private brandNames: Set<string> = new Set();
  private lookupTables: Map<string, Set<string>> = new Map();

  /**
   * Load validation rules from database
   */
  async loadRules(): Promise<ValidationRule[]> {
    const dbRules = await prisma.validationRule.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    this.rules = dbRules.map((rule) => ({
      id: rule.id,
      fieldName: rule.fieldName,
      ruleType: rule.ruleType as ValidationRule['ruleType'],
      ruleConfig: rule.ruleConfig as Record<string, any>,
      severity: rule.severity as ValidationRule['severity'],
      message: rule.message,
      isActive: rule.isActive,
      sortOrder: rule.sortOrder,
    }));

    return this.rules;
  }

  /**
   * Load brand configurations from database
   */
  async loadBrands(): Promise<void> {
    const brands = await prisma.brandConfig.findMany({
      where: { isActive: true },
      select: { brandName: true },
    });

    this.brandNames = new Set(brands.map((b) => b.brandName));
  }

  /**
   * Load lookup tables from database
   */
  async loadLookupTables(): Promise<void> {
    const lookupEntries = await prisma.lookupTable.findMany({
      where: { isActive: true },
      select: { tableType: true, targetValue: true },
    });

    // Group by table type
    this.lookupTables.clear();
    for (const entry of lookupEntries) {
      if (!this.lookupTables.has(entry.tableType)) {
        this.lookupTables.set(entry.tableType, new Set());
      }
      this.lookupTables.get(entry.tableType)!.add(entry.targetValue);
    }
  }

  /**
   * Apply a single validation rule to a row
   */
  applyRule(rule: ValidationRule, row: UploadRow): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const data = row.enrichedData || row.originalData;
    const fieldValue = data[rule.fieldName];

    switch (rule.ruleType) {
      case 'required':
        if (!this.isFieldPresent(fieldValue)) {
          issues.push({
            field: rule.fieldName,
            rule: rule.id,
            severity: rule.severity,
            message: rule.message,
          });
        }
        break;

      case 'max_length':
        if (this.isFieldPresent(fieldValue)) {
          const maxLength = rule.ruleConfig.max as number;
          if (String(fieldValue).length > maxLength) {
            issues.push({
              field: rule.fieldName,
              rule: rule.id,
              severity: rule.severity,
              message: rule.message.replace('{max}', String(maxLength)),
            });
          }
        }
        break;

      case 'regex':
        if (this.isFieldPresent(fieldValue)) {
          const pattern = new RegExp(rule.ruleConfig.pattern as string);
          if (!pattern.test(String(fieldValue))) {
            issues.push({
              field: rule.fieldName,
              rule: rule.id,
              severity: rule.severity,
              message: rule.message,
            });
          }
        }
        break;

      case 'range':
        if (this.isFieldPresent(fieldValue)) {
          const numValue = Number(fieldValue);
          if (!isNaN(numValue)) {
            const min = rule.ruleConfig.min as number | undefined;
            const max = rule.ruleConfig.max as number | undefined;

            if (min !== undefined && numValue < min) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message.replace('{min}', String(min)),
              });
            }

            if (max !== undefined && numValue > max) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message.replace('{max}', String(max)),
              });
            }
          }
        }
        break;

      case 'lookup':
        if (this.isFieldPresent(fieldValue)) {
          const tableType = rule.ruleConfig.table_type as string | undefined;
          const values = rule.ruleConfig.values as string[] | undefined;

          // Handle brand_name validation
          if (rule.fieldName === 'brand_name') {
            if (!this.validateBrand(String(fieldValue))) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          }
          // Handle lookup table validation (department, color_map, size_map)
          else if (tableType) {
            if (!this.validateLookupValue(String(fieldValue), tableType)) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          }
          // Handle enum validation (e.g., external_product_id_type)
          else if (values && Array.isArray(values)) {
            if (!this.validateEnum(String(fieldValue), values)) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          }
        }
        break;

      case 'custom':
        const functionName = rule.ruleConfig.function as string;
        
        // validateBulletPoints needs to check the entire data object, not just one field
        if (functionName === 'validateBulletPoints') {
          const result = this.validateBulletPoints(data);
          if (!result.isValid) {
            for (const issue of result.issues) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: issue,
              });
            }
          }
        } else if (this.isFieldPresent(fieldValue)) {
          if (functionName === 'validateUPCCheckDigit' || functionName === 'validateBarcodeCheckDigit') {
            // Validate UPC/EAN check digit
            if (!this.validateBarcodeCheckDigit(String(fieldValue))) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          } else if (functionName === 'validateBarcodeType') {
            // Validate barcode type is 'UPC' or 'EAN'
            if (!this.validateBarcodeType(String(fieldValue))) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          } else if (functionName === 'validateDescription') {
            // Validate description field
            const result = this.validateDescription(String(fieldValue));
            if (!result.isValid) {
              for (const issue of result.issues) {
                issues.push({
                  field: rule.fieldName,
                  rule: rule.id,
                  severity: rule.severity,
                  message: issue,
                });
              }
            }
          } else if (functionName === 'validateDescriptionQuality') {
            // Check description quality threshold
            if (!this.validateDescriptionQuality(String(fieldValue))) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          } else if (functionName === 'validateBulletPointQuality') {
            // Check bullet point quality threshold
            if (!this.validateBulletPointQuality(String(fieldValue))) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          } else if (functionName === 'validateURL') {
            // Validate URL format
            if (!this.validateURL(String(fieldValue))) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          } else if (functionName === 'validatePrice') {
            // Validate price is positive
            if (!this.validatePrice(fieldValue)) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          } else if (functionName === 'validateQuantity') {
            // Validate quantity is non-negative integer
            if (!this.validateQuantity(fieldValue)) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          } else if (functionName === 'validatePriceReasonableness') {
            // Check price reasonableness
            const maxThreshold = rule.ruleConfig.maxThreshold as number | undefined;
            if (!this.validatePriceReasonableness(fieldValue, maxThreshold)) {
              issues.push({
                field: rule.fieldName,
                rule: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          } else if (functionName === 'validateTitleQuality') {
            // Check title quality (missing components, uppercase, excessive punctuation)
            const result = this.validateTitleQuality(String(fieldValue), data);
            if (!result.isValid) {
              for (const issue of result.issues) {
                issues.push({
                  field: rule.fieldName,
                  rule: rule.id,
                  severity: rule.severity,
                  message: issue,
                });
              }
            }
          }
        }
        break;
    }

    return issues;
  }

  /**
   * Validate all rows in an upload
   */
  async validate(uploadId: string): Promise<ValidationResult> {
    // Load rules if not already loaded
    if (this.rules.length === 0) {
      await this.loadRules();
    }

    // Load brands and lookup tables
    await this.loadBrands();
    await this.loadLookupTables();

    // Fetch all rows for this upload
    const rows = await prisma.uploadRow.findMany({
      where: { uploadId },
      orderBy: { rowNumber: 'asc' },
    });

    let passCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    // Convert to UploadRow format
    const uploadRows: UploadRow[] = rows.map(row => ({
      id: row.id,
      uploadId: row.uploadId,
      rowNumber: row.rowNumber,
      originalData: row.originalData as Record<string, any>,
      enrichedData: row.enrichedData as Record<string, any> | undefined,
      status: row.status as UploadRow['status'],
    }));

    // First pass: Apply individual row rules
    const rowIssuesMap = new Map<string, ValidationIssue[]>();
    
    for (const uploadRow of uploadRows) {
      const allIssues: ValidationIssue[] = [];

      // Apply all rules to this row
      for (const rule of this.rules) {
        const issues = this.applyRule(rule, uploadRow);
        allIssues.push(...issues);
      }

      // Get enrichment suggestions and convert to info-level validation issues
      const data = uploadRow.enrichedData || uploadRow.originalData;
      const enrichmentSuggestions = await enrichmentService.getEnrichmentSuggestions(data);
      
      for (const suggestion of enrichmentSuggestions) {
        // Only add optional field suggestions as info-level issues
        // Other suggestions (color_map, size_map, etc.) are already handled by validation rules
        if (suggestion.confidence === 'low' && suggestion.suggestedValue === '') {
          allIssues.push({
            field: suggestion.field,
            rule: 'optional_field_suggestion',
            severity: 'info',
            message: suggestion.reason,
          });
        }
      }

      rowIssuesMap.set(uploadRow.id, allIssues);
    }

    // Second pass: Validate parent-child relationships across all rows
    const parentChildIssues = this.validateParentChildRelationships(uploadRows);
    
    // Merge parent-child issues with existing issues
    for (const [rowId, issues] of parentChildIssues.entries()) {
      const existingIssues = rowIssuesMap.get(rowId) || [];
      rowIssuesMap.set(rowId, [...existingIssues, ...issues]);
    }

    // Update each row with validation results
    for (const uploadRow of uploadRows) {
      const allIssues = rowIssuesMap.get(uploadRow.id) || [];

      // Categorize issues by severity
      const hasErrors = allIssues.some((issue) => issue.severity === 'error');
      const hasWarnings = allIssues.some((issue) => issue.severity === 'warning');

      let status: UploadRow['status'];
      if (hasErrors) {
        status = 'error';
        errorCount++;
      } else if (hasWarnings) {
        status = 'warning';
        warningCount++;
      } else {
        status = 'pass';
        passCount++;
      }

      // Update row with validation results
      await prisma.uploadRow.update({
        where: { id: uploadRow.id },
        data: {
          validationResults: allIssues as any,
          status,
        },
      });
    }

    // Update upload summary statistics
    const totalRows = rows.length;
    const healthScore = totalRows > 0 ? (passCount / totalRows) * 100 : 0;

    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        errorCount,
        warningCount,
        passCount,
        status: 'completed',
      },
    });

    return {
      uploadId,
      totalRows,
      passCount,
      errorCount,
      warningCount,
      healthScore,
    };
  }

  /**
   * Check if a field value is present (non-empty)
   */
  private isFieldPresent(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return false;
    }
    return true;
  }

  /**
   * Validate UPC/EAN check digit
   * UPC-A: 12 digits, EAN-13: 13 digits
   * Algorithm:
   * 1. Starting from the right (excluding check digit), alternate multiplying digits by 3 and 1
   * 2. Sum all products
   * 3. Check digit = (10 - (sum % 10)) % 10
   */
  validateBarcodeCheckDigit(barcode: string): boolean {
    // Remove any whitespace
    const cleanBarcode = barcode.trim();

    // Check if it's a valid UPC (12 digits) or EAN (13 digits)
    if (!/^\d{12}$/.test(cleanBarcode) && !/^\d{13}$/.test(cleanBarcode)) {
      return false;
    }

    // Extract check digit (last digit)
    const checkDigit = parseInt(cleanBarcode[cleanBarcode.length - 1], 10);

    // Extract the digits to validate (all except the last one)
    const digits = cleanBarcode.slice(0, -1);

    // Calculate the sum with alternating multipliers (3 and 1)
    let sum = 0;
    for (let i = digits.length - 1; i >= 0; i--) {
      const digit = parseInt(digits[i], 10);
      // For UPC/EAN, we alternate 3 and 1 starting from the right
      // Position 0 from right (first digit before check) gets multiplier 3
      // Position 1 from right gets multiplier 1, etc.
      const position = digits.length - 1 - i;
      const multiplier = position % 2 === 0 ? 3 : 1;
      sum += digit * multiplier;
    }

    // Calculate expected check digit
    const expectedCheckDigit = (10 - (sum % 10)) % 10;

    return checkDigit === expectedCheckDigit;
  }

    /**
     * Validate barcode type is either 'UPC' or 'EAN'
     */
    validateBarcodeType(barcodeType: string): boolean {
      if (!barcodeType) {
        return false;
      }
      const normalizedType = barcodeType.trim().toUpperCase();
      return normalizedType === 'UPC' || normalizedType === 'EAN';
    }

    /**
     * Validate brand name against configured brands
     */
    validateBrand(brandName: string): boolean {
      if (!brandName) {
        return false;
      }
      return this.brandNames.has(brandName.trim());
    }

    /**
     * Validate value against lookup table
     */
    validateLookupValue(value: string, tableType: string): boolean {
      if (!value) {
        return false;
      }
      const lookupSet = this.lookupTables.get(tableType);
      if (!lookupSet) {
        return false;
      }
      return lookupSet.has(value.trim());
    }

    /**
     * Validate value against enum list
     */
    validateEnum(value: string, allowedValues: string[]): boolean {
      if (!value) {
        return false;
      }
      const normalizedValue = value.trim().toUpperCase();
      return allowedValues.some((v) => v.toUpperCase() === normalizedValue);
    }

    /**
     * Validate description field
     * - Must be non-empty
     * - Must not exceed 2000 characters
     * - Must not contain HTML tags
     */
    validateDescription(description: string): { isValid: boolean; issues: string[] } {
          const issues: string[] = [];

          if (!description || description.trim() === '') {
            return { isValid: false, issues: ['Description is required'] };
          }

          const trimmedDesc = description.trim();

          // Check length limit
          if (trimmedDesc.length > 2000) {
            issues.push('Description must not exceed 2000 characters');
          }

          // Check for HTML tags - more specific pattern to avoid false positives
          // Matches opening tags, closing tags, and self-closing tags
          const htmlTagPattern = /<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>/;
          if (htmlTagPattern.test(trimmedDesc)) {
            issues.push('Description must not contain HTML tags');
          }

          return { isValid: issues.length === 0, issues };
        }

    /**
     * Check if description meets quality threshold
     * Warning if shorter than 100 characters
     */
    validateDescriptionQuality(description: string): boolean {
      if (!description || description.trim() === '') {
        return false;
      }
      return description.trim().length >= 100;
    }

    /**
     * Validate bullet points
     * - At least bullet_point1 must be present
     * - Each bullet must not exceed 500 characters
     * - Must not contain HTML tags
     */
    validateBulletPoints(data: Record<string, any>): { isValid: boolean; issues: string[] } {
          const issues: string[] = [];

          // Check if at least bullet_point1 is present
          const bullet1 = data['bullet_point1'];
          if (!bullet1 || String(bullet1).trim() === '') {
            return { isValid: false, issues: ['At least bullet_point1 is required'] };
          }

          // Check all bullet points (1-5)
          for (let i = 1; i <= 5; i++) {
            const bulletKey = `bullet_point${i}`;
            const bulletValue = data[bulletKey];

            if (bulletValue && String(bulletValue).trim() !== '') {
              const trimmedBullet = String(bulletValue).trim();

              // Check length limit
              if (trimmedBullet.length > 500) {
                issues.push(`${bulletKey} must not exceed 500 characters`);
              }

              // Check for HTML tags - more specific pattern to avoid false positives
              const htmlTagPattern = /<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>/;
              if (htmlTagPattern.test(trimmedBullet)) {
                issues.push(`${bulletKey} must not contain HTML tags`);
              }
            }
          }

          return { isValid: issues.length === 0, issues };
        }

    /**
     * Check if a bullet point meets quality threshold
     * Warning if shorter than 15 characters
     */
    validateBulletPointQuality(bulletPoint: string): boolean {
      if (!bulletPoint || bulletPoint.trim() === '') {
        return true; // Empty bullets are okay (except bullet_point1)
      }
      return bulletPoint.trim().length >= 15;
    }

    /**
     * Validate URL format
     * Checks if the value is a well-formed URL
     */
    validateURL(url: string): boolean {
      if (!url || url.trim() === '') {
        return false;
      }

      try {
        const urlObj = new URL(url.trim());
        // Check that it has a valid protocol (http or https)
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      } catch {
        return false;
      }
    }

    /**
     * Validate price is positive
     * Checks if the value is a positive numeric value
     */
    validatePrice(price: any): boolean {
      if (price === null || price === undefined || price === '') {
        return false;
      }

      const numValue = Number(price);

      // Check if it's a valid number and positive
      if (isNaN(numValue)) {
        return false;
      }

      return numValue > 0;
    }

    /**
     * Validate quantity is non-negative integer
     * Checks if the value is a non-negative integer
     */
    validateQuantity(quantity: any): boolean {
      if (quantity === null || quantity === undefined || quantity === '') {
        return false;
      }

      const numValue = Number(quantity);

      // Check if it's a valid number
      if (isNaN(numValue)) {
        return false;
      }

      // Check if it's non-negative
      if (numValue < 0) {
        return false;
      }

      // Check if it's an integer
      return Number.isInteger(numValue);
    }

    /**
     * Validate price reasonableness
     * Warning if price is zero or exceeds configured threshold
     */
    validatePriceReasonableness(price: any, maxThreshold: number = 10000): boolean {
      if (price === null || price === undefined || price === '') {
        return true; // Not applicable if no price
      }

      const numValue = Number(price);

      if (isNaN(numValue)) {
        return true; // Not applicable if not a number
      }

      // Flag if price is zero or exceeds threshold
      return numValue > 0 && numValue <= maxThreshold;
    }

    /**
     * Validate title quality
     * Warning if title is missing brand name, color, size, or material
     * Warning if title contains all uppercase letters or excessive punctuation
     */
    validateTitleQuality(title: string, data: Record<string, any>): { isValid: boolean; issues: string[] } {
      const issues: string[] = [];

      if (!title || title.trim() === '') {
        return { isValid: true, issues }; // Empty titles are handled by required validation
      }

      const trimmedTitle = title.trim();
      const lowerTitle = trimmedTitle.toLowerCase();

      // Check for missing key components
      const brandName = data['brand_name'];
      const colorName = data['color_name'] || data['color_map'];
      const sizeName = data['size_name'] || data['size_map'];
      const material = data['material'] || data['material_type'];

      // Flag if brand is missing from title
      if (brandName && String(brandName).trim() !== '') {
        const brandLower = String(brandName).trim().toLowerCase();
        if (!lowerTitle.includes(brandLower)) {
          issues.push('Title is missing brand name');
        }
      }

      // Flag if color is missing from title
      if (colorName && String(colorName).trim() !== '') {
        const colorLower = String(colorName).trim().toLowerCase();
        if (!lowerTitle.includes(colorLower)) {
          issues.push('Title is missing color');
        }
      }

      // Flag if size is missing from title
      if (sizeName && String(sizeName).trim() !== '') {
        const sizeLower = String(sizeName).trim().toLowerCase();
        if (!lowerTitle.includes(sizeLower)) {
          issues.push('Title is missing size');
        }
      }

      // Flag if material is missing from title
      if (material && String(material).trim() !== '') {
        const materialLower = String(material).trim().toLowerCase();
        if (!lowerTitle.includes(materialLower)) {
          issues.push('Title is missing material');
        }
      }

      // Check for all uppercase (excluding spaces and punctuation)
      const lettersOnly = trimmedTitle.replace(/[^a-zA-Z]/g, '');
      if (lettersOnly.length > 0 && lettersOnly === lettersOnly.toUpperCase()) {
        issues.push('Title contains all uppercase letters');
      }

      // Check for excessive punctuation
      // Excessive means more than 3 punctuation marks or multiple consecutive punctuation marks
      const punctuationMarks = trimmedTitle.match(/[!?.,;:]/g);
      if (punctuationMarks && punctuationMarks.length > 3) {
        issues.push('Title contains excessive punctuation');
      }

      // Check for multiple consecutive punctuation marks (e.g., "!!!", "???")
      if (/[!?.,;:]{2,}/.test(trimmedTitle)) {
        issues.push('Title contains excessive punctuation');
      }

      return { isValid: issues.length === 0, issues };
    }



    /**
     * Validate parent-child relationships across all rows
     * This must be called after all individual row validations
     * Returns issues for rows that have parent-child problems
     */
    validateParentChildRelationships(rows: UploadRow[]): Map<string, ValidationIssue[]> {
      const issuesByRowId = new Map<string, ValidationIssue[]>();

      // Build a map of SKUs to rows for quick lookup
      const skuToRow = new Map<string, UploadRow>();
      const parentSkus = new Set<string>();

      for (const row of rows) {
        const data = row.enrichedData || row.originalData;
        const itemSku = data['item_sku'];
        const parentChild = data['parent_child'];

        if (itemSku) {
          skuToRow.set(String(itemSku).trim(), row);

          // Track parent SKUs
          if (parentChild && String(parentChild).trim().toLowerCase() === 'parent') {
            parentSkus.add(String(itemSku).trim());
          }
        }
      }

      // Validate each row's parent-child relationships
      for (const row of rows) {
        const data = row.enrichedData || row.originalData;
        const parentChild = data['parent_child'];
        const parentSku = data['parent_sku'];
        const variationTheme = data['variation_theme'];
        const itemSku = data['item_sku'];

        // Skip if no parent-child relationship defined
        if (!parentChild) {
          continue;
        }

        const parentChildValue = String(parentChild).trim().toLowerCase();

        // Validate child rows
        if (parentChildValue === 'child') {
          const issues: ValidationIssue[] = [];

          // Check if parent_sku is provided
          if (!parentSku || String(parentSku).trim() === '') {
            issues.push({
              field: 'parent_sku',
              rule: 'parent_child_referential_integrity',
              severity: 'error',
              message: 'Child items must have a parent_sku',
            });
          } else {
            const parentSkuValue = String(parentSku).trim();

            // Check if parent exists in the file
            if (!parentSkus.has(parentSkuValue)) {
              issues.push({
                field: 'parent_sku',
                rule: 'parent_child_referential_integrity',
                severity: 'error',
                message: `Child SKU references non-existent parent SKU: ${parentSkuValue}`,
              });
            } else {
              // Parent exists, check variation_theme consistency
              const parentRow = skuToRow.get(parentSkuValue);
              if (parentRow) {
                const parentData = parentRow.enrichedData || parentRow.originalData;
                const parentVariationTheme = parentData['variation_theme'];

                if (variationTheme && parentVariationTheme) {
                  const childTheme = String(variationTheme).trim();
                  const parentTheme = String(parentVariationTheme).trim();

                  if (childTheme !== parentTheme) {
                    issues.push({
                      field: 'variation_theme',
                      rule: 'variation_theme_consistency',
                      severity: 'error',
                      message: `Child variation_theme (${childTheme}) does not match parent variation_theme (${parentTheme})`,
                    });
                  }
                }
              }
            }
          }

          if (issues.length > 0) {
            issuesByRowId.set(row.id, issues);
          }
        }

        // Validate parent rows
        if (parentChildValue === 'parent') {
          // Find all children of this parent
          const children = rows.filter(r => {
            const childData = r.enrichedData || r.originalData;
            const childParentSku = childData['parent_sku'];
            const childParentChild = childData['parent_child'];

            return childParentSku &&
                   String(childParentSku).trim() === String(itemSku).trim() &&
                   childParentChild &&
                   String(childParentChild).trim().toLowerCase() === 'child';
          });

          // Check variation_theme consistency across all children
          if (children.length > 0 && variationTheme) {
            const parentTheme = String(variationTheme).trim();

            for (const child of children) {
              const childData = child.enrichedData || child.originalData;
              const childVariationTheme = childData['variation_theme'];

              if (childVariationTheme) {
                const childTheme = String(childVariationTheme).trim();

                if (childTheme !== parentTheme) {
                  const childIssues = issuesByRowId.get(child.id) || [];
                  childIssues.push({
                    field: 'variation_theme',
                    rule: 'variation_theme_consistency',
                    severity: 'error',
                    message: `Child variation_theme (${childTheme}) does not match parent variation_theme (${parentTheme})`,
                  });
                  issuesByRowId.set(child.id, childIssues);
                }
              }
            }
          }
        }
      }

      return issuesByRowId;
    }


}

export const validationEngine = new ValidationEngine();
