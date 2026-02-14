import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { User } from '@prisma/client';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * JWT verification middleware
 * Extracts and verifies JWT from Authorization header
 * Attaches user to request object
 * Validates Requirements 1.5
 */
export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'No authorization token provided',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check for Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Authorization header must use Bearer token format',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'No token provided',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Verify token
    const payload = authService.verifyToken(token);

    // Get user from database
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your account has been deactivated',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Attach user to request object
    req.user = user;

    // Continue to next middleware
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage === 'Token expired') {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired. Please login again.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (errorMessage === 'Invalid token') {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Generic authentication error
    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Role-based authorization middleware factory
 * Checks user role against required role for endpoint
 * Validates Requirements 1.6
 * 
 * @param allowedRoles - Array of roles that are allowed to access the endpoint
 * @returns Express middleware function
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Ensure user is authenticated first
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // User has required role, continue
    next();
  };
}

/**
 * Convenience middleware for admin-only routes
 * Validates Requirements 1.6
 */
export const requireAdmin = requireRole('admin');

/**
 * Convenience middleware for authenticated users (any role)
 * Validates Requirements 1.5
 */
export const requireAuth = authenticateJWT;
