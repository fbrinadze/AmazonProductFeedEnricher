import Papa from 'papaparse';
import fs from 'fs';
import { detect } from 'jschardet';

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

export interface ParseOptions {
  delimiter?: string;
  encoding?: string;
}

export class CSVParserService {
  /**
   * Detect the delimiter used in a CSV file
   * Supports comma, tab, and pipe delimiters
   */
  detectDelimiter(content: string): string {
    const delimiters = [',', '\t', '|'];
    const sampleLines = content.split('\n').slice(0, 5).join('\n');
    
    let maxCount = 0;
    let detectedDelimiter = ',';
    
    for (const delimiter of delimiters) {
      const lines = sampleLines.split('\n').filter(line => line.trim());
      if (lines.length === 0) continue;
      
      const counts = lines.map(line => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length);
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
      const isConsistent = counts.every(count => count === counts[0]);
      
      if (isConsistent && avgCount > maxCount) {
        maxCount = avgCount;
        detectedDelimiter = delimiter;
      }
    }
    
    return detectedDelimiter;
  }

  /**
   * Detect the encoding of a file
   * Supports UTF-8, Latin-1 (ISO-8859-1), and Windows-1252
   */
  detectEncoding(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    const detected = detect(buffer);
    
    // Map detected encoding to supported encodings
    const encoding = detected.encoding?.toLowerCase() || 'utf-8';
    
    if (encoding.includes('utf-8') || encoding.includes('utf8')) {
      return 'utf-8';
    } else if (encoding.includes('iso-8859-1') || encoding.includes('latin1')) {
      return 'latin1';
    } else if (encoding.includes('windows-1252') || encoding.includes('cp1252')) {
      return 'windows-1252';
    }
    
    // Default to UTF-8 if unknown
    return 'utf-8';
  }

  /**
   * Parse a CSV file with automatic delimiter and encoding detection
   */
  async parseCSV(filePath: string, options: ParseOptions = {}): Promise<ParsedData> {
    // Detect encoding if not provided
    const encoding = options.encoding || this.detectEncoding(filePath);
    
    // Read file with detected encoding
    const content = fs.readFileSync(filePath, { encoding: encoding as BufferEncoding });
    
    // Detect delimiter if not provided
    const delimiter = options.delimiter || this.detectDelimiter(content);
    
    // Parse CSV using Papa Parse
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        delimiter,
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        complete: (results) => {
          const headers = results.meta.fields || [];
          const rows = results.data as Record<string, any>[];
          
          resolve({
            headers,
            rows,
            rowCount: rows.length,
          });
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  }
}

export const csvParserService = new CSVParserService();
