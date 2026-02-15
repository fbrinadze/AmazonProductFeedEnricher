import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { csvParserService, ParsedData } from './csv-parser.service.js';
import { excelParserService } from './excel-parser.service.js';
import { columnMappingService, AutoMappingResult } from './column-mapping.service.js';

const prisma = new PrismaClient();

export interface CreateUploadParams {
  userId: string;
  filename: string;
  filePath: string;
  originalSize: number;
}

export interface UploadRecord {
  id: string;
  userId: string;
  filename: string;
  originalSize: bigint | null;
  rowCount: number | null;
  errorCount: number;
  warningCount: number;
  passCount: number;
  status: string;
  filePath: string | null;
  exportPath: string | null;
  mappingTemplateId: string | null;
  createdAt: Date;
}

export interface UploadPreview {
  headers: string[];
  previewRows: Record<string, any>[];
  totalRows: number;
  autoMapping?: AutoMappingResult;
}

export class UploadService {
  /**
   * Create a new upload record in the database
   */
  async createUpload(params: CreateUploadParams): Promise<UploadRecord> {
    const upload = await prisma.upload.create({
      data: {
        userId: params.userId,
        filename: params.filename,
        filePath: params.filePath,
        originalSize: BigInt(params.originalSize),
        status: 'pending',
      },
    });

    return upload;
  }

  /**
   * Get upload by ID
   */
  async getUploadById(uploadId: string): Promise<UploadRecord | null> {
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
    });

    return upload;
  }

  /**
   * Get all uploads for a user (or all uploads for admin)
   */
  async getUploads(userId: string, isAdmin: boolean): Promise<UploadRecord[]> {
    const uploads = await prisma.upload.findMany({
      where: isAdmin ? {} : { userId },
      orderBy: { createdAt: 'desc' },
    });

    return uploads;
  }

  /**
   * Update upload status
   */
  async updateUploadStatus(uploadId: string, status: string): Promise<UploadRecord> {
    const upload = await prisma.upload.update({
      where: { id: uploadId },
      data: { status },
    });

    return upload;
  }

  /**
   * Delete upload and associated file
   */
  async deleteUpload(uploadId: string): Promise<void> {
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error('Upload not found');
    }

    // Delete file from filesystem if it exists
    if (upload.filePath && fs.existsSync(upload.filePath)) {
      fs.unlinkSync(upload.filePath);
    }

    // Delete export file if it exists
    if (upload.exportPath && fs.existsSync(upload.exportPath)) {
      fs.unlinkSync(upload.exportPath);
    }

    // Delete from database (cascade will delete upload_rows)
    await prisma.upload.delete({
      where: { id: uploadId },
    });
  }

  /**
   * Validate file exists and is accessible
   */
  validateFileExists(filePath: string): boolean {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  }

  /**
   * Parse uploaded file and generate preview
   * Returns headers and first 10 rows
   */
  async parseAndPreview(filePath: string, sheetName?: string): Promise<UploadPreview> {
    const ext = path.extname(filePath).toLowerCase();
    let parsedData: ParsedData;

    if (ext === '.csv') {
      parsedData = await csvParserService.parseCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      parsedData = await excelParserService.parseExcel(filePath, { sheetName });
    } else {
      throw new Error('Unsupported file format');
    }

    // Return first 10 rows as preview
    const previewRows = parsedData.rows.slice(0, 10);

    // Auto-map columns to Amazon fields
    const autoMapping = columnMappingService.autoMapColumns(parsedData.headers);

    return {
      headers: parsedData.headers,
      previewRows,
      totalRows: parsedData.rowCount,
      autoMapping,
    };
  }

  /**
   * Get sheet names from Excel file
   */
  getExcelSheetNames(filePath: string): string[] {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext !== '.xlsx' && ext !== '.xls') {
      throw new Error('File is not an Excel file');
    }

    return excelParserService.getSheetNames(filePath);
  }
}

export const uploadService = new UploadService();
