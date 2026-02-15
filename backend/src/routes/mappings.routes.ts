import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();
const prisma = new PrismaClient();

// All mapping routes require authentication
router.use(authenticateJWT);

/**
 * GET /api/mappings
 * List all mapping templates for the current user (or all for admin)
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
    
    // Admin sees all templates, users see only their own
    const templates = await prisma.mappingTemplate.findMany({
      where: isAdmin ? {} : { userId: req.user.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        isDefault: true,
        mappings: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
      },
    });

    return res.json({
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        isDefault: template.isDefault,
        mappings: template.mappings,
        userId: template.userId,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Get mapping templates error:', error);
    return res.status(500).json({
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch mapping templates',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/mappings
 * Create a new mapping template
 */
router.post('/', async (req: Request, res: Response) => {
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

    const { name, mappings, isDefault } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Template name is required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!mappings || typeof mappings !== 'object') {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Mappings object is required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Only admins can set default templates
    const canSetDefault = req.user.role === 'admin';
    const templateIsDefault = canSetDefault && isDefault === true;

    // If setting as default, unset other defaults
    if (templateIsDefault) {
      await prisma.mappingTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.mappingTemplate.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        mappings,
        isDefault: templateIsDefault,
      },
    });

    return res.status(201).json({
      id: template.id,
      name: template.name,
      isDefault: template.isDefault,
      mappings: template.mappings,
      userId: template.userId,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (error) {
    console.error('Create mapping template error:', error);
    return res.status(500).json({
      error: {
        code: 'CREATE_FAILED',
        message: 'Failed to create mapping template',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * PUT /api/mappings/:id
 * Update an existing mapping template
 */
router.put('/:id', async (req: Request, res: Response) => {
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

    const { name, mappings, isDefault } = req.body;

    // Find the template
    const existingTemplate = await prisma.mappingTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!existingTemplate) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Mapping template not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check authorization: user can only update their own templates unless admin
    if (existingTemplate.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this template',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate inputs if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Template name must be a non-empty string',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (mappings !== undefined && typeof mappings !== 'object') {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Mappings must be an object',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Only admins can set default templates
    const canSetDefault = req.user.role === 'admin';
    const templateIsDefault = canSetDefault && isDefault === true;

    // If setting as default, unset other defaults
    if (templateIsDefault && !existingTemplate.isDefault) {
      await prisma.mappingTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (mappings !== undefined) updateData.mappings = mappings;
    if (canSetDefault && isDefault !== undefined) updateData.isDefault = isDefault;

    const template = await prisma.mappingTemplate.update({
      where: { id: req.params.id },
      data: updateData,
    });

    return res.json({
      id: template.id,
      name: template.name,
      isDefault: template.isDefault,
      mappings: template.mappings,
      userId: template.userId,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (error) {
    console.error('Update mapping template error:', error);
    return res.status(500).json({
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update mapping template',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * DELETE /api/mappings/:id
 * Delete a mapping template
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

    const template = await prisma.mappingTemplate.findUnique({
      where: { id: req.params.id },
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

    // Check authorization: user can only delete their own templates unless admin
    if (template.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this template',
          timestamp: new Date().toISOString(),
        },
      });
    }

    await prisma.mappingTemplate.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete mapping template error:', error);
    return res.status(500).json({
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete mapping template',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;
