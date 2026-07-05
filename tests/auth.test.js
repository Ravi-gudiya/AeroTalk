import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { hashPassword, comparePassword, generateToken, authenticateToken } from '../backend/auth.js';

describe('Auth Layer Unit Tests', () => {
  it('should hash and compare passwords correctly', async () => {
    const password = 'mySuperSecurePassword';
    const hash = await hashPassword(password);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);

    const match = await comparePassword(password, hash);
    expect(match).toBe(true);

    const mismatch = await comparePassword('wrongPassword', hash);
    expect(mismatch).toBe(false);
  });

  it('should generate valid JWT tokens', () => {
    const user = { email: 'test@email.com', username: 'testuser' };
    const token = generateToken(user);
    expect(token).toBeDefined();

    const decoded = jwt.verify(token, 'aerotalk-super-secret-key-13579');
    expect(decoded.email).toBe(user.email);
    expect(decoded.username).toBe(user.username);
  });

  it('should authenticate valid token in middleware', () => {
    const token = generateToken({ email: 'test@email.com', username: 'testuser' });
    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticateToken(req, res, next);
    expect(req.user).toBeDefined();
    expect(req.user.email).toBe('test@email.com');
    expect(next).toHaveBeenCalled();
  });

  it('should reject requests missing token', () => {
    const req = { headers: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access token missing' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject invalid or expired tokens', () => {
    const req = {
      headers: {
        authorization: 'Bearer invalid-token-data'
      }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });
});
