import { Router, Request, Response } from 'express';
import multer from 'multer';
import { upload } from '../config/multer.js';
import { uploadService } from '../services/upload.service.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

// All upload routes require authentication
router.use(authenticateJWT);

/**
 * POST /api/uploads
 * Upload a new file (CSV, XLSX, XLS)
 */
router.post('/', (req: Request, res: Response, next) => {
  upload.single('file')(req, res, (err) => {
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

    // Create upload record in database
    const uploadRecord = await uploadService.createUpload({
      userId: req.user.id,
      filename: req.file.originalname,
      filePath: req.file.path,
      originalSize: req.file.size,
    });

    return res.status(201).json({
      id: uploadRecord.id,
      filename: uploadRecord.filename,
      originalSize: uploadRecord.originalSize?.toString(),
      status: uploadRecord.status,
      createdAt: uploadRecord.createdAt,
    });
  } catch (error) {
    console.error('Upload error:', error);

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

export default router;
