import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { upload } from '../config/multer.js';
import { uploadService } from '../services/upload.service.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();
const prisma = new PrismaClient();

// All upload routes require authentication
router.use(authenticateJWT);

/**
 * POST /api/uploads
 * Upload a new file (CSV, XLSX, XLS)
 */
router.post('/', (req: Request, res: Response, next) => {
  return upload.single('file')(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'File size exceeds maximum allowed size of 50 MB',
              details: {
                maxSize: 50 * 1024 * 1024,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      if (err.message && err.message.includes('Invalid file format')) {
        return res.status(400).json({
          error: {
            code: 'INVALID_FILE_FORMAT',
            message: err.message,
            timestamp: new Date().toISOString(),
          },
        });
      }

      return res.status(500).json({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload file',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // No error, proceed to the actual handler
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Parse file and generate preview
    const sheetName = req.body.sheetName; // Optional sheet name for Excel files
    let preview;
    
    try {
      preview = await uploadService.parseAndPreview(req.file.path, sheetName);
    } catch (parseError) {
      // Clean up uploaded file on parse error
      if (req.file.path && uploadService.validateFileExists(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        error: {
          code: 'PARSE_FAILED',
          message: parseError instanceof Error ? parseError.message : 'Failed to parse file',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Create upload record in database with row count
    const uploadRecord = await uploadService.createUpload({
      userId: req.user.id,
      filename: req.file.originalname,
      filePath: req.file.path,
      originalSize: req.file.size,
    });

    // Update row count
    await prisma.upload.update({
      where: { id: uploadRecord.id },
      data: { rowCount: preview.totalRows },
    });

    return res.status(201).json({
      id: uploadRecord.id,
      filename: uploadRecord.filename,
      originalSize: uploadRecord.originalSize?.toString(),
      status: uploadRecord.status,
      createdAt: uploadRecord.createdAt,
      preview: {
        headers: preview.headers,
        rows: preview.previewRows,
        totalRows: preview.totalRows,
      },
      autoMapping: preview.autoMapping,
    });
  } catch (error) {
    console.error('Upload error:', error);

    // Clean up uploaded file on error
    if (req.file?.path && uploadService.validateFileExists(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Failed to upload file',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/uploads
 * Get all uploads for the current user (or all uploads for admin)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const isAdmin = req.user.role === 'admin';
    const uploads = await uploadService.getUploads(req.user.id, isAdmin);

    return res.json({
      uploads: uploads.map((upload) => ({
        id: upload.id,
        filename: upload.filename,
        originalSize: upload.originalSize?.toString(),
        rowCount: upload.rowCount,
        errorCount: upload.errorCount,
        warningCount: upload.warningCount,
        passCount: upload.passCount,
        status: upload.status,
        createdAt: upload.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get uploads error:', error);
    return res.status(500).json({
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch uploads',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/uploads/:id
 * Get upload details by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const upload = await uploadService.getUploadById(req.params.id);

    if (!upload) {
      return res.status(404).json({
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: 'Upload not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check authorization: user can only access their own uploads unless admin
    if (upload.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this upload',
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.json({
      id: upload.id,
      filename: upload.filename,
      originalSize: upload.originalSize?.toString(),
      rowCount: upload.rowCount,
      errorCount: upload.errorCount,
      warningCount: upload.warningCount,
      passCount: upload.passCount,
      status: upload.status,
      filePath: upload.filePath,
      exportPath: upload.exportPath,
      mappingTemplateId: upload.mappingTemplateId,
      createdAt: upload.createdAt,
    });
  } catch (error) {
    console.error('Get upload error:', error);
    return res.status(500).json({
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch upload',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * DELETE /api/uploads/:id
 * Delete an upload and its associated data
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const upload = await uploadService.getUploadById(req.params.id);

    if (!upload) {
      return res.status(404).json({
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: 'Upload not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check authorization: user can only delete their own uploads unless admin
    if (upload.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this upload',
          timestamp: new Date().toISOString(),
        },
      });
    }

    await uploadService.deleteUpload(req.params.id);

    return res.status(204).send();
  } catch (error) {
    console.error('Delete upload error:', error);
    return res.status(500).json({
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete upload',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/uploads/:id/sheets
 * Get sheet names from an Excel file
 */
router.get('/:id/sheets', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const upload = await uploadService.getUploadById(req.params.id);

    if (!upload) {
      return res.status(404).json({
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: 'Upload not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check authorization
    if (upload.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this upload',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!upload.filePath) {
      return res.status(400).json({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Upload file not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    try {
      const sheetNames = uploadService.getExcelSheetNames(upload.filePath);
      return res.json({ sheets: sheetNames });
    } catch (error) {
      return res.status(400).json({
        error: {
          code: 'NOT_EXCEL_FILE',
          message: error instanceof Error ? error.message : 'Failed to get sheet names',
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error('Get sheets error:', error);
    return res.status(500).json({
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch sheet names',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;

/**
 * POST /api/uploads/:id/apply-mapping
 * Apply a saved mapping template to an upload
 */
router.post('/:id/apply-mapping', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const { mappingTemplateId } = req.body;

    // Validate input
    if (!mappingTemplateId || typeof mappingTemplateId !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Mapping template ID is required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Get the upload
    const upload = await uploadService.getUploadById(req.params.id);

    if (!upload) {
      return res.status(404).json({
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: 'Upload not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check authorization: user can only access their own uploads unless admin
    if (upload.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this upload',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Get the mapping template
    const template = await prisma.mappingTemplate.findUnique({
      where: { id: mappingTemplateId },
    });

    if (!template) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Mapping template not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check authorization for template: user can only use their own templates or default templates
    // Admin can use any template
    const canUseTemplate =
      req.user.role === 'admin' ||
      template.userId === req.user.id ||
      template.isDefault;

    if (!canUseTemplate) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to use this mapping template',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Update the upload with the mapping template ID
    const updatedUpload = await prisma.upload.update({
      where: { id: req.params.id },
      data: { mappingTemplateId },
    });

    return res.json({
      id: updatedUpload.id,
      filename: updatedUpload.filename,
      mappingTemplateId: updatedUpload.mappingTemplateId,
      mappings: template.mappings,
      message: 'Mapping template applied successfully',
    });
  } catch (error) {
    console.error('Apply mapping error:', error);
    return res.status(500).json({
      error: {
        code: 'APPLY_MAPPING_FAILED',
        message: 'Failed to apply mapping template',
        timestamp: new Date().toISOString(),
      },
    });
  }
});
