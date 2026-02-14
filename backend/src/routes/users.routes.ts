import { Router, Request, Response } from 'express';
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * GET /api/users/me
 * Get current user profile
 * Requires authentication
 * Validates Requirements 1.1
 */
router.get('/me', authenticateJWT, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      },
    });
  }

  return res.status(200).json({
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      isActive: req.user.isActive,
      createdAt: req.user.createdAt,
    },
  });
});

/**
 * GET /api/users
 * List all users (admin only)
 * Validates Requirements 1.7
 */
router.get('/', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    await prisma.$disconnect();

    return res.status(200).json({
      users,
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while fetching users',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/users
 * Create new user (admin only)
 * Validates Requirements 1.7
 */
router.post('/', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, fullName, role } = req.body;

    // Validate required fields
    if (!email || !fullName || !role) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email, full name, and role are required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate role
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Role must be either "user" or "admin"',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      await prisma.$disconnect();
      return res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email already exists',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Generate a temporary password
    const { authService } = await import('../services/auth.service.js');
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    const passwordHash = await authService.hashPassword(tempPassword);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        fullName,
        role,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await prisma.$disconnect();

    return res.status(201).json({
      user: newUser,
      tempPassword, // In production, this would be sent via email instead
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while creating user',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;

/**
 * PUT /api/users/:id
 * Update user role and active status (admin only)
 * Validates Requirements 1.8
 */
router.put('/:id', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;

    // Validate that at least one field is provided
    if (role === undefined && isActive === undefined) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one field (role or isActive) must be provided',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate role if provided
    if (role !== undefined && !['user', 'admin'].includes(role)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Role must be either "user" or "admin"',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate isActive if provided
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'isActive must be a boolean',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      await prisma.$disconnect();
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Build update data
    const updateData: any = {};
    if (role !== undefined) {
      updateData.role = role;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.$disconnect();

    return res.status(200).json({
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while updating user',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/users/:id/reset-password
 * Admin-initiated password reset
 * Generate secure temporary password
 * Validates Requirements 1.9
 */
router.post('/:id/reset-password', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      await prisma.$disconnect();
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Generate a secure temporary password (24 characters with mixed alphanumeric)
    const { authService } = await import('../services/auth.service.js');
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    const passwordHash = await authService.hashPassword(tempPassword);

    // Update user password and reset failed login attempts
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
      },
    });

    await prisma.$disconnect();

    return res.status(200).json({
      message: 'Password reset successfully',
      tempPassword, // In production, this would be sent via email instead
      userId: id,
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while resetting password',
        timestamp: new Date().toISOString(),
      },
    });
  }
});
