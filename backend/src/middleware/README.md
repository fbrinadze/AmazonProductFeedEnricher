# Authentication and Authorization Middleware

This directory contains middleware for JWT authentication and role-based authorization.

## Middleware Functions

### `authenticateJWT`

Verifies JWT tokens from the Authorization header and attaches the user to the request object.

**Usage:**
```typescript
import { authenticateJWT } from '../middleware/auth.middleware.js';

router.get('/protected', authenticateJWT, (req, res) => {
  // req.user is now available
  res.json({ user: req.user });
});
```

**Behavior:**
- Extracts JWT token from `Authorization: Bearer <token>` header
- Verifies token signature and expiration
- Loads user from database
- Checks if user account is active
- Attaches user object to `req.user`
- Returns 401 for missing/invalid tokens
- Returns 403 for deactivated accounts

**Validates Requirements:** 1.5

### `requireRole(...allowedRoles)`

Factory function that creates middleware to check if the authenticated user has one of the allowed roles.

**Usage:**
```typescript
import { authenticateJWT, requireRole } from '../middleware/auth.middleware.js';

// Single role
router.get('/admin-only', authenticateJWT, requireRole('admin'), handler);

// Multiple roles
router.get('/staff', authenticateJWT, requireRole('admin', 'moderator'), handler);
```

**Behavior:**
- Must be used after `authenticateJWT`
- Checks if `req.user.role` is in the allowed roles list
- Returns 403 if user doesn't have required role
- Calls `next()` if user has required role

**Validates Requirements:** 1.6

### `requireAdmin`

Convenience middleware for admin-only routes. Equivalent to `requireRole('admin')`.

**Usage:**
```typescript
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware.js';

router.get('/admin-panel', authenticateJWT, requireAdmin, handler);
```

**Validates Requirements:** 1.6

### `requireAuth`

Alias for `authenticateJWT`. Use for better readability.

**Usage:**
```typescript
import { requireAuth } from '../middleware/auth.middleware.js';

router.get('/profile', requireAuth, handler);
```

## Error Responses

All middleware functions return standardized error responses:

```typescript
{
  error: {
    code: string,        // Error code (e.g., 'AUTHENTICATION_REQUIRED')
    message: string,     // Human-readable error message
    timestamp: string    // ISO 8601 timestamp
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | No token provided |
| `INVALID_TOKEN_FORMAT` | 401 | Token not in Bearer format |
| `INVALID_TOKEN` | 401 | Token signature invalid |
| `TOKEN_EXPIRED` | 401 | Token has expired |
| `USER_NOT_FOUND` | 401 | User in token doesn't exist |
| `ACCOUNT_DEACTIVATED` | 403 | User account is deactivated |
| `INSUFFICIENT_PERMISSIONS` | 403 | User doesn't have required role |
| `AUTHENTICATION_FAILED` | 401 | Generic authentication error |

## Request Type Extension

The middleware extends the Express Request type to include the user:

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: User;  // Prisma User model
    }
  }
}
```

## Examples

### Basic Protected Route
```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/profile', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
```

### Admin-Only Route
```typescript
import { Router } from 'express';
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.delete('/users/:id', authenticateJWT, requireAdmin, async (req, res) => {
  // Only admins can delete users
  await deleteUser(req.params.id);
  res.json({ message: 'User deleted' });
});
```

### Multiple Role Access
```typescript
import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/reports', authenticateJWT, requireRole('admin', 'manager'), (req, res) => {
  // Both admins and managers can access reports
  res.json({ reports: [] });
});
```

## Testing

Tests are located in `auth.middleware.test.ts` and cover:
- Valid token authentication
- Missing/invalid token rejection
- Expired token handling
- Deactivated user rejection
- Role-based authorization
- User object attachment to request

Run tests with:
```bash
npm test -- auth.middleware.test.ts
```

Note: Tests require a running PostgreSQL database.
