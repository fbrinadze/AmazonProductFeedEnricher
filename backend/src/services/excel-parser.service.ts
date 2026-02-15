import * as XLSX from 'xlsx';
import fs from 'fs';

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

export interface ExcelParseOptions {
  sheetName?: string;
}

export class ExcelParserService {
  /**
   * Get all sheet names from an Excel file
   * Supports both XLSX and XLS formats
   */
  getSheetNames(filePath: string): string[] {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames;
  }

  /**
   * Parse an Excel file (XLSX or XLS)
   * If sheetName is not provided, parses the first sheet
   */
  async parseExcel(filePath: string, options: ExcelParseOptions = {}): Promise<ParsedData> {
    try {
      // Read the file
      const buffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // Determine which sheet to parse
      const sheetName = options.sheetName || workbook.SheetNames[0];
      
      if (!workbook.SheetNames.includes(sheetName)) {
        throw new Error(`Sheet "${sheetName}" not found in workbook`);
      }

      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Get raw array data first
        defval: '', // Default value for empty cells
        blankrows: false, // Skip blank rows
      }) as any[][];

      if (jsonData.length === 0) {
        return {
          headers: [],
          rows: [],
          rowCount: 0,
        };
      }

      // First row is headers
      const headers = jsonData[0].map((header: any) => 
        String(header || '').trim()
      );

      // Remaining rows are data
      const dataRows = jsonData.slice(1);

      // Convert array rows to objects with headers as keys
      const rows = dataRows.map((row: any[]) => {
        const rowObject: Record<string, any> = {};
        headers.forEach((header, index) => {
          rowObject[header] = row[index] !== undefined ? row[index] : '';
        });
        return rowObject;
      });

      return {
        headers,
        rows,
        rowCount: rows.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Excel parsing failed: ${error.message}`);
      }
      throw new Error('Excel parsing failed: Unknown error');
    }
  }
}

export const excelParserService = new ExcelParserService();
