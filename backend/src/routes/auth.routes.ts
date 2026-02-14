import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service.js';

const router = Router();

/**
 * POST /api/auth/login
 * Validates credentials, checks account status, handles failed login attempts
 * Returns JWT token on success
 * Validates Requirements 1.1, 1.2, 1.3
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Attempt login
    const result = await authService.login(email, password);

    return res.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error cases
    if (errorMessage === 'Invalid credentials') {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (errorMessage.includes('Account is locked')) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: errorMessage,
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (errorMessage === 'Account is deactivated') {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your account has been deactivated. Please contact an administrator.',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Generic server error
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred during login',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate session (if using token blacklist)
 * Validates Requirements 1.1
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
      await authService.logout(token);
    }

    return res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred during logout',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Generate time-limited reset token
 * Send reset email (mock email service for now)
 * Validates Requirements 1.4
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Request password reset
    await authService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    return res.status(200).json({
      message: 'If the email exists, a password reset link has been sent',
    });
  } catch (error) {
    // Always return success to prevent email enumeration
    return res.status(200).json({
      message: 'If the email exists, a password reset link has been sent',
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Verify reset token and update password
 * Validates Requirements 1.4
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Token and new password are required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate password strength (basic check)
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 8 characters long',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Reset password
    await authService.resetPassword(token, newPassword);

    return res.status(200).json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage === 'Token expired' || errorMessage === 'Invalid token') {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired reset token',
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred during password reset',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;
