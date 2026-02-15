import { AMAZON_FIELDS, AmazonField, FIELD_NAME_VARIATIONS } from '../constants/amazon-fields.js';

export interface ColumnMapping {
  sourceColumn: string;
  amazonField: AmazonField | null;
  confidence: 'exact' | 'high' | 'medium' | 'low' | 'none';
}

export interface AutoMappingResult {
  mappings: ColumnMapping[];
  unmappedColumns: string[];
  unmappedAmazonFields: AmazonField[];
}

export class ColumnMappingService {
  /**
   * Calculate string similarity using Levenshtein distance
   * Returns a value between 0 (completely different) and 1 (identical)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    // Create distance matrix
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Calculate Levenshtein distance
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    
    return 1 - (distance / maxLen);
  }
  
  /**
   * Normalize column name for comparison
   * Removes special characters, converts to lowercase, replaces separators with underscores
   */
  private normalizeColumnName(columnName: string): string {
    return columnName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  
  /**
   * Find the best matching Amazon field for a source column
   */
  private findBestMatch(sourceColumn: string): { field: AmazonField | null; confidence: ColumnMapping['confidence'] } {
    const normalized = this.normalizeColumnName(sourceColumn);
    
    // Check for exact match in variations
    if (normalized in FIELD_NAME_VARIATIONS) {
      return {
        field: FIELD_NAME_VARIATIONS[normalized],
        confidence: 'exact',
      };
    }
    
    // Check for partial matches and similarity
    let bestMatch: AmazonField | null = null;
    let bestScore = 0;
    
    for (const amazonField of AMAZON_FIELDS) {
      const similarity = this.calculateSimilarity(normalized, amazonField);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = amazonField;
      }
    }
    
    // Also check against variation keys for better matching
    for (const [variation, amazonField] of Object.entries(FIELD_NAME_VARIATIONS)) {
      const similarity = this.calculateSimilarity(normalized, variation);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = amazonField;
      }
    }
    
    // Determine confidence based on similarity score
    let confidence: ColumnMapping['confidence'];
    if (bestScore >= 0.9) {
      confidence = 'high';
    } else if (bestScore >= 0.7) {
      confidence = 'medium';
    } else if (bestScore >= 0.5) {
      confidence = 'low';
    } else {
      confidence = 'none';
      bestMatch = null;
    }
    
    return { field: bestMatch, confidence };
  }
  
  /**
   * Auto-map source columns to Amazon fields
   * Returns mappings with confidence levels
   */
  autoMapColumns(sourceColumns: string[]): AutoMappingResult {
    const mappings: ColumnMapping[] = [];
    const mappedAmazonFields = new Set<AmazonField>();
    const unmappedColumns: string[] = [];
    
    for (const sourceColumn of sourceColumns) {
      const { field, confidence } = this.findBestMatch(sourceColumn);
      
      // Only include mappings with at least medium confidence
      if (field && confidence !== 'none' && confidence !== 'low') {
        // Avoid duplicate mappings to the same Amazon field
        if (!mappedAmazonFields.has(field)) {
          mappings.push({
            sourceColumn,
            amazonField: field,
            confidence,
          });
          mappedAmazonFields.add(field);
        } else {
          // Column couldn't be mapped uniquely
          unmappedColumns.push(sourceColumn);
        }
      } else {
        unmappedColumns.push(sourceColumn);
      }
    }
    
    // Find Amazon fields that weren't mapped
    const unmappedAmazonFields = AMAZON_FIELDS.filter(
      field => !mappedAmazonFields.has(field)
    );
    
    return {
      mappings,
      unmappedColumns,
      unmappedAmazonFields,
    };
  }
  
  /**
   * Convert auto-mapping result to a simple mapping object
   * Returns { sourceColumn: amazonField }
   */
  toMappingObject(result: AutoMappingResult): Record<string, AmazonField> {
    const mapping: Record<string, AmazonField> = {};
    
    for (const { sourceColumn, amazonField } of result.mappings) {
      if (amazonField) {
        mapping[sourceColumn] = amazonField;
      }
    }
    
    return mapping;
  }
}

export const columnMappingService = new ColumnMappingService();
