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
  // This endpoint will be fully implemented in task 6.2
  return res.status(200).json({
    message: 'User list endpoint - to be implemented',
    users: [],
  });
});

/**
 * POST /api/users
 * Create new user (admin only)
 * Validates Requirements 1.7
 */
router.post('/', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  // This endpoint will be fully implemented in task 6.2
  return res.status(201).json({
    message: 'User creation endpoint - to be implemented',
  });
});

export default router;
