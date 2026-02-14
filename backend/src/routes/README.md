# Authentication API Routes

This document describes the authentication API endpoints implemented for the Amazon Product Data Enrichment Tool.

## Endpoints

### POST /api/auth/login
Authenticates a user with email and password credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "User Name",
    "role": "user"
  }
}
```

**Error Responses:**
- `400` - Missing email or password
- `401` - Invalid credentials
- `403` - Account locked (after 5 failed attempts) or deactivated
- `500` - Server error

**Features:**
- Validates credentials against database
- Checks account status (active/deactivated)
- Handles account locking after 5 failed login attempts
- Resets failed login counter on successful login
- Updates last login timestamp
- Returns JWT token with user information

### POST /api/auth/logout
Logs out the current user (stateless JWT implementation).

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

**Notes:**
- Currently stateless (client-side logout)
- Token parameter is optional
- Future enhancement: implement token blacklist

### POST /api/auth/forgot-password
Initiates password reset process by generating a time-limited reset token.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Error Responses:**
- `400` - Missing email

**Features:**
- Generates time-limited JWT token for password reset
- Returns success message regardless of email existence (prevents enumeration)
- In production: sends email with reset link
- Currently: returns token for testing purposes

### POST /api/auth/reset-password
Resets user password using a valid reset token.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newpassword123"
}
```

**Success Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

**Error Responses:**
- `400` - Missing token or password, or password too short (< 8 characters)
- `401` - Invalid or expired token
- `500` - Server error

**Features:**
- Verifies reset token validity
- Validates password strength (minimum 8 characters)
- Hashes new password with bcrypt
- Resets failed login counter
- Clears account lock status

## Testing

### Prerequisites
1. PostgreSQL database must be running
2. Database must be migrated: `npm run prisma:migrate`
3. Database should be seeded: `npm run prisma:seed`

### Running Tests
```bash
# Run all tests
npm test

# Run only auth route tests
npm test -- auth.routes.test.ts

# Run tests in watch mode
npm run test:watch
```

### Test Coverage
The test suite includes:
- Valid credential authentication
- Invalid credential rejection
- Missing field validation
- Account locking after 5 failed attempts
- Deactivated account rejection
- Failed login counter reset
- Logout functionality
- Password reset request
- Password reset with valid/invalid tokens
- Password strength validation

## Requirements Validated

- **Requirement 1.1**: JWT token authentication
- **Requirement 1.2**: Invalid credential rejection and failed login tracking
- **Requirement 1.3**: Account locking after 5 failed attempts
- **Requirement 1.4**: Password reset with time-limited tokens
- **Requirement 1.5**: Protected resource authentication
- **Requirement 1.8**: Deactivated account handling

## Security Features

1. **Password Hashing**: All passwords hashed with bcrypt (work factor ≥ 10)
2. **JWT Tokens**: Stateless authentication with expiration
3. **Account Locking**: Automatic lock after 5 failed attempts (30-minute timeout)
4. **Email Enumeration Prevention**: Same response for existing/non-existing emails
5. **Password Strength**: Minimum 8 characters required
6. **Token Expiration**: Reset tokens expire after configured time (default 24h)

## Error Response Format

All errors follow a consistent format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Environment Variables

Required environment variables:
- `JWT_SECRET`: Secret key for JWT signing (required)
- `JWT_EXPIRES_IN`: Token expiration time (default: "24h")
- `DATABASE_URL`: PostgreSQL connection string

## Next Steps

1. Implement authorization middleware (Task 5)
2. Implement user management endpoints (Task 6)
3. Add email service integration for password reset
4. Consider implementing token blacklist for logout
5. Add rate limiting to prevent brute force attacks
