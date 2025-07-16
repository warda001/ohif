const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get organization details
router.get('/', async (req, res, next) => {
  try {
    const organization = await database('organizations')
      .where('id', req.user.organization_id)
      .first();

    if (!organization) {
      return next(new AppError('Organization not found', 404));
    }

    res.json({ organization });
  } catch (error) {
    next(error);
  }
});

// Update organization (admin only)
router.put('/', authorize('admin'), [
  body('name').optional().notEmpty(),
  body('email').optional().isEmail(),
  body('phone').optional().notEmpty(),
  body('address').optional().notEmpty(),
  body('city').optional().notEmpty(),
  body('state').optional().notEmpty(),
  body('country').optional().notEmpty(),
  body('postal_code').optional().notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      country,
      postal_code,
      website,
      settings
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (country !== undefined) updates.country = country;
    if (postal_code !== undefined) updates.postal_code = postal_code;
    if (website !== undefined) updates.website = website;
    if (settings !== undefined) updates.settings = settings;

    await database('organizations')
      .where('id', req.user.organization_id)
      .update({
        ...updates,
        updated_at: new Date()
      });

    const updatedOrganization = await database('organizations')
      .where('id', req.user.organization_id)
      .first();

    res.json({
      message: 'Organization updated successfully',
      organization: updatedOrganization
    });
  } catch (error) {
    next(error);
  }
});

// Get organization statistics
router.get('/stats', async (req, res, next) => {
  try {
    const organizationId = req.user.organization_id;

    const stats = await database('studies')
      .where('organization_id', organizationId)
      .select(
        database.raw('COUNT(*) as total_studies'),
        database.raw('COUNT(CASE WHEN status = ? THEN 1 END) as unread_studies', ['unread']),
        database.raw('COUNT(CASE WHEN status = ? THEN 1 END) as assigned_studies', ['assigned']),
        database.raw('COUNT(CASE WHEN status = ? THEN 1 END) as in_progress_studies', ['in_progress']),
        database.raw('COUNT(CASE WHEN status = ? THEN 1 END) as completed_studies', ['completed']),
        database.raw('COUNT(CASE WHEN is_stat = true THEN 1 END) as stat_studies'),
        database.raw('AVG(CASE WHEN completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 END) as avg_turnaround_hours')
      )
      .first();

    const userStats = await database('users')
      .where('organization_id', organizationId)
      .where('is_active', true)
      .select(
        database.raw('COUNT(*) as total_users'),
        database.raw('COUNT(CASE WHEN role = ? THEN 1 END) as radiologists', ['radiologist']),
        database.raw('COUNT(CASE WHEN role = ? THEN 1 END) as managers', ['manager']),
        database.raw('COUNT(CASE WHEN role = ? THEN 1 END) as technicians', ['technician']),
        database.raw('COUNT(CASE WHEN role = ? THEN 1 END) as admins', ['admin'])
      )
      .first();

    const reportStats = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('studies.organization_id', organizationId)
      .select(
        database.raw('COUNT(*) as total_reports'),
        database.raw('COUNT(CASE WHEN reports.status = ? THEN 1 END) as finalized_reports', ['finalized']),
        database.raw('COUNT(CASE WHEN reports.status = ? THEN 1 END) as draft_reports', ['draft']),
        database.raw('AVG(CASE WHEN reports.finalized_at IS NOT NULL THEN EXTRACT(EPOCH FROM (reports.finalized_at - reports.created_at))/3600 END) as avg_reporting_hours')
      )
      .first();

    res.json({
      stats: {
        ...stats,
        ...userStats,
        ...reportStats
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get organization users
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (page - 1) * limit;

    let query = database('users')
      .where('organization_id', req.user.organization_id)
      .where('is_active', true);

    if (role) {
      query = query.where('role', role);
    }

    if (search) {
      query = query.where(function() {
        this.where('first_name', 'ilike', `%${search}%`)
          .orWhere('last_name', 'ilike', `%${search}%`)
          .orWhere('email', 'ilike', `%${search}%`);
      });
    }

    const [{ count }] = await query.clone().count('* as count');

    const users = await query
      .select('id', 'first_name', 'last_name', 'email', 'role', 'created_at', 'last_login')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      users,
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

module.exports = router;