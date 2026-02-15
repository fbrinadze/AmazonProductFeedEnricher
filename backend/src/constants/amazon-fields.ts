/**
 * Amazon Clothing Flat File Template Fields
 * These are the standard fields expected by Amazon Seller Central
 */

export const AMAZON_FIELDS = [
  // Required fields
  'item_sku',
  'item_name',
  'external_product_id',
  'external_product_id_type',
  'brand_name',
  'product_description',
  'standard_price',
  'quantity',
  
  // Department and categorization
  'department_name',
  'item_type',
  'clothing_type',
  
  // Variation fields
  'parent_child',
  'parent_sku',
  'variation_theme',
  
  // Size and color
  'size_name',
  'size_map',
  'color_name',
  'color_map',
  
  // Bullet points
  'bullet_point1',
  'bullet_point2',
  'bullet_point3',
  'bullet_point4',
  'bullet_point5',
  
  // Images
  'main_image_url',
  'other_image_url1',
  'other_image_url2',
  'other_image_url3',
  'other_image_url4',
  'other_image_url5',
  'other_image_url6',
  'other_image_url7',
  'other_image_url8',
  
  // Additional attributes
  'material_type',
  'fabric_type',
  'care_instructions',
  'country_of_origin',
  'manufacturer',
  'fulfillment_channel',
] as const;

export type AmazonField = typeof AMAZON_FIELDS[number];

/**
 * Common variations of field names that might appear in source files
 * Maps source column names to Amazon field names
 */
export const FIELD_NAME_VARIATIONS: Record<string, AmazonField> = {
  // SKU variations
  'sku': 'item_sku',
  'product_sku': 'item_sku',
  'seller_sku': 'item_sku',
  'item_sku': 'item_sku',
  
  // Title/Name variations
  'title': 'item_name',
  'product_title': 'item_name',
  'product_name': 'item_name',
  'name': 'item_name',
  'item_name': 'item_name',
  
  // UPC/EAN variations
  'upc': 'external_product_id',
  'ean': 'external_product_id',
  'barcode': 'external_product_id',
  'product_id': 'external_product_id',
  'external_product_id': 'external_product_id',
  
  // Barcode type
  'barcode_type': 'external_product_id_type',
  'id_type': 'external_product_id_type',
  'external_product_id_type': 'external_product_id_type',
  
  // Brand variations
  'brand': 'brand_name',
  'brand_name': 'brand_name',
  'manufacturer': 'manufacturer',
  
  // Description variations
  'description': 'product_description',
  'product_description': 'product_description',
  'long_description': 'product_description',
  
  // Price variations
  'price': 'standard_price',
  'list_price': 'standard_price',
  'standard_price': 'standard_price',
  'unit_price': 'standard_price',
  
  // Quantity variations
  'qty': 'quantity',
  'stock': 'quantity',
  'inventory': 'quantity',
  'quantity': 'quantity',
  'available_quantity': 'quantity',
  
  // Department variations
  'department': 'department_name',
  'dept': 'department_name',
  'category': 'department_name',
  'department_name': 'department_name',
  
  // Item type variations
  'type': 'item_type',
  'product_type': 'item_type',
  'item_type': 'item_type',
  
  // Clothing type
  'clothing_type': 'clothing_type',
  'garment_type': 'clothing_type',
  
  // Parent-child variations
  'parent_child': 'parent_child',
  'relationship_type': 'parent_child',
  
  // Parent SKU
  'parent': 'parent_sku',
  'parent_sku': 'parent_sku',
  'parent_id': 'parent_sku',
  
  // Variation theme
  'variation_theme': 'variation_theme',
  'variation_type': 'variation_theme',
  
  // Size variations
  'size': 'size_name',
  'size_name': 'size_name',
  'product_size': 'size_name',
  
  // Size map
  'size_map': 'size_map',
  'amazon_size': 'size_map',
  
  // Color variations
  'color': 'color_name',
  'color_name': 'color_name',
  'product_color': 'color_name',
  
  // Color map
  'color_map': 'color_map',
  'amazon_color': 'color_map',
  
  // Bullet points
  'bullet1': 'bullet_point1',
  'bullet_1': 'bullet_point1',
  'bullet_point1': 'bullet_point1',
  'feature1': 'bullet_point1',
  
  'bullet2': 'bullet_point2',
  'bullet_2': 'bullet_point2',
  'bullet_point2': 'bullet_point2',
  'feature2': 'bullet_point2',
  
  'bullet3': 'bullet_point3',
  'bullet_3': 'bullet_point3',
  'bullet_point3': 'bullet_point3',
  'feature3': 'bullet_point3',
  
  'bullet4': 'bullet_point4',
  'bullet_4': 'bullet_point4',
  'bullet_point4': 'bullet_point4',
  'feature4': 'bullet_point4',
  
  'bullet5': 'bullet_point5',
  'bullet_5': 'bullet_point5',
  'bullet_point5': 'bullet_point5',
  'feature5': 'bullet_point5',
  
  // Image variations
  'image': 'main_image_url',
  'main_image': 'main_image_url',
  'image_url': 'main_image_url',
  'main_image_url': 'main_image_url',
  'primary_image': 'main_image_url',
  
  'image1': 'other_image_url1',
  'other_image1': 'other_image_url1',
  'other_image_url1': 'other_image_url1',
  
  'image2': 'other_image_url2',
  'other_image2': 'other_image_url2',
  'other_image_url2': 'other_image_url2',
  
  'image3': 'other_image_url3',
  'other_image3': 'other_image_url3',
  'other_image_url3': 'other_image_url3',
  
  'image4': 'other_image_url4',
  'other_image4': 'other_image_url4',
  'other_image_url4': 'other_image_url4',
  
  'image5': 'other_image_url5',
  'other_image5': 'other_image_url5',
  'other_image_url5': 'other_image_url5',
  
  'image6': 'other_image_url6',
  'other_image6': 'other_image_url6',
  'other_image_url6': 'other_image_url6',
  
  'image7': 'other_image_url7',
  'other_image7': 'other_image_url7',
  'other_image_url7': 'other_image_url7',
  
  'image8': 'other_image_url8',
  'other_image8': 'other_image_url8',
  'other_image_url8': 'other_image_url8',
  
  // Material and fabric
  'material': 'material_type',
  'material_type': 'material_type',
  'fabric': 'fabric_type',
  'fabric_type': 'fabric_type',
  
  // Care instructions
  'care': 'care_instructions',
  'care_instructions': 'care_instructions',
  'washing_instructions': 'care_instructions',
  
  // Country of origin
  'country': 'country_of_origin',
  'origin': 'country_of_origin',
  'country_of_origin': 'country_of_origin',
  'made_in': 'country_of_origin',
  
  // Fulfillment
  'fulfillment': 'fulfillment_channel',
  'fulfillment_channel': 'fulfillment_channel',
  'shipping_method': 'fulfillment_channel',
};
