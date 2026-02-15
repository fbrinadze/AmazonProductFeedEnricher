import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Enrichment Service
 * Provides data enrichment functionality including title generation,
 * lookup-based suggestions, and inference-based enrichment
 */

export interface EnrichmentSuggestion {
  field: string;
  suggestedValue: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Auto-fix interface for fixable issues
 */
export interface AutoFix {
  field: string;
  originalValue: any;
  fixedValue: any;
  fixType: 'whitespace' | 'formatting' | 'check_digit' | 'mapping';
  description: string;
}

/**
 * Enrichment change tracking interface
 */
export interface EnrichmentChange {
  field: string;
  originalValue: any;
  newValue: any;
  changeType: 'suggestion_applied' | 'auto_fix' | 'manual_edit';
  timestamp: Date;
  reason?: string;
}

/**
 * Recommended optional fields that improve listing quality
 * These are not strictly required by Amazon but significantly enhance product listings
 */
export const RECOMMENDED_OPTIONAL_FIELDS = [
  'bullet_point2',
  'bullet_point3',
  'bullet_point4',
  'bullet_point5',
  'other_image_url1',
  'other_image_url2',
  'material_type',
  'fabric_type',
  'care_instructions',
  'country_of_origin',
  'manufacturer',
] as const;

export class EnrichmentService {
  /**
   * Generate a title using the pattern:
   * [Brand] [Department] [Product Type] [Key Feature] [Color] [Size]
   * 
   * @param data - Product data row
   * @returns Generated title string
   */
  generateTitle(data: Record<string, any>): string {
    const parts: string[] = [];

    // 1. Brand
    const brand = this.extractBrand(data);
    if (brand) {
      parts.push(brand);
    }

    // 2. Department (map to readable form)
    const department = this.extractDepartment(data);
    if (department) {
      parts.push(department);
    }

    // 3. Product Type
    const productType = this.extractProductType(data);
    if (productType) {
      parts.push(productType);
    }

    // 4. Key Feature (from first bullet point or description)
    const keyFeature = this.extractKeyFeature(data);
    if (keyFeature) {
      parts.push(keyFeature);
    }

    // 5. Color
    const color = this.extractColor(data);
    if (color) {
      parts.push(color);
    }

    // 6. Size
    const size = this.extractSize(data);
    if (size) {
      parts.push(size);
    }

    // Join parts with spaces and capitalize appropriately
    return this.formatTitle(parts.join(' '));
  }

  /**
   * Extract brand from data
   */
  private extractBrand(data: Record<string, any>): string {
    return data.brand_name || data.brand || '';
  }

  /**
   * Extract department and convert to readable form
   */
  private extractDepartment(data: Record<string, any>): string {
    const dept = data.department_name || data.department || '';
    
    // Map common Amazon department codes to readable names
    const departmentMap: Record<string, string> = {
      'womens': "Women's",
      'mens': "Men's",
      'girls': "Girls'",
      'boys': "Boys'",
      'baby-girls': "Baby Girls'",
      'baby-boys': "Baby Boys'",
      'unisex-adult': 'Unisex Adult',
      'unisex-child': 'Unisex Child',
    };

    const normalized = dept.toLowerCase().trim();
    return departmentMap[normalized] || this.capitalizeWords(dept);
  }

  /**
   * Extract product type from clothing_type or item_type
   */
  private extractProductType(data: Record<string, any>): string {
    const clothingType = data.clothing_type || data.garment_type || '';
    const itemType = data.item_type || data.type || '';
    
    // Prefer clothing_type, fall back to item_type
    const type = clothingType || itemType;
    
    return this.capitalizeWords(type);
  }

  /**
   * Extract key feature from first bullet point or description
   */
  private extractKeyFeature(data: Record<string, any>): string {
    // Try to get from first bullet point
    const bullet1 = data.bullet_point1 || data.bullet1 || data.feature1 || '';
    if (bullet1) {
      // Extract first meaningful phrase (up to 4 words)
      const words = bullet1.trim().split(/\s+/).slice(0, 4);
      const feature = words.join(' ');
      
      // Clean up and return if it's meaningful
      if (feature.length > 3 && feature.length < 50) {
        return this.capitalizeWords(feature);
      }
    }

    // Try to extract from description
    const description = data.product_description || data.description || '';
    if (description) {
      // Extract first sentence or first few words
      const firstSentence = description.split(/[.!?]/)[0];
      const words = firstSentence.trim().split(/\s+/).slice(0, 4);
      const feature = words.join(' ');
      
      if (feature.length > 3 && feature.length < 50) {
        return this.capitalizeWords(feature);
      }
    }

    return '';
  }

  /**
   * Extract color from data
   */
  private extractColor(data: Record<string, any>): string {
    const color = data.color_name || data.color || '';
    return this.capitalizeWords(color);
  }

  /**
   * Extract size from data
   */
  private extractSize(data: Record<string, any>): string {
    const size = data.size_name || data.size || '';
    
    // Keep size as-is (don't capitalize things like "XL", "2XL", etc.)
    return size.toString().trim();
  }

  /**
   * Format title with proper capitalization
   */
  private formatTitle(title: string): string {
    if (!title) return '';

    // Trim and remove extra spaces
    let formatted = title.trim().replace(/\s+/g, ' ');

    // Ensure first character is uppercase
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    return formatted;
  }

  /**
   * Capitalize each word in a string
   */
  private capitalizeWords(str: string): string {
    if (!str) return '';

    return str
      .trim()
      .split(/\s+/)
      .map(word => {
        if (word.length === 0) return word;
        
        // Keep acronyms and size codes as-is (all uppercase or mixed case with numbers)
        if (/^[A-Z0-9]+$/.test(word) || /\d/.test(word)) {
          return word;
        }
        
        // Capitalize first letter, lowercase rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  /**
   * Get color mapping suggestion from lookup table
   * Queries lookup_tables for color_name → color_map
   * 
   * @param colorName - The source color name from ERP
   * @param brand - Optional brand for brand-specific mappings
   * @returns Suggested color_map value or null if not found
   */
  async getColorMapping(colorName: string, brand?: string): Promise<string | null> {
    if (!colorName || colorName.trim() === '') {
      return null;
    }

    const normalizedColorName = colorName.trim();

    try {
      // First try brand-specific mapping if brand is provided
      if (brand) {
        const brandMapping = await prisma.lookupTable.findFirst({
          where: {
            tableType: 'color_map',
            sourceValue: normalizedColorName,
            brand: brand,
            isActive: true,
          },
        });

        if (brandMapping) {
          return brandMapping.targetValue;
        }
      }

      // Fall back to generic mapping (brand = null)
      const genericMapping = await prisma.lookupTable.findFirst({
        where: {
          tableType: 'color_map',
          sourceValue: normalizedColorName,
          brand: null,
          isActive: true,
        },
      });

      return genericMapping ? genericMapping.targetValue : null;
    } catch (error) {
      console.error('Error fetching color mapping:', error);
      return null;
    }
  }

  /**
   * Get size mapping suggestion from lookup table
   * Queries lookup_tables for size_name → size_map
   * 
   * @param sizeName - The source size name from ERP
   * @param brand - Optional brand for brand-specific mappings
   * @returns Suggested size_map value or null if not found
   */
  async getSizeMapping(sizeName: string, brand?: string): Promise<string | null> {
    if (!sizeName || sizeName.toString().trim() === '') {
      return null;
    }

    const normalizedSizeName = sizeName.toString().trim();

    try {
      // First try brand-specific mapping if brand is provided
      if (brand) {
        const brandMapping = await prisma.lookupTable.findFirst({
          where: {
            tableType: 'size_map',
            sourceValue: normalizedSizeName,
            brand: brand,
            isActive: true,
          },
        });

        if (brandMapping) {
          return brandMapping.targetValue;
        }
      }

      // Fall back to generic mapping (brand = null)
      const genericMapping = await prisma.lookupTable.findFirst({
        where: {
          tableType: 'size_map',
          sourceValue: normalizedSizeName,
          brand: null,
          isActive: true,
        },
      });

      return genericMapping ? genericMapping.targetValue : null;
    } catch (error) {
      console.error('Error fetching size mapping:', error);
      return null;
    }
  }

  /**
   * Infer department_name from product attributes
   * Analyzes clothing_type, size_name, color_name, and other attributes
   * to suggest the appropriate Amazon department
   * 
   * @param data - Product data row
   * @returns Inferred department name or null if cannot infer
   */
  inferDepartment(data: Record<string, any>): string | null {
    const clothingType = (data.clothing_type || data.garment_type || '').toLowerCase().trim();
    const sizeName = (data.size_name || data.size || '').toString().toLowerCase().trim();
    const itemName = (data.item_name || data.title || '').toLowerCase().trim();
    const description = (data.product_description || data.description || '').toLowerCase().trim();

    // Combine all text for analysis
    const allText = `${clothingType} ${sizeName} ${itemName} ${description}`.toLowerCase();

    // Check for unisex indicators first (most specific)
    const unisexIndicators = ['unisex', 'gender neutral', 'all gender'];
    const hasUnisexIndicator = unisexIndicators.some(indicator => allText.includes(indicator));
    
    if (hasUnisexIndicator) {
      // Determine if adult or child unisex
      const kidsIndicators = ['kids', 'child', 'children', 'youth', 'junior'];
      const hasKidsIndicator = kidsIndicators.some(indicator => allText.includes(indicator));
      
      // Kids size indicators (numeric sizes typically indicate kids)
      const kidsNumericSizes = ['2t', '3t', '4t', '5t', '6', '7', '8', '10', '12', '14', '16'];
      const hasKidsSizeIndicator = kidsNumericSizes.some(size => sizeName.includes(size));
      
      if (hasKidsIndicator || hasKidsSizeIndicator) {
        return 'unisex-child';
      }
      return 'unisex-adult';
    }

    // Baby department indicators (check before kids as they're more specific)
    const babyIndicators = ['baby', 'infant', 'newborn', 'onesie', 'bodysuit', 'romper'];
    const hasBabyIndicator = babyIndicators.some(indicator => allText.includes(indicator));
    
    if (hasBabyIndicator) {
      // Try to determine gender for baby
      const girlsIndicators = ['girl', 'girls', 'pink', 'princess', 'dress'];
      const boysIndicators = ['boy', 'boys', 'blue'];
      
      const hasGirlsIndicator = girlsIndicators.some(indicator => allText.includes(indicator));
      const hasBoysIndicator = boysIndicators.some(indicator => allText.includes(indicator));
      
      if (hasGirlsIndicator && !hasBoysIndicator) {
        return 'baby-girls';
      } else if (hasBoysIndicator && !hasGirlsIndicator) {
        return 'baby-boys';
      }
      // If ambiguous or unisex, default to baby-girls (common convention)
      return 'baby-girls';
    }

    // Kids department indicators
    const kidsIndicators = ['kids', 'child', 'children', 'youth', 'junior'];
    const hasKidsIndicator = kidsIndicators.some(indicator => allText.includes(indicator));
    
    // Kids size indicators (numeric sizes typically indicate kids)
    const kidsNumericSizes = ['2t', '3t', '4t', '5t', '6', '7', '8', '10', '12', '14', '16'];
    const hasKidsSizeIndicator = kidsNumericSizes.some(size => sizeName.includes(size));
    
    if (hasKidsIndicator || hasKidsSizeIndicator) {
      // Try to determine gender for kids
      const girlsIndicators = ['girl', 'girls', 'pink', 'princess', 'dress', 'skirt'];
      const boysIndicators = ['boy', 'boys'];
      
      const hasGirlsIndicator = girlsIndicators.some(indicator => allText.includes(indicator));
      const hasBoysIndicator = boysIndicators.some(indicator => allText.includes(indicator));
      
      if (hasGirlsIndicator && !hasBoysIndicator) {
        return 'girls';
      } else if (hasBoysIndicator && !hasGirlsIndicator) {
        return 'boys';
      }
      // If ambiguous, default to girls
      return 'girls';
    }

    // Adult department indicators
    const womensIndicators = ['women', 'womens', "women's", 'ladies', 'female'];
    const mensIndicators = ['men', 'mens', "men's", 'male', 'gentleman'];
    
    const hasWomensIndicator = womensIndicators.some(indicator => allText.includes(indicator));
    const hasMensIndicator = mensIndicators.some(indicator => allText.includes(indicator));
    
    // Check for women's specific clothing types
    const womensClothingTypes = ['dress', 'blouse', 'skirt', 'leggings', 'tunic'];
    const hasWomensClothingType = womensClothingTypes.some(type => clothingType.includes(type));
    
    // Check for men's specific clothing types
    const mensClothingTypes = ['suit', 'tie', 'tuxedo'];
    const hasMensClothingType = mensClothingTypes.some(type => clothingType.includes(type));
    
    // Prioritize explicit gender indicators over clothing type
    if (hasMensIndicator && !hasWomensIndicator) {
      return 'mens';
    } else if (hasWomensIndicator && !hasMensIndicator) {
      return 'womens';
    } else if (hasMensClothingType && !hasWomensClothingType) {
      return 'mens';
    } else if (hasWomensClothingType && !hasMensClothingType) {
      return 'womens';
    }

    // Default: if we have any clothing type but can't determine department, default to womens
    // (most common in fashion retail)
    if (clothingType) {
      return 'womens';
    }

    return null;
  }

  /**
   * Suggest item_type keywords from clothing_type and product attributes
   * Generates Amazon-compatible item_type keywords based on the product's
   * clothing type and other attributes
   * 
   * @param data - Product data row
   * @returns Array of suggested item_type keywords or null if cannot infer
   */
  inferItemType(data: Record<string, any>): string[] | null {
    const clothingType = (data.clothing_type || data.garment_type || '').toLowerCase().trim();
    const itemName = (data.item_name || data.title || '').toLowerCase().trim();
    const description = (data.product_description || data.description || '').toLowerCase().trim();

    if (!clothingType && !itemName) {
      return null;
    }

    const keywords: string[] = [];

    // Combine text for analysis
    const allText = `${clothingType} ${itemName} ${description}`.toLowerCase();

    // Map clothing types to Amazon item_type keywords
    const itemTypeMap: Record<string, string[]> = {
      // Tops
      'shirt': ['shirts', 'tops'],
      'blouse': ['blouses', 'tops'],
      't-shirt': ['t-shirts', 'tops'],
      'tee': ['t-shirts', 'tops'],
      'tank': ['tank-tops', 'tops'],
      'sweater': ['sweaters', 'tops'],
      'cardigan': ['cardigans', 'sweaters', 'tops'],
      'hoodie': ['hoodies', 'sweatshirts', 'tops'],
      'sweatshirt': ['sweatshirts', 'tops'],
      'polo': ['polo-shirts', 'shirts', 'tops'],
      'tunic': ['tunics', 'tops'],
      
      // Bottoms
      'pants': ['pants', 'bottoms'],
      'jeans': ['jeans', 'pants', 'bottoms'],
      'trousers': ['trousers', 'pants', 'bottoms'],
      'shorts': ['shorts', 'bottoms'],
      'skirt': ['skirts', 'bottoms'],
      'leggings': ['leggings', 'pants', 'bottoms'],
      
      // Dresses
      'dress': ['dresses'],
      'gown': ['gowns', 'dresses'],
      
      // Outerwear
      'jacket': ['jackets', 'outerwear'],
      'coat': ['coats', 'outerwear'],
      'blazer': ['blazers', 'jackets', 'outerwear'],
      'vest': ['vests', 'outerwear'],
      'parka': ['parkas', 'coats', 'outerwear'],
      
      // Activewear
      'athletic': ['activewear', 'athletic-apparel'],
      'sports': ['activewear', 'athletic-apparel'],
      'yoga': ['yoga-apparel', 'activewear'],
      'running': ['running-apparel', 'activewear'],
      
      // Sleepwear
      'pajama': ['pajamas', 'sleepwear'],
      'nightgown': ['nightgowns', 'sleepwear'],
      'robe': ['robes', 'sleepwear'],
      
      // Underwear
      'underwear': ['underwear'],
      'bra': ['bras', 'underwear'],
      'panties': ['panties', 'underwear'],
      'boxers': ['boxers', 'underwear'],
      'briefs': ['briefs', 'underwear'],
      
      // Swimwear
      'swimsuit': ['swimwear', 'swimsuits'],
      'bikini': ['bikinis', 'swimwear'],
      'swim': ['swimwear'],
      
      // Accessories (clothing accessories)
      'scarf': ['scarves', 'accessories'],
      'hat': ['hats', 'accessories'],
      'gloves': ['gloves', 'accessories'],
      'belt': ['belts', 'accessories'],
      'tie': ['ties', 'accessories'],
      
      // Suits
      'suit': ['suits'],
      'tuxedo': ['tuxedos', 'suits'],
    };

    // Find matching keywords based on clothing type
    for (const [key, values] of Object.entries(itemTypeMap)) {
      if (clothingType.includes(key) || allText.includes(key)) {
        keywords.push(...values);
      }
    }

    // Remove duplicates
    const uniqueKeywords = Array.from(new Set(keywords));

    return uniqueKeywords.length > 0 ? uniqueKeywords : null;
  }

  /**
   * Get enrichment suggestions for a product row
   * Returns suggestions for color_map, size_map, department_name, and item_type
   * based on lookup tables and inference
   * 
   * @param data - Product data row
   * @returns Array of enrichment suggestions
   */
  async getEnrichmentSuggestions(data: Record<string, any>): Promise<EnrichmentSuggestion[]> {
    const suggestions: EnrichmentSuggestion[] = [];
    const brand = data.brand_name || data.brand || undefined;

    // Color mapping suggestion
    const colorName = data.color_name || data.color;
    if (colorName && !data.color_map) {
      const colorMapping = await this.getColorMapping(colorName, brand);
      if (colorMapping) {
        suggestions.push({
          field: 'color_map',
          suggestedValue: colorMapping,
          confidence: 'high',
          reason: `Mapped from color_name "${colorName}" using lookup table`,
        });
      }
    }

    // Size mapping suggestion
    const sizeName = data.size_name || data.size;
    if (sizeName && !data.size_map) {
      const sizeMapping = await this.getSizeMapping(sizeName, brand);
      if (sizeMapping) {
        suggestions.push({
          field: 'size_map',
          suggestedValue: sizeMapping,
          confidence: 'high',
          reason: `Mapped from size_name "${sizeName}" using lookup table`,
        });
      }
    }

    // Department inference suggestion
    if (!data.department_name) {
      const inferredDepartment = this.inferDepartment(data);
      if (inferredDepartment) {
        suggestions.push({
          field: 'department_name',
          suggestedValue: inferredDepartment,
          confidence: 'medium',
          reason: `Inferred from product attributes`,
        });
      }
    }

    // Item type inference suggestion
    if (!data.item_type) {
      const inferredItemTypes = this.inferItemType(data);
      if (inferredItemTypes && inferredItemTypes.length > 0) {
        // Suggest the first (most specific) item type
        suggestions.push({
          field: 'item_type',
          suggestedValue: inferredItemTypes[0],
          confidence: 'medium',
          reason: `Inferred from clothing_type "${data.clothing_type || data.garment_type || ''}"`,
        });
      }
    }

    // Optional field suggestions (info-level)
    const optionalFieldSuggestions = this.getOptionalFieldSuggestions(data);
    suggestions.push(...optionalFieldSuggestions);

    return suggestions;
  }

  /**
   * Check for missing recommended optional fields and return info-level suggestions
   * 
   * @param data - Product data row
   * @returns Array of suggestions for missing optional fields
   */
  private getOptionalFieldSuggestions(data: Record<string, any>): EnrichmentSuggestion[] {
    const suggestions: EnrichmentSuggestion[] = [];

    for (const field of RECOMMENDED_OPTIONAL_FIELDS) {
      // Check if field is missing or empty
      const value = data[field];
      const isEmpty = value === undefined || value === null || value === '';

      if (isEmpty) {
        suggestions.push({
          field,
          suggestedValue: '', // No specific value to suggest, just flagging as missing
          confidence: 'low',
          reason: `Recommended optional field "${field}" is missing. Adding this field can improve listing quality.`,
        });
      }
    }

    return suggestions;
  }

  /**
   * Apply automatic fixes to product data
   * Fixes whitespace, formatting, check digits, and standard mappings
   * 
   * @param data - Product data row
   * @returns Object with fixed data and array of applied fixes
   */
  async applyAutoFix(data: Record<string, any>): Promise<{ fixedData: Record<string, any>; fixes: AutoFix[] }> {
    const fixedData = { ...data };
    const fixes: AutoFix[] = [];

    // Fix whitespace issues in all string fields
    for (const [field, value] of Object.entries(fixedData)) {
      if (typeof value === 'string' && value !== value.trim()) {
        const originalValue = value;
        const fixedValue = value.trim().replace(/\s+/g, ' ');
        fixedData[field] = fixedValue;
        
        if (originalValue !== fixedValue) {
          fixes.push({
            field,
            originalValue,
            fixedValue,
            fixType: 'whitespace',
            description: `Removed leading/trailing whitespace and normalized spaces`,
          });
        }
      }
    }

    // Fix UPC/EAN check digits if invalid
    const externalProductId = fixedData.external_product_id;
    if (externalProductId && typeof externalProductId === 'string') {
      const digits = externalProductId.replace(/\D/g, '');
      
      if (digits.length === 12 || digits.length === 13) {
        const calculatedCheckDigit = this.calculateCheckDigit(digits.slice(0, -1));
        const currentCheckDigit = digits.slice(-1);
        
        if (calculatedCheckDigit !== currentCheckDigit) {
          const fixedValue = digits.slice(0, -1) + calculatedCheckDigit;
          fixes.push({
            field: 'external_product_id',
            originalValue: externalProductId,
            fixedValue,
            fixType: 'check_digit',
            description: `Corrected check digit from ${currentCheckDigit} to ${calculatedCheckDigit}`,
          });
          fixedData.external_product_id = fixedValue;
        }
      }
    }

    // Apply standard mappings from lookup tables
    const brand = fixedData.brand_name || fixedData.brand || undefined;

    // Auto-fix color_map if color_name is present
    const colorName = fixedData.color_name || fixedData.color;
    if (colorName && !fixedData.color_map) {
      const colorMapping = await this.getColorMapping(colorName, brand);
      if (colorMapping) {
        fixes.push({
          field: 'color_map',
          originalValue: null,
          fixedValue: colorMapping,
          fixType: 'mapping',
          description: `Applied color mapping from lookup table`,
        });
        fixedData.color_map = colorMapping;
      }
    }

    // Auto-fix size_map if size_name is present
    const sizeName = fixedData.size_name || fixedData.size;
    if (sizeName && !fixedData.size_map) {
      const sizeMapping = await this.getSizeMapping(sizeName, brand);
      if (sizeMapping) {
        fixes.push({
          field: 'size_map',
          originalValue: null,
          fixedValue: sizeMapping,
          fixType: 'mapping',
          description: `Applied size mapping from lookup table`,
        });
        fixedData.size_map = sizeMapping;
      }
    }

    // Fix formatting issues in specific fields
    
    // Fix item_sku: remove whitespace and convert to uppercase
    if (fixedData.item_sku && typeof fixedData.item_sku === 'string') {
      const original = fixedData.item_sku;
      const fixed = original.trim().toUpperCase().replace(/\s+/g, '');
      if (original !== fixed) {
        fixes.push({
          field: 'item_sku',
          originalValue: original,
          fixedValue: fixed,
          fixType: 'formatting',
          description: `Normalized SKU format (uppercase, no spaces)`,
        });
        fixedData.item_sku = fixed;
      }
    }

    // Fix standard_price: ensure proper decimal format
    if (fixedData.standard_price) {
      const priceStr = fixedData.standard_price.toString().trim();
      const priceNum = parseFloat(priceStr);
      
      if (!isNaN(priceNum) && priceNum > 0) {
        const formatted = priceNum.toFixed(2);
        if (priceStr !== formatted) {
          fixes.push({
            field: 'standard_price',
            originalValue: fixedData.standard_price,
            fixedValue: formatted,
            fixType: 'formatting',
            description: `Formatted price to 2 decimal places`,
          });
          fixedData.standard_price = formatted;
        }
      }
    }

    // Fix quantity: ensure integer format
    if (fixedData.quantity !== undefined && fixedData.quantity !== null) {
      const quantityStr = fixedData.quantity.toString().trim();
      const quantityNum = parseInt(quantityStr, 10);
      
      if (!isNaN(quantityNum) && quantityNum >= 0) {
        const formatted = quantityNum.toString();
        if (quantityStr !== formatted) {
          fixes.push({
            field: 'quantity',
            originalValue: fixedData.quantity,
            fixedValue: formatted,
            fixType: 'formatting',
            description: `Formatted quantity as integer`,
          });
          fixedData.quantity = formatted;
        }
      }
    }

    return { fixedData, fixes };
  }

  /**
   * Calculate UPC/EAN check digit
   * 
   * @param digits - The first 11 (UPC) or 12 (EAN) digits
   * @returns The calculated check digit
   */
  private calculateCheckDigit(digits: string): string {
    const digitsArray = digits.split('').map(Number);
    let sum = 0;

    // For UPC-A (11 digits) and EAN-13 (12 digits)
    // Alternate multiplying by 3 and 1, starting from the right
    for (let i = digitsArray.length - 1; i >= 0; i--) {
      const position = digitsArray.length - 1 - i;
      const multiplier = position % 2 === 0 ? 3 : 1;
      sum += digitsArray[i] * multiplier;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }

  /**
   * Check if a field has an available auto-fix
   * 
   * @param field - Field name
   * @param value - Field value
   * @param data - Full product data row (for context)
   * @returns True if auto-fix is available for this field
   */
  async hasAutoFix(field: string, value: any, data: Record<string, any>): Promise<boolean> {
    // Whitespace fixes
    if (typeof value === 'string' && value !== value.trim()) {
      return true;
    }

    // Check digit fixes
    if (field === 'external_product_id' && typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 12 || digits.length === 13) {
        const calculatedCheckDigit = this.calculateCheckDigit(digits.slice(0, -1));
        const currentCheckDigit = digits.slice(-1);
        return calculatedCheckDigit !== currentCheckDigit;
      }
    }

    // Mapping fixes
    const brand = data.brand_name || data.brand || undefined;
    
    if (field === 'color_map' && !value) {
      const colorName = data.color_name || data.color;
      if (colorName) {
        const mapping = await this.getColorMapping(colorName, brand);
        return mapping !== null;
      }
    }

    if (field === 'size_map' && !value) {
      const sizeName = data.size_name || data.size;
      if (sizeName) {
        const mapping = await this.getSizeMapping(sizeName, brand);
        return mapping !== null;
      }
    }

    // Formatting fixes
    if (field === 'item_sku' && typeof value === 'string') {
      const fixed = value.trim().toUpperCase().replace(/\s+/g, '');
      return value !== fixed;
    }

    if (field === 'standard_price') {
      const priceStr = value.toString().trim();
      const priceNum = parseFloat(priceStr);
      if (!isNaN(priceNum) && priceNum > 0) {
        const formatted = priceNum.toFixed(2);
        return priceStr !== formatted;
      }
    }

    if (field === 'quantity') {
      const quantityStr = value.toString().trim();
      const quantityNum = parseInt(quantityStr, 10);
      if (!isNaN(quantityNum) && quantityNum >= 0) {
        const formatted = quantityNum.toString();
        return quantityStr !== formatted;
      }
    }

    return false;
  }


    /**
     * Apply enrichment suggestion and track the change
     *
     * @param data - Current product data
     * @param suggestion - Enrichment suggestion to apply
     * @returns Updated data with enrichment applied and change tracked
     */
    applyEnrichmentSuggestion(
      data: Record<string, any>,
      suggestion: EnrichmentSuggestion
    ): { updatedData: Record<string, any>; change: EnrichmentChange } {
      const updatedData = { ...data };
      const originalValue = data[suggestion.field];

      // Apply the suggestion
      updatedData[suggestion.field] = suggestion.suggestedValue;

      // Track the change
      const change: EnrichmentChange = {
        field: suggestion.field,
        originalValue,
        newValue: suggestion.suggestedValue,
        changeType: 'suggestion_applied',
        timestamp: new Date(),
        reason: suggestion.reason,
      };

      return { updatedData, change };
    }

    /**
     * Track enrichment changes from auto-fix
     * Converts AutoFix array to EnrichmentChange array
     *
     * @param fixes - Array of auto-fixes applied
     * @returns Array of enrichment changes
     */
    trackAutoFixChanges(fixes: AutoFix[]): EnrichmentChange[] {
      return fixes.map(fix => ({
        field: fix.field,
        originalValue: fix.originalValue,
        newValue: fix.fixedValue,
        changeType: 'auto_fix' as const,
        timestamp: new Date(),
        reason: fix.description,
      }));
    }

    /**
     * Track manual edit change
     *
     * @param field - Field that was edited
     * @param originalValue - Original value before edit
     * @param newValue - New value after edit
     * @returns Enrichment change record
     */
    trackManualEdit(field: string, originalValue: any, newValue: any): EnrichmentChange {
      return {
        field,
        originalValue,
        newValue,
        changeType: 'manual_edit',
        timestamp: new Date(),
      };
    }

    /**
     * Get enrichment history from enriched data
     * Extracts the change history from the enriched data JSONB field
     *
     * @param enrichedData - Enriched data object that may contain _enrichmentHistory
     * @returns Array of enrichment changes
     */
    getEnrichmentHistory(enrichedData: Record<string, any>): EnrichmentChange[] {
      return (enrichedData._enrichmentHistory as EnrichmentChange[]) || [];
    }

    /**
     * Add enrichment change to history
     * Updates the enriched data with a new change record
     *
     * @param enrichedData - Current enriched data
     * @param change - New enrichment change to add
     * @returns Updated enriched data with change added to history
     */
    addEnrichmentChange(
      enrichedData: Record<string, any>,
      change: EnrichmentChange
    ): Record<string, any> {
      const updated = { ...enrichedData };
      const history = this.getEnrichmentHistory(enrichedData);

      updated._enrichmentHistory = [...history, change];

      return updated;
    }

    /**
     * Add multiple enrichment changes to history
     *
     * @param enrichedData - Current enriched data
     * @param changes - Array of enrichment changes to add
     * @returns Updated enriched data with changes added to history
     */
    addEnrichmentChanges(
      enrichedData: Record<string, any>,
      changes: EnrichmentChange[]
    ): Record<string, any> {
      const updated = { ...enrichedData };
      const history = this.getEnrichmentHistory(enrichedData);

      updated._enrichmentHistory = [...history, ...changes];

      return updated;
    }

    /**
     * Get enrichment summary for a row
     * Returns statistics about enrichment changes
     *
     * @param enrichedData - Enriched data with history
     * @returns Summary of enrichment changes
     */
    getEnrichmentSummary(enrichedData: Record<string, any>): {
      totalChanges: number;
      suggestionApplied: number;
      autoFix: number;
      manualEdit: number;
      fieldsChanged: string[];
    } {
      const history = this.getEnrichmentHistory(enrichedData);

      const summary = {
        totalChanges: history.length,
        suggestionApplied: history.filter(c => c.changeType === 'suggestion_applied').length,
        autoFix: history.filter(c => c.changeType === 'auto_fix').length,
        manualEdit: history.filter(c => c.changeType === 'manual_edit').length,
        fieldsChanged: Array.from(new Set(history.map(c => c.field))),
      };

      return summary;
    }

}
