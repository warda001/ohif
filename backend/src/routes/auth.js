const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const database = require('../database');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');
const { generateTwoFactorSecret, verifyTwoFactor } = require('../services/twoFactorService');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      organization_id: user.organization_id 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Generate refresh token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

// User registration
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('first_name').notEmpty().trim(),
  body('last_name').notEmpty().trim(),
  body('organization_code').notEmpty().trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { email, password, first_name, last_name, organization_code } = req.body;

    // Check if organization exists
    const organization = await database('organizations')
      .where('code', organization_code)
      .where('is_active', true)
      .first();

    if (!organization) {
      return next(new AppError('Invalid organization code', 400));
    }

    // Check if user already exists
    const existingUser = await database('users')
      .where('email', email)
      .first();

    if (existingUser) {
      return next(new AppError('User already exists', 409));
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const [user] = await database('users')
      .insert({
        email,
        password_hash: hashedPassword,
        first_name,
        last_name,
        organization_id: organization.id,
        role: 'viewer', // Default role
        verification_token: jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' })
      })
      .returning('*');

    // Send verification email
    await sendEmail({
      to: email,
      subject: 'Verify your account',
      template: 'verification',
      data: {
        name: `${first_name} ${last_name}`,
        verification_link: `${process.env.FRONTEND_URL}/verify-email?token=${user.verification_token}`
      }
    });

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });

  } catch (error) {
    next(error);
  }
});

// User login
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Invalid credentials', 401));
    }

    const { email, password, two_factor_code } = req.body;

    // Find user with organization
    const user = await database('users')
      .select('users.*', 'organizations.name as organization_name')
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
      .where('users.email', email)
      .where('users.is_active', true)
      .first();

    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if account is verified
    if (!user.is_verified) {
      return next(new AppError('Please verify your email address first', 401));
    }

    // Check two-factor authentication
    if (user.two_factor_enabled) {
      if (!two_factor_code) {
        return res.status(202).json({
          message: 'Two-factor authentication required',
          requires_2fa: true
        });
      }

      const isValidTwoFactor = verifyTwoFactor(user.two_factor_secret, two_factor_code);
      if (!isValidTwoFactor) {
        return next(new AppError('Invalid two-factor code', 401));
      }
    }

    // Update last login
    await database('users')
      .where('id', user.id)
      .update({ last_login: new Date() });

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        preferences: user.preferences,
        rating_average: user.rating_average
      },
      token,
      refresh_token: refreshToken
    });

  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return next(new AppError('Refresh token required', 401));
    }

    const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);
    const user = await database('users')
      .where('id', decoded.id)
      .where('is_active', true)
      .first();

    if (!user) {
      return next(new AppError('Invalid refresh token', 401));
    }

    const token = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      token,
      refresh_token: newRefreshToken
    });

  } catch (error) {
    next(new AppError('Invalid refresh token', 401));
  }
});

// Logout
router.post('/logout', authenticate, (req, res) => {
  // In a real implementation, you might want to blacklist the token
  res.json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await database('users')
      .select('users.*', 'organizations.name as organization_name')
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
      .where('users.id', req.user.id)
      .first();

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        preferences: user.preferences,
        rating_average: user.rating_average,
        two_factor_enabled: user.two_factor_enabled
      }
    });

  } catch (error) {
    next(error);
  }
});

// Email verification
router.post('/verify-email', [
  body('token').notEmpty()
], async (req, res, next) => {
  try {
    const { token } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await database('users')
      .where('verification_token', token)
      .first();

    if (!user) {
      return next(new AppError('Invalid verification token', 400));
    }

    await database('users')
      .where('id', user.id)
      .update({
        is_verified: true,
        verification_token: null,
        verification_token_expires: null
      });

    res.json({ message: 'Email verified successfully' });

  } catch (error) {
    next(new AppError('Invalid or expired verification token', 400));
  }
});

// Password reset request
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await database('users')
      .where('email', email)
      .first();

    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: 'If the email exists, a reset link has been sent.' });
    }

    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await database('users')
      .where('id', user.id)
      .update({
        reset_token: resetToken,
        reset_token_expires: new Date(Date.now() + 3600000) // 1 hour
      });

    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      data: {
        name: `${user.first_name} ${user.last_name}`,
        reset_link: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      }
    });

    res.json({ message: 'If the email exists, a reset link has been sent.' });

  } catch (error) {
    next(error);
  }
});

// Password reset
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 })
], async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await database('users')
      .where('reset_token', token)
      .where('reset_token_expires', '>', new Date())
      .first();

    if (!user) {
      return next(new AppError('Invalid or expired reset token', 400));
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await database('users')
      .where('id', user.id)
      .update({
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
        password_changed_at: new Date()
      });

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    next(new AppError('Invalid or expired reset token', 400));
  }
});

module.exports = router;