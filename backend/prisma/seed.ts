import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create initial admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bcibrands.com' },
    update: {},
    create: {
      email: 'admin@bcibrands.com',
      passwordHash: adminPassword,
      fullName: 'System Administrator',
      role: 'admin',
      isActive: true,
    },
  });
  console.log('Created admin user:', admin.email);

  // Create sample validation rules
  const validationRules = [
    {
      fieldName: 'item_sku',
      ruleType: 'required',
      ruleConfig: {},
      severity: 'error',
      message: 'SKU is required and must be unique',
      sortOrder: 1,
    },
    {
      fieldName: 'item_name',
      ruleType: 'required',
      ruleConfig: {},
      severity: 'error',
      message: 'Product title is required',
      sortOrder: 2,
    },
    {
      fieldName: 'item_name',
      ruleType: 'max_length',
      ruleConfig: { max: 200 },
      severity: 'error',
      message: 'Product title must not exceed 200 characters',
      sortOrder: 3,
    },
    {
      fieldName: 'external_product_id',
      ruleType: 'custom',
      ruleConfig: { function: 'validateUPCEAN' },
      severity: 'error',
      message: 'UPC/EAN must be valid with correct check digit',
      sortOrder: 4,
    },
    {
      fieldName: 'external_product_id_type',
      ruleType: 'lookup',
      ruleConfig: { values: ['UPC', 'EAN'] },
      severity: 'error',
      message: 'Barcode type must be UPC or EAN',
      sortOrder: 5,
    },
    {
      fieldName: 'brand_name',
      ruleType: 'required',
      ruleConfig: {},
      severity: 'error',
      message: 'Brand name is required',
      sortOrder: 6,
    },
    {
      fieldName: 'department_name',
      ruleType: 'lookup',
      ruleConfig: { table_type: 'department' },
      severity: 'error',
      message: 'Department must be a valid Amazon department',
      sortOrder: 7,
    },
    {
      fieldName: 'product_description',
      ruleType: 'required',
      ruleConfig: {},
      severity: 'error',
      message: 'Product description is required',
      sortOrder: 8,
    },
    {
      fieldName: 'product_description',
      ruleType: 'max_length',
      ruleConfig: { max: 2000 },
      severity: 'error',
      message: 'Product description must not exceed 2000 characters',
      sortOrder: 9,
    },
    {
      fieldName: 'product_description',
      ruleType: 'regex',
      ruleConfig: { pattern: '^(?!.*<[^>]+>).*$' },
      severity: 'error',
      message: 'Product description must not contain HTML tags',
      sortOrder: 10,
    },
    {
      fieldName: 'bullet_point1',
      ruleType: 'required',
      ruleConfig: {},
      severity: 'error',
      message: 'At least one bullet point is required',
      sortOrder: 11,
    },
    {
      fieldName: 'bullet_point1',
      ruleType: 'max_length',
      ruleConfig: { max: 500 },
      severity: 'error',
      message: 'Bullet points must not exceed 500 characters',
      sortOrder: 12,
    },
    {
      fieldName: 'color_map',
      ruleType: 'lookup',
      ruleConfig: { table_type: 'color_map' },
      severity: 'error',
      message: 'Color must be a valid Amazon color map value',
      sortOrder: 13,
    },
    {
      fieldName: 'size_map',
      ruleType: 'lookup',
      ruleConfig: { table_type: 'size_map' },
      severity: 'error',
      message: 'Size must be a valid Amazon size map value',
      sortOrder: 14,
    },
    {
      fieldName: 'main_image_url',
      ruleType: 'regex',
      ruleConfig: { pattern: '^https?://[^\\s]+$' },
      severity: 'error',
      message: 'Main image URL must be a valid URL',
      sortOrder: 15,
    },
    {
      fieldName: 'standard_price',
      ruleType: 'range',
      ruleConfig: { min: 0.01 },
      severity: 'error',
      message: 'Price must be a positive value',
      sortOrder: 16,
    },
    {
      fieldName: 'quantity',
      ruleType: 'range',
      ruleConfig: { min: 0 },
      severity: 'error',
      message: 'Quantity must be a non-negative integer',
      sortOrder: 17,
    },
    {
      fieldName: 'item_name',
      ruleType: 'custom',
      ruleConfig: { function: 'checkTitleQuality' },
      severity: 'warning',
      message: 'Title may be missing brand, color, size, or material',
      sortOrder: 18,
    },
    {
      fieldName: 'bullet_point1',
      ruleType: 'custom',
      ruleConfig: { function: 'checkBulletQuality', minLength: 15 },
      severity: 'warning',
      message: 'Bullet point is too short (minimum 15 characters recommended)',
      sortOrder: 19,
    },
    {
      fieldName: 'product_description',
      ruleType: 'custom',
      ruleConfig: { function: 'checkDescriptionQuality', minLength: 100 },
      severity: 'warning',
      message: 'Description is too short (minimum 100 characters recommended)',
      sortOrder: 20,
    },
    {
      fieldName: 'standard_price',
      ruleType: 'custom',
      ruleConfig: { function: 'checkPriceReasonableness', maxPrice: 10000 },
      severity: 'warning',
      message: 'Price seems unusually high or is zero',
      sortOrder: 21,
    },
  ];

  for (const rule of validationRules) {
    await prisma.validationRule.create({
      data: rule,
    });
  }
  console.log(`Created ${validationRules.length} validation rules`);

  // Create sample brand configurations
  const brands = [
    {
      brandName: 'CECE',
      amazonBrand: 'CeCe',
      defaultManufacturer: 'BCI Brands',
      defaultFulfillment: 'DEFAULT',
    },
    {
      brandName: 'Vince Camuto',
      amazonBrand: 'Vince Camuto',
      defaultManufacturer: 'BCI Brands',
      defaultFulfillment: 'DEFAULT',
    },
    {
      brandName: '1.STATE',
      amazonBrand: '1.STATE',
      defaultManufacturer: 'BCI Brands',
      defaultFulfillment: 'DEFAULT',
    },
  ];

  for (const brand of brands) {
    await prisma.brandConfig.upsert({
      where: { brandName: brand.brandName },
      update: {},
      create: brand,
    });
  }
  console.log(`Created ${brands.length} brand configurations`);

  // Create sample lookup table entries
  const lookupEntries = [
    // Color mappings
    { tableType: 'color_map', sourceValue: 'Black', targetValue: 'Black' },
    { tableType: 'color_map', sourceValue: 'White', targetValue: 'White' },
    { tableType: 'color_map', sourceValue: 'Navy', targetValue: 'Blue' },
    { tableType: 'color_map', sourceValue: 'Red', targetValue: 'Red' },
    { tableType: 'color_map', sourceValue: 'Grey', targetValue: 'Gray' },
    
    // Size mappings
    { tableType: 'size_map', sourceValue: 'XS', targetValue: 'X-Small' },
    { tableType: 'size_map', sourceValue: 'S', targetValue: 'Small' },
    { tableType: 'size_map', sourceValue: 'M', targetValue: 'Medium' },
    { tableType: 'size_map', sourceValue: 'L', targetValue: 'Large' },
    { tableType: 'size_map', sourceValue: 'XL', targetValue: 'X-Large' },
    
    // Department mappings
    { tableType: 'department', sourceValue: 'Womens', targetValue: 'womens' },
    { tableType: 'department', sourceValue: 'Mens', targetValue: 'mens' },
    { tableType: 'department', sourceValue: 'Girls', targetValue: 'girls' },
    { tableType: 'department', sourceValue: 'Boys', targetValue: 'boys' },
    
    // Item type mappings
    { tableType: 'item_type', sourceValue: 'Blouse', targetValue: 'shirt-blouse' },
    { tableType: 'item_type', sourceValue: 'Dress', targetValue: 'dress' },
    { tableType: 'item_type', sourceValue: 'Pants', targetValue: 'pants' },
    { tableType: 'item_type', sourceValue: 'Skirt', targetValue: 'skirt' },
  ];

  for (const entry of lookupEntries) {
    const existing = await prisma.lookupTable.findFirst({
      where: {
        tableType: entry.tableType,
        sourceValue: entry.sourceValue,
        brand: null,
      },
    });

    if (!existing) {
      await prisma.lookupTable.create({
        data: entry,
      });
    }
  }
  console.log(`Created ${lookupEntries.length} lookup table entries`);

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
