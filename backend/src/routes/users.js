const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const database = require('../database');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize, checkResourceAccess } = require('../middleware/auth');
const { generateSecret, enableTwoFactor, disableTwoFactor, getTwoFactorInfo } = require('../services/twoFactorService');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all users (admin and manager only)
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;
    const offset = (page - 1) * limit;
    
    let query = database('users')
      .select('users.*', 'organizations.name as organization_name')
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
      .where('users.organization_id', req.user.organization_id);

    // Apply filters
    if (search) {
      query = query.where(function() {
        this.where('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`);
      });
    }

    if (role) {
      query = query.where('users.role', role);
    }

    if (status) {
      query = query.where('users.is_active', status === 'active');
    }

    // Get total count
    const totalQuery = query.clone();
    const [{ count }] = await totalQuery.count('* as count');

    // Get paginated results
    const users = await query
      .orderBy('users.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Remove sensitive data
    const sanitizedUsers = users.map(user => {
      const { password_hash, two_factor_secret, reset_token, verification_token, ...sanitized } = user;
      return sanitized;
    });

    res.json({
      users: sanitizedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', checkResourceAccess('user'), async (req, res, next) => {
  try {
    const user = await database('users')
      .select('users.*', 'organizations.name as organization_name')
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
      .where('users.id', req.params.id)
      .where('users.organization_id', req.user.organization_id)
      .first();

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Remove sensitive data
    const { password_hash, two_factor_secret, reset_token, verification_token, ...sanitizedUser } = user;
    
    // Add 2FA info
    const twoFactorInfo = await getTwoFactorInfo(user.id);
    sanitizedUser.two_factor_info = twoFactorInfo;

    res.json({ user: sanitizedUser });
  } catch (error) {
    next(error);
  }
});

// Create new user (admin only)
router.post('/', authorize('admin'), [
  body('email').isEmail().normalizeEmail(),
  body('first_name').notEmpty().trim(),
  body('last_name').notEmpty().trim(),
  body('role').isIn(['admin', 'radiologist', 'manager', 'technician', 'viewer']),
  body('password').optional().isLength({ min: 8 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { email, first_name, last_name, role, password, phone, specialization } = req.body;

    // Check if user already exists
    const existingUser = await database('users')
      .where('email', email)
      .first();

    if (existingUser) {
      return next(new AppError('User already exists', 409));
    }

    // Generate password if not provided
    const userPassword = password || Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(userPassword, 12);

    // Create user
    const [user] = await database('users')
      .insert({
        organization_id: req.user.organization_id,
        email,
        password_hash: hashedPassword,
        first_name,
        last_name,
        role,
        phone,
        specialization,
        is_active: true,
        is_verified: true // Admin-created users are auto-verified
      })
      .returning('*');

    // Send welcome email
    await sendEmail({
      to: email,
      subject: 'Welcome to Radiology Platform',
      template: 'welcome',
      data: {
        name: `${first_name} ${last_name}`,
        email: email,
        password: userPassword,
        login_url: `${process.env.FRONTEND_URL}/login`
      }
    });

    // Remove sensitive data
    const { password_hash, two_factor_secret, reset_token, verification_token, ...sanitizedUser } = user;

    res.status(201).json({
      message: 'User created successfully',
      user: sanitizedUser
    });
  } catch (error) {
    next(error);
  }
});

// Update user
router.put('/:id', checkResourceAccess('user'), [
  body('email').optional().isEmail().normalizeEmail(),
  body('first_name').optional().notEmpty().trim(),
  body('last_name').optional().notEmpty().trim(),
  body('role').optional().isIn(['admin', 'radiologist', 'manager', 'technician', 'viewer'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { email, first_name, last_name, role, phone, specialization, is_active, preferences } = req.body;
    const userId = req.params.id;

    // Check if user exists
    const user = await database('users')
      .where('id', userId)
      .where('organization_id', req.user.organization_id)
      .first();

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Only admin can change roles and active status
    const updates = {};
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (phone !== undefined) updates.phone = phone;
    if (specialization !== undefined) updates.specialization = specialization;
    if (preferences !== undefined) updates.preferences = preferences;

    if (req.user.role === 'admin') {
      if (role !== undefined) updates.role = role;
      if (is_active !== undefined) updates.is_active = is_active;
    }

    // Check if email is changing
    if (email && email !== user.email) {
      const existingUser = await database('users')
        .where('email', email)
        .where('id', '!=', userId)
        .first();

      if (existingUser) {
        return next(new AppError('Email already in use', 409));
      }

      updates.email = email;
      updates.is_verified = false; // Require re-verification
    }

    // Update user
    await database('users')
      .where('id', userId)
      .update({
        ...updates,
        updated_at: new Date()
      });

    // Get updated user
    const updatedUser = await database('users')
      .select('users.*', 'organizations.name as organization_name')
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
      .where('users.id', userId)
      .first();

    // Remove sensitive data
    const { password_hash, two_factor_secret, reset_token, verification_token, ...sanitizedUser } = updatedUser;

    res.json({
      message: 'User updated successfully',
      user: sanitizedUser
    });
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/:id', authorize('admin'), checkResourceAccess('user'), async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const user = await database('users')
      .where('id', userId)
      .where('organization_id', req.user.organization_id)
      .first();

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Soft delete (set is_active to false)
    await database('users')
      .where('id', userId)
      .update({
        is_active: false,
        deleted_at: new Date()
      });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Change password
router.put('/:id/password', checkResourceAccess('user'), [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { current_password, new_password } = req.body;
    const userId = req.params.id;

    // Only users can change their own password (or admin)
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return next(new AppError('Access denied', 403));
    }

    // Get user
    const user = await database('users')
      .where('id', userId)
      .first();

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Verify current password (skip for admin)
    if (req.user.role !== 'admin') {
      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!isValidPassword) {
        return next(new AppError('Invalid current password', 400));
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 12);

    // Update password
    await database('users')
      .where('id', userId)
      .update({
        password_hash: hashedPassword,
        password_changed_at: new Date()
      });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Enable 2FA
router.post('/:id/2fa/enable', checkResourceAccess('user'), async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Only users can enable their own 2FA
    if (userId !== req.user.id) {
      return next(new AppError('Access denied', 403));
    }

    // Generate 2FA secret
    const twoFactorData = await generateSecret(userId, req.user.email);

    res.json({
      message: '2FA setup initiated',
      ...twoFactorData
    });
  } catch (error) {
    next(error);
  }
});

// Confirm 2FA setup
router.post('/:id/2fa/confirm', checkResourceAccess('user'), [
  body('token').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { token } = req.body;
    const userId = req.params.id;

    // Only users can confirm their own 2FA
    if (userId !== req.user.id) {
      return next(new AppError('Access denied', 403));
    }

    // Enable 2FA
    await enableTwoFactor(userId, token);

    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    next(error);
  }
});

// Disable 2FA
router.post('/:id/2fa/disable', checkResourceAccess('user'), [
  body('token').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { token } = req.body;
    const userId = req.params.id;

    // Only users can disable their own 2FA
    if (userId !== req.user.id) {
      return next(new AppError('Access denied', 403));
    }

    // Disable 2FA
    await disableTwoFactor(userId, token);

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    next(error);
  }
});

// Get user statistics
router.get('/:id/stats', checkResourceAccess('user'), async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Get user statistics
    const stats = await database('users')
      .where('id', userId)
      .select(
        'rating_average',
        'rating_count'
      )
      .first();

    // Get additional stats for radiologists
    if (req.user.role === 'radiologist') {
      const studyStats = await database('studies')
        .where('assigned_radiologist_id', userId)
        .select(
          database.raw('COUNT(*) as total_studies'),
          database.raw('COUNT(CASE WHEN status = ? THEN 1 END) as completed_studies', ['completed']),
          database.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending_studies', ['assigned']),
          database.raw('COUNT(CASE WHEN is_stat = true THEN 1 END) as stat_studies')
        )
        .first();

      const reportStats = await database('reports')
        .where('radiologist_id', userId)
        .select(
          database.raw('COUNT(*) as total_reports'),
          database.raw('COUNT(CASE WHEN status = ? THEN 1 END) as finalized_reports', ['finalized']),
          database.raw('AVG(EXTRACT(EPOCH FROM (finalized_at - created_at))/3600) as avg_turnaround_hours')
        )
        .first();

      stats.study_stats = studyStats;
      stats.report_stats = reportStats;
    }

    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

// Get user activity
router.get('/:id/activity', checkResourceAccess('user'), async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get recent activities from audit logs
    const activities = await database('audit_logs')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({ activities });
  } catch (error) {
    next(error);
  }
});

module.exports = router;