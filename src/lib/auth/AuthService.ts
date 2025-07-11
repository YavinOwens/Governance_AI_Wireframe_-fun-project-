import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import dbManager from '../database/connection';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth.log' })
  ]
});

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organization?: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface AuthToken {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly bcryptRounds: number;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');

    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET not set in environment variables. Using default value.');
    }
  }

  /**
   * Register a new user
   */
  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organization?: string;
    role?: string;
  }): Promise<{ user: User; token: string }> {
    try {
      const { email, password, firstName, lastName, organization, role = 'user' } = userData;

      // Check if user already exists
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.bcryptRounds);

      // Insert user into database
      const query = `
        INSERT INTO users (email, password_hash, first_name, last_name, role, organization, is_active, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, true, false)
        RETURNING id, email, first_name, last_name, role, organization, is_active, email_verified, created_at
      `;

      const result = await dbManager.query(query, [
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        organization
      ]);

      const user = this.mapDbUserToUser(result.rows[0]);
      const token = this.generateToken(user);

      logger.info(`User registered successfully: ${email}`);
      return { user, token };

    } catch (error) {
      logger.error('User registration failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate user login
   */
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    try {
      // Get user from database
      const user = await this.getUserByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Get password hash from database
      const query = 'SELECT password_hash FROM users WHERE email = $1';
      const result = await dbManager.query(query, [email]);
      
      if (!result.rows.length) {
        throw new Error('Invalid email or password');
      }

      const passwordHash = result.rows[0].password_hash;

      // Verify password
      const isValidPassword = await bcrypt.compare(password, passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await this.updateLastLogin(user.id);

      // Generate token
      const token = this.generateToken(user);

      logger.info(`User logged in successfully: ${email}`);
      return { user, token };

    } catch (error) {
      logger.error('User login failed:', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const query = `
        SELECT id, email, first_name, last_name, role, organization, 
               is_active, email_verified, created_at, last_login
        FROM users 
        WHERE email = $1
      `;
      
      const result = await dbManager.query(query, [email]);
      
      if (!result.rows.length) {
        return null;
      }

      return this.mapDbUserToUser(result.rows[0]);

    } catch (error) {
      logger.error('Get user by email failed:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const query = `
        SELECT id, email, first_name, last_name, role, organization, 
               is_active, email_verified, created_at, last_login
        FROM users 
        WHERE id = $1
      `;
      
      const result = await dbManager.query(query, [userId]);
      
      if (!result.rows.length) {
        return null;
      }

      return this.mapDbUserToUser(result.rows[0]);

    } catch (error) {
      logger.error('Get user by ID failed:', error);
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Get current password hash
      const query = 'SELECT password_hash FROM users WHERE id = $1';
      const result = await dbManager.query(query, [userId]);
      
      if (!result.rows.length) {
        throw new Error('User not found');
      }

      const currentPasswordHash = result.rows[0].password_hash;

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, currentPasswordHash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.bcryptRounds);

      // Update password
      const updateQuery = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
      await dbManager.query(updateQuery, [newPasswordHash, userId]);

      logger.info(`Password updated for user: ${userId}`);

    } catch (error) {
      logger.error('Password update failed:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    organization?: string;
  }): Promise<User> {
    try {
      const allowedFields = ['first_name', 'last_name', 'organization'];
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCounter = 1;

      // Build dynamic update query
      Object.entries(updates).forEach(([key, value]) => {
        const dbField = key === 'firstName' ? 'first_name' : 
                       key === 'lastName' ? 'last_name' : key;
        
        if (allowedFields.includes(dbField) && value !== undefined) {
          updateFields.push(`${dbField} = $${paramCounter}`);
          updateValues.push(value);
          paramCounter++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(userId);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCounter}
        RETURNING id, email, first_name, last_name, role, organization, 
                  is_active, email_verified, created_at, last_login
      `;

      const result = await dbManager.query(query, updateValues);
      
      if (!result.rows.length) {
        throw new Error('User not found');
      }

      const user = this.mapDbUserToUser(result.rows[0]);
      logger.info(`Profile updated for user: ${userId}`);
      
      return user;

    } catch (error) {
      logger.error('Profile update failed:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<AuthToken> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AuthToken;
      
      // Check if user still exists and is active
      const user = await this.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return decoded;

    } catch (error) {
      logger.error('Token verification failed:', error);
      throw new Error('Invalid token');
    }
  }

  /**
   * Update last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
    await dbManager.query(query, [userId]);
  }

  /**
   * Map database user to User interface
   */
  private mapDbUserToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      role: dbUser.role,
      organization: dbUser.organization,
      isActive: dbUser.is_active,
      emailVerified: dbUser.email_verified,
      createdAt: dbUser.created_at,
      lastLogin: dbUser.last_login
    };
  }

  /**
   * Check if user has required role
   */
  hasRole(user: User, requiredRole: string): boolean {
    const roleHierarchy = {
      'admin': 3,
      'manager': 2,
      'user': 1
    };

    const userLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

    return userLevel >= requiredLevel;
  }

  /**
   * Middleware to authenticate requests
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7);
      const decoded = await this.verifyToken(token);
      
      // Add user info to request
      (req as any).user = decoded;
      
      next();

    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  /**
   * Middleware to authorize based on role
   */
  authorize = (requiredRole: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userToken = (req as any).user as AuthToken;
        
        if (!userToken) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const user = await this.getUserById(userToken.userId);
        
        if (!user || !this.hasRole(user, requiredRole)) {
          res.status(403).json({ error: 'Insufficient permissions' });
          return;
        }

        next();

      } catch (error) {
        res.status(403).json({ error: 'Authorization failed' });
      }
    };
  };
}

// Singleton instance
const authService = new AuthService();
export default authService; 