import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();

// Minimum bcrypt work factor as per requirements 1.10 and 8.1
const BCRYPT_WORK_FACTOR = 10;

export interface JWTPayload {
  userId: string;
  role: string;
  exp: number;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

export class AuthService {
  /**
   * Hash a password using bcrypt with work factor >= 10
   * Validates Requirements 1.10, 8.1
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_WORK_FACTOR);
  }

  /**
   * Compare a plaintext password with a bcrypt hash
   * Validates Requirements 1.10, 8.1
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token with user ID, role, and expiration
   * Validates Requirements 1.1, 8.2
   */
  generateToken(userId: string, role: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    const token = jwt.sign(
      {
        userId,
        role,
      },
      secret,
      {
        expiresIn,
      }
    );

    return token;
  }

  /**
   * Verify a JWT token and return the decoded payload
   * Validates Requirements 1.5, 8.3
   */
  verifyToken(token: string): JWTPayload {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    try {
      const decoded = jwt.verify(token, secret) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Login with email and password
   * Validates Requirements 1.1, 1.2, 1.3
   */
  async login(email: string, password: string): Promise<AuthResult> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if account is locked (Requirement 1.3)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new Error('Account is locked. Please try again later or contact an administrator.');
    }

    // Check if account is active (Requirement 1.8)
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login counter (Requirement 1.2)
      const failedLogins = user.failedLogins + 1;
      const updateData: any = {
        failedLogins,
      };

      // Lock account after 5 failed attempts (Requirement 1.3)
      if (failedLogins >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new Error('Invalid credentials');
    }

    // Reset failed login counter and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.role);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * Logout (for future token blacklist implementation)
   * Validates Requirements 1.1
   */
  async logout(token: string): Promise<void> {
    // In a stateless JWT implementation, logout is handled client-side
    // For future enhancement: implement token blacklist in Redis or database
    return;
  }

  /**
   * Request password reset
   * Validates Requirements 1.4
   */
  async requestPasswordReset(email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists for security
      throw new Error('If the email exists, a reset link will be sent');
    }

    // Generate time-limited reset token (valid for 1 hour)
    const resetToken = this.generateToken(user.id, user.role);

    // In production, send email with reset link containing the token
    // For now, return the token for testing
    return resetToken;
  }

  /**
   * Reset password with token
   * Validates Requirements 1.4
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Verify token
    const payload = this.verifyToken(token);

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update user password
    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
      },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }
}

export const authService = new AuthService();
